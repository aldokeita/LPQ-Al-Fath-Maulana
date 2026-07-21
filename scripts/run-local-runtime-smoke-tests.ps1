param(
  [string]$SupabaseUrl = "http://127.0.0.1:55321"
)

$ErrorActionPreference = "Stop"

function Get-LocalEnv {
  $envMap = @{}

  if ($env:SUPABASE_ANON_KEY) {
    $envMap["ANON_KEY"] = $env:SUPABASE_ANON_KEY.Trim()
  }
  if ($env:SUPABASE_API_URL) {
    $envMap["API_URL"] = $env:SUPABASE_API_URL.Trim()
  }
  if ($env:SUPABASE_SERVICE_ROLE_KEY) {
    $envMap["SERVICE_ROLE_KEY"] = $env:SUPABASE_SERVICE_ROLE_KEY.Trim()
  }
  if ($envMap.ContainsKey("ANON_KEY") -and $envMap.ContainsKey("API_URL") -and $envMap.ContainsKey("SERVICE_ROLE_KEY")) {
    return $envMap
  }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & supabase status -o env 2>&1
  $statusExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  foreach ($line in $output) {
    $text = $line.ToString()
    if ($text -match "^([A-Z0-9_]+)=(.+)$") {
      $envMap[$Matches[1]] = $Matches[2].Trim().Trim('"')
    }
  }
  if (!$envMap.ContainsKey("ANON_KEY")) { throw "ANON_KEY not found in local Supabase status." }
  if (!$envMap.ContainsKey("API_URL")) { throw "API_URL not found in local Supabase status." }
  if (!$envMap.ContainsKey("SERVICE_ROLE_KEY")) { throw "SERVICE_ROLE_KEY not found in local Supabase status." }
  if ($statusExitCode -ne 0) { throw "Local Supabase status command failed." }
  return $envMap
}

function Assert-LocalUrl {
  param([string]$Url)
  $uri = [Uri]$Url
  if ($uri.Scheme -ne "http" -or $uri.Port -ne 55321 -or ($uri.Host -notin @("127.0.0.1", "localhost", "::1"))) {
    throw "Refusing non-local URL: $Url"
  }
}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    [object]$Body = $null
  )
  try {
    $webMethod = switch ($Method.ToUpperInvariant()) {
      "GET" { "Get" }
      "POST" { "Post" }
      "DELETE" { "Delete" }
      default { throw "Unsupported HTTP method for smoke test: $Method" }
    }

    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 20 -Compress
      $parsed = Invoke-RestMethod -Method $webMethod -Uri $Url -Headers $Headers -ErrorAction Stop -Body $jsonBody -ContentType "application/json"
    } else {
      $parsed = Invoke-RestMethod -Method $webMethod -Uri $Url -Headers $Headers -ErrorAction Stop
    }
    return [pscustomobject]@{ ok = $true; status = 200; body = $parsed; error = "" }
  } catch {
    $outerMessage = $_.Exception.Message
    $status = 0
    $body = $null
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
      $status = [int]$errorResponse.StatusCode
      try {
        $stream = $errorResponse.GetResponseStream()
        if ($stream) {
          $reader = [System.IO.StreamReader]::new($stream)
          $content = $reader.ReadToEnd()
          if ($content) { $body = $content | ConvertFrom-Json }
        }
      } catch {
        $body = $null
      }
    }
    return [pscustomobject]@{ ok = $false; status = $status; body = $body; error = $outerMessage }
  }
}

function Add-Result {
  param([string]$Name, [bool]$Passed, [string]$Detail = "")
  $script:Results += [pscustomobject]@{ name = $Name; passed = $Passed; detail = $Detail }
  $prefix = if ($Passed) { "PASS" } else { "FAIL" }
  if ($Detail) { Write-Host "$prefix $Name - $Detail" } else { Write-Host "$prefix $Name" }
}

function SignInPassword {
  param([string]$Email, [string]$Password)
  $body = @{ email = $Email; password = $Password }
  return Invoke-Json -Method "POST" -Url "$script:ApiUrl/auth/v1/token?grant_type=password" -Headers $script:AnonHeaders -Body $body
}

function CallFunction {
  param([string]$Name, [object]$Body, [string]$Token = "")
  $headers = @{} + $script:AnonHeaders
  $headers["X-Forwarded-For"] = $script:SmokeTestIp
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  return Invoke-Json -Method "POST" -Url "$script:ApiUrl/functions/v1/$Name" -Headers $headers -Body $Body
}

