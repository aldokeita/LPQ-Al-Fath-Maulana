param(
  # Project Ref of the database to inspect. Must match the project linked with `supabase link`.
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [string]$OutputRoot = "_private_reference\face-pilot-rehearsal"
)

# Read-only rehearsal for the face attendance pilot. Every command here only READS the linked
# project; nothing is pushed, repaired or executed remotely:
#   - supabase migration list   -> which migration versions are applied remotely vs in the repo
#   - supabase db dump          -> schema-only dump (no santri data) written to a local, git-ignored folder
#   - supabase db diff --linked -> differences between the repo migrations and the remote public schema
# Output goes to _private_reference (git-ignored). Review it before deciding to apply any migration.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ($ProjectRef -notmatch '^[a-z]{20}$') { throw "Project Ref format is invalid." }

$linkedRefFile = Join-Path $root "supabase\.temp\project-ref"
if (-not (Test-Path -LiteralPath $linkedRefFile -PathType Leaf)) {
  throw "No linked project. Run: supabase link --project-ref $ProjectRef"
}
$linkedRef = (Get-Content -LiteralPath $linkedRefFile -Raw).Trim()
if ($linkedRef -ne $ProjectRef) {
  throw "Linked project ($linkedRef) differs from -ProjectRef ($ProjectRef). Refusing to inspect the wrong project."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $root (Join-Path $OutputRoot $stamp)
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "1/3 Migration history (read-only)..."
supabase migration list --linked 2>&1 | Tee-Object -FilePath (Join-Path $outputDir "migration-list.txt")
if ($LASTEXITCODE -ne 0) { throw "supabase migration list failed." }

Write-Host "2/3 Schema-only dump (read-only, no data)..."
supabase db dump --linked -f (Join-Path $outputDir "remote-schema.sql")
if ($LASTEXITCODE -ne 0) { throw "supabase db dump failed." }

Write-Host "3/3 Schema diff of public: repo migrations vs remote (read-only, needs Docker)..."
supabase db diff --linked --schema public 2>&1 | Out-File -Encoding utf8 (Join-Path $outputDir "public-schema-diff.sql")
if ($LASTEXITCODE -ne 0) { throw "supabase db diff failed." }

Write-Host ""
Write-Host "Done. Files in: $outputDir"
Write-Host "Expected in public-schema-diff.sql: only the face pilot objects (attendance_source_check allowing 'face',"
Write-Host "pilot_face_operation, pilot_record_santri_attendance). Anything else is drift to resolve first."
Write-Host "Expected in migration-list.txt: every remote version also exists locally."
