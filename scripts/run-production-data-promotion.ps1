param(
  [switch]$Resume,
  [string]$ProjectRef = $env:LPQ_PRODUCTION_PROJECT_REF
)

$ErrorActionPreference = "Stop"
$expectedRef = $ProjectRef
if ([string]::IsNullOrWhiteSpace($expectedRef) -or $expectedRef -notmatch '^[a-z0-9]{15,32}$') {
  throw "Project Ref production baru wajib diberikan dan harus valid."
}

$secretInput = Read-Host "Masukkan secret/service-role key target (input tersembunyi)" -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretInput)

try {
  $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $confirmation = Read-Host "Ketik IMPORT-PRODUCTION-$expectedRef untuk melanjutkan"
  if ($confirmation -cne "IMPORT-PRODUCTION-$expectedRef") {
    throw "Konfirmasi promosi data dibatalkan."
  }

  $env:SUPABASE_URL = "https://$expectedRef.supabase.co"
  $env:LPQ_PRODUCTION_PROJECT_REF = $expectedRef
  $env:SUPABASE_SERVICE_ROLE_KEY = $secret
  $env:PRODUCTION_IMPORT_EXECUTE = "true"
  $env:PRODUCTION_IMPORT_RESUME = if ($Resume) { "true" } else { "false" }
  $env:PRODUCTION_IMPORT_CONFIRMATION = $confirmation

  & node (Join-Path $PSScriptRoot "promote-staging-production-data.mjs")
  if ($LASTEXITCODE -ne 0) {
    throw "Promosi data belum selesai. Gunakan -Resume setelah akar error diperbaiki."
  }
}
finally {
  Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:LPQ_PRODUCTION_PROJECT_REF -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:PRODUCTION_IMPORT_EXECUTE -ErrorAction SilentlyContinue
  Remove-Item Env:PRODUCTION_IMPORT_RESUME -ErrorAction SilentlyContinue
  Remove-Item Env:PRODUCTION_IMPORT_CONFIRMATION -ErrorAction SilentlyContinue
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  $secret = $null
  $secretInput = $null
}

Write-Host "Promosi data dan asset selesai serta tervalidasi." -ForegroundColor Green
