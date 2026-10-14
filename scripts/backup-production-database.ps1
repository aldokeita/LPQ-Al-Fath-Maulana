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

Write-Host "Paste the Session pooler URI from Dashboard > Connect > Session pooler (keep [YOUR-PASSWORD] as is):"
$template = (Read-Host "URI").Trim()
$pattern = '^postgresql://postgres\.(?<ref>[a-z]{20}):\[YOUR-PASSWORD\]@(?<host>[a-z0-9.-]+\.pooler\.supabase\.com):(?<port>\d+)/postgres$'
$match = [regex]::Match($template, $pattern)
if (-not $match.Success) { throw "URI is not a Supabase pooler URI with the [YOUR-PASSWORD] placeholder." }
if ($match.Groups['ref'].Value -ne $ProjectRef) { throw "URI belongs to project $($match.Groups['ref'].Value), not $ProjectRef. Refusing." }
# Transaction mode (6543) does not support pg_dump reliably; Session mode uses 5432.
if ($match.Groups['port'].Value -ne '5432') { throw "Use the Session pooler (port 5432), not the Transaction pooler." }

$secure = Read-Host "Database password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if (-not $password) { throw "Password is empty." }
  $dbUrl = $template.Replace('[YOUR-PASSWORD]', [uri]::EscapeDataString($password))
  $password = $null

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
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
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
