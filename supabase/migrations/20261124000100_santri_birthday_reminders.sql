-- Ulang tahun santri:
-- 1. Profil santri untuk Kartu Santri menyertakan tanggal ulang tahun berikutnya dan usia pada hari itu,
--    agar kartu ucapan yang dikirim sebelum hari H langsung memakai usia yang akan dicapai.
-- 2. Pengingat Telegram untuk guru (yang sudah menyambungkan Telegram) 3 hari dan 1 hari sebelum santri
--    di kelasnya berulang tahun. Satu pesan per guru per hari, berisi nama panggilan, kelas, tanggal, usia.
--    Mengikuti aturan Telegram yang ada: tidak dikirim bila Telegram dimatikan atau mode senyap aktif,
--    dan hanya dikirim pukul 06.00–20.59 WIB.

-- Tanggal ulang tahun pada tahun tertentu; kelahiran 29 Februari jatuh pada 28 Februari di tahun biasa.
create or replace function public.santri_birthday_in_year(p_birth date, p_year integer)
returns date
language sql
immutable
as $$
  select make_date(p_year, extract(month from p_birth)::int, 1)
    + (least(extract(day from p_birth)::int,
        extract(day from (make_date(p_year, extract(month from p_birth)::int, 1) + interval '1 month - 1 day'))::int) - 1);
$$;

-- Ulang tahun berikutnya mulai hari ini (bila hari ini ulang tahun, hasilnya hari ini).
create or replace function public.santri_next_birthday(p_birth date, p_today date)
returns date
language sql
immutable
as $$
  select case
    when p_birth is null or p_today is null then null
    when public.santri_birthday_in_year(p_birth, extract(year from p_today)::int) >= p_today
      then public.santri_birthday_in_year(p_birth, extract(year from p_today)::int)
    else public.santri_birthday_in_year(p_birth, extract(year from p_today)::int + 1)
  end;
$$;

-- "Rabu, 26 November"
create or replace function public.indonesian_day_month(p_date date)
returns text
language sql
immutable
as $$
  select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow from p_date)::int + 1] || ', '
    || extract(day from p_date)::int || ' '
    || (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month from p_date)::int];
$$;

grant execute on function public.santri_birthday_in_year(date, integer) to authenticated, service_role;
grant execute on function public.santri_next_birthday(date, date) to authenticated, service_role;
grant execute on function public.indonesian_day_month(date) to authenticated, service_role;

-- ===== Profil santri: tambah ulang tahun berikutnya =====

create or replace function public.get_assistant_santri_profile(p_santri_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  s record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and not public.guru_has_santri_access(p_santri_id) then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and public.assistant_silent_mode() then
    return null;
  end if;

  select * into s from public.santri where id = p_santri_id and deleted_at is null;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'santri_id', s.id,
    'nama_lengkap', s.nama_lengkap,
    'nama_panggilan', s.nama_panggilan,
    'jenis_kelamin', s.jenis_kelamin,
    'usia', case when s.tanggal_lahir is not null then extract(year from age(public.jakarta_today(), s.tanggal_lahir))::int end,
    -- Ulang tahun berikutnya (hari ini terhitung) dan usia pada hari itu, untuk kartu ucapan yang dikirim lebih awal.
    'ultah_berikut', public.santri_next_birthday(s.tanggal_lahir, public.jakarta_today()),
    'usia_ultah_berikut', extract(year from public.santri_next_birthday(s.tanggal_lahir, public.jakarta_today()))::int
      - extract(year from s.tanggal_lahir)::int,
    'jilid', s.jilid,
    'poin', round(coalesce(s.points, 0)::numeric, 1),
    'riwayat_jilid', (select coalesce(jsonb_agg(jsonb_build_object('dari', h.from_jilid, 'ke', h.to_jilid,
        'hari_lalu', public.jakarta_today() - (h.changed_at at time zone 'Asia/Jakarta')::date) order by h.changed_at desc), '[]'::jsonb)
      from (select * from public.jilid_history where santri_id = s.id order by changed_at desc limit 6) h),
    'hafalan', (select coalesce(jsonb_agg(jsonb_build_object('kategori', p.category, 'materi', p.item_name, 'skor', p.score,
        'hari_sejak_dinilai', public.jakarta_today() - (p.updated_at at time zone 'Asia/Jakarta')::date)
        order by p.category, i.item_order nulls last, p.item_name), '[]'::jsonb)
      from (select * from public.hafalan_progress where santri_id = s.id order by updated_at desc limit 200) p
      left join public.hafalan_items i on i.id = p.item_id),
    -- Hafalan wajib jilid saat ini, termasuk yang belum pernah dinilai (skor null).
    'hafalan_wajib_jilid', (select coalesce(jsonb_agg(jsonb_build_object('kategori', hi.category, 'materi', hi.item_name,
        'skor', hp.score, 'status', coalesce(hp.status, 'belum')) order by hi.category, hi.item_order nulls last, hi.item_name), '[]'::jsonb)
      from public.hafalan_items hi
      left join public.hafalan_progress hp on hp.item_id = hi.id and hp.santri_id = s.id
      where hi.is_active and hi.program_scope = 'TPQ' and btrim(hi.jilid) = public.assistant_hafalan_jilid_key(s.jilid)),
    'karakter', (select coalesce(jsonb_agg(jsonb_build_object('indikator', ci.item_name, 'skor', cs.score) order by ci.item_order), '[]'::jsonb)
      from public.santri_character_scores cs join public.character_assessment_items ci on ci.id = cs.item_id
      where cs.santri_id = s.id),
    'kekuatan', (select coalesce(jsonb_agg(st.strength_key), '[]'::jsonb) from public.santri_character_strengths st where st.santri_id = s.id),
    'perilaku', (select coalesce(jsonb_agg(jsonb_build_object('tingkat', b.level, 'perilaku', left(b.behavior, 200),
        'tindak_lanjut', left(b.follow_up, 200), 'hari_lalu', public.jakarta_today() - b.incident_date) order by b.incident_date desc), '[]'::jsonb)
      from (select * from public.santri_behavior_records where santri_id = s.id and incident_date >= public.jakarta_today() - 180
            order by incident_date desc limit 10) b),
    'catatan_guru', (select coalesce(jsonb_agg(jsonb_build_object('catatan', left(n.note, 300),
        'hari_lalu', public.jakarta_today() - (n.created_at at time zone 'Asia/Jakarta')::date) order by n.created_at desc), '[]'::jsonb)
      from (select * from public.santri_notes where santri_id = s.id and (v_admin or visibility = 'internal')
            order by created_at desc limit 8) n)
  );
