param(
  [string]$SupabaseUrl = $env:LPQ_STAGING_SUPABASE_URL,
  [string]$ProjectRef = $env:LPQ_STAGING_PROJECT_REF,
  [string]$PublishableKey = $env:STAGING_SUPABASE_PUBLISHABLE_KEY,
  [switch]$SelfTestHeaders
)

$ErrorActionPreference = "Stop"

function ConvertFrom-SecureStringToPlainText {
  param([securestring]$Value)

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Get-EnvFileValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match "^\s*$([regex]::Escape($Key))=(.*)$") {
      return $Matches[1].Trim()
    }
  }
  return $null
}

function Assert-StagingTarget {
  param([string]$Url, [string]$Ref)

  if ([string]::IsNullOrWhiteSpace($Url) -or [string]::IsNullOrWhiteSpace($Ref)) {
    throw "Supabase URL dan Project Ref staging baru wajib diberikan secara eksplisit."
  }
  if ($Ref -notmatch '^[a-z0-9]{15,32}$') {
    throw "Format Project Ref staging tidak valid."
  }
  $uri = [Uri]$Url
  if ($uri.Scheme -ne "https" -or $uri.Host -ne "$Ref.supabase.co") {
    throw "Target staging harus cocok dengan Project Ref baru yang diberikan."
  }
}

function Get-SecretKeyKind {
  param([string]$Key)

  if (-not $Key -or $Key.Trim().Length -eq 0) {
    throw "Secret key staging wajib diisi melalui prompt tersembunyi."
  }

  $trimmed = $Key.Trim()
  if ($trimmed -like "sbp_*") {
    throw "Personal Access Token sbp_ tidak boleh digunakan. Masukkan secret/service-role key project staging."
  }
  if ($trimmed -like "sb_publishable_*") {
    throw "Publishable key tidak boleh digunakan sebagai secret/service-role key."
  }
  if ($trimmed -match "^(postgres|postgresql)://") {
    throw "Database password atau connection string tidak boleh digunakan sebagai secret/service-role key."
  }
  if ($trimmed -like "sb_secret_*") {
    return "secret"
  }
  if ($trimmed -match "^eyJ[^.]+\.[^.]+\.[^.]+$") {
    return "legacy-jwt"
  }

  throw "Format key tidak dikenali. Gunakan secret key sb_secret_... atau legacy service-role JWT."
}

function New-BackendHeaders {
  param(
    [string]$Key,
    [string]$KeyKind
  )

  $headers = @{
    apikey = $Key
    Accept = "application/json"
    "Content-Type" = "application/json"
    "User-Agent" = "LPQ-Staging-Bootstrap/1.0"
  }

  if ($KeyKind -eq "legacy-jwt") {
    $headers.Authorization = "Bearer $Key"
  }

  return $headers
}

function New-UserHeaders {
  param([string]$AccessToken)

  return @{
    apikey = $script:PublishableKey
    Authorization = "Bearer $AccessToken"
    Accept = "application/json"
    "Content-Type" = "application/json"
    "User-Agent" = "LPQ-Staging-Bootstrap/1.0"
  }
}

function Format-SafeHttpErrorBodyText {
  param([string]$Body)

  if (-not $Body) { return "" }

  $redacted = $Body -replace "Bearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [REDACTED]"
  $redacted = $redacted -replace "sb_" + "secret_[A-Za-z0-9_=-]+", "sb_secret_[REDACTED]"
  $redacted = $redacted -replace "eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[JWT_REDACTED]"

  try {
    $parsed = $redacted | ConvertFrom-Json -ErrorAction Stop
    $parts = @()
    foreach ($name in @("code", "message", "details", "hint")) {
      if ($null -ne $parsed.$name -and "$($parsed.$name)".Length -gt 0) {
        $parts += "$name=$($parsed.$name)"
      }
    }
    if ($parts.Count -gt 0) {
      $formatted = $parts -join " "
      if ($formatted.Length -gt 1200) { return $formatted.Substring(0, 1200) + "...[truncated]" }
      return $formatted
    }
  } catch {
    # Fall back to redacted raw text below.
  }

  if ($redacted.Length -gt 1200) { return $redacted.Substring(0, 1200) + "...[truncated]" }
  return $redacted
}