function RestGet {
  param([string]$Path, [string]$Token = "")
  $headers = @{} + $script:AnonHeaders
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  return Invoke-Json -Method "GET" -Url "$script:ApiUrl/rest/v1/$Path" -Headers $headers
}

function RestPost {
  param([string]$Path, [object]$Body, [string]$Token = "")
  $headers = @{} + $script:AnonHeaders
  $headers["Prefer"] = "return=minimal"
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  return Invoke-Json -Method "POST" -Url "$script:ApiUrl/rest/v1/$Path" -Headers $headers -Body $Body
}

Assert-LocalUrl -Url $SupabaseUrl
$envMap = Get-LocalEnv
$script:ApiUrl = $envMap["API_URL"]
$anonKey = $envMap["ANON_KEY"]
$script:AnonHeaders = @{
  apikey = $anonKey
  Authorization = "Bearer $anonKey"
}
$serviceRoleKey = $envMap["SERVICE_ROLE_KEY"]
$script:ServiceHeaders = @{
  apikey = $serviceRoleKey
  Authorization = "Bearer $serviceRoleKey"
}
$script:SmokeTestIp = "local-smoke-$([guid]::NewGuid().ToString("N"))"
Write-Host "Using local API $script:ApiUrl with anon key length $($anonKey.Length)."
$script:Results = @()

$adminLogin = SignInPassword -Email "admin-demo@example.invalid" -Password "LocalOnly-AFM-Dummy-Admin-001!"
$guruALogin = SignInPassword -Email "guru-a-demo@example.invalid" -Password "LocalOnly-AFM-Dummy-Guru-A-001!"
$guruBLogin = SignInPassword -Email "guru-b-demo@example.invalid" -Password "LocalOnly-AFM-Dummy-Guru-B-001!"
if (-not $guruBLogin.ok) {
  $guruBLogin = SignInPassword -Email "guru-b-demo@example.invalid" -Password "LocalOnly-AFM-Dummy-Guru-B-Reset!"
}

Add-Result "auth admin login" ($adminLogin.ok -and $adminLogin.body.access_token) "status=$($adminLogin.status) error=$($adminLogin.error)"
Add-Result "auth guru A login" ($guruALogin.ok -and $guruALogin.body.access_token) "status=$($guruALogin.status) error=$($guruALogin.error)"
Add-Result "auth guru B login" ($guruBLogin.ok -and $guruBLogin.body.access_token) "status=$($guruBLogin.status) error=$($guruBLogin.error)"

$adminToken = $adminLogin.body.access_token
$guruAToken = $guruALogin.body.access_token
$guruBToken = $guruBLogin.body.access_token

$santriLogin = CallFunction -Name "signin-with-nomor-induk" -Body @{ nomor_induk_qiroati = "AFMLOCAL-ANAK-A01"; password = "LocalOnly-AFM-Dummy-Santri-A1!" }
Add-Result "function signin santri success" ($santriLogin.ok -and $santriLogin.body.data.session.access_token) "status=$($santriLogin.status) error=$($santriLogin.error)"
$santriToken = $santriLogin.body.data.session.access_token

$ptptLogin = CallFunction -Name "signin-with-nomor-induk" -Body @{ nomor_induk_qiroati = "AFMLOCAL-PTPT-01"; password = "LocalOnly-AFM-Dummy-PTPT-1!" }
Add-Result "function signin ptpt santri success" ($ptptLogin.ok -and $ptptLogin.body.data.session.access_token) "status=$($ptptLogin.status) error=$($ptptLogin.error)"

$wrongPassword = CallFunction -Name "signin-with-nomor-induk" -Body @{ nomor_induk_qiroati = "AFMLOCAL-ANAK-A01"; password = "wrong-local-only" }
$unknownAlias = CallFunction -Name "signin-with-nomor-induk" -Body @{ nomor_induk_qiroati = "AFMLOCAL-TIDAK-ADA"; password = "wrong-local-only" }
$wrongMessage = $wrongPassword.body.error.message
$unknownMessage = $unknownAlias.body.error.message
Add-Result "function signin generic error" (-not $wrongPassword.ok -and -not $unknownAlias.ok -and $wrongMessage -eq $unknownMessage)