end;
$$;

revoke all on function public.get_assistant_santri_profile(uuid) from public, anon;
grant execute on function public.get_assistant_santri_profile(uuid) to authenticated;

-- ===== Pengingat ulang tahun via Telegram =====

alter table public.assistant_telegram_outbox drop constraint assistant_telegram_outbox_jenis;
alter table public.assistant_telegram_outbox add constraint assistant_telegram_outbox_jenis
  check (jenis in ('segera', 'ringkasan', 'pekanan', 'ultah'));

create or replace function public.assistant_telegram_birthday_enqueue(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_settings jsonb := public.get_assistant_settings();
  v_today date := (p_now at time zone 'Asia/Jakarta')::date;
  v_n int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if (v_settings->>'silent_mode')::boolean
     or not coalesce((v_settings#>>'{notifications,telegram_enabled}')::boolean, false)
     or extract(hour from p_now at time zone 'Asia/Jakarta')::int < 7 then
    return 0;
  end if;

  insert into public.assistant_telegram_outbox (user_id, jenis, pesan, tautan, dedupe_key)
  select g.user_id, 'ultah',
    E'🎉 <b>Pengingat ulang tahun santri</b>\n\n' || g.lines
      || E'\n\nKartu ucapan bisa dibuat kapan saja dari menu <b>Kartu Santri</b> di dasbor.',
    v_settings#>>'{notifications,dashboard_url}',
    'ultah:' || v_today
  from (
    select tl.user_id,
      string_agg(format('🎂 <b>%s</b> (%s) — %s, %s%s',
          public.assistant_telegram_escape(x.nama), public.assistant_telegram_escape(x.kelas),
          case x.sisa when 1 then 'besok' else x.sisa || ' hari lagi' end,
          public.indonesian_day_month(x.tanggal),
          case when x.usia > 0 then ' · ke-' || x.usia else '' end),
        E'\n' order by x.sisa, x.nama) as lines
    from public.telegram_links tl
    join public.user_profiles up on up.id = tl.user_id and up.status = 'active' and up.role::text = 'guru'
    join lateral (
      select distinct on (s.id) s.id,
        coalesce(nullif(btrim(s.nama_panggilan), ''), split_part(btrim(s.nama_lengkap), ' ', 1)) as nama,
        c.nama_kelas as kelas,
        b.tanggal,
        b.tanggal - v_today as sisa,
        extract(year from b.tanggal)::int - extract(year from s.tanggal_lahir)::int as usia
      from public.classes c
      join public.class_memberships cm on cm.class_id = c.id and cm.status = 'active'
      join public.santri s on s.id = cm.santri_id and s.deleted_at is null and s.tanggal_lahir is not null
      cross join lateral (select public.santri_next_birthday(s.tanggal_lahir, v_today) as tanggal) b
      where c.id_guru = tl.user_id and c.deleted_at is null and b.tanggal - v_today in (1, 3)
      order by s.id, c.nama_kelas
    ) x on true
    where tl.active
    group by tl.user_id
  ) g
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.assistant_telegram_birthday_enqueue(timestamptz) from public, anon, authenticated;
grant execute on function public.assistant_telegram_birthday_enqueue(timestamptz) to service_role;

-- Penjadwal 10 menitan yang sama kini juga menyusun pengingat ulang tahun.
create or replace function public.assistant_telegram_tick()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n int;
  v_url text;
  v_secret text;
begin
  v_n := public.assistant_telegram_enqueue();
  begin
    v_n := v_n + public.assistant_telegram_birthday_enqueue();
  exception when others then
    -- Pengingat ulang tahun tidak boleh menghentikan pengiriman peringatan lain.
    raise warning 'assistant_telegram_birthday_enqueue: %', sqlerrm;
  end;
  if extract(hour from now() at time zone 'Asia/Jakarta')::int not between 6 and 20 then
    return v_n;
  end if;
  if not exists (select 1 from public.assistant_telegram_outbox where status = 'menunggu') then
    return v_n;
  end if;
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'assistant_functions_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'telegram_dispatch_secret';
  exception when others then
    return v_n;
  end;
  if v_url is null or v_secret is null then
    return v_n;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/telegram-dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', v_secret),
    body := '{}'::jsonb
  );
  return v_n;
end;
$$;

revoke all on function public.assistant_telegram_tick() from public, anon, authenticated;
