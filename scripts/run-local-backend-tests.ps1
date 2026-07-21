param(
  [string]$SupabaseUrl = "http://127.0.0.1:55321",
  [string]$DbContainer = "supabase_db_lpq-al-fath-maulana-local"
)

$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0

function Add-TestResult {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail = ""
  )

  if ($Passed) {
    $script:Passed += 1
    if ($Detail) { Write-Host "PASS $Name - $Detail" } else { Write-Host "PASS $Name" }
  } else {
    $script:Failed += 1
    if ($Detail) { Write-Host "FAIL $Name - $Detail" } else { Write-Host "FAIL $Name" }
  }
}

function Assert-LocalUrl {
  param([string]$Url)

  $uri = [Uri]$Url
  $allowedHosts = @("127.0.0.1", "localhost", "::1")

  if ($uri.Scheme -ne "http" -or $uri.Port -ne 55321 -or ($uri.Host -notin $allowedHosts)) {
    throw "Refusing non-local Supabase URL. Expected http://127.0.0.1:55321 or http://localhost:55321."
  }
}

function Test-LocalHealth {
  param([switch]$Quiet)

  $apiHealthy = Test-NetConnection -ComputerName "127.0.0.1" -Port 55321 -InformationLevel Quiet
  $dbHealthy = Test-NetConnection -ComputerName "127.0.0.1" -Port 55322 -InformationLevel Quiet

  $dockerHealthy = $false
  try {
    $containers = & docker ps --format "{{.Names}}|{{.Status}}" 2>$null
    $dockerHealthy = ($LASTEXITCODE -eq 0) -and ($containers -match [regex]::Escape($DbContainer))
  } catch {
    $dockerHealthy = $false
  }

  if (-not $Quiet) {
    Add-TestResult "local API health" $apiHealthy "port=55321"
    Add-TestResult "local DB health" $dbHealthy "port=55322"
    Add-TestResult "local Docker DB container" $dockerHealthy $DbContainer
  }

  return ($apiHealthy -and $dbHealthy -and $dockerHealthy)
}

function Invoke-StepScript {
  param(
    [string]$Name,
    [string]$Path,
    [string[]]$Arguments = @()
  )

  $output = & powershell -ExecutionPolicy Bypass -File $Path @Arguments 2>&1
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    Add-TestResult $Name $true (($output | Select-Object -Last 1) -join " ")
  } else {
    Add-TestResult $Name $false (($output | Select-Object -Last 1) -join " ")
  }

  return [pscustomobject]@{
    exitCode = $exitCode
    output = $output
  }
}

function Invoke-SchemaChecks {
  $sql = @'
with expected_migrations(version) as (
  values
    ('20260624000100'),
    ('20260624000200'),
    ('20260624000300'),
    ('20260624000400'),
    ('20260624000500'),
    ('20260624000600'),
    ('20260624000700'),
    ('20260624000800'),
    ('20260624000900'),
    ('20260624001000'),
    ('20260624001100'),
    ('20260624001200'),
    ('20260624001300'),
    ('20260624001400'),
    ('20260624001500'),
    ('20260624001600'),
    ('20260624001700'),
    ('20260624001800'),
    ('20260624001900'),
    ('20260624002000'),
    ('20260624002100'),
    ('20260629000100'),
    ('20260716000100'),
    ('20260716000200'),
    ('20260716000300'),
    ('20260716000400'),
    ('20260717000100'),
    ('20260717000200'),
    ('20260717000300'),
    ('20260717000400'),
    ('20260721000100'),
    ('20260721000200')
),
sensitive_tables(table_name) as (
  values
    ('user_profiles'),
    ('guru'),
    ('santri'),
    ('auth_login_aliases'),
    ('auth_rate_limits'),
    ('classes'),
    ('class_memberships'),
    ('attendance'),
    ('payments'),
    ('expenses'),
    ('murojaah_submissions'),
    ('feedbacks'),
    ('notifications'),
    ('santri_notes'),
    ('login_logs'),
    ('jilid_history'),
    ('santri_character_scores'),
    ('santri_character_strengths'),
    ('santri_behavior_records')
),
forbidden_payment_columns(column_name) as (
  values
    ('jumlah'),
    ('metode_pembayaran'),
    ('catatan'),
    ('notes'),
    ('transaction_id'),
    ('payment_reference')
)
select 'all migrations recorded' as check_name,
       (count(sm.version) = 32 and not exists (
         select 1
         from expected_migrations em
         left join supabase_migrations.schema_migrations sm2 on sm2.version = em.version
         where sm2.version is null
       ))::text as passed,
       'applied=' || count(sm.version)::text as detail
from supabase_migrations.schema_migrations sm
where sm.version in (select version from expected_migrations)

union all
select 'no public application password columns',
       (count(*) = 0)::text,
       'matches=' || count(*)::text
from information_schema.columns
where table_schema = 'public'
  and column_name ilike '%password%'

union all
select 'attendance stores actual session separately',
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'attendance'
           and column_name = 'attended_session'
           and data_type = 'text'
       )::text,
       'column=attendance.attended_session'

