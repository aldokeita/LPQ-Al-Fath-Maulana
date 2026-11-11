-- Asisten tahap 1: data panel "Perlu Perhatian" dan aksi guru atas peringatan.
--
-- Satu kartu per episode (santri + aturan + episode_key), memakai peringatan terbarunya. Episode
-- tertutup bila sudah ada keputusan, atau otomatis: santri kembali hadir (absen_beruntun), sudah
-- naik jilid (jilid_lama), atau sudah lewat 7 hari (aturan pekanan, digantikan pekan berikutnya).

create or replace function public.assistant_alert_visible(p_class uuid, p_senyap boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (not p_senyap and not public.assistant_silent_mode() and public.guru_has_class_access(p_class));
$$;

revoke all on function public.assistant_alert_visible(uuid, boolean) from public, anon;
grant execute on function public.assistant_alert_visible(uuid, boolean) to authenticated;

create or replace function public.get_assistant_attention(p_class_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_silent_mode boolean := public.assistant_silent_mode();
  v_items jsonb;
  v_silent_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if p_class_id is not null and not (v_admin or public.guru_has_class_access(p_class_id)) then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and not public.is_guru() and not public.is_pentashih() then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if v_silent_mode and not v_admin then
    return jsonb_build_object('items', '[]'::jsonb, 'senyap_tersimpan', 0, 'mode_senyap', true);
  end if;

  with latest as (
    select distinct on (a.santri_id, a.rule, a.episode_key) a.*
    from public.assistant_alerts a
    where a.created_at > now() - interval '60 days'
      and not a.senyap
      and (p_class_id is null or a.class_id = p_class_id)
      and (v_admin or public.guru_has_class_access(a.class_id))
    order by a.santri_id, a.rule, a.episode_key, a.created_at desc
  ),
  episode as (
    select l.*,
      (select min(a2.created_at) from public.assistant_alerts a2
        where a2.santri_id = l.santri_id and a2.rule = l.rule and a2.episode_key = l.episode_key
          and not a2.senyap) as first_alert_at,
      (select count(*) from public.assistant_alerts a2
        where a2.santri_id = l.santri_id and a2.rule = l.rule and a2.episode_key = l.episode_key
          and not a2.senyap)::int as jumlah_pengingat,
      exists (select 1 from public.assistant_alert_decisions d
        join public.assistant_alerts a2 on a2.id = d.alert_id
        where a2.santri_id = l.santri_id and a2.rule = l.rule and a2.episode_key = l.episode_key) as decided
    from latest l
  ),
  open_items as (
    select e.*, s.nama_lengkap, s.nama_panggilan, s.jilid as jilid_sekarang, c.nama_kelas
    from episode e
    join public.santri s on s.id = e.santri_id
    join public.classes c on c.id = e.class_id
    where not e.decided
      and case e.rule
        when 'absen_beruntun' then not exists (
          select 1 from public.attendance a
          where a.user_id = e.santri_id and a.attendance_date > (e.detail->>'last_absent')::date)
          and not exists (
          select 1 from public.attendance_presence_corrections pc
          where pc.santri_id = e.santri_id and pc.tanggal > (e.detail->>'last_absent')::date)
        when 'jilid_lama' then s.jilid is not distinct from e.detail->>'jilid'
        else e.created_at > now() - interval '7 days'
      end
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'alert_id', o.id,
      'santri_id', o.santri_id,
      'nama', o.nama_lengkap,
      'nama_panggilan', o.nama_panggilan,
      'class_id', o.class_id,
      'nama_kelas', o.nama_kelas,
      'rule', o.rule,
      'tingkat', o.tingkat,
      'alasan', o.alasan,
      'detail', o.detail,
      'senyap', o.senyap,
      'created_at', o.created_at,
      'first_alert_at', o.first_alert_at,
      'jumlah_pengingat', o.jumlah_pengingat
    ) order by case o.tingkat when 'tinggi' then 0 when 'sedang' then 1 else 2 end, o.created_at desc), '[]'::jsonb)
  into v_items
  from open_items o;

  if v_admin then
    select count(distinct (a.santri_id, a.rule, a.episode_key))::int into v_silent_count
    from public.assistant_alerts a
    where a.senyap and a.created_at > now() - interval '60 days'
      and (p_class_id is null or a.class_id = p_class_id);
  end if;

  return jsonb_build_object(
    'items', v_items,
    'senyap_tersimpan', v_silent_count,
    'mode_senyap', v_silent_mode
  );