function Get-SafeHttpErrorBody {
  param([object]$Exception)

  try {
    $response = $Exception.Response
    if (-not $response) { return "" }

    $stream = $response.GetResponseStream()
    if (-not $stream) { return "" }

    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    if (-not $body) { return "" }

    return Format-SafeHttpErrorBodyText -Body $body
  } catch {
    return ""
  }
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body = $null,
    [string]$Step = "http_request"
  )

  $safePath = ([Uri]$Uri).AbsolutePath

  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ErrorAction Stop
    }

    $json = $Body | ConvertTo-Json -Depth 20 -Compress
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -Body $json -ContentType "application/json" -ErrorAction Stop
  } catch {
    $status = "unknown"
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $_.Exception.Response.StatusCode }
    }
    $body = Get-SafeHttpErrorBody -Exception $_.Exception
    if ($body) {
      throw "HTTP request failed. step=$Step status=$status endpoint=$safePath body=$body"
    }
    throw "HTTP request failed. step=$Step status=$status endpoint=$safePath message=$($_.Exception.Message)"
  }
}

function Invoke-ServiceRest {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Query = "",
    [hashtable]$ExtraHeaders = @{}
  )

  $headers = New-BackendHeaders -Key $script:ServiceRoleKey -KeyKind $script:ServiceRoleKeyKind
  foreach ($key in $ExtraHeaders.Keys) { $headers[$key] = $ExtraHeaders[$key] }
  return Invoke-JsonRequest -Method $Method -Uri "$SupabaseUrl/rest/v1/$Path$Query" -Headers $headers -Body $Body -Step "rest:$Method $Path"
}

function Invoke-UserRest {
  param(
    [string]$Method,
    [string]$Path,
    [string]$AccessToken,
    [object]$Body = $null,
    [string]$Query = "",
    [hashtable]$ExtraHeaders = @{}
  )

  $headers = New-UserHeaders -AccessToken $AccessToken
  foreach ($key in $ExtraHeaders.Keys) { $headers[$key] = $ExtraHeaders[$key] }
  return Invoke-JsonRequest -Method $Method -Uri "$SupabaseUrl/rest/v1/$Path$Query" -Headers $headers -Body $Body -Step "user-rest:$Method $Path"
}

function Invoke-AuthAdmin {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $headers = New-BackendHeaders -Key $script:ServiceRoleKey -KeyKind $script:ServiceRoleKeyKind
  return Invoke-JsonRequest -Method $Method -Uri "$SupabaseUrl/auth/v1$Path" -Headers $headers -Body $Body -Step "auth-admin:$Method $($Path.Split('?')[0])"
}

function Get-AuthUserByEmail {
  param([string]$Email)

  $existing = Invoke-AuthAdmin -Method "GET" -Path "/admin/users?page=1&per_page=200"
  $users = @()
  if ($existing.users) { $users = @($existing.users) }
  elseif ($existing -is [array]) { $users = @($existing) }
  return $users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
}

function Ensure-AdminUser {
  $spec = @{
    id = "b2fa7a20-0000-0000-0000-000000000001"
    email = "staging-admin@example.invalid"
    name = "Admin LPQ Al-Fath Maulana"
  }

  $found = Get-AuthUserByEmail -Email $spec.email
  if ($found) {
    if ($found.id -ne $spec.id) { throw "Existing staging admin has unexpected UUID." }
    Write-Host "Admin Auth exists: $($spec.id)"
  } else {
    $created = Invoke-AuthAdmin -Method "POST" -Path "/admin/users" -Body @{
      id = $spec.id
      email = $spec.email
      password = $script:DummyPassword
      email_confirm = $true
      user_metadata = @{
        role = "admin"
        display_name = $spec.name
      }
      app_metadata = @{
        role = "admin"
        provider = "email"
        providers = @("email")
      }
    }
    if ($created.id -ne $spec.id) { throw "Created admin returned unexpected UUID." }
    Write-Host "Created admin Auth: $($spec.id)"
  }

  try {
    Invoke-ServiceRest -Method "POST" -Path "user_profiles" -Body @{
      id = $spec.id
      role = "admin"
      display_name = $spec.name
      email = $spec.email
      status = "active"
      created_by = $spec.id
      updated_by = $spec.id
    } -ExtraHeaders @{ Prefer = "resolution=merge-duplicates,return=minimal" } | Out-Null
  } catch {
    if (-not $found) { Invoke-AuthAdmin -Method "DELETE" -Path "/admin/users/$($spec.id)" | Out-Null }
    throw
  }

  return $spec
}

