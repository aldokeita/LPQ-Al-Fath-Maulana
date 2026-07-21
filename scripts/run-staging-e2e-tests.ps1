param(
  [string]$SupabaseUrl = $env:LPQ_STAGING_SUPABASE_URL,
  [string]$ProjectRef = $env:LPQ_STAGING_PROJECT_REF,
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

$script:Passed = 0
$script:Failed = 0
$script:Results = @()

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
  param([string]$Path, [string]$Key)

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
    throw "Staging URL and Project Ref must be provided explicitly."
  }
  if ($Ref -notmatch '^[a-z0-9]{15,32}$') {
    throw "Staging Project Ref format is invalid."
  }
  $uri = [Uri]$Url
  if ($uri.Scheme -ne "https" -or $uri.Host -ne "$Ref.supabase.co") {
    throw "Staging URL must match the newly supplied Project Ref."
  }
}

function Get-SecretKeyKind {
  param([string]$Key)

  if (-not $Key -or $Key.Trim().Length -eq 0) {
    throw "Staging secret/service-role key is required."
  }

  $trimmed = $Key.Trim()
  if ($trimmed -like "sbp_*") { throw "Personal Access Token sbp_ is not accepted." }
  if ($trimmed -like "sb_publishable_*") { throw "Publishable key is not accepted as secret/service-role key." }
  if ($trimmed -match "^(postgres|postgresql)://") { throw "Database connection string is not accepted." }
  if ($trimmed -like "sb_secret_*") { return "secret" }
  if ($trimmed -match "^eyJ[^.]+\.[^.]+\.[^.]+$") { return "legacy-jwt" }

  throw "Unsupported key format. Use sb_secret_... or legacy service-role JWT."
}

function New-BackendHeaders {
  param([string]$Key, [string]$KeyKind)

  $headers = @{
    apikey = $Key
    Accept = "application/json"
    "Content-Type" = "application/json"
    "User-Agent" = "LPQ-Staging-E2E/1.0"
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
    "User-Agent" = "LPQ-Staging-E2E/1.0"
  }
}

function New-AnonHeaders {
  return @{
    apikey = $script:PublishableKey
    Accept = "application/json"
    "Content-Type" = "application/json"
    "User-Agent" = "LPQ-Staging-E2E/1.0"
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
    if ($parts.Count -gt 0) { return ($parts -join " ") }
  } catch {
    # Fall back to redacted raw body.
  }

  if ($redacted.Length -gt 1200) { return $redacted.Substring(0, 1200) + "...[truncated]" }
  return $redacted
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body = $null,
    [string]$Step = "http",
    [int[]]$AcceptStatus = @(200, 201, 204)
  )

  $safePath = ([Uri]$Uri).AbsolutePath
  try {
    $json = $null
    if ($null -ne $Body) { $json = $Body | ConvertTo-Json -Depth 30 -Compress }

    $response = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers -Body $json -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    if ($AcceptStatus -notcontains [int]$response.StatusCode) {
      throw "Unexpected status $($response.StatusCode)"
    }
    if (-not $response.Content) { return $null }
    return $response.Content | ConvertFrom-Json
  } catch {
    $status = "unknown"
    $body = ""
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $_.Exception.Response.StatusCode }
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $body = Format-SafeHttpErrorBodyText -Body $reader.ReadToEnd()
        }
      } catch {
        $body = ""
      }
    }
    if ($body) { throw "step=$Step status=$status endpoint=$safePath $body" }
    throw "step=$Step status=$status endpoint=$safePath message=$($_.Exception.Message)"
  }
}

function Get-SafeStorageErrorBody {
  param([object]$Exception)

  try {
    if (-not $Exception.Response) { return "" }
    $stream = $Exception.Response.GetResponseStream()
    if (-not $stream) { return "" }
    $reader = New-Object System.IO.StreamReader($stream)
    return Format-SafeHttpErrorBodyText -Body $reader.ReadToEnd()
  } catch {
    return ""
  }
}

function Assert-SafeObjectPath {
  param([string]$Path)

  if (-not $Path -or $Path.StartsWith("/") -or $Path -match "\\") {
    throw "invalid object path"
  }
  if ($Path -match "(^|/)website-assets(/|$)") {
    throw "object path must not contain bucket name"
  }
}

