-- Absen panggil guru: kehadiran santri yang dikonfirmasi guru per sesi.
--
-- Tabel ini terpisah dari public.attendance. Tap RFID/wajah tetap utuh di attendance; guru hanya
-- menetapkan status akhir di sini. Catatan bersifat hanya-tambah: konfirmasi pertama tidak pernah
-- ditimpa, perubahan status masuk sebagai baris baru di attendance_confirmation_changes, dan status
-- terkini dibaca dari view attendance_confirmations_current.

-- Pemblokir UPDATE/DELETE untuk semua tabel pencatatan penelitian. DELETE hanya diizinkan bila
-- datang dari aksi ON DELETE CASCADE (kedalaman trigger > 1), misalnya saat admin menghapus
-- permanen data santri. UPDATE langsung atau DELETE langsung selalu ditolak, termasuk oleh
-- service role.
create or replace function public.block_append_only_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'APPEND_ONLY: % pada % tidak diizinkan; catatan hanya bisa ditambah', tg_op, tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create or replace function public.jakarta_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Jakarta')::date; $$;

create table public.attendance_confirmations (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  tanggal date not null,
  sesi text not null,
  status text not null,
  keterangan text,
  dikonfirmasi_oleh uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint attendance_confirmations_status_check check (status in ('hadir', 'terlambat', 'tidak_hadir')),
  constraint attendance_confirmations_sesi_check check (length(btrim(sesi)) between 1 and 40),
  constraint attendance_confirmations_keterangan_check check (keterangan is null or length(keterangan) <= 300),
  constraint attendance_confirmations_unique unique (santri_id, tanggal, sesi)
);

create index attendance_confirmations_class_date_idx on public.attendance_confirmations(class_id, tanggal, sesi);
create index attendance_confirmations_tanggal_idx on public.attendance_confirmations(tanggal);

create table public.attendance_confirmation_changes (
  id uuid primary key default gen_random_uuid(),
  urutan bigint generated always as identity,
  confirmation_id uuid not null references public.attendance_confirmations(id) on delete cascade,
  status text not null,
  keterangan text,
  diubah_oleh uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint attendance_confirmation_changes_status_check check (status in ('hadir', 'terlambat', 'tidak_hadir')),
  constraint attendance_confirmation_changes_keterangan_check check (keterangan is null or length(keterangan) <= 300)
);

create index attendance_confirmation_changes_confirmation_idx
  on public.attendance_confirmation_changes(confirmation_id, urutan desc);

create trigger attendance_confirmations_append_only
  before update or delete on public.attendance_confirmations
  for each row execute function public.block_append_only_mutation();

create trigger attendance_confirmation_changes_append_only
  before update or delete on public.attendance_confirmation_changes
  for each row execute function public.block_append_only_mutation();

alter table public.attendance_confirmations enable row level security;
alter table public.attendance_confirmation_changes enable row level security;

revoke all on public.attendance_confirmations from anon, authenticated;
revoke all on public.attendance_confirmation_changes from anon, authenticated;
grant select, insert on public.attendance_confirmations to authenticated;
grant select, insert on public.attendance_confirmation_changes to authenticated;

create policy attendance_confirmations_select_scope on public.attendance_confirmations
  for select to authenticated
  using (public.is_admin() or public.guru_has_class_access(class_id));

create policy attendance_confirmations_insert_scope on public.attendance_confirmations
  for insert to authenticated
  with check (
    dikonfirmasi_oleh = auth.uid()
    and tanggal <= public.jakarta_today()
    and (public.is_admin() or public.guru_has_class_access(class_id))
    and exists (
      select 1 from public.class_memberships cm
      where cm.santri_id = attendance_confirmations.santri_id
        and cm.class_id = attendance_confirmations.class_id
        and cm.status = 'active'
    )
  );

create policy attendance_confirmation_changes_select_scope on public.attendance_confirmation_changes
  for select to authenticated
  using (exists (
    select 1 from public.attendance_confirmations c
    where c.id = attendance_confirmation_changes.confirmation_id
      and (public.is_admin() or public.guru_has_class_access(c.class_id))
  ));

