param(
  [string]$SupabaseUrl = "http://127.0.0.1:55321",
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
  [string]$Environment = "local"
)

$ErrorActionPreference = "Stop"

function Assert-LocalTarget {
  param([string]$Url, [string]$EnvName)

  if ($EnvName -match "prod|production|staging") {
    throw "Refusing to bootstrap dummy Auth users for non-local environment '$EnvName'."
  }

  $uri = [Uri]$Url
  $isLocalHost = $uri.Host -in @("127.0.0.1", "localhost", "::1")
  $isLocalPort = $uri.Port -eq 55321
  $isHttp = $uri.Scheme -eq "http"

  if (-not ($isHttp -and $isLocalHost -and $isLocalPort)) {
    throw "Refusing non-local Supabase URL. Expected http://127.0.0.1:55321 or http://localhost:55321."
  }
}

function Get-LocalServiceRoleKey {
  param([string]$ExistingKey)

  if ($ExistingKey -and $ExistingKey.Trim().Length -gt 0) {
    return $ExistingKey.Trim()
  }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $statusOutput = & supabase status -o env 2>&1
  $statusExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  foreach ($line in $statusOutput) {
    $text = $line.ToString()
    if ($text -match "^(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=(.+)$") {
      return $Matches[2].Trim().Trim('"')
    }
  }

  if ($statusExitCode -ne 0) {
    throw "Local service-role key is unavailable from Supabase status. Ensure 'supabase start' is running."
  }

  throw "Could not find local SERVICE_ROLE_KEY in Supabase status output."
}

function Invoke-AuthAdminJson {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Key,
    [object]$Body = $null
  )

  $headers = @{
    "apikey" = $Key
    "Authorization" = "Bearer $Key"
    "Content-Type" = "application/json"
  }

  $uri = "$SupabaseUrl/auth/v1$Path"

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 10 -Compress
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
}

function New-DummyUserSpec {
  @(
    @{
      id = "a1fa7a10-0000-0000-0000-000000000001"
      email = "admin-demo@example.invalid"
      password = "LocalOnly-AFM-Dummy-Admin-001!"
      role = "admin"
      name = "Admin Demo"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000002"
      email = "guru-a-demo@example.invalid"
      password = "LocalOnly-AFM-Dummy-Guru-A-001!"
      role = "guru"
      name = "Guru Demo A"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000003"
      email = "guru-b-demo@example.invalid"
      password = "LocalOnly-AFM-Dummy-Guru-B-001!"
      role = "guru"
      name = "Guru Demo B"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000004"
      email = "pentashih-demo@example.invalid"
      password = "LocalOnly-AFM-Dummy-Pentashih-001!"
      role = "pentashih"
      name = "Pentashih Demo"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000101"
      email = "santri+a1fa7a10-0000-0000-0000-000000000101@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-Santri-A1!"
      role = "santri"
      name = "Santri Demo A1"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000102"
      email = "santri+a1fa7a10-0000-0000-0000-000000000102@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-Santri-A2!"
      role = "santri"
      name = "Santri Demo A2"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000103"
      email = "santri+a1fa7a10-0000-0000-0000-000000000103@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-Santri-A3!"
      role = "santri"
      name = "Santri Demo A3"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000201"
      email = "santri+a1fa7a10-0000-0000-0000-000000000201@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-Santri-B1!"
      role = "santri"
      name = "Santri Demo B1"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000202"
      email = "santri+a1fa7a10-0000-0000-0000-000000000202@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-Santri-B2!"
      role = "santri"
      name = "Santri Demo B2"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000301"
      email = "santri+a1fa7a10-0000-0000-0000-000000000301@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-PTPT-1!"
      role = "santri"
      name = "Santri PTPT Demo 1"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000302"
      email = "santri+a1fa7a10-0000-0000-0000-000000000302@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-PTPT-2!"
      role = "santri"
      name = "Santri PTPT Demo 2"
    },
    @{
      id = "a1fa7a10-0000-0000-0000-000000000303"
      email = "santri+a1fa7a10-0000-0000-0000-000000000303@auth.lpqalfathmaulana.local"
      password = "LocalOnly-AFM-Dummy-PTPT-3!"
      role = "santri"
      name = "Santri PTPT Demo 3"
    }
  )
}

try {
  Assert-LocalTarget -Url $SupabaseUrl -EnvName $Environment
  $key = Get-LocalServiceRoleKey -ExistingKey $ServiceRoleKey
  $users = New-DummyUserSpec

  $existing = Invoke-AuthAdminJson -Method "GET" -Path "/admin/users?page=1&per_page=200" -Key $key
  $existingUsers = @()
  if ($existing.users) {
    $existingUsers = @($existing.users)
  } elseif ($existing -is [array]) {
    $existingUsers = @($existing)
  }

  foreach ($spec in $users) {
    $found = $existingUsers | Where-Object { $_.email -eq $spec.email } | Select-Object -First 1

    if ($found) {
      if ($found.id -ne $spec.id) {
        throw "Existing dummy Auth user '$($spec.email)' has unexpected UUID. Refusing to continue."
      }
      Write-Host "Auth dummy exists: $($spec.role) $($spec.id)"
      continue
    }

    $payload = @{
      id = $spec.id
      email = $spec.email
      password = $spec.password
      email_confirm = $true
      user_metadata = @{
        role = $spec.role
        display_name = $spec.name
      }
      app_metadata = @{
        role = $spec.role
        provider = "email"
        providers = @("email")
      }
    }

    $created = Invoke-AuthAdminJson -Method "POST" -Path "/admin/users" -Key $key -Body $payload
    if ($created.id -ne $spec.id) {
      throw "Created Auth user '$($spec.email)' returned unexpected UUID. Refusing to continue."
    }

    Write-Host "Created Auth dummy: $($spec.role) $($spec.id)"
  }

  Write-Host "Local Auth dummy bootstrap completed. Passwords and service-role key were not printed."
  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