function ConvertTo-StorageObjectUrlPath {
  param(
    [string]$Bucket,
    [string]$ObjectPath
  )

  Assert-SafeObjectPath -Path $ObjectPath
  $segments = $ObjectPath.Split("/") | ForEach-Object { [System.Uri]::EscapeDataString($_) }
  return "$Bucket/$($segments -join '/')"
}

function Invoke-StorageUploadText {
  param(
    [string]$Bucket,
    [string]$ObjectPath,
    [string]$Content,
    [string]$ContentType = "application/pdf"
  )

  $encodedPath = ConvertTo-StorageObjectUrlPath -Bucket $Bucket -ObjectPath $ObjectPath
  $headers = New-StorageUploadHeaders -Key $script:SecretKey -KeyKind $script:SecretKeyKind -ContentType $ContentType

  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Content)
    $response = Invoke-WebRequest -Method "POST" -Uri "$SupabaseUrl/storage/v1/object/$encodedPath" -Headers $headers -Body $bytes -UseBasicParsing -ErrorAction Stop
    if ([int]$response.StatusCode -notin @(200, 201)) {
      throw "storage upload returned status $($response.StatusCode)"
    }
  } catch {
    $status = "unknown"
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $_.Exception.Response.StatusCode }
    }
    $body = Get-SafeStorageErrorBody -Exception $_.Exception
    if ($body) {
      throw "storage upload failed status=$status bucket=$Bucket path=$ObjectPath $body"
    }
    throw "storage upload failed status=$status bucket=$Bucket path=$ObjectPath message=$($_.Exception.Message)"
  }
}

function New-StorageUploadHeaders {
  param([string]$Key, [string]$KeyKind, [string]$ContentType = "application/pdf")

  $headers = New-BackendHeaders -Key $Key -KeyKind $KeyKind
  $headers["Content-Type"] = $ContentType
  $headers["x-upsert"] = "true"
  return $headers
}

function Invoke-StorageDeleteObject {
  param(
    [string]$Bucket,
    [string]$ObjectPath
  )

  $encodedPath = ConvertTo-StorageObjectUrlPath -Bucket $Bucket -ObjectPath $ObjectPath
  $headers = New-BackendHeaders -Key $script:SecretKey -KeyKind $script:SecretKeyKind

  try {
    Invoke-WebRequest -Method "DELETE" -Uri "$SupabaseUrl/storage/v1/object/$encodedPath" -Headers $headers -UseBasicParsing -ErrorAction Stop | Out-Null
  } catch {
    # Best-effort cleanup only. The object path is stable and upserted on the next run.
  }
}

function Test-StorageBucketPublic {
  param([string]$Bucket)

  try {
    $headers = New-BackendHeaders -Key $script:SecretKey -KeyKind $script:SecretKeyKind
    $response = Invoke-WebRequest -Method "GET" -Uri "$SupabaseUrl/storage/v1/bucket/$Bucket" -Headers $headers -UseBasicParsing -ErrorAction Stop
    $bucketInfo = $response.Content | ConvertFrom-Json
    if ($bucketInfo.id -ne $Bucket -or $bucketInfo.public -ne $true) {
      throw "bucket lookup failed: bucket=$Bucket public=$($bucketInfo.public)"
    }
  } catch {
    $status = "unknown"
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $_.Exception.Response.StatusCode }
    }
    $body = Get-SafeStorageErrorBody -Exception $_.Exception
    if ($body) {
      throw "bucket lookup failed status=$status bucket=$Bucket $body"
    }
    throw "bucket lookup failed status=$status bucket=$Bucket message=$($_.Exception.Message)"
  }
}

