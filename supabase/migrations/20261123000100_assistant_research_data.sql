-- Data penelitian asisten (bahan Bab 4 tesis), khusus admin dan hanya membaca.
--
-- Membandingkan masa "sebelum" (mode senyap: peringatan dicatat tetapi tidak ditampilkan ke guru) dengan
-- masa "sesudah" (peringatan tampil), mengukur ketepatan peringatan, waktu tanggap guru, dan perubahan
-- kehadiran santri sebelum vs sesudah peringatan. Santri dan kelas disamarkan menjadi kode tetap
-- (potongan md5 id) agar data bisa diekspor tanpa identitas anak.
--
-- Catatan metode: hari sekolah memakai pengaturan hari sekolah dan kalender libur yang berlaku sekarang;
-- jendela kehadiran = 20 sesi terjadwal sampai tanggal peringatan (sebelum) dan 20 sesi berikutnya sampai
-- kemarin (sesudah). Dampak dihitung per episode (peringatan pertama tiap episode) untuk aturan kehadiran.

create or replace function public.assistant_research_alert_rows(p_from date, p_to date)
returns table (
  alert_id uuid,
  kode_santri text,
  kode_kelas text,
  tanggal date,
  ref_date date,
  aturan text,
  tingkat text,
  masa text,
  pertama_episode boolean,
  keputusan_pertama text,
  jam_tanggap numeric,
  wali_dihubungi boolean,
  koreksi_hadir boolean,
  keliru boolean,
  sebelum_hadir int,
  sebelum_sesi int,
  sesudah_hadir int,
  sesudah_sesi int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days jsonb := public.get_assistant_settings()->'school_days';
  v_yesterday date := public.jakarta_today() - 1;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'INVALID_RANGE' using errcode = 'invalid_parameter_value';
  end if;

  return query
  with base as (
    select a.*,
      (a.created_at at time zone 'Asia/Jakarta')::date as tgl,
      row_number() over (partition by a.santri_id, a.rule, a.episode_key, a.senyap order by a.created_at) = 1 as pertama
    from public.assistant_alerts a
  ),
  picked as (
    select * from base where tgl between p_from and p_to
  )
  select
    p.id,
    'S' || upper(substr(md5(p.santri_id::text), 1, 6)),
    'K' || upper(substr(md5(p.class_id::text), 1, 4)),
    p.tgl,
    p.ref_date,
    p.rule,
    p.tingkat,
    case when p.senyap then 'sebelum' else 'sesudah' end,
    p.pertama,
    d.keputusan,
    case when d.created_at is null or p.senyap then null
      else round((extract(epoch from d.created_at - p.created_at) / 3600)::numeric, 1) end,
    exists (select 1 from public.wali_followups w where w.alert_id = p.id),
    exists (select 1 from public.attendance_presence_corrections c where c.alert_id = p.id),
    exists (select 1 from public.attendance_presence_corrections c where c.alert_id = p.id)
      or exists (select 1 from public.assistant_alert_decisions x where x.alert_id = p.id and x.keputusan = 'peringatan_keliru'),
    pre.hadir, pre.sesi, post.hadir, post.sesi
  from picked p
  left join lateral (
    select x.keputusan, x.created_at from public.assistant_alert_decisions x
    where x.alert_id = p.id order by x.created_at limit 1
  ) d on true
  left join lateral (
    select count(*) filter (where public.assistant_is_present(p.santri_id, s.d))::int as hadir, count(*)::int as sesi
    from (
      select d0 as d from public.assistant_school_days(p.ref_date - 60, p.ref_date, v_days) d0
      order by d0 desc limit 20
    ) s
  ) pre on true
  left join lateral (
    select count(*) filter (where public.assistant_is_present(p.santri_id, s.d))::int as hadir, count(*)::int as sesi
    from (
      select d0 as d from public.assistant_school_days(p.ref_date + 1, least(p.ref_date + 60, v_yesterday), v_days) d0
      order by d0 limit 20
    ) s
  ) post on true
  order by p.created_at;
end;
$$;

revoke all on function public.assistant_research_alert_rows(date, date) from public, anon;
grant execute on function public.assistant_research_alert_rows(date, date) to authenticated;

-- Baris per peringatan (sudah disamarkan) untuk ekspor CSV.
create or replace function public.get_assistant_research_alerts(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(r) - 'alert_id' order by r.tanggal), '[]'::jsonb)
  from public.assistant_research_alert_rows(p_from, p_to) r;
$$;

revoke all on function public.get_assistant_research_alerts(date, date) from public, anon;
grant execute on function public.get_assistant_research_alerts(date, date) to authenticated;