$guruASantri = RestGet -Path "santri?select=id&order=id" -Token $guruAToken
Add-Result "rls guru A sees assigned TPQ and PTPT santri only" ($guruASantri.ok -and @($guruASantri.body).Count -eq 6) "status=$($guruASantri.status) count=$(@($guruASantri.body).Count) error=$($guruASantri.error)"

$guruBSantri = RestGet -Path "santri?select=id&order=id" -Token $guruBToken
Add-Result "rls guru B sees class B santri only" ($guruBSantri.ok -and @($guruBSantri.body).Count -eq 2) "status=$($guruBSantri.status) count=$(@($guruBSantri.body).Count) error=$($guruBSantri.error)"

$santriOwn = RestGet -Path "santri?select=id" -Token $santriToken
Add-Result "rls santri sees own record only" ($santriOwn.ok -and @($santriOwn.body).Count -eq 1) "status=$($santriOwn.status) count=$(@($santriOwn.body).Count) error=$($santriOwn.error)"

$guruPayments = RestGet -Path "payments?select=id" -Token $guruAToken
Add-Result "rls guru direct payments denied" ((-not $guruPayments.ok) -or @($guruPayments.body).Count -eq 0)

$guruPaymentStatus = RestGet -Path "payment_status_summary?select=status,class_id" -Token $guruAToken
$statusValues = @($guruPaymentStatus.body | ForEach-Object { $_.status } | Select-Object -Unique)
Add-Result "rls guru payment status only" ($guruPaymentStatus.ok -and $statusValues.Count -gt 0 -and ($statusValues | Where-Object { $_ -notin @("Lunas", "Belum Lunas") }).Count -eq 0)

$guruExpenses = RestGet -Path "expenses?select=id" -Token $guruAToken
Add-Result "rls expenses guru denied" ((-not $guruExpenses.ok) -or @($guruExpenses.body).Count -eq 0)

$adminExpenses = RestGet -Path "expenses?select=id" -Token $adminToken
Add-Result "rls expenses admin allowed" ($adminExpenses.ok -and @($adminExpenses.body).Count -ge 1) "status=$($adminExpenses.status) count=$(@($adminExpenses.body).Count) error=$($adminExpenses.error)"

$anonNews = RestGet -Path "news?select=id,slug"
Add-Result "rls anon reads published news" ($anonNews.ok -and @($anonNews.body).Count -ge 1) "status=$($anonNews.status) count=$(@($anonNews.body).Count) error=$($anonNews.error)"

$anonFeedbackRead = RestGet -Path "feedbacks?select=id"
Add-Result "rls anon cannot read feedbacks" (-not $anonFeedbackRead.ok)

$anonFeedbackInsert = RestPost -Path "feedbacks" -Body @{ message = "Feedback dummy runtime smoke test." }
Add-Result "rls anon can insert feedback" ($anonFeedbackInsert.ok -or $anonFeedbackInsert.status -eq 201) "status=$($anonFeedbackInsert.status) error=$($anonFeedbackInsert.error)"

$ownAvatar = CallFunction -Name "generate-signed-upload-url" -Token $santriToken -Body @{
  bucket = "avatars"
  path = "santri/a1fa7a10-0000-0000-0000-000000000101/profile.webp"
  content_type = "image/webp"
  size = 1024
  purpose = "santri_avatar"
}
Add-Result "function signed upload santri own avatar" ($ownAvatar.ok -and $ownAvatar.body.data.path)

$otherAvatar = CallFunction -Name "generate-signed-upload-url" -Token $santriToken -Body @{
  bucket = "avatars"
  path = "santri/a1fa7a10-0000-0000-0000-000000000102/profile.webp"
  content_type = "image/webp"
  size = 1024
  purpose = "santri_avatar"
}
Add-Result "function signed upload santri other avatar denied" (-not $otherAvatar.ok)

$invalidMime = CallFunction -Name "generate-signed-upload-url" -Token $santriToken -Body @{
  bucket = "avatars"
  path = "santri/a1fa7a10-0000-0000-0000-000000000101/profile.webp"
  content_type = "application/octet-stream"
  size = 1024
  purpose = "santri_avatar"
}
Add-Result "function signed upload invalid mime denied" (-not $invalidMime.ok)

