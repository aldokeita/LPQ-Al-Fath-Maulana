$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repositoryRoot 'src'

if (-not (Test-Path -LiteralPath $sourceRoot)) {
  throw "Source directory not found: $sourceRoot"
}

$patterns = [ordered]@{
  'legacy relationship alias' = '(?i)(class|guru)\s*:\s*id_kelas'
  'legacy PostgREST filter' = '(?i)\.(eq|neq|in|is)\(\s*[''"]id_kelas[''"]'
  'legacy santri select column' = '(?i)\.select\(\s*[''"][^''"\r\n]*\bid_kelas\b'
  'legacy santri mutation field' = '(?i)\.(insert|update|upsert)\(\s*\{[^}\r\n]*\bid_kelas\s*:'
}

$violations = @()
$files = Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Include '*.js', '*.jsx', '*.ts', '*.tsx'

foreach ($file in $files) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  foreach ($entry in $patterns.GetEnumerator()) {
    if ($content -match $entry.Value) {
      $relativePath = $file.FullName.Substring($repositoryRoot.Length + 1)
      $violations += "$relativePath ($($entry.Key))"
    }
  }
}

if ($violations.Count -gt 0) {
  Write-Error ("Legacy santri class database contract detected:`n - " + (($violations | Sort-Object -Unique) -join "`n - "))
  exit 1
}

Write-Host 'PASS no legacy santri.id_kelas database queries'
