-- Asisten tahap 1: helper bersama dan pengaturan standar yang diatur admin.
--
-- Pengaturan disimpan berversi dan hanya-tambah: setiap perubahan admin menjadi baris baru, sehingga
-- standar yang berlaku pada tanggal tertentu tetap bisa ditelusuri untuk penelitian. Mode senyap
-- aktif secara default: aturan berjalan dan menyimpan peringatan, tetapi guru belum melihatnya.

-- Pemblokir UPDATE/DELETE untuk tabel pencatatan. DELETE dan UPDATE yang datang dari aksi foreign
-- key (ON DELETE CASCADE / SET NULL, kedalaman trigger > 1) tetap diizinkan agar penghapusan
-- permanen data santri oleh admin tidak macet. UPDATE/DELETE langsung selalu ditolak, termasuk oleh
-- service role.
create or replace function public.block_append_only_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'APPEND_ONLY: % pada % tidak diizinkan; catatan hanya bisa ditambah', tg_op, tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.block_append_only_mutation() from public, anon, authenticated;

create or replace function public.jakarta_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Jakarta')::date; $$;

create or replace function public.assistant_default_settings()
returns jsonb
language sql
immutable
as $$
  select '{
    "version": 1,
    "silent_mode": true,
    "school_days": [1, 2, 3, 4, 5],
    "attendance": {
      "consecutive_sessions": 3,
      "repeat_every_sessions": 3,
      "high_consecutive_sessions": 6,
      "monthly_min_percent": 75
    },
    "jilid": {
      "default_days": 30,
      "per_jilid": {},
      "repeat_every_days": 14
    },
    "hafalan": {
      "proses_max_days": 30,
      "required_items_after_percent": 50,
      "murojaah_review_max_days": 7
    }
  }'::jsonb;
$$;

create table public.assistant_settings (
  id bigint generated always as identity primary key,
  settings jsonb not null,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint assistant_settings_object check (jsonb_typeof(settings) = 'object')
);

create trigger assistant_settings_append_only
  before update or delete on public.assistant_settings
  for each row execute function public.block_append_only_mutation();

alter table public.assistant_settings enable row level security;
revoke all on public.assistant_settings from anon, authenticated;
grant select on public.assistant_settings to authenticated;

create policy assistant_settings_select_admin on public.assistant_settings
  for select to authenticated
  using (public.is_admin());

insert into public.assistant_settings (settings, created_by)
values (public.assistant_default_settings(), null);

-- Penggabungan dalam: nilai tersimpan menimpa default per kunci, sehingga kunci baru di versi
-- berikutnya tetap punya nilai.
create or replace function public.jsonb_deep_merge(base jsonb, patch jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(base) = 'object' and jsonb_typeof(patch) = 'object' then (
      select coalesce(jsonb_object_agg(
        coalesce(b.key, p.key),
        case
          when p.key is null then b.value
          when b.key is null then p.value
          when b.key = 'per_jilid' then p.value
          else public.jsonb_deep_merge(b.value, p.value)
        end
      ), '{}'::jsonb)
      from jsonb_each(base) b
      full join jsonb_each(patch) p on p.key = b.key
    )
    when patch is null then base
    else patch
  end;
$$;

create or replace function public.get_assistant_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.jsonb_deep_merge(
    public.assistant_default_settings(),
    coalesce((select s.settings from public.assistant_settings s order by s.id desc limit 1), '{}'::jsonb)
  );
$$;

revoke all on function public.get_assistant_settings() from public, anon;
grant execute on function public.get_assistant_settings() to authenticated;

-- Validasi dan simpan pengaturan baru (khusus admin). Nilai di luar batas ditolak, bukan dipotong.
create or replace function public.save_assistant_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_key text;
  v_value jsonb;
  v_days jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception 'INVALID_SETTINGS' using errcode = 'invalid_parameter_value';
  end if;

  v := public.jsonb_deep_merge(public.assistant_default_settings(), p_settings);

  if jsonb_typeof(v->'silent_mode') <> 'boolean' then
    raise exception 'INVALID_SETTINGS: silent_mode' using errcode = 'invalid_parameter_value';
  end if;

  v_days := v->'school_days';
  if jsonb_typeof(v_days) <> 'array' or jsonb_array_length(v_days) = 0 or exists (
    select 1 from jsonb_array_elements(v_days) d
    where jsonb_typeof(d) <> 'number' or (d)::text::int not between 1 and 7
  ) then
    raise exception 'INVALID_SETTINGS: school_days' using errcode = 'invalid_parameter_value';
  end if;

  if not (
    (v#>>'{attendance,consecutive_sessions}')::int between 2 and 20
    and (v#>>'{attendance,repeat_every_sessions}')::int between 1 and 20
    and (v#>>'{attendance,high_consecutive_sessions}')::int between (v#>>'{attendance,consecutive_sessions}')::int and 40
    and (v#>>'{attendance,monthly_min_percent}')::int between 1 and 100
    and (v#>>'{jilid,default_days}')::int between 7 and 730
    and (v#>>'{jilid,repeat_every_days}')::int between 1 and 90
    and (v#>>'{hafalan,proses_max_days}')::int between 3 and 365
    and (v#>>'{hafalan,required_items_after_percent}')::int between 10 and 100
    and (v#>>'{hafalan,murojaah_review_max_days}')::int between 1 and 60
  ) then
    raise exception 'INVALID_SETTINGS: angka di luar batas' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(v#>'{jilid,per_jilid}') <> 'object' then
    raise exception 'INVALID_SETTINGS: per_jilid' using errcode = 'invalid_parameter_value';
  end if;
  for v_key, v_value in select key, value from jsonb_each(v#>'{jilid,per_jilid}') loop
    if length(v_key) > 40 or jsonb_typeof(v_value) <> 'number' or (v_value)::text::int not between 7 and 730 then
      raise exception 'INVALID_SETTINGS: per_jilid %', v_key using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  insert into public.assistant_settings (settings, created_by) values (v, auth.uid());
  return v;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_SETTINGS: angka tidak valid' using errcode = 'invalid_parameter_value';
end;
$$;

revoke all on function public.save_assistant_settings(jsonb) from public, anon;
grant execute on function public.save_assistant_settings(jsonb) to authenticated;

-- Hari sekolah (Senin–Jumat secara default) yang bukan libur kalender akademik.
create or replace function public.assistant_school_days(p_from date, p_to date, p_days jsonb)
returns setof date
language sql
stable
set search_path = public
as $$
  select d::date
  from generate_series(p_from, p_to, interval '1 day') d
  where extract(isodow from d)::int in (select (x)::text::int from jsonb_array_elements(p_days) x)
    and not exists (select 1 from public.academic_calendar ac where ac.date = d::date and ac.is_holiday);
$$;