$oversize = CallFunction -Name "generate-signed-upload-url" -Token $santriToken -Body @{
  bucket = "avatars"
  path = "santri/a1fa7a10-0000-0000-0000-000000000101/profile.webp"
  content_type = "image/webp"
  size = 3000000
  purpose = "santri_avatar"
}
Add-Result "function signed upload oversize denied" (-not $oversize.ok)

$archiveTargetId = "a1fa7a10-0000-0000-0000-000000000101"
$membershipBeforeArchive = RestGet -Path "class_memberships?santri_id=eq.$archiveTargetId&select=id,class_id,status" -Token $adminToken
$santriBeforeArchive = RestGet -Path "santri?id=eq.$archiveTargetId&select=id,current_class_id" -Token $adminToken
$archiveSantri = CallFunction -Name "manage-user" -Token $adminToken -Body @{
  action = "archive"
  role = "santri"
  target_user_id = $archiveTargetId
  reason = "Local archive workflow smoke test"
}
$archivedRecord = RestGet -Path "santri?id=eq.$archiveTargetId&select=id,status,deleted_at,current_class_id" -Token $adminToken
$archivedRows = @($archivedRecord.body)
$archiveStateValid = $archiveSantri.ok -and $archivedRows.Count -eq 1 -and $archivedRows[0].status -eq "Nonaktif" -and $null -ne $archivedRows[0].deleted_at
Add-Result "function manage-user archives santri" $archiveStateValid "status=$($archiveSantri.status) archived=$($archivedRows[0].status)"

$archivedLogin = CallFunction -Name "signin-with-nomor-induk" -Body @{ nomor_induk_qiroati = "AFMLOCAL-ANAK-A01"; password = "LocalOnly-AFM-Dummy-Santri-A1!" }
Add-Result "archived santri login denied" (-not $archivedLogin.ok) "status=$($archivedLogin.status)"

$membershipAfterArchive = RestGet -Path "class_memberships?santri_id=eq.$archiveTargetId&select=id,class_id,status" -Token $adminToken
$santriBeforeRows = @($santriBeforeArchive.body)
$membershipPreserved = @($membershipBeforeArchive.body).Count -gt 0 -and @($membershipBeforeArchive.body).Count -eq @($membershipAfterArchive.body).Count -and $santriBeforeRows[0].current_class_id -eq $archivedRows[0].current_class_id
Add-Result "archive preserves class and membership" $membershipPreserved "memberships=$(@($membershipAfterArchive.body).Count)"

$restoreSantri = CallFunction -Name "manage-user" -Token $adminToken -Body @{
  action = "restore"
  role = "santri"
  target_user_id = $archiveTargetId
}
$restoredRecord = RestGet -Path "santri?id=eq.$archiveTargetId&select=id,status,deleted_at,current_class_id" -Token $adminToken
$restoredRows = @($restoredRecord.body)
$restoreStateValid = $restoreSantri.ok -and $restoredRows.Count -eq 1 -and $restoredRows[0].status -eq "Aktif" -and $null -eq $restoredRows[0].deleted_at
Add-Result "function manage-user restores santri" $restoreStateValid "status=$($restoreSantri.status) restored=$($restoredRows[0].status)"

$restoredLogin = CallFunction -Name "signin-with-nomor-induk" -Body @{ nomor_induk_qiroati = "AFMLOCAL-ANAK-A01"; password = "LocalOnly-AFM-Dummy-Santri-A1!" }
Add-Result "restored santri login works" ($restoredLogin.ok -and $restoredLogin.body.data.session.access_token) "status=$($restoredLogin.status)"

$duplicateSantri = CallFunction -Name "manage-user" -Token $adminToken -Body @{
  action = "create"
  role = "santri"
  initial_password = "LocalOnly-AFM-Dummy-Duplicate-001!"
  profile = @{
    nomor_induk_qiroati = "AFMLOCAL-ANAK-A01"
    nama_lengkap = "Santri Demo Duplicate"
    kategori = "Anak"
  }
}
Add-Result "function manage-user duplicate nomor denied" (-not $duplicateSantri.ok -and $duplicateSantri.status -eq 409) "status=$($duplicateSantri.status) error=$($duplicateSantri.error)"