end;
$$;

revoke all on function public.get_assistant_attention(uuid) from public, anon;
grant execute on function public.get_assistant_attention(uuid) to authenticated;

-- Koreksi "sebenarnya hadir" untuk tanggal-tanggal di peringatan absen. Bila koreksi memutus
-- rangkaian absen di bawah ambang, peringatan otomatis ditandai "peringatan_keliru".
create or replace function public.record_presence_corrections(p_alert_id uuid, p_dates date[], p_keterangan text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert public.assistant_alerts;
  v_date date;
  v_absent date[];
  v_remaining int := 0;
  v_inserted int := 0;
  v_rows int;
  v_keterangan text := nullif(btrim(coalesce(p_keterangan, '')), '');
  v_closed boolean := false;
begin
  select * into v_alert from public.assistant_alerts where id = p_alert_id;
  if v_alert.id is null or not public.assistant_alert_visible(v_alert.class_id, v_alert.senyap) then
    raise exception 'ALERT_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  if v_alert.rule <> 'absen_beruntun' then
    raise exception 'NOT_ATTENDANCE_ALERT' using errcode = 'invalid_parameter_value';
  end if;
  if p_dates is null or cardinality(p_dates) = 0 or cardinality(p_dates) > 60 then
    raise exception 'INVALID_DATES' using errcode = 'invalid_parameter_value';
  end if;
  if v_keterangan is not null and length(v_keterangan) > 300 then
    raise exception 'KETERANGAN_TOO_LONG' using errcode = 'invalid_parameter_value';
  end if;

  select array_agg(x::date order by x::date desc) into v_absent
  from jsonb_array_elements_text(v_alert.detail->'absent_dates') x;

  foreach v_date in array p_dates loop
    if not v_date = any(v_absent) then
      raise exception 'DATE_NOT_IN_ALERT' using errcode = 'invalid_parameter_value';
    end if;
    insert into public.attendance_presence_corrections (santri_id, class_id, tanggal, keterangan, alert_id, dikoreksi_oleh)
    values (v_alert.santri_id, v_alert.class_id, v_date, v_keterangan, v_alert.id, auth.uid())
    on conflict (santri_id, tanggal) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;
  end loop;

  -- Hitung ulang rangkaian absen dari tanggal absen terakhir ke belakang.
  for i in 1 .. array_length(v_absent, 1) loop
    exit when exists (select 1 from public.attendance_presence_corrections pc
                      where pc.santri_id = v_alert.santri_id and pc.tanggal = v_absent[i]);
    v_remaining := v_remaining + 1;
  end loop;

  if v_remaining < coalesce((v_alert.detail->>'threshold')::int, 3) then
    insert into public.assistant_alert_decisions (alert_id, keputusan, catatan, diputuskan_oleh)
    values (v_alert.id, 'peringatan_keliru', 'Otomatis: guru mengoreksi santri sebenarnya hadir.', auth.uid());
    v_closed := true;
  end if;

  return jsonb_build_object('koreksi_baru', v_inserted, 'sisa_absen', v_remaining, 'ditutup', v_closed);
end;
$$;

create or replace function public.decide_assistant_alert(p_alert_id uuid, p_keputusan text, p_catatan text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert public.assistant_alerts;
  v_id uuid;
  v_catatan text := nullif(btrim(coalesce(p_catatan, '')), '');
begin
  select * into v_alert from public.assistant_alerts where id = p_alert_id;
  if v_alert.id is null or not public.assistant_alert_visible(v_alert.class_id, v_alert.senyap) then
    raise exception 'ALERT_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  if p_keputusan not in ('ditangani', 'diabaikan', 'peringatan_keliru') then
    raise exception 'INVALID_DECISION' using errcode = 'invalid_parameter_value';
  end if;
  if p_keputusan = 'diabaikan' and v_catatan is null then
    raise exception 'REASON_REQUIRED' using errcode = 'invalid_parameter_value';
  end if;
  if v_catatan is not null and length(v_catatan) > 500 then
    raise exception 'CATATAN_TOO_LONG' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.assistant_alert_decisions (alert_id, keputusan, catatan, diputuskan_oleh)
  values (v_alert.id, p_keputusan, v_catatan, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Satu kontak wali menutup satu atau beberapa perkara milik santri yang sama. Kontak dicatat sekali
-- (dikaitkan ke perkara pertama) agar indikator tindak lanjut tidak terhitung ganda.
create or replace function public.record_alert_wali_followup(
  p_alert_ids uuid[], p_tanggal_kontak date, p_saluran text, p_hasil text, p_catatan text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alerts public.assistant_alerts[];
  v_first public.assistant_alerts;
  v_alert public.assistant_alerts;
  v_id uuid;
  v_catatan text := nullif(btrim(coalesce(p_catatan, '')), '');
begin
  if p_alert_ids is null or cardinality(p_alert_ids) = 0 or cardinality(p_alert_ids) > 20 then
    raise exception 'ALERT_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  select array_agg(a order by array_position(p_alert_ids, a.id)) into v_alerts
  from public.assistant_alerts a where a.id = any(p_alert_ids);
  if coalesce(cardinality(v_alerts), 0) <> cardinality(p_alert_ids) then
    raise exception 'ALERT_NOT_FOUND' using errcode = 'insufficient_privilege';
  end if;
  v_first := v_alerts[1];
  foreach v_alert in array v_alerts loop
    if not public.assistant_alert_visible(v_alert.class_id, v_alert.senyap) then
      raise exception 'ALERT_NOT_FOUND' using errcode = 'insufficient_privilege';
    end if;
    if v_alert.santri_id <> v_first.santri_id then
      raise exception 'ALERTS_DIFFERENT_SANTRI' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if p_tanggal_kontak is null or p_tanggal_kontak > public.jakarta_today()
     or p_tanggal_kontak < (v_first.created_at at time zone 'Asia/Jakarta')::date - 14 then
    raise exception 'INVALID_CONTACT_DATE' using errcode = 'invalid_parameter_value';
  end if;
  if p_saluran not in ('whatsapp', 'telepon', 'tatap_muka', 'lainnya')
     or p_hasil not in ('terhubung', 'tidak_merespons', 'janji_hadir', 'lainnya') then
    raise exception 'INVALID_FOLLOWUP' using errcode = 'invalid_parameter_value';
  end if;
  if v_catatan is not null and length(v_catatan) > 500 then
    raise exception 'CATATAN_TOO_LONG' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.wali_followups (santri_id, class_id, guru_id, alert_id, tanggal_kontak, saluran, hasil, catatan)
  values (v_first.santri_id, v_first.class_id, auth.uid(), v_first.id, p_tanggal_kontak, p_saluran, p_hasil, v_catatan)
  returning id into v_id;

  insert into public.assistant_alert_decisions (alert_id, keputusan, catatan, diputuskan_oleh)
  select a.id, 'wali_dihubungi', null, auth.uid() from unnest(v_alerts) a;
  return v_id;
end;
$$;

revoke all on function public.record_presence_corrections(uuid, date[], text) from public, anon;
revoke all on function public.decide_assistant_alert(uuid, text, text) from public, anon;
revoke all on function public.record_alert_wali_followup(uuid[], date, text, text, text) from public, anon;
grant execute on function public.record_presence_corrections(uuid, date[], text) to authenticated;
grant execute on function public.decide_assistant_alert(uuid, text, text) to authenticated;
grant execute on function public.record_alert_wali_followup(uuid[], date, text, text, text) to authenticated;
