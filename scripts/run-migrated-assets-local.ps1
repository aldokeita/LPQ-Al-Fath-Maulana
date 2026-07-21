param([string]$SupabaseUrl = "http://127.0.0.1:55321")

$ErrorActionPreference = "Stop"
$uri = [Uri]$SupabaseUrl
if ($uri.Scheme -ne "http" -or $uri.Host -notin @("127.0.0.1", "localhost", "::1") -or $uri.Port -ne 55321) {
  throw "Asset migration menolak target non-local."
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$status = & supabase status -o env 2>&1
$statusExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($statusExitCode -ne 0) { throw "Supabase lokal belum aktif." }

$serviceRoleKey = $null
foreach ($line in $status) {
  if ($line.ToString() -match "^(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=(.+)$") {
    $serviceRoleKey = $Matches[2].Trim().Trim('"')
    break
  }
}
if (-not $serviceRoleKey) { throw "Local service-role key tidak ditemukan." }

try {
  $env:SUPABASE_URL = $SupabaseUrl
  $env:SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey
  & node (Join-Path $PSScriptRoot "upload-migrated-assets-local.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Upload asset rehearsal gagal." }
} finally {
  Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  $serviceRoleKey = $null
}

Write-Host "Migrated assets applied to local Supabase."
