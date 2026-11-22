-- Asisten: ringkasan per santri untuk infografik kartu "Perlu Perhatian".
--
-- Hanya membaca. Satu panggilan untuk semua santri di panel: 10 sesi terjadwal terakhir, kehadiran
-- 4 pekan, lama di jilid terhadap batasnya, capaian hafalan jilid saat ini, dan setoran muroja'ah
-- yang menunggu. Perhitungan memakai aturan yang sama dengan run_assistant_rules (hari sekolah,
-- libur kalender, koreksi "sebenarnya hadir"). Akses mengikuti panel: admin semua kelas, guru hanya
-- kelasnya, dan guru tidak mendapat apa pun selama mode senyap.

create or replace function public.get_assistant_santri_snapshot(p_santri_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_settings jsonb := public.get_assistant_settings();
  v_days jsonb := v_settings->'school_days';
  v_default int := (v_settings#>>'{jilid,default_days}')::int;
  v_ref date := public.jakarta_today() - 1;
  v_result jsonb := '[]'::jsonb;
  r record;
  v_start date;
  v_jilid_start date;
  v_jilid_days int;
  v_limit int;
  v_key text;
  v_pulse jsonb;
  v_total int;
  v_present int;
  v_hafalan jsonb;
  v_murojaah int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and not public.is_guru() and not public.is_pentashih() then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_santri_ids, 1), 0) > 200 then
    raise exception 'TOO_MANY_SANTRI' using errcode = 'invalid_parameter_value';
  end if;
  if not v_admin and public.assistant_silent_mode() then
    return '[]'::jsonb;
  end if;

  for r in
    select s.id, s.jilid, s.tanggal_pendaftaran, s.no_hp_ortu, cm.class_id, cm.start_date
    from public.santri s
    join public.class_memberships cm on cm.santri_id = s.id and cm.status = 'active'
    where s.id = any(coalesce(p_santri_ids, '{}'))
      and s.deleted_at is null
      and (v_admin or public.guru_has_class_access(cm.class_id))
  loop
    v_start := coalesce(r.start_date, r.tanggal_pendaftaran, v_ref - 120);

    -- 10 sesi terjadwal terakhir, lama ke baru.
    select coalesce(jsonb_agg(jsonb_build_object('t', x.d, 's', x.s) order by x.d), '[]'::jsonb) into v_pulse
    from (
      select d.d,
        case
          when a.status is not null and a.status ilike '%terlambat%' then 'terlambat'
          when a.status is not null then 'hadir'
          when exists (select 1 from public.attendance_presence_corrections c where c.santri_id = r.id and c.tanggal = d.d) then 'koreksi'
          else 'absen'
        end as s
      from (
        select d from public.assistant_school_days(greatest(v_start, v_ref - 40), v_ref, v_days) d
        order by d desc limit 10
      ) d
      left join lateral (
        select at.status from public.attendance at
        where at.user_id = r.id and at.attendance_date = d.d
        order by at.check_in_time nulls last limit 1
      ) a on true
    ) x;

    select count(*)::int, count(*) filter (where public.assistant_is_present(r.id, d))::int
    into v_total, v_present
    from public.assistant_school_days(greatest(v_start, v_ref - 27), v_ref, v_days) d;

    v_jilid_days := null;
    v_limit := null;
    v_jilid_start := null;
    if r.jilid is not null and length(btrim(r.jilid)) > 0 then
      select max((jh.changed_at at time zone 'Asia/Jakarta')::date) into v_jilid_start
      from public.jilid_history jh where jh.santri_id = r.id and jh.to_jilid = r.jilid;
      v_jilid_start := coalesce(v_jilid_start, r.start_date, r.tanggal_pendaftaran);
      if v_jilid_start is not null and v_jilid_start <= v_ref then
        select (v_ref - v_jilid_start) - count(*)::int into v_jilid_days
        from public.academic_calendar ac
        where ac.is_holiday and ac.date > v_jilid_start and ac.date <= v_ref;
      end if;
      v_limit := coalesce((v_settings#>>array['jilid', 'per_jilid', r.jilid])::int, v_default);
    end if;

    v_key := public.assistant_hafalan_jilid_key(r.jilid);
    v_hafalan := null;
    if v_key is not null then
      select jsonb_build_object(
        'total', count(*),
        'lulus', count(*) filter (where hp.status = 'lulus'),
        'proses', count(*) filter (where hp.status in ('proses', 'ulang')),
        'dicatat', count(hp.item_id),
        'kategori_proses', (array_agg(hi.category order by hp.updated_at) filter (where hp.status in ('proses', 'ulang')))[1]
      ) into v_hafalan
      from public.hafalan_items hi
      left join public.hafalan_progress hp on hp.item_id = hi.id and hp.santri_id = r.id
      where hi.is_active and hi.program_scope = 'TPQ' and btrim(hi.jilid) = v_key;
    end if;

    select count(*)::int into v_murojaah
    from public.murojaah_submissions ms where ms.santri_id = r.id and ms.status = 'menunggu';

    v_result := v_result || jsonb_build_object(
      'santri_id', r.id,
      'jilid', r.jilid,
      'jilid_sejak', v_jilid_start,
      'jilid_hari', v_jilid_days,
      'jilid_batas', v_limit,
      'sesi_terakhir', v_pulse,
      'hadir_4pekan', v_present,
      'sesi_4pekan', v_total,
      'hafalan', v_hafalan,
      'murojaah_menunggu', v_murojaah,
      'no_hp_wali', nullif(btrim(coalesce(r.no_hp_ortu, '')), '')
    );
  end loop;

  return v_result;
end;
$$;

revoke all on function public.get_assistant_santri_snapshot(uuid[]) from public, anon;
grant execute on function public.get_assistant_santri_snapshot(uuid[]) to authenticated;