union all
select 'santri nomor induk is text',
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'santri'
           and column_name = 'nomor_induk_qiroati'
           and data_type = 'text'
       )::text,
       'column=santri.nomor_induk_qiroati'

union all
select 'adult santri nomor induk is optional',
       (
         exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'santri'
             and column_name = 'nomor_induk_qiroati'
             and is_nullable = 'YES'
         )
         and exists (
           select 1
           from pg_constraint c
           join pg_class t on t.oid = c.conrelid
           join pg_namespace n on n.oid = t.relnamespace
           where n.nspname = 'public'
             and t.relname = 'santri'
             and c.conname = 'santri_nomor_induk_required_for_non_adult'
         )
       )::text,
       'nullable=adult_only'

union all
select 'santri nomor induk unique',
       exists (
         select 1
         from pg_indexes
         where schemaname = 'public'
           and tablename = 'santri'
           and indexdef ilike '%unique%'
           and indexdef ilike '%nomor_induk_qiroati%'
       )::text,
       'unique_index=nomor_induk_qiroati'

union all
select 'no orphan user profiles',
       (not exists (
         select 1
         from public.user_profiles up
         left join auth.users au on au.id = up.id
         where au.id is null
       ))::text,
       'orphan_count=' || (
         select count(*)::text
         from public.user_profiles up
         left join auth.users au on au.id = up.id
         where au.id is null
       )

union all
select 'one active membership per santri',
       (not exists (
         select 1
         from public.class_memberships
         where status = 'active'
         group by santri_id
         having count(*) > 1
       ))::text,
       'violations=' || (
         select count(*)::text
         from (
           select santri_id
           from public.class_memberships
           where status = 'active'
           group by santri_id
           having count(*) > 1
         ) v
       )

union all
select 'sensitive tables have rls enabled',
       (not exists (
         select 1
         from sensitive_tables st
         join pg_class c on c.relname = st.table_name
         join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
         where not c.relrowsecurity
       ))::text,
       'tables=' || (select count(*)::text from sensitive_tables)

union all
select 'payment status summary hides finance detail',
       (not exists (
         select 1
         from information_schema.columns c
         join forbidden_payment_columns f on f.column_name = c.column_name
         where c.table_schema = 'public'
           and c.table_name = 'payment_status_summary'
       ))::text,
       'checked_forbidden_columns'

union all
select 'required storage buckets exist',
       (count(*) = 3)::text,
       'buckets=' || count(*)::text
from storage.buckets
where id in ('avatars', 'website-assets', 'murojaah-recordings')

union all
select 'consume auth rate limit rpc exists',
       exists (
         select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'consume_auth_rate_limit'
       )::text,
       'rpc=consume_auth_rate_limit'

union all
select 'login activity log rpc and rls exist',
       (
         exists (
           select 1
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname = 'record_login_attempt'
         )
         and exists (
           select 1
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public'
             and c.relname = 'login_logs'
             and c.relrowsecurity
         )
       )::text,
       'table=login_logs rpc=record_login_attempt'