-- Ringkasan metrik penelitian untuk satu periode.
create or replace function public.get_assistant_research_metrics(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as materialized (
    select * from public.assistant_research_alert_rows(p_from, p_to)
  ),
  sesudah as (
    select * from r where masa = 'sesudah'
  )
  select jsonb_build_object(
    'periode', jsonb_build_object('dari', p_from, 'sampai', p_to),

    -- Riwayat mode senyap (masa sebelum/sesudah) dari pengaturan yang hanya bisa ditambah.
    'masa_senyap', (
      select coalesce(jsonb_agg(jsonb_build_object('mulai', x.mulai, 'senyap', x.senyap) order by x.mulai), '[]'::jsonb)
      from (
        select (s.created_at at time zone 'Asia/Jakarta')::date as mulai,
          coalesce((s.settings->>'silent_mode')::boolean, false) as senyap,
          lag(coalesce((s.settings->>'silent_mode')::boolean, false)) over (order by s.id) as sebelumnya
        from public.assistant_settings s
      ) x
      where x.sebelumnya is distinct from x.senyap
    ),

    'masa', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'masa', m.masa,
        'peringatan', m.n,
        'episode', m.episode,
        'santri', m.santri,
        'per_aturan', (select jsonb_object_agg(q.aturan, q.n) from (select aturan, count(*)::int n from r where r.masa = m.masa group by aturan) q),
        'per_tingkat', (select jsonb_object_agg(q.tingkat, q.n) from (select tingkat, count(*)::int n from r where r.masa = m.masa group by tingkat) q)
      ) order by m.masa desc), '[]'::jsonb)
      from (
        select masa, count(*)::int n, count(*) filter (where pertama_episode)::int episode, count(distinct kode_santri)::int santri
        from r group by masa
      ) m
    ),

    -- Ketepatan hanya untuk peringatan yang tampil ke guru (masa sesudah) dan sudah diputuskan/dikoreksi.
    'ketepatan', (
      select jsonb_build_object(
        'dinilai', count(*) filter (where keputusan_pertama is not null or koreksi_hadir),
        'keliru', count(*) filter (where keliru),
        'koreksi_hadir', count(*) filter (where koreksi_hadir),
        'presisi_persen', case when count(*) filter (where keputusan_pertama is not null or koreksi_hadir) > 0
          then round(100.0 * (1 - count(*) filter (where keliru)::numeric
            / count(*) filter (where keputusan_pertama is not null or koreksi_hadir)), 1) end
      )
      from sesudah
    ),

    'tanggap', (
      select jsonb_build_object(
        'peringatan', count(*),
        'diputuskan', count(*) filter (where keputusan_pertama is not null),
        'persen_diputuskan', case when count(*) > 0 then round(100.0 * count(*) filter (where keputusan_pertama is not null) / count(*), 1) end,
        'median_jam', round((percentile_cont(0.5) within group (order by jam_tanggap))::numeric, 1),
        'p75_jam', round((percentile_cont(0.75) within group (order by jam_tanggap))::numeric, 1),
        'dalam_24_jam', count(*) filter (where jam_tanggap <= 24),
        'dalam_72_jam', count(*) filter (where jam_tanggap <= 72),
        'wali_dihubungi', count(*) filter (where wali_dihubungi),
        'per_keputusan', (select coalesce(jsonb_object_agg(q.k, q.n), '{}'::jsonb)
          from (select keputusan_pertama k, count(*)::int n from sesudah where keputusan_pertama is not null group by keputusan_pertama) q)
      )
      from sesudah
    ),

    -- Dampak: kehadiran 20 sesi sebelum vs sesudah peringatan kehadiran (episode pertama, minimal 5 sesi sesudah).
    'dampak', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'masa', q.masa,
        'episode', q.episode,
        'dengan_data', q.dengan_data,
        'rata_sebelum_persen', q.pre,
        'rata_sesudah_persen', q.post,
        'selisih_poin', round(q.post - q.pre, 1)
      ) order by q.masa desc), '[]'::jsonb)
      from (
        select masa,
          count(*)::int episode,
          count(*) filter (where sesudah_sesi >= 5 and sebelum_sesi > 0)::int dengan_data,
          round(avg(100.0 * sebelum_hadir / nullif(sebelum_sesi, 0)) filter (where sesudah_sesi >= 5 and sebelum_sesi > 0), 1) pre,
          round(avg(100.0 * sesudah_hadir / nullif(sesudah_sesi, 0)) filter (where sesudah_sesi >= 5 and sebelum_sesi > 0), 1) post
        from r
        where pertama_episode and aturan in ('absen_beruntun', 'kehadiran_bulanan')
        group by masa
      ) q
    )
  );
$$;

revoke all on function public.get_assistant_research_metrics(date, date) from public, anon;
grant execute on function public.get_assistant_research_metrics(date, date) to authenticated;
