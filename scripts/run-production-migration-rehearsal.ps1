param(
  [string]$SupabaseUrl = "http://127.0.0.1:55321",
  [string]$PreparedData = "_private_reference\migration-work\prepared-production-data\prepared-data.json"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Assert-LocalTarget {
  param([string]$Url)

  $uri = [Uri]$Url
  if ($uri.Scheme -ne "http" -or $uri.Host -notin @("127.0.0.1", "localhost", "::1") -or $uri.Port -ne 55321) {
    throw "Migration rehearsal menolak target non-local."
  }
}

function Get-LocalServiceRoleKey {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $status = & supabase status -o env 2>&1
  $statusExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  if ($statusExitCode -ne 0) {
    throw "Supabase lokal belum aktif."
  }

  foreach ($line in $status) {
    $text = $line.ToString()
    if ($text -match "^(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=(.+)$") {
      return $Matches[2].Trim().Trim('"')
    }
  }

  throw "Local service-role key tidak ditemukan."
}

Assert-LocalTarget -Url $SupabaseUrl
$preparedPath = Join-Path $root $PreparedData
$privateRoot = Join-Path $root "_private_reference"
$resolvedPrivate = [System.IO.Path]::GetFullPath($privateRoot)
$resolvedPrepared = [System.IO.Path]::GetFullPath($preparedPath)
if (-not $resolvedPrepared.StartsWith($resolvedPrivate, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Prepared data harus berada di _private_reference."
}
if (-not (Test-Path -LiteralPath $resolvedPrepared -PathType Leaf)) {
  throw "Prepared data tidak ditemukan."
}

$serviceRoleKey = Get-LocalServiceRoleKey
try {
  $env:SUPABASE_URL = $SupabaseUrl
  $env:SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey
  & node (Join-Path $PSScriptRoot "import-production-migration-local.mjs") $resolvedPrepared
  if ($LASTEXITCODE -ne 0) {
    throw "Import rehearsal gagal."
  }
} finally {
  Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  $serviceRoleKey = $null
}

Write-Host "Production migration rehearsal import completed locally."
