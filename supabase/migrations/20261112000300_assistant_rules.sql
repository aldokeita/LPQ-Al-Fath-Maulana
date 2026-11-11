-- Asisten tahap 1: pemeriksa aturan harian.
--
-- Aturan (bukan AI) menentukan santri yang perlu perhatian. Hanya santri TPQ anak (kategori 'Anak')
-- yang aktif dan punya kelas aktif. Hari sekolah = hari di settings.school_days yang bukan libur di
-- academic_calendar. Santri dianggap hadir bila ada baris attendance (sumber apa pun) atau koreksi
-- "sebenarnya hadir" pada tanggal itu.
--
-- Aturan harian : absen_beruntun, jilid_lama.
-- Aturan pekanan (Jumat, atau dipaksa): kehadiran_bulanan, hafalan_macet,
--                 hafalan_wajib_belum_lulus, murojaah_belum_ditinjau.
--
-- Satu "episode" (misalnya satu rangkaian absen) hanya menghasilkan satu peringatan per tahap
-- pengingat; dedupe_key mencegah peringatan ganda bila pemeriksa dijalankan berulang. Kunci itu
-- dipisah per status senyap, sehingga episode yang berjalan saat mode senyap dimatikan tetap
-- muncul ke guru pada pemeriksaan berikutnya.

-- Angka jilid TPQ yang dipakai hafalan_items ('1'..'6') dari jilid santri ('Jilid 2A' -> '2').
create or replace function public.assistant_hafalan_jilid_key(p_jilid text)
returns text
language sql
immutable
as $$ select substring(coalesce(p_jilid, '') from '^Jilid\s*([1-6])[A-C]?$'); $$;

create or replace function public.assistant_is_present(p_santri uuid, p_date date)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.attendance a where a.user_id = p_santri and a.attendance_date = p_date)
      or exists (select 1 from public.attendance_presence_corrections c where c.santri_id = p_santri and c.tanggal = p_date);
$$;

