-- Ekspor rekap berkode untuk analisis tesis (khusus admin).
--
-- Nama, nomor induk, dan nomor HP tidak pernah keluar. Santri diberi kode tetap K-001, K-002, …,
-- kelas Kelas-01, …, dan guru G-01, … Kode disimpan di research_subject_codes agar sama di setiap
-- ekspor, sehingga data sebelum dan sesudah bisa dipasangkan. Tabel pemetaan tidak bisa dibaca
-- lewat API oleh siapa pun; hanya fungsi ekspor di bawah yang memakainya.

create table public.research_subject_codes (
  subject_type text not null,
  subject_id uuid not null,
  kode text not null,
  created_at timestamptz not null default now(),
  primary key (subject_type, subject_id),
  constraint research_subject_codes_type_check check (subject_type in ('santri', 'kelas', 'guru')),
  constraint research_subject_codes_kode_unique unique (kode)
);

create trigger research_subject_codes_append_only
  before update or delete on public.research_subject_codes
  for each row execute function public.block_append_only_mutation();

alter table public.research_subject_codes enable row level security;
revoke all on public.research_subject_codes from anon, authenticated;

create or replace function public.research_code(p_type text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kode text;
  v_next integer;
  v_prefix text := case p_type when 'santri' then 'K-' when 'kelas' then 'Kelas-' when 'guru' then 'G-' end;
  v_width integer := case p_type when 'santri' then 3 else 2 end;
begin
  if p_id is null then
    return null;
  end if;
  if v_prefix is null then
    raise exception 'INVALID_SUBJECT_TYPE' using errcode = 'invalid_parameter_value';
  end if;

  select kode into v_kode from public.research_subject_codes where subject_type = p_type and subject_id = p_id;
  if v_kode is not null then
    return v_kode;
  end if;

  perform pg_advisory_xact_lock(hashtext('research_subject_codes:' || p_type));
  select kode into v_kode from public.research_subject_codes where subject_type = p_type and subject_id = p_id;
  if v_kode is not null then
    return v_kode;
  end if;

  select count(*) + 1 into v_next from public.research_subject_codes where subject_type = p_type;
  v_kode := v_prefix || lpad(v_next::text, v_width, '0');
  insert into public.research_subject_codes (subject_type, subject_id, kode) values (p_type, p_id, v_kode);
  return v_kode;
end;
$$;

revoke all on function public.research_code(text, uuid) from public, anon, authenticated;

create or replace function public.assert_research_export_input(p_dari date, p_sampai date)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if p_dari is null or p_sampai is null or p_dari > p_sampai or p_sampai - p_dari > 400 then
    raise exception 'INVALID_EXPORT_RANGE' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

revoke all on function public.assert_research_export_input(date, date) from public, anon, authenticated;

-- Rekap per santri: konfirmasi kehadiran (status terkini) dan tindak lanjut wali dalam rentang.
-- Tanggal libur di academic_calendar tidak dihitung dan dilaporkan terpisah.
create or replace function public.export_rekap_penelitian_berkode(p_dari date, p_sampai date)
returns table (
  kode_santri text,
  kode_kelas text,
  sesi_dikonfirmasi integer,
  hadir integer,
  izin integer,
  sakit integer,
  alpa integer,
  sesi_berubah_status integer,
  sesi_pada_hari_libur integer,
  sesi_dengan_tap integer,
  peringatan integer,
  tindak_lanjut integer,
  tindak_lanjut_terhubung integer,
  rerata_hari_peringatan_ke_kontak numeric
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.assert_research_export_input(p_dari, p_sampai);

  return query
  with subjects as (
    select distinct x.santri_id, x.class_id
    from (
      select c.santri_id, c.class_id from public.attendance_confirmations c
      where c.tanggal between p_dari and p_sampai
      union
      select f.santri_id, f.class_id from public.wali_followups f
      where f.tanggal_kontak between p_dari and p_sampai
      union
      select a.santri_id, a.class_id from public.assistant_alerts a
      where (a.created_at at time zone 'Asia/Jakarta')::date between p_dari and p_sampai
    ) x
  ),
  conf as (
    select cur.santri_id, cur.class_id, cur.status, cur.jumlah_perubahan, cur.tanggal,
      coalesce(ac.is_holiday, false) as libur,
      exists (
        select 1 from public.attendance a
        where a.user_id = cur.santri_id and a.attendance_date = cur.tanggal
      ) as ada_tap
    from public.attendance_confirmations_current cur
    left join public.academic_calendar ac on ac.date = cur.tanggal
    where cur.tanggal between p_dari and p_sampai
  ),
  conf_agg as (
    select santri_id, class_id,
      count(*) filter (where not libur)::integer as total,
      count(*) filter (where not libur and status = 'hadir')::integer as hadir,
      count(*) filter (where not libur and status = 'izin')::integer as izin,
      count(*) filter (where not libur and status = 'sakit')::integer as sakit,
      count(*) filter (where not libur and status = 'alpa')::integer as alpa,
      count(*) filter (where not libur and jumlah_perubahan > 0)::integer as berubah,
      count(*) filter (where libur)::integer as libur,
      count(*) filter (where not libur and ada_tap)::integer as tap
    from conf
    group by santri_id, class_id
  ),
  alert_agg as (
    select a.santri_id, a.class_id, count(*)::integer as n
    from public.assistant_alerts a
    where (a.created_at at time zone 'Asia/Jakarta')::date between p_dari and p_sampai
    group by a.santri_id, a.class_id
  ),
  fu_agg as (
    select f.santri_id, f.class_id,
      count(*)::integer as n,
      count(*) filter (where f.hasil = 'terhubung')::integer as terhubung,
      round(avg(f.tanggal_kontak - f.tanggal_peringatan) filter (where f.tanggal_peringatan is not null), 2) as rerata
    from public.wali_followups f
    where f.tanggal_kontak between p_dari and p_sampai
    group by f.santri_id, f.class_id
  )
  select
    public.research_code('santri', s.santri_id),
    public.research_code('kelas', s.class_id),
    coalesce(ca.total, 0), coalesce(ca.hadir, 0), coalesce(ca.izin, 0), coalesce(ca.sakit, 0),
    coalesce(ca.alpa, 0), coalesce(ca.berubah, 0), coalesce(ca.libur, 0), coalesce(ca.tap, 0),
    coalesce(aa.n, 0), coalesce(fa.n, 0), coalesce(fa.terhubung, 0), fa.rerata
  from subjects s
  left join conf_agg ca on ca.santri_id = s.santri_id and ca.class_id = s.class_id
  left join alert_agg aa on aa.santri_id = s.santri_id and aa.class_id = s.class_id
  left join fu_agg fa on fa.santri_id = s.santri_id and fa.class_id = s.class_id
  order by 2, 1;
end;
$$;

-- Rincian tindak lanjut wali per kejadian, berkode. Kolom catatan (teks bebas) tidak diekspor.
create or replace function public.export_tindak_lanjut_berkode(p_dari date, p_sampai date)
returns table (
  kode_santri text,
  kode_kelas text,
  kode_guru text,
  tanggal_peringatan date,
  tanggal_kontak date,
  selisih_hari integer,
  saluran text,
  hasil text,
  dari_peringatan_asisten boolean,
  dicatat_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.assert_research_export_input(p_dari, p_sampai);

  return query
  select
    public.research_code('santri', f.santri_id),
    public.research_code('kelas', f.class_id),
    public.research_code('guru', f.guru_id),
    f.tanggal_peringatan,
    f.tanggal_kontak,
    (f.tanggal_kontak - f.tanggal_peringatan)::integer,
    f.saluran,
    f.hasil,
    f.alert_id is not null,
    f.created_at
  from public.wali_followups f
  where f.tanggal_kontak between p_dari and p_sampai
  order by f.tanggal_kontak, f.created_at;
end;
$$;

revoke all on function public.export_rekap_penelitian_berkode(date, date) from public, anon;
revoke all on function public.export_tindak_lanjut_berkode(date, date) from public, anon;
grant execute on function public.export_rekap_penelitian_berkode(date, date) to authenticated;
grant execute on function public.export_tindak_lanjut_berkode(date, date) to authenticated;