union all
select 'jilid history table and rls exist',
       exists (
         select 1
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'jilid_history'
           and c.relrowsecurity
       )::text,
       'table=jilid_history'

union all
select 'move santri to class rpc exists',
       exists (
         select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'move_santri_to_class'
       )::text,
       'rpc=move_santri_to_class'

union all
select 'change santri category rpc exists',
       exists (
         select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'change_santri_category'
       )::text,
       'rpc=change_santri_category'

union all
select 'santri archive rpc is service role only',
       (
         to_regprocedure('public.set_santri_archive_state(uuid,boolean,uuid,text)') is not null
         and has_function_privilege('service_role', 'public.set_santri_archive_state(uuid,boolean,uuid,text)', 'EXECUTE')
         and not has_function_privilege('authenticated', 'public.set_santri_archive_state(uuid,boolean,uuid,text)', 'EXECUTE')
         and not has_function_privilege('anon', 'public.set_santri_archive_state(uuid,boolean,uuid,text)', 'EXECUTE')
       )::text,
       'rpc=set_santri_archive_state scope=service_role'

union all
select 'payments period unique index exists',
       exists (
         select 1
         from pg_indexes
         where schemaname = 'public'
           and tablename = 'payments'
           and indexname = 'payments_active_santri_bulan_tahun_unique'
           and indexdef ilike '%unique%'
           and indexdef ilike '%santri_id%'
           and indexdef ilike '%bulan%'
           and indexdef ilike '%tahun%'
           and indexdef ilike '%deleted_at IS NULL%'
       )::text,
       'index=payments_active_santri_bulan_tahun_unique'

union all
select 'santri default spp column is constrained numeric',
       (
         exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'santri'
             and column_name = 'default_spp_amount'
             and data_type = 'numeric'
         )
         and exists (
           select 1
           from pg_constraint
           where conname = 'santri_default_spp_amount_valid'
             and conrelid = 'public.santri'::regclass
         )
       )::text,
       'column=santri.default_spp_amount'

union all
select 'official hafalan curriculum installed',
       (count(*) >= 103)::text,
       'active_items=' || count(*)::text
from public.hafalan_items
where is_active
  and category in ('Doa', 'Sholat', 'Surat')
  and jilid in ('1', '2', '3', '4', '5', '6')

union all
select 'ptpt category and curriculum scope installed',
       (
         exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'hafalan_items'
             and column_name = 'program_scope'
             and is_nullable = 'NO'
         )
         and exists (
           select 1 from pg_constraint
           where conname = 'santri_kategori_check'
             and conrelid = 'public.santri'::regclass
             and pg_get_constraintdef(oid) like '%PTPT%'
         )
       )::text,
       'category=PTPT program_scope=required'

union all
select 'ptpt tahfizh curriculum installed',
       (
         count(*) = 98
         and count(*) filter (where jilid = 'Juz 1') = 21
         and count(*) filter (where jilid = 'Juz 2') = 20
         and count(*) filter (
           where jilid = 'Juz 1'
             and item_order between 1 and 21
             and item_name = format('Halaman %s', item_order)
         ) = 21
         and count(*) filter (
           where jilid = 'Juz 2'
             and item_order between 1 and 20
             and item_name = format('Halaman %s', item_order + 21)
         ) = 20
         and count(*) filter (where jilid = 'Juz 28') = 9
         and count(*) filter (where jilid = 'Juz 29') = 11
         and count(*) filter (where jilid = 'Juz 30') = 37
       )::text,
       'items=' || count(*)::text
from public.hafalan_items
where is_active
  and program_scope = 'PTPT'
  and category = 'Tahfizh'

union all
select 'hafalan scoring is constrained and synchronized',
       (
         exists (
           select 1 from information_schema.columns
           where table_schema = 'public'
             and table_name = 'hafalan_progress'
             and column_name = 'score'
             and data_type = 'smallint'
             and is_nullable = 'NO'
         )
         and exists (
           select 1 from pg_constraint
           where conname = 'hafalan_progress_score_check'
             and conrelid = 'public.hafalan_progress'::regclass
         )
         and exists (
           select 1 from pg_trigger
           where tgname = 'sync_hafalan_status_from_score'
             and tgrelid = 'public.hafalan_progress'::regclass
             and not tgisinternal
         )
       )::text,
       'column=hafalan_progress.score range=1..4'