function Convert-WebResponseContentToText {
  param($Response)

  if ($null -eq $Response) { return "" }

  if ($Response.Content -is [byte[]]) {
    return [System.Text.Encoding]::UTF8.GetString($Response.Content)
  }

  if ($Response.Content -is [string]) {
    return $Response.Content
  }

  if ($Response.RawContentStream) {
    try {
      $stream = $Response.RawContentStream
      if ($stream.CanSeek) { $stream.Position = 0 }
      $memory = New-Object System.IO.MemoryStream
      $stream.CopyTo($memory)
      $bytes = $memory.ToArray()
      return [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {
      return ""
    }
  }

  return [string]$Response.Content
}

function Invoke-PublicStorageGetText {
  param(
    [string]$Bucket,
    [string]$ObjectPath
  )

  $encodedPath = ConvertTo-StorageObjectUrlPath -Bucket $Bucket -ObjectPath $ObjectPath
  $publicUrl = "$SupabaseUrl/storage/v1/object/public/$encodedPath"

  try {
    $response = Invoke-WebRequest -Method "GET" -Uri $publicUrl -UseBasicParsing -ErrorAction Stop
    if ([int]$response.StatusCode -ne 200) {
      throw "public GET returned status $($response.StatusCode)"
    }
    return Convert-WebResponseContentToText -Response $response
  } catch {
    $status = "unknown"
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $_.Exception.Response.StatusCode }
    }
    $body = Get-SafeStorageErrorBody -Exception $_.Exception
    if ($body) {
      throw "public GET failed status=$status bucket=$Bucket path=$ObjectPath $body"
    }
    throw "public GET failed status=$status bucket=$Bucket path=$ObjectPath message=$($_.Exception.Message)"
  }
}

function New-PaymentTestContext {
  $suffix = [guid]::NewGuid().ToString("N")
  return [pscustomobject]@{
    prefix = "STG-E2E-PAY-"
    run_id = $suffix
    first_transaction_id = "STG-E2E-PAY-$suffix-A"
    duplicate_transaction_id = "STG-E2E-PAY-$suffix-B"
    bulan = 11
    tahun = 2099
    inserted = $false
  }
}

function Invoke-Rest {
  param(
    [string]$Method,
    [string]$Path,
    [hashtable]$Headers,
    [object]$Body = $null,
    [string]$Query = "",
    [string]$Step = "rest",
    [int[]]$AcceptStatus = @(200, 201, 204)
  )

  return Invoke-JsonRequest -Method $Method -Uri "$SupabaseUrl/rest/v1/$Path$Query" -Headers $Headers -Body $Body -Step $Step -AcceptStatus $AcceptStatus
}

function Invoke-Function {
  param([string]$Name, [hashtable]$Headers, [object]$Body, [int[]]$AcceptStatus = @(200, 201))

  return Invoke-JsonRequest -Method "POST" -Uri "$SupabaseUrl/functions/v1/$Name" -Headers $Headers -Body $Body -Step "function:$Name" -AcceptStatus $AcceptStatus
}

function SignInWithPassword {
  param([string]$Email, [string]$Password)

  return Invoke-JsonRequest -Method "POST" -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Headers (New-AnonHeaders) -Body @{
    email = $Email
    password = $Password
  } -Step "auth:signin"
}

function SignInSantri {
  param([string]$NomorInduk, [string]$Password)

  return Invoke-Function -Name "signin-with-nomor-induk" -Headers (New-AnonHeaders) -Body @{
    nomor_induk_qiroati = $NomorInduk
    password = $Password
  }
}

function Add-Result {
  param([string]$Name, [bool]$Ok, [string]$Message = "")

  if ($Ok) {
    $script:Passed++
    Write-Host "PASS $Name"
  } else {
    $script:Failed++
    if ($Message) { Write-Host "FAIL $Name - $Message" } else { Write-Host "FAIL $Name" }
  }
  $script:Results += [pscustomobject]@{ name = $Name; pass = $Ok; message = $Message }
}

function Test-Case {
  param([string]$Name, [scriptblock]$Block)

  try {
    & $Block
    Add-Result -Name $Name -Ok $true
  } catch {
    Add-Result -Name $Name -Ok $false -Message $_.Exception.Message
  }
}

function Require-AnyRows {
  param([object]$Rows, [string]$Message)

  if ($null -eq $Rows -or @($Rows).Count -lt 1) { throw $Message }
}

function Require-NoRows {
  param([object]$Rows, [string]$Message)

  if ($null -ne $Rows -and @($Rows).Count -gt 0) { throw $Message }
}

function Cleanup-TemporaryRows {
  $serviceHeaders = New-BackendHeaders -Key $script:SecretKey -KeyKind $script:SecretKeyKind
  $now = (Get-Date).ToUniversalTime().ToString("o")

  Invoke-Rest -Method "PATCH" -Path "expenses" -Headers $serviceHeaders -Query "?deskripsi=eq.STAGING_E2E_EXPENSE" -Body @{ deleted_at = $now } -Step "cleanup:expenses" -AcceptStatus @(200, 204) | Out-Null
  Invoke-Rest -Method "DELETE" -Path "attendance" -Headers $serviceHeaders -Query "?source=eq.manual&status=eq.STAGING_E2E_PRESENT" -Step "cleanup:attendance" -AcceptStatus @(200, 204) | Out-Null
  Invoke-Rest -Method "DELETE" -Path "feedbacks" -Headers $serviceHeaders -Query "?message=eq.STAGING_E2E_FEEDBACK" -Step "cleanup:feedbacks" -AcceptStatus @(200, 204) | Out-Null
}

