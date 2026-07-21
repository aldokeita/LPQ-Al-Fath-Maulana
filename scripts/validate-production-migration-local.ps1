param(
  [string]$SupabaseUrl = "http://127.0.0.1:55321",
  [string]$SafeSummary = "_private_reference\migration-work\prepared-production-data\safe-summary.json"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$uri = [Uri]$SupabaseUrl
if ($uri.Scheme -ne "http" -or $uri.Host -notin @("127.0.0.1", "localhost", "::1") -or $uri.Port -ne 55321) {
  throw "Validator menolak target non-local."
}

$summaryPath = Join-Path $root $SafeSummary
if (-not (Test-Path -LiteralPath $summaryPath -PathType Leaf)) {
  throw "Safe summary tidak ditemukan."
}
$summary = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json

$dbContainer = docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1
if (-not $dbContainer) {
  throw "Container database Supabase lokal tidak ditemukan."
}

$sql = @'
\pset tuples_only on
\pset format unaligned
select 'user_profiles|' || count(*) from public.user_profiles;
select 'guru|' || count(*) from public.guru;
select 'classes|' || count(*) from public.classes;
select 'santri|' || count(*) from public.santri;
select 'auth_login_aliases|' || count(*) from public.auth_login_aliases;
select 'class_memberships|' || count(*) from public.class_memberships;
select 'attendance|' || count(*) from public.attendance;
select 'payments|' || count(*) from public.payments;
select 'expenses|' || count(*) from public.expenses;
select 'academic_calendar|' || count(*) from public.academic_calendar;
select 'mmq_schedule|' || count(*) from public.mmq_schedule;
select 'mmq_attendance|' || count(*) from public.mmq_attendance;
select 'website_content|' || count(*) from public.website_content;
select 'auth_profile_orphans|' || count(*) from public.user_profiles p left join auth.users u on u.id=p.id where u.id is null;
select 'santri_auth_orphans|' || count(*) from public.santri s left join auth.users u on u.id=s.id where u.id is null;
select 'guru_auth_orphans|' || count(*) from public.guru g left join auth.users u on u.id=g.id where u.id is null;
select 'membership_orphans|' || count(*) from public.class_memberships m left join public.santri s on s.id=m.santri_id left join public.classes c on c.id=m.class_id where s.id is null or c.id is null;
select 'active_membership_duplicates|' || count(*) from (select santri_id from public.class_memberships where status='active' and end_date is null group by santri_id having count(*)>1) q;
select 'current_class_mismatches|' || count(*) from public.santri s left join public.class_memberships m on m.santri_id=s.id and m.status='active' and m.end_date is null where s.current_class_id is distinct from m.class_id;
select 'attendance_orphans|' || count(*) from public.attendance a left join auth.users u on u.id=a.user_id where u.id is null;
select 'attendance_duplicates|' || count(*) from (select user_id,attendance_date,coalesce(sesi,'') from public.attendance group by user_id,attendance_date,coalesce(sesi,'') having count(*)>1) q;
select 'payment_orphans|' || count(*) from public.payments p left join public.santri s on s.id=p.santri_id where s.id is null;
select 'payment_period_duplicates|' || count(*) from (select santri_id,bulan,tahun from public.payments where deleted_at is null and bulan is not null and tahun is not null group by santri_id,bulan,tahun having count(*)>1) q;
select 'payment_transaction_duplicates|' || count(*) from (select transaction_id from public.payments where transaction_id is not null group by transaction_id having count(*)>1) q;
select 'mmq_duplicates|' || count(*) from (select schedule_id,guru_id,attendance_date from public.mmq_attendance group by schedule_id,guru_id,attendance_date having count(*)>1) q;
select 'mmq_orphans|' || count(*) from public.mmq_attendance a left join public.mmq_schedule s on s.id=a.schedule_id left join public.guru g on g.id=a.guru_id where s.id is null or g.id is null;
select 'password_columns|' || count(*) from information_schema.columns where table_schema='public' and column_name ilike '%password%';
select 'rls_missing_sensitive_tables|' || count(*) from (values ('user_profiles'),('guru'),('santri'),('attendance'),('payments'),('expenses'),('class_memberships'),('mmq_attendance')) expected(name) left join pg_class c on c.relname=expected.name left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public' where c.oid is null or not c.relrowsecurity;
select 'storage_buckets_missing|' || 3-count(*) from storage.buckets where id in ('avatars','website-assets','murojaah-recordings');
select 'legacy_content_url_references|' || count(*) from public.website_content where content::text like '%PROJECT_REF_SUMBER_DIHAPUS%';
select 'guru_avatar_missing_objects|' || count(*) from public.guru g where g.avatar_path is not null and not exists (select 1 from storage.objects o where o.bucket_id='avatars' and o.name=g.avatar_path);
select 'guru_avatar_orphan_objects|' || count(*) from storage.objects o where o.bucket_id='avatars' and o.name like 'guru/%/profile.webp' and not exists (select 1 from public.guru g where g.avatar_path=o.name);
select 'santri_avatar_missing_objects|' || count(*) from public.santri s where s.avatar_path is not null and not exists (select 1 from storage.objects o where o.bucket_id='avatars' and o.name=s.avatar_path);
select 'santri_avatar_orphan_objects|' || count(*) from storage.objects o where o.bucket_id='avatars' and o.name like 'santri/%/profile.webp' and not exists (select 1 from public.santri s where s.avatar_path=o.name);
select 'website_asset_objects|' || count(*) from storage.objects where bucket_id='website-assets';
select 'hafalan_items|' || count(*) from public.hafalan_items;
select 'character_assessment_items|' || count(*) from public.character_assessment_items;
'@

$lines = $sql | docker exec -i $dbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
  throw "Query validasi database lokal gagal."
}

