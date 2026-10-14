# Dot-source this file. Read-SupabasePoolerUrl asks for the Session pooler URI (with the [YOUR-PASSWORD]
# placeholder) and the database password, checks that the URI belongs to $ProjectRef, and returns a
# percent-encoded connection string. The password is read without echo and never written anywhere.
function Read-SupabasePoolerUrl {
  param([Parameter(Mandatory = $true)][string]$ProjectRef)

  Write-Host "Paste the Session pooler URI from Dashboard > Connect > Session pooler (keep [YOUR-PASSWORD] as is):"
  $template = (Read-Host "URI").Trim()
  $pattern = '^postgresql:\/\/postgres\.(?<ref>[a-z]{20}):\[YOUR-PASSWORD\]@(?<host>[a-z0-9.-]+\.pooler\.supabase\.com):(?<port>\d+)/postgres$'
  $match = [regex]::Match($template, $pattern)
  if (-not $match.Success) { throw "URI is not a Supabase pooler URI with the [YOUR-PASSWORD] placeholder." }
  if ($match.Groups['ref'].Value -ne $ProjectRef) { throw "URI belongs to project $($match.Groups['ref'].Value), not $ProjectRef. Refusing." }
  # Transaction mode (6543) does not support pg_dump or migrations reliably; Session mode uses 5432.
  if ($match.Groups['port'].Value -ne '5432') { throw "Use the Session pooler (port 5432), not the Transaction pooler." }

  $secure = Read-Host "Database password" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if (-not $password) { throw "Password is empty." }
    return $template.Replace('[YOUR-PASSWORD]', [uri]::EscapeDataString($password))
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}