create or replace function public.run_assistant_rules(p_ref date default null, p_weekly boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref date;
  v_settings jsonb := public.get_assistant_settings();
  v_settings_id bigint := (select max(id) from public.assistant_settings);
  v_days jsonb := v_settings->'school_days';
  v_silent boolean := (v_settings->>'silent_mode')::boolean;
  v_n int := (v_settings#>>'{attendance,consecutive_sessions}')::int;
  v_repeat int := (v_settings#>>'{attendance,repeat_every_sessions}')::int;
  v_high int := (v_settings#>>'{attendance,high_consecutive_sessions}')::int;
  v_min_pct int := (v_settings#>>'{attendance,monthly_min_percent}')::int;
  v_jilid_default int := (v_settings#>>'{jilid,default_days}')::int;
  v_jilid_repeat int := (v_settings#>>'{jilid,repeat_every_days}')::int;
  v_proses_days int := (v_settings#>>'{hafalan,proses_max_days}')::int;
  v_required_pct int := (v_settings#>>'{hafalan,required_items_after_percent}')::int;
  v_review_days int := (v_settings#>>'{hafalan,murojaah_review_max_days}')::int;
  v_weekly boolean;
  v_week text;
  r record;
  v_sched date[];
  v_absent date[];
  v_streak int;
  v_k int;
  v_jilid_start date;
  v_jilid_days int;
  v_threshold int;
  v_total int;
  v_present int;
  v_count int;
  v_names jsonb;
  v_inserted int := 0;
  v_checked int := 0;
begin
  -- Admin boleh menjalankan manual; pg_cron (tanpa JWT) juga boleh. Pengguna lain ditolak.
  if auth.uid() is not null then
    if not public.is_admin() then
      raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
    end if;
  elsif coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  v_ref := coalesce(p_ref, public.jakarta_today() - 1);
  if v_ref > public.jakarta_today() then
    raise exception 'FUTURE_DATE_NOT_ALLOWED' using errcode = 'invalid_parameter_value';
  end if;
  v_weekly := coalesce(p_weekly, extract(isodow from v_ref) = 5);
  v_week := to_char(v_ref, 'IYYY-"W"IW');

  for r in
    select s.id as santri_id, s.jilid, s.tanggal_pendaftaran, cm.class_id, cm.start_date
    from public.santri s
    join public.class_memberships cm on cm.santri_id = s.id and cm.status = 'active'
    join public.classes c on c.id = cm.class_id and c.deleted_at is null
    where s.kategori = 'Anak' and s.status = 'Aktif' and s.deleted_at is null
      and cm.start_date <= v_ref
  loop
    v_checked := v_checked + 1;

    -- ===== absen_beruntun =====
    select array_agg(d order by d desc) into v_sched
    from (
      select d from public.assistant_school_days(greatest(r.start_date, v_ref - 120), v_ref, v_days) d
      order by d desc limit 60
    ) x;

    v_absent := '{}';
    if v_sched is not null then
      for i in 1 .. array_length(v_sched, 1) loop
        exit when public.assistant_is_present(r.santri_id, v_sched[i]);
        v_absent := v_absent || v_sched[i];
      end loop;
    end if;
    v_streak := coalesce(array_length(v_absent, 1), 0);

    if v_streak >= v_n then
      v_k := (v_streak - v_n) / v_repeat;
      v_inserted := v_inserted + public.assistant_insert_alert(
        r.santri_id, r.class_id, 'absen_beruntun',
        case when v_streak >= v_high then 'tinggi' when v_k > 0 then 'rendah' else 'sedang' end,
        format('Tidak hadir %s sesi terjadwal berturut-turut (%s s.d. %s).', v_streak,
          to_char(v_absent[v_streak], 'DD-MM-YYYY'), to_char(v_absent[1], 'DD-MM-YYYY')),
        jsonb_build_object('streak', v_streak, 'absent_dates', to_jsonb(v_absent),
          'episode_start', v_absent[v_streak], 'last_absent', v_absent[1], 'threshold', v_n),
        'absen:' || v_absent[v_streak] || ':' || v_k,
        'absen:' || v_absent[v_streak],
        v_silent, v_ref, v_settings_id);
    end if;

    -- ===== jilid_lama =====
    if r.jilid is not null and length(btrim(r.jilid)) > 0 then
      select max((jh.changed_at at time zone 'Asia/Jakarta')::date) into v_jilid_start
      from public.jilid_history jh
      where jh.santri_id = r.santri_id and jh.to_jilid = r.jilid;
      v_jilid_start := coalesce(v_jilid_start, r.start_date, r.tanggal_pendaftaran);

      if v_jilid_start is not null and v_jilid_start <= v_ref then
        select (v_ref - v_jilid_start) - count(*)::int into v_jilid_days
        from public.academic_calendar ac
        where ac.is_holiday and ac.date > v_jilid_start and ac.date <= v_ref;
        v_threshold := coalesce((v_settings#>>array['jilid', 'per_jilid', r.jilid])::int, v_jilid_default);

        if v_jilid_days > v_threshold then
          v_k := (v_jilid_days - v_threshold - 1) / v_jilid_repeat;
          v_inserted := v_inserted + public.assistant_insert_alert(
            r.santri_id, r.class_id, 'jilid_lama', case when v_k > 0 then 'rendah' else 'sedang' end,
            format('Sudah %s hari di %s tanpa naik jilid (batas %s hari).', v_jilid_days, r.jilid, v_threshold),
            jsonb_build_object('jilid', r.jilid, 'days', v_jilid_days, 'since', v_jilid_start, 'threshold', v_threshold),
            'jilid:' || r.jilid || ':' || v_jilid_start || ':' || v_k,
            'jilid:' || r.jilid || ':' || v_jilid_start,
            v_silent, v_ref, v_settings_id);
        end if;
      end if;
    else
      v_jilid_days := null;
      v_threshold := null;
    end if;

    continue when not v_weekly;

    -- ===== kehadiran_bulanan (4 pekan terakhir) =====
    select count(*)::int, count(*) filter (where public.assistant_is_present(r.santri_id, d))::int
    into v_total, v_present
    from public.assistant_school_days(greatest(r.start_date, v_ref - 27), v_ref, v_days) d;

    if v_total >= 5 and v_present * 100 < v_min_pct * v_total then
      v_inserted := v_inserted + public.assistant_insert_alert(
        r.santri_id, r.class_id, 'kehadiran_bulanan', 'sedang',
        format('Kehadiran 4 pekan terakhir %s%% (%s dari %s sesi), di bawah standar %s%%.',
          (v_present * 100 / v_total), v_present, v_total, v_min_pct),
        jsonb_build_object('present', v_present, 'total', v_total, 'percent', v_present * 100 / v_total, 'min_percent', v_min_pct),
        'pekan:' || v_week, 'pekan:' || v_week, v_silent, v_ref, v_settings_id);
    end if;

    -- ===== hafalan_macet =====
    select count(*)::int, coalesce(jsonb_agg(hp.item_name order by hp.updated_at) filter (where hp.item_name is not null), '[]')
    into v_count, v_names
    from public.hafalan_progress hp
    where hp.santri_id = r.santri_id and hp.status in ('proses', 'ulang')
      and (hp.updated_at at time zone 'Asia/Jakarta')::date < v_ref - v_proses_days;

    if v_count > 0 then
      v_inserted := v_inserted + public.assistant_insert_alert(
        r.santri_id, r.class_id, 'hafalan_macet', 'sedang',
        format('%s item hafalan berstatus proses/ulang lebih dari %s hari.', v_count, v_proses_days),
        jsonb_build_object('count', v_count, 'items', (select jsonb_agg(e) from (select e from jsonb_array_elements(v_names) e limit 5) t), 'max_days', v_proses_days),
        'pekan:' || v_week, 'pekan:' || v_week, v_silent, v_ref, v_settings_id);
    end if;

    -- ===== hafalan_wajib_belum_lulus (setelah melewati sebagian batas jilid) =====
    if v_jilid_days is not null and public.assistant_hafalan_jilid_key(r.jilid) is not null
       and v_jilid_days * 100 >= v_threshold * v_required_pct then
      select count(*)::int, coalesce(jsonb_agg(hi.item_name order by hi.item_order), '[]')
      into v_count, v_names
      from public.hafalan_items hi
      where hi.is_active and hi.program_scope = 'TPQ'
        and btrim(hi.jilid) = public.assistant_hafalan_jilid_key(r.jilid)
        and not exists (
          select 1 from public.hafalan_progress hp
          where hp.santri_id = r.santri_id and hp.item_id = hi.id and hp.status = 'lulus'
        );

      if v_count > 0 then
        v_inserted := v_inserted + public.assistant_insert_alert(
          r.santri_id, r.class_id, 'hafalan_wajib_belum_lulus', 'sedang',
          format('%s item hafalan wajib %s belum lulus, sudah %s dari %s hari batas jilid.', v_count, r.jilid, v_jilid_days, v_threshold),
          jsonb_build_object('count', v_count, 'items', (select jsonb_agg(e) from (select e from jsonb_array_elements(v_names) e limit 5) t), 'jilid', r.jilid),
          'pekan:' || v_week, 'pekan:' || v_week, v_silent, v_ref, v_settings_id);
      end if;
    end if;

    -- ===== murojaah_belum_ditinjau =====
    select count(*)::int into v_count
    from public.murojaah_submissions ms
    where ms.santri_id = r.santri_id and ms.status = 'menunggu'
      and (coalesce(ms.submitted_at, ms.created_at) at time zone 'Asia/Jakarta')::date < v_ref - v_review_days;

    if v_count > 0 then
      v_inserted := v_inserted + public.assistant_insert_alert(
        r.santri_id, r.class_id, 'murojaah_belum_ditinjau', 'rendah',
        format('%s setoran muroja''ah menunggu ditinjau lebih dari %s hari.', v_count, v_review_days),
        jsonb_build_object('count', v_count, 'max_days', v_review_days),
        'pekan:' || v_week, 'pekan:' || v_week, v_silent, v_ref, v_settings_id);
    end if;
  end loop;

  return jsonb_build_object('ref_date', v_ref, 'weekly', v_weekly, 'santri_diperiksa', v_checked,
    'peringatan_baru', v_inserted, 'senyap', v_silent);
end;
$$;

-- Menyimpan satu peringatan bila belum ada (dedupe). Peringatan menjadi 'tinggi' bila santri yang
-- sama sedang punya peringatan terbuka dari aturan lain dalam 7 hari terakhir.
create or replace function public.assistant_insert_alert(
  p_santri uuid, p_class uuid, p_rule text, p_tingkat text, p_alasan text, p_detail jsonb,
  p_dedupe text, p_episode text, p_silent boolean, p_ref date, p_settings_id bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tingkat text := p_tingkat;
  v_rows integer;
begin
  if exists (
    select 1 from public.assistant_alerts a
    where a.santri_id = p_santri and a.rule <> p_rule and a.senyap = p_silent
      and a.created_at > now() - interval '7 days'
      and not exists (select 1 from public.assistant_alert_decisions d
                      join public.assistant_alerts a2 on a2.id = d.alert_id
                      where a2.santri_id = a.santri_id and a2.rule = a.rule and a2.episode_key = a.episode_key)
  ) then
    v_tingkat := 'tinggi';
  end if;

  insert into public.assistant_alerts (santri_id, class_id, rule, tingkat, alasan, detail, dedupe_key,
    episode_key, senyap, ref_date, settings_id)
  values (p_santri, p_class, p_rule, v_tingkat, p_alasan, p_detail, p_dedupe, p_episode, p_silent, p_ref, p_settings_id)
  on conflict (santri_id, rule, dedupe_key, senyap) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.assistant_insert_alert(uuid, uuid, text, text, text, jsonb, text, text, boolean, date, bigint) from public, anon, authenticated;
revoke all on function public.run_assistant_rules(date, boolean) from public, anon;
grant execute on function public.run_assistant_rules(date, boolean) to authenticated;
revoke all on function public.assistant_is_present(uuid, date) from public, anon, authenticated;

-- Jadwal harian 23.30 WIB (16.30 UTC), sesudah sesi Malam selesai.
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'assistant-rules-daily') then
    perform cron.unschedule('assistant-rules-daily');
  end if;
  perform cron.schedule('assistant-rules-daily', '30 16 * * *',
    'select public.run_assistant_rules(public.jakarta_today(), null)');
end $$;