$ptptCreatedByAdmin = CallFunction -Name "manage-user" -Token $adminToken -Body @{
  action = "create"
  role = "santri"
  initial_password = "LocalOnly-AFM-PTPT-Baru-001!"
  profile = @{
    nomor_induk_qiroati = "AFMLOCAL-PTPT-BARU-01"
    nama_lengkap = "Santri PTPT Create Local Smoke"
    nama_panggilan = "PTPT Create Smoke"
    kategori = "PTPT"
    jilid = "Juz 30"
    sesi_mengaji = "3"
    status = "Aktif"
  }
}
$ptptCreatedUserId = $ptptCreatedByAdmin.body.data.user_id
$ptptCreatedRecord = if ($ptptCreatedUserId) {
  RestGet -Path "santri?id=eq.$ptptCreatedUserId&select=id,nomor_induk_qiroati,kategori,jilid" -Token $adminToken
} else {
  $null
}
$ptptCreatedRows = if ($ptptCreatedRecord) { @($ptptCreatedRecord.body) } else { @() }
$ptptCreatedRowCount = @($ptptCreatedRows).Count
$ptptCreatedOk = $ptptCreatedByAdmin.ok -and $ptptCreatedRowCount -eq 1 -and $ptptCreatedRows[0].kategori -eq "PTPT" -and $ptptCreatedRows[0].jilid -eq "Juz 30"
Add-Result "function manage-user creates ptpt santri" $ptptCreatedOk "status=$($ptptCreatedByAdmin.status) rows=$ptptCreatedRowCount category=$($ptptCreatedRows[0].kategori)"

if ($ptptCreatedUserId) {
  $ptptCleanup = Invoke-Json -Method "DELETE" -Url "$script:ApiUrl/auth/v1/admin/users/$ptptCreatedUserId" -Headers $script:ServiceHeaders
  Add-Result "ptpt create smoke cleanup" $ptptCleanup.ok "status=$($ptptCleanup.status)"
}

$adultWithoutNomor = CallFunction -Name "manage-user" -Token $adminToken -Body @{
  action = "create"
  role = "santri"
  initial_password = "LocalOnly-AFM-Dewasa-001!"
  profile = @{
    nomor_induk_qiroati = $null
    nama_lengkap = "Santri Dewasa Optional Local Smoke"
    nama_panggilan = "Adult Optional Smoke"
    kategori = "Dewasa"
    status = "Aktif"
  }
}
$adultUserId = $adultWithoutNomor.body.data.user_id
$adultRecord = if ($adultUserId) {
  RestGet -Path "santri?id=eq.$adultUserId&select=id,nomor_induk_qiroati,kategori" -Token $adminToken
} else {
  $null
}
$adultRows = if ($adultRecord) { @($adultRecord.body) } else { @() }
$adultRowCount = @($adultRows).Count
$adultCreated = $adultWithoutNomor.ok -and $adultRowCount -eq 1 -and $null -eq $adultRows[0].nomor_induk_qiroati -and $adultRows[0].kategori -eq "Dewasa"
Add-Result "function manage-user creates adult without nomor induk" $adultCreated "function_ok=$($adultWithoutNomor.ok) user_created=$([bool]$adultUserId) rows=$adultRowCount nomor_null=$($null -eq $adultRows[0].nomor_induk_qiroati) category=$($adultRows[0].kategori)"

if ($adultUserId) {
  $adultCleanup = Invoke-Json -Method "DELETE" -Url "$script:ApiUrl/auth/v1/admin/users/$adultUserId" -Headers $script:ServiceHeaders
  Add-Result "adult optional smoke cleanup" $adultCleanup.ok "status=$($adultCleanup.status)"
}

$resetGuru = CallFunction -Name "reset-user-password" -Token $adminToken -Body @{
  target_user_id = "a1fa7a10-0000-0000-0000-000000000003"
  new_password = "LocalOnly-AFM-Dummy-Guru-B-Reset!"
  require_password_change = $true
}
Add-Result "function reset password admin allowed" ($resetGuru.ok) "status=$($resetGuru.status) error=$($resetGuru.error)"

$guruBResetLogin = SignInPassword -Email "guru-b-demo@example.invalid" -Password "LocalOnly-AFM-Dummy-Guru-B-Reset!"
Add-Result "auth reset password login works" ($guruBResetLogin.ok -and $guruBResetLogin.body.access_token)

$failed = @($script:Results | Where-Object { -not $_.passed })
Write-Host "SUMMARY passed=$($script:Results.Count - $failed.Count) failed=$($failed.Count)"
if ($failed.Count -gt 0) {
  exit 1
}
exit 0
