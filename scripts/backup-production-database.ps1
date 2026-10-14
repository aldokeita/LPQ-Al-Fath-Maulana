param(
  # Project Ref of the database to back up. The pooler URI must belong to this project.
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [string]$OutputRoot = "_private_reference\production-backups"
)

# Read-only logical backup of a Supabase database before applying migrations. Uses pg_dump through the
# Supabase CLI (needs Docker running) and only READS the remote database:
#   roles.sql  -> custom roles
#   schema.sql -> schema of the project's own schemas
#   data.sql   -> all data as COPY statements (santri personal data: keep private)
# The password is read without echo and never written to disk or shell history.
# Output goes to _private_reference (git-ignored). Do not commit, share or upload it.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ($ProjectRef -notmatch '^[a-z]{20}$') { throw "Project Ref format is invalid." }

. (Join-Path $PSScriptRoot "supabasePoolerUrl.ps1")
$dbUrl = Read-SupabasePoolerUrl -ProjectRef $ProjectRef
try {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $outputDir = Join-Path $root (Join-Path $OutputRoot "$ProjectRef-$stamp")
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

  $dumps = @(
    @{ Step = "1/3 Roles"; File = "roles.sql"; Args = @("--role-only") },
    @{ Step = "2/3 Schema"; File = "schema.sql"; Args = @() },
    @{ Step = "3/3 Data"; File = "data.sql"; Args = @("--use-copy", "--data-only") }
  )
  foreach ($dump in $dumps) {
    Write-Host "$($dump.Step) (read-only)..."
    $file = Join-Path $outputDir $dump.File
    $extra = $dump.Args
    supabase db dump --db-url $dbUrl -f $file @extra
    if ($LASTEXITCODE -ne 0) { throw "supabase db dump failed at: $($dump.Step)." }
    if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -eq 0) {
      throw "$($dump.File) is missing or empty."
    }
  }
} finally {
  $dbUrl = $null
}

$schema = Get-Content -LiteralPath (Join-Path $outputDir "schema.sql") -Raw
if ($schema -notmatch 'CREATE TABLE[^;(]*"?public"?\."?attendance"?\s*\(') { throw "schema.sql does not contain public.attendance; backup looks incomplete." }
$copies = (Select-String -LiteralPath (Join-Path $outputDir "data.sql") -Pattern '^COPY ').Count
if ($copies -eq 0) { throw "data.sql contains no COPY statements; backup looks incomplete." }

$manifest = Get-ChildItem -LiteralPath $outputDir -Filter *.sql | ForEach-Object {
  "{0}  {1}  {2} bytes" -f (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLower(), $_.Name, $_.Length
}
$manifest | Set-Content -Encoding utf8 (Join-Path $outputDir "SHA256SUMS.txt")

Write-Host ""
$manifest | ForEach-Object { Write-Host $_ }
Write-Host "Tables dumped: $copies"
Write-Host "Done. Backup in: $outputDir"
Write-Host "Contains personal data. Keep it off cloud sync and chat; copy it to an encrypted drive if needed."