union all
select 'official character assessment indicators installed',
       (count(*) = 15)::text,
       'active_items=' || count(*)::text
from public.character_assessment_items
where is_active
;
'@

  $output = $sql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -F "|"
  if ($LASTEXITCODE -ne 0) {
    Add-TestResult "schema checks query" $false "psql exited with $LASTEXITCODE"
    return
  }

  foreach ($line in $output) {
    if (-not $line) { continue }
    $parts = $line -split "\|", 3
    if ($parts.Count -lt 3) {
      Add-TestResult "schema check parse" $false "unexpected output"
      continue
    }

    Add-TestResult $parts[0] ($parts[1] -eq "true") $parts[2]
  }
}

function Invoke-PaymentPeriodUniquenessTests {
  $sql = @'
do $$
begin
  delete from public.payments
  where transaction_id like 'RUNNER-PERIOD-TEST-%';
end
$$;

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  'a1fa7a10-0000-0000-0000-000000000101',
  8,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST first',
  'RUNNER-PERIOD-TEST-FIRST'
);

select 'payment period first insert succeeds' as check_name,
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-FIRST'
       )::text as passed,
       'santri=demo-a bulan=8 tahun=2026' as detail;

select 'payment period duplicate rejected',
       (select public.__payment_period_duplicate_rejected())::text,
       'unique_violation=same santri/bulan/tahun';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  'a1fa7a10-0000-0000-0000-000000000101',
  9,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST different-month',
  'RUNNER-PERIOD-TEST-DIFFERENT-MONTH'
);

select 'payment different month succeeds',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-MONTH'
       )::text,
       'bulan=9';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  'a1fa7a10-0000-0000-0000-000000000101',
  8,
  2027,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST different-year',
  'RUNNER-PERIOD-TEST-DIFFERENT-YEAR'
);

select 'payment different year succeeds',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-YEAR'
       )::text,
       'tahun=2027';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  'a1fa7a10-0000-0000-0000-000000000102',
  8,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST different-santri',
  'RUNNER-PERIOD-TEST-DIFFERENT-SANTRI'
);

select 'payment different santri same period succeeds',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-SANTRI'
       )::text,
       'santri=demo-b';

select 'payment update conflict rejected',
       (select public.__payment_period_update_conflict_rejected())::text,
       'unique_violation=update to existing period';

delete from public.payments
where transaction_id = 'RUNNER-PERIOD-TEST-FIRST';

insert into public.payments (
  santri_id,
  bulan,
  tahun,
  jumlah,
  tanggal_pembayaran,
  metode_pembayaran,
  status,
  catatan,
  transaction_id
) values (
  'a1fa7a10-0000-0000-0000-000000000101',
  8,
  2026,
  10000,
  current_date,
  'Tunai',
  'paid',
  'RUNNER-PERIOD-TEST recreated',
  'RUNNER-PERIOD-TEST-RECREATED'
);

select 'payment hard delete allows recreate',
       exists (
         select 1 from public.payments where transaction_id = 'RUNNER-PERIOD-TEST-RECREATED'
       )::text,
       'delete_model=hard_delete';

delete from public.payments
where transaction_id like 'RUNNER-PERIOD-TEST-%';
'@

  $helperSql = @'
create or replace function public.__payment_period_duplicate_rejected()
returns boolean
language plpgsql
as $$
begin
  insert into public.payments (
    santri_id,
    bulan,
    tahun,
    jumlah,
    tanggal_pembayaran,
    metode_pembayaran,
    status,
    catatan,
    transaction_id
  ) values (
    'a1fa7a10-0000-0000-0000-000000000101',
    8,
    2026,
    10000,
    current_date,
    'Tunai',
    'paid',
    'RUNNER-PERIOD-TEST duplicate',
    'RUNNER-PERIOD-TEST-DUPLICATE'
  );
  return false;