function Cleanup-PaymentTestRows {
  if (-not $script:SantriId) { return }

  $serviceHeaders = New-BackendHeaders -Key $script:SecretKey -KeyKind $script:SecretKeyKind
  $now = (Get-Date).ToUniversalTime().ToString("o")

  Invoke-Rest -Method "PATCH" -Path "payments" -Headers $serviceHeaders -Query "?santri_id=eq.$script:SantriId&transaction_id=like.STG-E2E-PAY-*&deleted_at=is.null" -Body @{ deleted_at = $now } -Step "cleanup:payments-current-prefix" -AcceptStatus @(200, 204) | Out-Null
  Invoke-Rest -Method "PATCH" -Path "payments" -Headers $serviceHeaders -Query "?santri_id=eq.$script:SantriId&transaction_id=like.STAGING-E2E-PAYMENT-*&deleted_at=is.null" -Body @{ deleted_at = $now } -Step "cleanup:payments-legacy-prefix" -AcceptStatus @(200, 204) | Out-Null
}

function Initialize-Context {
  $script:AnonHeaders = New-AnonHeaders
  $script:ServiceHeaders = New-BackendHeaders -Key $script:SecretKey -KeyKind $script:SecretKeyKind

  $script:AdminSession = SignInWithPassword -Email "staging-admin@example.invalid" -Password $script:DummyPassword
  $script:GuruSession = SignInWithPassword -Email "staging-test-guru@example.invalid" -Password $script:DummyPassword
  $script:PentashihSession = SignInWithPassword -Email "staging-test-pentashih@example.invalid" -Password $script:DummyPassword
  $script:SantriLogin = SignInSantri -NomorInduk "AFM-STAGING-SANTRI-01" -Password $script:DummyPassword

  $script:AdminHeaders = New-UserHeaders -AccessToken $script:AdminSession.access_token
  $script:GuruHeaders = New-UserHeaders -AccessToken $script:GuruSession.access_token
  $script:PentashihHeaders = New-UserHeaders -AccessToken $script:PentashihSession.access_token
  $script:SantriHeaders = New-UserHeaders -AccessToken $script:SantriLogin.data.session.access_token

  $script:AdminId = $script:AdminSession.user.id
  $script:GuruId = $script:GuruSession.user.id
  $script:PentashihId = $script:PentashihSession.user.id
  $script:SantriId = $script:SantriLogin.data.user.id

  $classes = Invoke-Rest -Method "GET" -Path "classes" -Headers $script:ServiceHeaders -Query "?select=id,nama_kelas&id_guru=eq.$script:GuruId&limit=1" -Step "lookup:class"
  Require-AnyRows $classes "Staging class not found."
  $script:ClassId = @($classes)[0].id
}