function SignInWithPassword {
  param(
    [string]$Email,
    [string]$Password
  )

  $headers = @{
    apikey = $script:PublishableKey
    Accept = "application/json"
    "Content-Type" = "application/json"
    "User-Agent" = "LPQ-Staging-Bootstrap/1.0"
  }
  return Invoke-JsonRequest -Method "POST" -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Headers $headers -Body @{
    email = $Email
    password = $Password
  } -Step "auth-signin"
}

function Invoke-EdgeFunction {
  param(
    [string]$Name,
    [string]$AccessToken,
    [object]$Body
  )

  $headers = New-UserHeaders -AccessToken $AccessToken
  return Invoke-JsonRequest -Method "POST" -Uri "$SupabaseUrl/functions/v1/$Name" -Headers $headers -Body $Body -Step "edge-function:$Name"
}

function Ensure-ManagedUser {
  param(
    [string]$Role,
    [hashtable]$Profile,
    [string]$AdminToken
  )

  if ($Role -eq "santri") {
    $alias = Invoke-ServiceRest -Method "GET" -Path "auth_login_aliases" -Query "?select=auth_user_id&alias_type=eq.nomor_induk_qiroati&normalized_alias=eq.$($Profile.nomor_induk_qiroati)&limit=1"
    if ($alias -and $alias.Count -gt 0) {
      Write-Host "Managed user exists: santri"
      return $alias[0].auth_user_id
    }
  } else {
    $existing = Get-AuthUserByEmail -Email $Profile.email
    if ($existing) {
      Write-Host "Managed user exists: $Role"
      return $existing.id
    }
  }

  $created = Invoke-EdgeFunction -Name "manage-user" -AccessToken $AdminToken -Body @{
    action = "create"
    role = $Role
    initial_password = $script:DummyPassword
    profile = $Profile
  }
  Write-Host "Created managed user: $Role"
  return $created.data.user_id
}

function Upsert-ServiceRows {
  param(
    [string]$Table,
    [object]$Rows
  )

  Invoke-ServiceRest -Method "POST" -Path $Table -Body $Rows -ExtraHeaders @{ Prefer = "resolution=merge-duplicates,return=minimal" } | Out-Null
}