create policy attendance_confirmation_changes_insert_scope on public.attendance_confirmation_changes
  for insert to authenticated
  with check (
    diubah_oleh = auth.uid()
    and exists (
      select 1 from public.attendance_confirmations c
      where c.id = attendance_confirmation_changes.confirmation_id
        and (public.is_admin() or public.guru_has_class_access(c.class_id))
    )
  );

-- Status terkini per santri+tanggal+sesi. security_invoker membuat RLS tabel dasar tetap berlaku.
create view public.attendance_confirmations_current
with (security_invoker = true)
as
select
  c.id,
  c.santri_id,
  c.class_id,
  c.tanggal,
  c.sesi,
  coalesce(h.status, c.status) as status,
  case when h.id is null then c.keterangan else h.keterangan end as keterangan,
  c.status as status_awal,
  c.dikonfirmasi_oleh,
  c.created_at as dikonfirmasi_at,
  coalesce(h.diubah_oleh, c.dikonfirmasi_oleh) as terakhir_oleh,
  coalesce(h.created_at, c.created_at) as terakhir_at,
  coalesce(n.jumlah, 0)::integer as jumlah_perubahan
from public.attendance_confirmations c
left join lateral (
  select ch.id, ch.status, ch.keterangan, ch.diubah_oleh, ch.created_at
  from public.attendance_confirmation_changes ch
  where ch.confirmation_id = c.id
  order by ch.urutan desc
  limit 1
) h on true
left join lateral (
  select count(*) as jumlah
  from public.attendance_confirmation_changes ch
  where ch.confirmation_id = c.id
) n on true;

revoke all on public.attendance_confirmations_current from anon;
grant select on public.attendance_confirmations_current to authenticated;