exception
  when unique_violation then
    return true;
end;
$$;

create or replace function public.__payment_period_update_conflict_rejected()
returns boolean
language plpgsql
as $$
begin
  update public.payments
  set bulan = 8,
      tahun = 2026
  where transaction_id = 'RUNNER-PERIOD-TEST-DIFFERENT-MONTH';
  return false;
exception
  when unique_violation then
    return true;
end;
$$;
'@

  $cleanupSql = @'
drop function if exists public.__payment_period_duplicate_rejected();
drop function if exists public.__payment_period_update_conflict_rejected();
delete from public.payments
where transaction_id like 'RUNNER-PERIOD-TEST-%';
'@

  $helperSql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) {
    Add-TestResult "payment period helper setup" $false "psql exited with $LASTEXITCODE"
    return
  }

  $output = $sql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -F "|"
  $exitCode = $LASTEXITCODE
  $cleanupSql | docker exec -i $DbContainer psql -U postgres -d postgres -q | Out-Null

  if ($exitCode -ne 0) {
    Add-TestResult "payment period uniqueness query" $false "psql exited with $exitCode"
    return
  }

  foreach ($line in $output) {
    if (-not $line) { continue }
    $parts = $line -split "\|", 3
    if ($parts.Count -lt 3) {
      continue
    }

    Add-TestResult $parts[0] ($parts[1] -eq "true") $parts[2]
  }
}

