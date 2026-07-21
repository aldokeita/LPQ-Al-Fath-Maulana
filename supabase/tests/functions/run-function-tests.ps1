param([string]$SupabaseUrl = "http://127.0.0.1:55321")

$ErrorActionPreference = "Stop"
$runner = Resolve-Path (Join-Path $PSScriptRoot "../../../scripts/run-local-backend-tests.ps1")
Write-Host "Running local backend suite with Edge Function coverage."
& $runner -SupabaseUrl $SupabaseUrl
exit $LASTEXITCODE
