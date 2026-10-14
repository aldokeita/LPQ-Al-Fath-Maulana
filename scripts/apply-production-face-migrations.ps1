param(
  # Project Ref of the database to migrate. The pooler URI must belong to this project.
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [string]$BackupRoot = "_private_reference\production-backups",
  [int]$MaxBackupAgeHours = 24
)

# Applies ONLY the pending face attendance pilot migration(s) listed in $expected:
#   1. refuses without a recent backup made by backup-production-database.ps1 for this project;
#   2. dry run: the pending list must be exactly $expected, nothing else;
#   3. asks you to type the Project Ref, then runs `supabase db push` (the CLI asks Y/n once more);
#   4. dry run again: the remote must be up to date.
# The pilot stays off: no function is deployed and no secret is set here.
# Afterwards run scripts/verify-face-attendance-migrations.sql in the SQL Editor.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ($ProjectRef -notmatch '^[a-z]{20}$') { throw "Project Ref format is invalid." }

# 20261007000100 and 20261014000100 are already applied in production; only the guru step is pending.
$expected = @("20261015000100_face_attendance_guru.sql")
foreach ($name in $expected) {
  if (-not (Test-Path -LiteralPath (Join-Path $root "supabase\migrations\$name") -PathType Leaf)) { throw "Missing migration: $name" }
}
$dirty = git status --porcelain -- supabase/migrations
if ($LASTEXITCODE -ne 0) { throw "git status failed." }
if ($dirty) { throw "supabase/migrations has uncommitted changes. Commit or discard them first:`n$dirty" }

$backup = Get-ChildItem -LiteralPath (Join-Path $root $BackupRoot) -Directory -Filter "$ProjectRef-*" -ErrorAction SilentlyContinue |
  Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "SHA256SUMS.txt") -PathType Leaf } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $backup -or $backup.LastWriteTime -lt (Get-Date).AddHours(-$MaxBackupAgeHours)) {
  throw "No backup for $ProjectRef from the last $MaxBackupAgeHours hours. Run scripts/backup-production-database.ps1 first."
}
Write-Host "Backup found: $($backup.FullName)"

$logDir = Join-Path $root (Join-Path "_private_reference\face-pilot-rehearsal" "apply-$ProjectRef-$(Get-Date -Format 'yyyyMMdd-HHmmss')")
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# The CLI prints its progress on stderr; Windows PowerShell turns that into errors under "Stop".
function Invoke-DryRun([string]$DbUrl, [string]$LogFile) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { $lines = & supabase db push --db-url $DbUrl --dry-run 2>&1 | ForEach-Object { "$_" } }
  finally { $ErrorActionPreference = $previous }
  $code = $LASTEXITCODE
  $lines | Set-Content -Encoding utf8 $LogFile
  $lines | ForEach-Object { Write-Host "  $_" }
  if ($code -ne 0) { throw "supabase db push --dry-run failed (see $LogFile)." }
  return , @($lines | ForEach-Object { [regex]::Matches($_, '\d{14}_[A-Za-z0-9_]+\.sql') | ForEach-Object { $_.Value } } | Select-Object -Unique)
}

. (Join-Path $PSScriptRoot "supabasePoolerUrl.ps1")
$dbUrl = Read-SupabasePoolerUrl -ProjectRef $ProjectRef
try {
  Write-Host ""
  Write-Host "1/3 Dry run (nothing is changed)..."
  $pending = Invoke-DryRun $dbUrl (Join-Path $logDir "dry-run-before.txt")
  if (($pending -join "|") -ne ($expected -join "|")) {
    throw "Pending migrations are not exactly [$($expected -join ', ')]. Found: [$($pending -join ', ')]. Stopping without changes."
  }

  Write-Host ""
  Write-Host "Only these migrations will be applied to $ProjectRef :"
  $expected | ForEach-Object { Write-Host "  - $_" }
  Write-Host "It adds private guru face tables and lets the service-role-only face RPC enrol and match gurus."
  Write-Host "No attendance table is altered; the face RPC is replaced in one transaction."
  $confirm = (Read-Host "Type the Project Ref to apply, anything else to cancel").Trim()
  if ($confirm -ne $ProjectRef) { Write-Host "Cancelled. Nothing was changed."; return }

  Write-Host ""
  Write-Host "2/3 Applying (the CLI asks Y/n once more)..."
  & supabase db push --db-url $dbUrl
  if ($LASTEXITCODE -ne 0) { throw "supabase db push failed. Each migration runs in its own transaction; check the migration list before retrying." }

  Write-Host ""
  Write-Host "3/3 Dry run after apply..."
  $left = Invoke-DryRun $dbUrl (Join-Path $logDir "dry-run-after.txt")
  if ($left.Count -gt 0) { throw "Migrations still pending after push: [$($left -join ', ')]." }
} finally {
  $dbUrl = $null
}

Write-Host ""
Write-Host "Done. Remote is up to date. Logs in: $logDir"
Write-Host "Next: run scripts/verify-face-attendance-migrations.sql in the SQL Editor; every column must be true."