try {
  Assert-StagingTarget -Url $SupabaseUrl -Ref $ProjectRef

  if ($SelfTest) {
    $fakeSecret = "sb_" + "secret_fake_for_header_test"
    $secretHeaders = New-BackendHeaders -Key $fakeSecret -KeyKind (Get-SecretKeyKind $fakeSecret)
    if ($secretHeaders.ContainsKey("Authorization")) { throw "sb_secret must not include Authorization." }
    if ($secretHeaders["User-Agent"] -ne "LPQ-Staging-E2E/1.0") { throw "Missing User-Agent." }

    $jwt = "eyJfakeheader.eyJfakepayload.fakesignature"
    $jwtHeaders = New-BackendHeaders -Key $jwt -KeyKind (Get-SecretKeyKind $jwt)
    if ($jwtHeaders.Authorization -ne "Bearer $jwt") { throw "legacy JWT must include Authorization." }

    $body = Format-SafeHttpErrorBodyText -Body '{"code":"PGRST116","message":"No rows","details":"none","hint":"check filters"}'
    foreach ($part in @("code=PGRST116", "message=No rows", "details=none", "hint=check filters")) {
      if ($body -notlike "*$part*") { throw "Diagnostic self-test failed for $part." }
    }

    $storagePath = ConvertTo-StorageObjectUrlPath -Bucket "website-assets" -ObjectPath "staging-e2e/public-read-test.pdf"
    if ($storagePath -ne "website-assets/staging-e2e/public-read-test.pdf") { throw "Storage path self-test failed." }
    $badPathRejected = $false
    try { ConvertTo-StorageObjectUrlPath -Bucket "website-assets" -ObjectPath "/website-assets\bad.txt" | Out-Null } catch { $badPathRejected = $true }
    if (-not $badPathRejected) { throw "Invalid storage path self-test failed." }
    $fakeBinaryResponse = [pscustomobject]@{ Content = [System.Text.Encoding]::UTF8.GetBytes("STAGING_E2E_WEBSITE_ASSET_PUBLIC_READ") }
    if ((Convert-WebResponseContentToText -Response $fakeBinaryResponse) -notlike "*WEBSITE_ASSET_PUBLIC_READ*") {
      throw "Storage public GET binary decode self-test failed."
    }

    $paymentTest = New-PaymentTestContext
    if ($paymentTest.first_transaction_id -notlike "STG-E2E-PAY-*-A") { throw "Payment transaction id self-test failed." }
    if ($paymentTest.duplicate_transaction_id -notlike "STG-E2E-PAY-*-B") { throw "Payment duplicate transaction id self-test failed." }
    if ($paymentTest.first_transaction_id -eq $paymentTest.duplicate_transaction_id) { throw "Payment transaction ids must be unique." }

    $fakeSecretKind = Get-SecretKeyKind $fakeSecret
    $uploadHeaders = New-StorageUploadHeaders -Key $fakeSecret -KeyKind $fakeSecretKind
    if ($uploadHeaders.Authorization) { throw "Storage upload sb_secret header must not include Authorization." }
    if ($uploadHeaders["x-upsert"] -ne "true") { throw "Storage upload x-upsert self-test failed." }
    if ($uploadHeaders["Content-Type"] -ne "application/pdf") { throw "Storage upload Content-Type self-test failed." }

    Write-Host "Self-test passed."
    exit 0
  }

  $script:PublishableKey = Get-EnvFileValue -Path ".env.staging.local" -Key "VITE_SUPABASE_ANON_KEY"
  if (-not $script:PublishableKey -or $script:PublishableKey -notmatch "^sb_publishable_") {
    throw "Missing staging publishable key in .env.staging.local."
  }

  $secretInput = Read-Host "Masukkan staging secret/service-role key (input tersembunyi)" -AsSecureString
  $passwordInput = Read-Host "Masukkan password dummy staging (input tersembunyi)" -AsSecureString
  $script:SecretKey = ConvertFrom-SecureStringToPlainText -Value $secretInput
  $script:DummyPassword = ConvertFrom-SecureStringToPlainText -Value $passwordInput
  $script:SecretKeyKind = Get-SecretKeyKind $script:SecretKey

  if ($script:DummyPassword.Length -lt 8) { throw "Password dummy staging minimal 8 karakter." }

  Cleanup-TemporaryRows
  Initialize-Context
  Cleanup-PaymentTestRows
  $script:PaymentTest = New-PaymentTestContext

  Test-Case "login admin" { if (-not $script:AdminSession.user.id) { throw "admin login failed" } }
  Test-Case "login guru" { if (-not $script:GuruSession.user.id) { throw "guru login failed" } }
  Test-Case "login pentashih" { if (-not $script:PentashihSession.user.id) { throw "pentashih login failed" } }
  Test-Case "login santri via nomor induk" { if (-not $script:SantriLogin.data.session.access_token) { throw "santri login failed" } }

  Test-Case "role berasal dari user_profiles" {
    $profiles = Invoke-Rest -Method "GET" -Path "user_profiles" -Headers $script:ServiceHeaders -Query "?select=id,role&id=in.($script:AdminId,$script:GuruId,$script:PentashihId,$script:SantriId)" -Step "profiles:roles"
    $roles = @{}
    foreach ($p in @($profiles)) { $roles[$p.id] = $p.role }
    if ($roles[$script:AdminId] -ne "admin" -or $roles[$script:GuruId] -ne "guru" -or $roles[$script:PentashihId] -ne "pentashih" -or $roles[$script:SantriId] -ne "santri") {
      throw "unexpected profile roles"
    }
  }

  Test-Case "anon ditolak membaca payments" {
    try {
      $rows = Invoke-Rest -Method "GET" -Path "payments" -Headers $script:AnonHeaders -Query "?select=id&limit=1" -Step "anon:payments"
      Require-NoRows $rows "anon saw private payments"
    } catch {
      if ($_.Exception.Message -notmatch "status=401|status=403") { throw }
    }
  }

  Test-Case "anon membaca news published" {
    $rows = Invoke-Rest -Method "GET" -Path "news" -Headers $script:AnonHeaders -Query "?select=id,slug,status&status=eq.published&slug=eq.berita-dummy-staging-published" -Step "anon:news-published"
    Require-AnyRows $rows "published news not visible"
  }

  Test-Case "anon membaca announcements published" {
    $rows = Invoke-Rest -Method "GET" -Path "announcements" -Headers $script:AnonHeaders -Query "?select=id,slug,status&status=eq.published&slug=eq.pengumuman-dummy-staging-published" -Step "anon:announcements-published"
    Require-AnyRows $rows "published announcement not visible"
  }

  Test-Case "anon tidak membaca draft" {
    $news = Invoke-Rest -Method "GET" -Path "news" -Headers $script:AnonHeaders -Query "?select=id&slug=eq.berita-dummy-staging-draft" -Step "anon:news-draft"
    $ann = Invoke-Rest -Method "GET" -Path "announcements" -Headers $script:AnonHeaders -Query "?select=id&slug=eq.pengumuman-dummy-staging-draft" -Step "anon:announcement-draft"
    Require-NoRows $news "anon saw draft news"
    Require-NoRows $ann "anon saw draft announcement"
  }

  Test-Case "feedback publik insert dan anon tidak dapat list" {
    Invoke-Rest -Method "POST" -Path "feedbacks" -Headers $script:AnonHeaders -Body @{ nama = "Staging E2E"; message = "STAGING_E2E_FEEDBACK" } -Step "anon:feedback-insert" -AcceptStatus @(201) | Out-Null
    try {
      $rows = Invoke-Rest -Method "GET" -Path "feedbacks" -Headers $script:AnonHeaders -Query "?select=id&message=eq.STAGING_E2E_FEEDBACK" -Step "anon:feedback-list"
      Require-NoRows $rows "anon listed feedback"
    } catch {
      if ($_.Exception.Message -notmatch "status=401|status=403") { throw }
    }
  }

  Test-Case "guru hanya membaca kelasnya" {
    $rows = Invoke-Rest -Method "GET" -Path "classes" -Headers $script:GuruHeaders -Query "?select=id,nama_kelas" -Step "guru:classes"
    Require-AnyRows $rows "guru cannot read assigned class"
    if (-not (@($rows).id -contains $script:ClassId)) { throw "assigned class missing" }
  }

  Test-Case "pentashih hanya membaca assignment" {
    $rows = Invoke-Rest -Method "GET" -Path "pentashih_class_assignments" -Headers $script:PentashihHeaders -Query "?select=id,class_id&is_active=eq.true" -Step "pentashih:assignments"
    Require-AnyRows $rows "pentashih assignment missing"
    if (-not (@($rows).class_id -contains $script:ClassId)) { throw "assigned class missing" }
  }

  Test-Case "santri hanya membaca data sendiri" {
    $rows = Invoke-Rest -Method "GET" -Path "santri" -Headers $script:SantriHeaders -Query "?select=id,nomor_induk_qiroati" -Step "santri:self"
    Require-AnyRows $rows "santri cannot read own data"
    if (@($rows).Count -ne 1 -or @($rows)[0].id -ne $script:SantriId) { throw "santri saw other data" }
  }

  Test-Case "admin mencatat absensi RFID" {
    Invoke-Rest -Method "POST" -Path "attendance" -Headers $script:AdminHeaders -Body @{
      user_id = $script:SantriId
      role = "santri"
      attendance_date = "2099-12-31"
      check_in_timestamp = "2099-12-31T08:00:00Z"
      class_id = $script:ClassId
      sesi = "E2E"
      status = "STAGING_E2E_PRESENT"
      source = "manual"
      created_by = $script:AdminId
      updated_by = $script:AdminId
    } -Step "admin:attendance-insert" -AcceptStatus @(201) | Out-Null
  }

  Test-Case "absensi duplikat ditolak" {
    try {
      Invoke-Rest -Method "POST" -Path "attendance" -Headers $script:AdminHeaders -Body @{
        user_id = $script:SantriId
        role = "santri"
        attendance_date = "2099-12-31"
        check_in_timestamp = "2099-12-31T08:05:00Z"
        class_id = $script:ClassId
        sesi = "E2E"
        status = "STAGING_E2E_PRESENT"
        source = "manual"
        created_by = $script:AdminId
        updated_by = $script:AdminId
      } -Step "admin:attendance-duplicate" -AcceptStatus @(201) | Out-Null
      throw "duplicate attendance was accepted"
    } catch {
      if ($_.Exception.Message -eq "duplicate attendance was accepted") { throw }
      if ($_.Exception.Message -notmatch "23505|duplicate|status=409") { throw }
    }
  }

  Test-Case "pembayaran pertama berhasil" {
    Invoke-Rest -Method "POST" -Path "payments" -Headers $script:AdminHeaders -Body @{
      santri_id = $script:SantriId
      bulan = $script:PaymentTest.bulan
      tahun = $script:PaymentTest.tahun
      jumlah = 12345
      tanggal_pembayaran = "2099-12-31"
      metode_pembayaran = "E2E"
      status = "paid"
      transaction_id = $script:PaymentTest.first_transaction_id
      catatan = "STAGING_E2E_PAYMENT"
      created_by = $script:AdminId
      updated_by = $script:AdminId
    } -Step "admin:payment-insert" -AcceptStatus @(201) | Out-Null
    $script:PaymentTest.inserted = $true
  }

  Test-Case "pembayaran periode sama ditolak" {
    if (-not $script:PaymentTest.inserted) {
      throw "dependency failed: first payment insert did not pass"
    }
    try {
      Invoke-Rest -Method "POST" -Path "payments" -Headers $script:AdminHeaders -Body @{
        santri_id = $script:SantriId
        bulan = $script:PaymentTest.bulan
        tahun = $script:PaymentTest.tahun
        jumlah = 12346
        tanggal_pembayaran = "2099-12-31"
        metode_pembayaran = "E2E"
        status = "paid"
        transaction_id = $script:PaymentTest.duplicate_transaction_id
        catatan = "STAGING_E2E_PAYMENT_DUPLICATE"
        created_by = $script:AdminId
        updated_by = $script:AdminId
      } -Step "admin:payment-duplicate" -AcceptStatus @(201) | Out-Null
      throw "duplicate payment was accepted"
    } catch {
      if ($_.Exception.Message -eq "duplicate payment was accepted") { throw }
      if ($_.Exception.Message -notmatch "23505|duplicate|status=409") { throw }
    }
  }

  Test-Case "guru hanya membaca status pembayaran" {
    $rows = Invoke-Rest -Method "GET" -Path "payment_status_summary" -Headers $script:GuruHeaders -Query "?select=santri_id,class_id,bulan,tahun,status&santri_id=eq.$script:SantriId&bulan=eq.$($script:PaymentTest.bulan)&tahun=eq.$($script:PaymentTest.tahun)" -Step "guru:payment-status"
    Require-AnyRows $rows "payment status not visible to guru"
    $json = $rows | ConvertTo-Json -Compress
    if ($json -match "jumlah|metode|catatan|transaction") { throw "payment detail leaked" }
  }

  Test-Case "guru ditolak membaca detail payments" {
    try {
      $rows = Invoke-Rest -Method "GET" -Path "payments" -Headers $script:GuruHeaders -Query "?select=id,jumlah&santri_id=eq.$script:SantriId" -Step "guru:payments-detail"
      Require-NoRows $rows "guru saw payment details"
    } catch {
      if ($_.Exception.Message -notmatch "status=401|status=403") { throw }
    }
  }

  Test-Case "admin membuat dan soft-delete expense dummy" {
    Invoke-Rest -Method "POST" -Path "expenses" -Headers $script:AdminHeaders -Body @{
      tanggal_pengeluaran = "2099-12-31"
      kategori = "E2E"
      deskripsi = "STAGING_E2E_EXPENSE"
      jumlah = 55321
      created_by = $script:AdminId
      updated_by = $script:AdminId
    } -Step "admin:expense-insert" -AcceptStatus @(201) | Out-Null
    Invoke-Rest -Method "PATCH" -Path "expenses" -Headers $script:AdminHeaders -Query "?deskripsi=eq.STAGING_E2E_EXPENSE" -Body @{ deleted_at = (Get-Date).ToUniversalTime().ToString("o"); updated_by = $script:AdminId } -Step "admin:expense-soft-delete" -AcceptStatus @(200, 204) | Out-Null
  }

  Test-Case "expense terhapus tidak ikut rekap aktif" {
    $rows = Invoke-Rest -Method "GET" -Path "expenses" -Headers $script:AdminHeaders -Query "?select=id&deskripsi=eq.STAGING_E2E_EXPENSE&deleted_at=is.null" -Step "admin:expense-active-check"
    Require-NoRows $rows "soft-deleted expense still active"
  }

  Test-Case "RPC move_santri_to_class hanya admin" {
    Invoke-Rest -Method "POST" -Path "rpc/move_santri_to_class" -Headers $script:AdminHeaders -Body @{
      p_santri_id = $script:SantriId
      p_to_class_id = $script:ClassId
      p_reason = "STAGING_E2E_SAME_CLASS"
    } -Step "admin:move-same-class" | Out-Null
    try {
      Invoke-Rest -Method "POST" -Path "rpc/move_santri_to_class" -Headers $script:GuruHeaders -Body @{
        p_santri_id = $script:SantriId
        p_to_class_id = $script:ClassId
        p_reason = "STAGING_E2E_FORBIDDEN"
      } -Step "guru:move-forbidden" | Out-Null
      throw "guru move rpc accepted"
    } catch {
      if ($_.Exception.Message -eq "guru move rpc accepted") { throw }
      if ($_.Exception.Message -notmatch "FORBIDDEN|status=403|status=400") { throw }
    }
  }

  Test-Case "avatar signed upload dapat dibuat" {
    $response = Invoke-Function -Name "generate-signed-upload-url" -Headers $script:SantriHeaders -Body @{
      bucket = "avatars"
      path = "santri/$script:SantriId/profile.webp"
      content_type = "image/webp"
      size = 1024
      purpose = "avatar"
    }
    if (-not $response.data.path) { throw "signed upload path missing" }
  }

  Test-Case "website-assets public read" {
    $bucket = "website-assets"
    $objectPath = "staging-e2e/public-read-test.pdf"
    $marker = "STAGING_E2E_WEBSITE_ASSET_PUBLIC_READ"
    $pdfContent = "%PDF-1.1`n% $marker`n1 0 obj << /Type /Catalog >> endobj`ntrailer << /Root 1 0 R >>`n%%EOF`n"
    Test-StorageBucketPublic -Bucket $bucket
    Invoke-StorageUploadText -Bucket $bucket -ObjectPath $objectPath -Content $pdfContent -ContentType "application/pdf"
    $content = Invoke-PublicStorageGetText -Bucket $bucket -ObjectPath $objectPath
    if ($content -notlike "*$marker*") { throw "public GET content marker mismatch" }
    Invoke-StorageDeleteObject -Bucket $bucket -ObjectPath $objectPath
  }

  Test-Case "reset password ditolak bagi non-admin" {
    try {
      Invoke-Function -Name "reset-user-password" -Headers $script:GuruHeaders -Body @{
        target_user_id = $script:SantriId
        new_password = "AFM-Staging-Reset-Dummy-001!"
      } -AcceptStatus @(200) | Out-Null
      throw "non-admin reset accepted"
    } catch {
      if ($_.Exception.Message -eq "non-admin reset accepted") { throw }
      if ($_.Exception.Message -notmatch "status=401|status=403|FORBIDDEN") { throw }
    }
  }

  Cleanup-TemporaryRows
  Cleanup-PaymentTestRows

  Write-Host "SUMMARY passed=$script:Passed failed=$script:Failed"
  if ($script:Failed -gt 0) { exit 1 }
  exit 0
} catch {
  Add-Result -Name "runner setup" -Ok $false -Message $_.Exception.Message
  Write-Host "SUMMARY passed=$script:Passed failed=$script:Failed"
  exit 1
} finally {
  if ($script:SecretKey -and $script:SecretKeyKind -and $script:SantriId) {
    try { Cleanup-PaymentTestRows } catch { }
  }
  $script:SecretKey = $null
  $script:SecretKeyKind = $null
  $script:DummyPassword = $null
  $script:AdminSession = $null
  $script:GuruSession = $null
  $script:PentashihSession = $null
  $script:SantriLogin = $null
}