try {
  Assert-StagingTarget -Url $SupabaseUrl -Ref $ProjectRef

  if ($SelfTestHeaders) {
    $fakeSecret = "sb_" + "secret_fake_for_header_test"
    $secretHeaders = New-BackendHeaders -Key $fakeSecret -KeyKind (Get-SecretKeyKind $fakeSecret)
    if ($secretHeaders.ContainsKey("Authorization")) { throw "Self-test failed: sb_secret header must not include Authorization." }
    if ($secretHeaders.apikey -ne $fakeSecret) { throw "Self-test failed: sb_secret apikey missing." }
    if ($secretHeaders["User-Agent"] -ne "LPQ-Staging-Bootstrap/1.0") { throw "Self-test failed: User-Agent missing." }

    $jwt = "eyJfakeheader.eyJfakepayload.fakesignature"
    $jwtHeaders = New-BackendHeaders -Key $jwt -KeyKind (Get-SecretKeyKind $jwt)
    if ($jwtHeaders.Authorization -ne "Bearer $jwt") { throw "Self-test failed: legacy JWT must include Bearer Authorization." }
    if ($jwtHeaders.apikey -ne $jwt) { throw "Self-test failed: legacy JWT apikey missing." }

    $rejected = $false
    try { Get-SecretKeyKind "sb_publishable_fake" | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw "Self-test failed: publishable key must be rejected as secret." }

    $formatted = Format-SafeHttpErrorBodyText -Body '{"code":"PGRST102","message":"All object keys must match","details":"Object keys differ","hint":"Use null for missing optional columns."}'
    foreach ($field in @("code=PGRST102", "message=All object keys must match", "details=Object keys differ", "hint=Use null for missing optional columns.")) {
      if ($formatted -notlike "*$field*") { throw "Self-test failed: diagnostic formatter missing $field." }
    }

    Write-Host "Header self-test passed."
    exit 0
  }

  if (-not $PublishableKey) {
    $PublishableKey = Get-EnvFileValue -Path ".env.staging.local" -Key "VITE_SUPABASE_ANON_KEY"
  }
  if (-not $PublishableKey -or $PublishableKey -notmatch "^sb_publishable_") {
    throw "Staging publishable key is required through STAGING_SUPABASE_PUBLISHABLE_KEY or .env.staging.local."
  }
  $script:PublishableKey = $PublishableKey.Trim()

  $serviceSecret = Read-Host "Masukkan staging service-role key (input tersembunyi)" -AsSecureString
  $passwordSecret = Read-Host "Masukkan password dummy sementara (input tersembunyi)" -AsSecureString
  $script:ServiceRoleKey = ConvertFrom-SecureStringToPlainText -Value $serviceSecret
  $script:DummyPassword = ConvertFrom-SecureStringToPlainText -Value $passwordSecret

  $script:ServiceRoleKeyKind = Get-SecretKeyKind $script:ServiceRoleKey
  if ($script:DummyPassword.Length -lt 8) { throw "Password dummy minimal 8 karakter." }

  $admin = Ensure-AdminUser
  $adminSession = SignInWithPassword -Email $admin.email -Password $script:DummyPassword
  $adminToken = $adminSession.access_token

  $guruId = Ensure-ManagedUser -Role "guru" -AdminToken $adminToken -Profile @{
    nama_lengkap = "Staging Test Guru"
    email = "staging-test-guru@example.invalid"
    no_hp = "080000000001"
    jabatan = "Guru Staging"
  }
  $pentashihId = Ensure-ManagedUser -Role "pentashih" -AdminToken $adminToken -Profile @{
    nama_lengkap = "Staging Test Pentashih"
    email = "staging-test-pentashih@example.invalid"
    no_hp = "080000000002"
    jabatan = "Pentashih Staging"
  }

  $classId = "b2fa7a20-0000-0000-0000-000000000101"
  Upsert-ServiceRows -Table "classes" -Rows @{
    id = $classId
    nama_kelas = "STAGING TEST KELAS A"
    id_guru = $guruId
    sesi = "Sore"
    kategori = "Anak"
    is_active = $true
    created_by = $admin.id
    updated_by = $admin.id
  }

  $santriId = Ensure-ManagedUser -Role "santri" -AdminToken $adminToken -Profile @{
    nama_lengkap = "Staging Test Santri"
    nama_panggilan = "Dummy"
    nomor_induk_qiroati = "AFM-STAGING-SANTRI-01"
    kategori = "Anak"
    current_class_id = $classId
  }

  Upsert-ServiceRows -Table "santri" -Rows @{
    id = $santriId
    nomor_induk_qiroati = "AFM-STAGING-SANTRI-01"
    nama_lengkap = "Staging Test Santri"
    nama_panggilan = "Dummy"
    kategori = "Anak"
    current_class_id = $classId
    rfid_tag = "AFM-STAGING-RFID-DUMMY-01"
    status = "Aktif"
    created_by = $admin.id
    updated_by = $admin.id
  }

  Upsert-ServiceRows -Table "class_memberships" -Rows @{
    id = "b2fa7a20-0000-0000-0000-000000000102"
    santri_id = $santriId
    class_id = $classId
    start_date = "2026-06-25"
    status = "active"
    created_by = $admin.id
    updated_by = $admin.id
  }

  Upsert-ServiceRows -Table "pentashih_class_assignments" -Rows @{
    id = "b2fa7a20-0000-0000-0000-000000000103"
    pentashih_id = $pentashihId
    class_id = $classId
    scope = "class"
    is_active = $true
    starts_at = "2026-06-25"
    created_by = $admin.id
    updated_by = $admin.id
  }

  Upsert-ServiceRows -Table "hafalan_items" -Rows @{
    id = "b2fa7a20-0000-0000-0000-000000000104"
    category = "Staging Test"
    jilid = "1"
    item_name = "Doa Staging Dummy"
    item_order = 1
    is_active = $true
  }

  Upsert-ServiceRows -Table "website_content" -Rows @(
    @{
      id = "b2fa7a20-0000-0000-0000-000000000105"
      key = "global_config"
      content = @{ site_name = "LPQ Al-Fath Maulana Staging"; marker = "STAGING_DUMMY" }
      is_public = $true
      created_by = $admin.id
      updated_by = $admin.id
    },
    @{
      id = "b2fa7a20-0000-0000-0000-000000000106"
      key = "contact"
      content = @{ address = "Alamat Dummy Staging"; phone = "080000000003"; marker = "STAGING_DUMMY" }
      is_public = $true
      created_by = $admin.id
      updated_by = $admin.id
    }
  )

  Upsert-ServiceRows -Table "news" -Rows @(
    @{
      id = "b2fa7a20-0000-0000-0000-000000000107"
      title = "Berita Dummy Staging Published"
      slug = "berita-dummy-staging-published"
      excerpt = "Konten dummy staging."
      content = @{ body = "Berita dummy staging."; marker = "STAGING_DUMMY" }
      status = "published"
      published_at = "2026-06-25T00:00:00Z"
      created_by = $admin.id
      updated_by = $admin.id
    },
    @{
      id = "b2fa7a20-0000-0000-0000-000000000108"
      title = "Berita Dummy Staging Draft"
      slug = "berita-dummy-staging-draft"
      excerpt = "Draft dummy staging."
      content = @{ body = "Draft dummy staging."; marker = "STAGING_DUMMY" }
      status = "draft"
      published_at = $null
      created_by = $admin.id
      updated_by = $admin.id
    }
  )

  Upsert-ServiceRows -Table "announcements" -Rows @(
    @{
      id = "b2fa7a20-0000-0000-0000-000000000109"
      title = "Pengumuman Dummy Staging Published"
      slug = "pengumuman-dummy-staging-published"
      excerpt = "Pengumuman dummy staging."
      content = @{ body = "Pengumuman dummy staging."; marker = "STAGING_DUMMY" }
      status = "published"
      priority = "normal"
      published_at = "2026-06-25T00:00:00Z"
      created_by = $admin.id
      updated_by = $admin.id
    },
    @{
      id = "b2fa7a20-0000-0000-0000-000000000110"
      title = "Pengumuman Dummy Staging Draft"
      slug = "pengumuman-dummy-staging-draft"
      excerpt = "Draft pengumuman dummy staging."
      content = @{ body = "Draft pengumuman dummy staging."; marker = "STAGING_DUMMY" }
      status = "draft"
      priority = "low"
      published_at = $null
      created_by = $admin.id
      updated_by = $admin.id
    }
  )

  Write-Host "Staging bootstrap completed."
  Write-Host "Admin email: staging-admin@example.invalid"
  Write-Host "Guru email: staging-test-guru@example.invalid"
  Write-Host "Pentashih email: staging-test-pentashih@example.invalid"
  Write-Host "Santri nomor induk: AFM-STAGING-SANTRI-01"
  Write-Host "RFID marker: AFM-STAGING-RFID-DUMMY-01"
  Write-Host "Secrets and dummy password were not printed."
  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  $script:ServiceRoleKey = $null
  $script:ServiceRoleKeyKind = $null
  $script:DummyPassword = $null
}