-- Daftar absen panggil satu kelas pada satu tanggal dan sesi: santri aktif, tap RFID/wajah hari itu
-- sebagai saran awal, konfirmasi terkini, dan tanda libur dari academic_calendar.
create or replace function public.get_attendance_roll_call(p_class_id uuid, p_tanggal date, p_sesi text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_holiday jsonb;
  v_rows jsonb;
  v_sesi text := btrim(coalesce(p_sesi, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not (public.is_admin() or public.guru_has_class_access(p_class_id)) then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if p_tanggal is null or length(v_sesi) = 0 then
    raise exception 'INVALID_ROLL_CALL_INPUT' using errcode = 'invalid_parameter_value';
  end if;

  select jsonb_build_object('title', ac.title, 'is_holiday', ac.is_holiday)
  into v_holiday
  from public.academic_calendar ac
  where ac.date = p_tanggal;

  select coalesce(jsonb_agg(r order by r.urut, r.nama), '[]'::jsonb)
  into v_rows
  from (
    select
      s.id as santri_id,
      s.nama_lengkap as nama,
      coalesce(cm.order_in_class, 9999) as urut,
      tap.check_in_time as tap_waktu,
      tap.status as tap_status,
      tap.source as tap_sumber,
      tap.sesi as tap_sesi,
      cur.status,
      cur.keterangan,
      cur.terakhir_at,
      cur.jumlah_perubahan
    from public.class_memberships cm
    join public.santri s on s.id = cm.santri_id and s.deleted_at is null
    left join lateral (
      select a.check_in_time, a.status, a.source, a.sesi
      from public.attendance a
      where a.user_id = s.id
        and a.attendance_date = p_tanggal
      order by (coalesce(a.sesi, '') = v_sesi) desc, a.check_in_time nulls last, a.created_at
      limit 1
    ) tap on true
    left join public.attendance_confirmations_current cur
      on cur.santri_id = s.id and cur.tanggal = p_tanggal and cur.sesi = v_sesi
    where cm.class_id = p_class_id
      and cm.status = 'active'
  ) r;

  return jsonb_build_object(
    'class_id', p_class_id,
    'tanggal', p_tanggal,
    'sesi', v_sesi,
    'libur', v_holiday,
    'santri', v_rows
  );
end;
$$;

-- Simpan absen panggil. Hanya entri yang dikirim yang diproses (partial update dari UI).
-- Entri baru menjadi konfirmasi pertama; entri yang berbeda dari status terkini menjadi baris
-- riwayat; entri yang sama dilewati.
create or replace function public.save_attendance_confirmations(
  p_class_id uuid,
  p_tanggal date,
  p_sesi text,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sesi text := btrim(coalesce(p_sesi, ''));
  v_entry jsonb;
  v_santri uuid;
  v_status text;
  v_keterangan text;
  v_current record;
  v_new_id uuid;
  v_inserted integer := 0;
  v_changed integer := 0;
  v_unchanged integer := 0;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not (public.is_admin() or public.guru_has_class_access(p_class_id)) then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if p_tanggal is null or length(v_sesi) = 0 or length(v_sesi) > 40 then
    raise exception 'INVALID_ROLL_CALL_INPUT' using errcode = 'invalid_parameter_value';
  end if;
  if p_tanggal > public.jakarta_today() then
    raise exception 'FUTURE_DATE_NOT_ALLOWED' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) = 0
     or jsonb_array_length(p_entries) > 200 then
    raise exception 'INVALID_ROLL_CALL_ENTRIES' using errcode = 'invalid_parameter_value';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_santri := nullif(v_entry->>'santri_id', '')::uuid;
    v_status := lower(btrim(coalesce(v_entry->>'status', '')));
    v_keterangan := nullif(btrim(coalesce(v_entry->>'keterangan', '')), '');

    if v_santri is null or v_status not in ('hadir', 'terlambat', 'tidak_hadir') then
      raise exception 'INVALID_ROLL_CALL_ENTRIES' using errcode = 'invalid_parameter_value';
    end if;
    if v_keterangan is not null and length(v_keterangan) > 300 then
      raise exception 'KETERANGAN_TOO_LONG' using errcode = 'invalid_parameter_value';
    end if;
    if not exists (
      select 1 from public.class_memberships cm
      where cm.santri_id = v_santri and cm.class_id = p_class_id and cm.status = 'active'
    ) then
      raise exception 'SANTRI_NOT_IN_CLASS' using errcode = 'insufficient_privilege';
    end if;

    insert into public.attendance_confirmations (santri_id, class_id, tanggal, sesi, status, keterangan, dikonfirmasi_oleh)
    values (v_santri, p_class_id, p_tanggal, v_sesi, v_status, v_keterangan, v_uid)
    on conflict (santri_id, tanggal, sesi) do nothing
    returning id into v_new_id;

    if v_new_id is not null then
      v_inserted := v_inserted + 1;
      v_new_id := null;
      continue;
    end if;

    select cur.id, cur.class_id, cur.status, cur.keterangan
    into v_current
    from public.attendance_confirmations_current cur
    where cur.santri_id = v_santri and cur.tanggal = p_tanggal and cur.sesi = v_sesi;

    if not (public.is_admin() or public.guru_has_class_access(v_current.class_id)) then
      raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
    end if;

    if v_current.status = v_status and v_current.keterangan is not distinct from v_keterangan then
      v_unchanged := v_unchanged + 1;
    else
      insert into public.attendance_confirmation_changes (confirmation_id, status, keterangan, diubah_oleh)
      values (v_current.id, v_status, v_keterangan, v_uid);
      v_changed := v_changed + 1;
    end if;
  end loop;

  return jsonb_build_object('baru', v_inserted, 'diubah', v_changed, 'tetap', v_unchanged);
end;
$$;

revoke all on function public.get_attendance_roll_call(uuid, date, text) from public, anon;
revoke all on function public.save_attendance_confirmations(uuid, date, text, jsonb) from public, anon;
grant execute on function public.get_attendance_roll_call(uuid, date, text) to authenticated;
grant execute on function public.save_attendance_confirmations(uuid, date, text, jsonb) to authenticated;
revoke all on function public.block_append_only_mutation() from public, anon, authenticated;