$actual = @{}
foreach ($line in $lines) {
  $text = $line.ToString().Trim()
  if ($text -notmatch '^([^|]+)\|(\d+)$') { continue }
  $actual[$Matches[1]] = [int64]$Matches[2]
}

$failures = @()
$expectedTables = @(
  "user_profiles", "guru", "classes", "santri", "auth_login_aliases", "class_memberships",
  "attendance", "payments", "expenses", "academic_calendar", "mmq_schedule", "mmq_attendance", "website_content"
)
foreach ($table in $expectedTables) {
  $expected = [int64]$summary.target_counts.$table
  if ($actual[$table] -ne $expected) {
    $failures += "$table expected=$expected actual=$($actual[$table])"
  }
}

$zeroChecks = @(
  "auth_profile_orphans", "santri_auth_orphans", "guru_auth_orphans", "membership_orphans",
  "active_membership_duplicates", "current_class_mismatches", "attendance_orphans", "attendance_duplicates",
  "payment_orphans", "payment_period_duplicates", "payment_transaction_duplicates", "mmq_duplicates",
  "mmq_orphans", "password_columns", "rls_missing_sensitive_tables", "storage_buckets_missing",
  "legacy_content_url_references",
  "guru_avatar_missing_objects", "guru_avatar_orphan_objects",
  "santri_avatar_missing_objects", "santri_avatar_orphan_objects"
)
foreach ($check in $zeroChecks) {
  if ($actual[$check] -ne 0) {
    $failures += "$check=$($actual[$check])"
  }
}
if ($actual["hafalan_items"] -lt 1) { $failures += "hafalan_items kosong" }
if ($actual["character_assessment_items"] -ne 15) { $failures += "character_assessment_items=$($actual['character_assessment_items'])" }

Write-Host "Migration database integrity checks: $($zeroChecks.Count + $expectedTables.Count + 2)"
Write-Host "Legacy website-content references pending asset migration: $($actual['legacy_content_url_references'])"
Write-Host "Website assets stored locally: $($actual['website_asset_objects'])"
if ($failures.Count -gt 0) {
  foreach ($failure in $failures) { Write-Error $failure }
  exit 1
}

Write-Host "Local production migration validation passed."
exit 0