function Invoke-DevelopmentScoringTests {
  $sql = @'
begin;

update public.hafalan_progress
set score = 3
where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
  and item_id = 'e5fa7a50-0000-0000-0000-000000000001';

select 'hafalan score below four remains in progress',
       exists (
         select 1 from public.hafalan_progress
         where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
           and item_id = 'e5fa7a50-0000-0000-0000-000000000001'
           and score = 3
           and status = 'proses'
       )::text,
       'score=3 status=proses';

update public.hafalan_progress
set score = 4
where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
  and item_id = 'e5fa7a50-0000-0000-0000-000000000001';

select 'hafalan score four is completed',
       exists (
         select 1 from public.hafalan_progress
         where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
           and item_id = 'e5fa7a50-0000-0000-0000-000000000001'
           and score = 4
           and status = 'lulus'
       )::text,
       'score=4 status=lulus';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1fa7a10-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into public.santri_character_scores (santri_id, item_id, score, assessed_by, created_by, updated_by)
values (
  'a1fa7a10-0000-0000-0000-000000000101',
  1,
  4,
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002'
)
on conflict (santri_id, item_id) do update set score = excluded.score, updated_by = excluded.updated_by;

insert into public.santri_character_strengths (santri_id, strength_key, selected_by)
values (
  'a1fa7a10-0000-0000-0000-000000000101',
  'Disiplin',
  'a1fa7a10-0000-0000-0000-000000000002'
)
on conflict (santri_id, strength_key) do update set selected_at = now();

insert into public.santri_behavior_records (
  santri_id, guru_id, incident_date, level, behavior, follow_up, teacher_note, created_by, updated_by
)
values (
  'a1fa7a10-0000-0000-0000-000000000101',
  'a1fa7a10-0000-0000-0000-000000000002',
  current_date,
  'Ringan',
  'RUNNER-DEVELOPMENT-SCORING',
  'Nasihat dan pengingat dari guru',
  'Data dummy test lokal',
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002'
);

insert into public.hafalan_progress (
  santri_id, item_id, category, item_name, score, assessed_by, created_by, updated_by
)
select
  'a1fa7a10-0000-0000-0000-000000000301',
  hi.id,
  hi.category,
  hi.item_name,
  4,
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002'
from public.hafalan_items hi
where hi.program_scope = 'PTPT'
  and hi.jilid = 'Juz 30'
  and hi.item_name = 'An-Naba'
on conflict (santri_id, item_id) where item_id is not null
do update set score = excluded.score, assessed_by = excluded.assessed_by, updated_by = excluded.updated_by;

insert into public.santri_character_scores (santri_id, item_id, score, assessed_by, created_by, updated_by)
values (
  'a1fa7a10-0000-0000-0000-000000000301',
  2,
  3,
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002'
)
on conflict (santri_id, item_id) do update set score = excluded.score, updated_by = excluded.updated_by;

insert into public.santri_character_strengths (santri_id, strength_key, selected_by)
values (
  'a1fa7a10-0000-0000-0000-000000000301',
  'Semangat Belajar',
  'a1fa7a10-0000-0000-0000-000000000002'
)
on conflict (santri_id, strength_key) do update set selected_at = now();

insert into public.santri_behavior_records (
  santri_id, guru_id, incident_date, level, behavior, follow_up, teacher_note, created_by, updated_by
)
values (
  'a1fa7a10-0000-0000-0000-000000000301',
  'a1fa7a10-0000-0000-0000-000000000002',
  current_date,
  'Ringan',
  'RUNNER-PTPT-DEVELOPMENT',
  'Nasihat dan pengingat dari guru',
  'Data dummy test lokal',
  'a1fa7a10-0000-0000-0000-000000000002',
  'a1fa7a10-0000-0000-0000-000000000002'
);

select 'guru scores assigned ptpt tahfizh',
       exists (
         select 1
         from public.hafalan_progress hp
         join public.hafalan_items hi on hi.id = hp.item_id
         where hp.santri_id = 'a1fa7a10-0000-0000-0000-000000000301'
           and hi.program_scope = 'PTPT'
           and hi.item_name = 'An-Naba'
           and hp.score = 4
           and hp.status = 'lulus'
       )::text,
       'program=PTPT item=An-Naba score=4';

select 'guru manages ptpt character development',
       (
         exists (
           select 1 from public.santri_character_scores
           where santri_id = 'a1fa7a10-0000-0000-0000-000000000301'
             and item_id = 2
             and score = 3
         )
         and exists (
           select 1 from public.santri_character_strengths
           where santri_id = 'a1fa7a10-0000-0000-0000-000000000301'
             and strength_key = 'Semangat Belajar'
         )
         and exists (
           select 1 from public.santri_behavior_records
           where santri_id = 'a1fa7a10-0000-0000-0000-000000000301'
             and behavior = 'RUNNER-PTPT-DEVELOPMENT'
         )
       )::text,
       'score strength behavior=allowed';

select 'guru scores assigned santri character',
       exists (
         select 1 from public.santri_character_scores
         where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
           and item_id = 1
           and score = 4
       )::text,
       'guru=A santri=A1 score=4';

select 'guru assigns character strength',
       exists (
         select 1 from public.santri_character_strengths
         where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
           and strength_key = 'Disiplin'
       )::text,
       'strength=Disiplin';

select 'guru records assigned santri behavior',
       exists (
         select 1 from public.santri_behavior_records
         where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
           and behavior = 'RUNNER-DEVELOPMENT-SCORING'
       )::text,
       'level=Ringan';

do $$
begin
  begin
    insert into public.santri_character_scores (santri_id, item_id, score, assessed_by)
    values ('a1fa7a10-0000-0000-0000-000000000201', 1, 4, 'a1fa7a10-0000-0000-0000-000000000002');
    raise exception 'guru outside-scope character write was accepted';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

select 'guru outside class character write denied', 'true', 'rls=denied';

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1fa7a10-0000-0000-0000-000000000101","role":"authenticated"}', true);

select 'santri reads own character score',
       (count(*) = 1)::text,
       'own_rows=' || count(*)::text
from public.santri_character_scores
where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
  and item_id = 1;

select 'santri cannot read behavior records',
       (count(*) = 0)::text,
       'visible_rows=' || count(*)::text
from public.santri_behavior_records
where santri_id = 'a1fa7a10-0000-0000-0000-000000000101'
  and behavior = 'RUNNER-DEVELOPMENT-SCORING';

reset role;
delete from public.santri_behavior_records where behavior = 'RUNNER-DEVELOPMENT-SCORING';
delete from public.santri_character_strengths
where santri_id = 'a1fa7a10-0000-0000-0000-000000000101' and strength_key = 'Disiplin';
delete from public.santri_character_scores
where santri_id = 'a1fa7a10-0000-0000-0000-000000000101' and item_id = 1;
delete from public.santri_behavior_records where behavior = 'RUNNER-PTPT-DEVELOPMENT';
delete from public.santri_character_strengths
where santri_id = 'a1fa7a10-0000-0000-0000-000000000301' and strength_key = 'Semangat Belajar';
delete from public.santri_character_scores
where santri_id = 'a1fa7a10-0000-0000-0000-000000000301' and item_id = 2;
delete from public.hafalan_progress
where santri_id = 'a1fa7a10-0000-0000-0000-000000000301';
rollback;
'@

  $output = $sql | docker exec -i $DbContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -F "|"
  if ($LASTEXITCODE -ne 0) {
    Add-TestResult "development scoring role matrix" $false "psql exited with $LASTEXITCODE"
    return
  }

  foreach ($line in $output) {
    if (-not $line) { continue }
    $parts = $line -split "\|", 3
    if ($parts.Count -lt 3) { continue }
    Add-TestResult $parts[0] ($parts[1] -eq "true") $parts[2]
  }
}

function Invoke-SmokeTests {
  $output = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run-local-runtime-smoke-tests.ps1") -SupabaseUrl $SupabaseUrl 2>&1
  $exitCode = $LASTEXITCODE
  $summary = $output | Where-Object { $_.ToString() -match "^SUMMARY passed=\d+ failed=\d+" } | Select-Object -Last 1

  if ($summary -and $summary.ToString() -match "passed=(\d+) failed=(\d+)") {
    $passed = [int]$Matches[1]
    $failed = [int]$Matches[2]
    $script:Passed += $passed
    $script:Failed += $failed
    $output | Where-Object {
      $_.ToString() -match "^(PASS|FAIL|SUMMARY) "
    } | ForEach-Object { Write-Host $_ }
  } else {
    Add-TestResult "runtime smoke tests" ($exitCode -eq 0) "summary not parsed"
  }

  if ($exitCode -ne 0) {
    Add-TestResult "runtime smoke test process" $false "exit=$exitCode"
  }
}

try {
  Assert-LocalUrl -Url $SupabaseUrl
  Add-TestResult "target is local only" $true $SupabaseUrl

  Invoke-StepScript -Name "production guard" -Path (Join-Path $PSScriptRoot "check-production-guard.ps1") | Out-Null

  if (-not (Test-LocalHealth -Quiet)) {
    Write-Host "Local services are not ready; waiting once before retrying health check."
    Start-Sleep -Seconds 10
  }
  $healthOk = Test-LocalHealth
  if (-not $healthOk) {
    Write-Host "SUMMARY passed=$script:Passed failed=$($script:Failed + 1)"
    exit 1
  }

  Invoke-StepScript -Name "migration order validation" -Path (Join-Path $PSScriptRoot "validate-migration-order.ps1") | Out-Null
  Invoke-StepScript -Name "seed dummy-only validation" -Path (Join-Path $PSScriptRoot "validate-seed-dummy-only.ps1") | Out-Null
  Invoke-StepScript -Name "legacy class column validation" -Path (Join-Path $PSScriptRoot "validate-no-legacy-class-column.ps1") | Out-Null
  Invoke-StepScript -Name "no-secret scan" -Path (Join-Path $PSScriptRoot "validate-no-secrets.ps1") | Out-Null

  Invoke-SchemaChecks
  Invoke-PaymentPeriodUniquenessTests
  Invoke-DevelopmentScoringTests
  Invoke-SmokeTests

  Write-Host "SUMMARY passed=$script:Passed failed=$script:Failed"
  if ($script:Failed -gt 0) { exit 1 }
  exit 0
} catch {
  Add-TestResult "runner unhandled error" $false $_.Exception.Message
  Write-Host "SUMMARY passed=$script:Passed failed=$script:Failed"
  exit 1
}
