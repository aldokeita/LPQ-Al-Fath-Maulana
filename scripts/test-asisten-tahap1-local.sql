\set ON_ERROR_STOP on
-- Uji asisten tahap 1 (aturan, mode senyap, panel, koreksi, keputusan, RLS, hanya-tambah) di
-- Supabase lokal. Data rekaan, seluruh transaksi di-rollback. Tanggal acuan: Jumat 30-10-2026.
-- Jalankan:
--   docker exec -i supabase_db_lpq-al-fath-maulana-local psql -U postgres -d postgres < scripts/test-asisten-tahap1-local.sql
begin;

insert into auth.users (id, email) values
  ('7e571000-0000-0000-0000-00000000000a', 'admin@lpqalfathmaulana.id'),
  ('7e571000-0000-0000-0000-0000000000a1', 'TEST-t1-guru-a@local.invalid'),
  ('7e571000-0000-0000-0000-0000000000b1', 'TEST-t1-guru-b@local.invalid');
insert into auth.users (id, email)
select ('7e571000-0000-0000-0000-00000000010' || n)::uuid, 'TEST-t1-santri-' || n || '@local.invalid' from generate_series(1, 6) n;
insert into public.user_profiles (id, role, status, email) values
  ('7e571000-0000-0000-0000-00000000000a', 'admin', 'active', 'admin@lpqalfathmaulana.id'),
  ('7e571000-0000-0000-0000-0000000000a1', 'guru', 'active', null),
  ('7e571000-0000-0000-0000-0000000000b1', 'guru', 'active', null);
insert into public.guru (id, nama, email, roles) values
  ('7e571000-0000-0000-0000-0000000000a1', 'TEST T1 Guru A', 'TEST-t1-guru-a@local.invalid', '{}'),
  ('7e571000-0000-0000-0000-0000000000b1', 'TEST T1 Guru B', 'TEST-t1-guru-b@local.invalid', '{}');
insert into public.classes (id, nama_kelas, id_guru, sesi) values
  ('7e571000-0000-0000-0000-0000000c1a00', 'TEST T1 Kelas A', '7e571000-0000-0000-0000-0000000000a1', 'Sore'),
  ('7e571000-0000-0000-0000-0000000c1b00', 'TEST T1 Kelas B', '7e571000-0000-0000-0000-0000000000b1', 'Sore');
-- S1, S2, S3, S5 di kelas A; S4 di kelas B; S5 santri PTPT (di luar cakupan).
insert into public.santri (id, nomor_induk_qiroati, nama_lengkap, kategori, current_class_id, jilid) values
  ('7e571000-0000-0000-0000-000000000101', 'TESTT1-1', 'TEST T1 Satu', 'Anak', '7e571000-0000-0000-0000-0000000c1a00', null),
  ('7e571000-0000-0000-0000-000000000102', 'TESTT1-2', 'TEST T1 Dua', 'Anak', '7e571000-0000-0000-0000-0000000c1a00', 'Jilid 2A'),
  ('7e571000-0000-0000-0000-000000000103', 'TESTT1-3', 'TEST T1 Tiga', 'Anak', '7e571000-0000-0000-0000-0000000c1a00', 'Jilid 1A'),
  ('7e571000-0000-0000-0000-000000000104', 'TESTT1-4', 'TEST T1 Empat', 'Anak', '7e571000-0000-0000-0000-0000000c1b00', null),
  ('7e571000-0000-0000-0000-000000000105', 'TESTT1-5', 'TEST T1 Lima', 'PTPT', '7e571000-0000-0000-0000-0000000c1a00', null),
  ('7e571000-0000-0000-0000-000000000106', 'TESTT1-6', 'TEST T1 Enam', 'Anak', '7e571000-0000-0000-0000-0000000c1a00', 'Jilid 3A');
insert into public.class_memberships (santri_id, class_id, start_date, status)
select s.id, s.current_class_id, date '2026-09-01', 'active' from public.santri s where s.nomor_induk_qiroati like 'TESTT1-%';

-- Libur Kamis 29-10-2026.
insert into public.academic_calendar (date, title, is_holiday) values (date '2026-10-29', 'TEST T1 Libur', true)
  on conflict (date) do update set is_holiday = true;

-- Hadir di semua hari sekolah 01-09 s.d. 30-10, kecuali:
--   S1: 27, 28, 30 Okt (3 sesi, libur 29 dilewati)          -> absen_beruntun sedang
--   S2: 28, 30 Okt (2 sesi)                                   -> tidak ada peringatan absen
--   S3: 14 Okt s.d. 30 Okt (12 sesi)                          -> absen_beruntun tinggi, kehadiran_bulanan
--   S4: 27, 28, 30 Okt (kelas B)                              -> hanya terlihat oleh guru B
--   S5: 20 s.d. 30 Okt (PTPT)                                 -> tidak diperiksa
--   S6: hadir rutin, Jilid 3A sejak 15-09 tanpa catatan hafalan -> jilid lama saja
insert into public.attendance (user_id, role, attendance_date, check_in_time, class_id, sesi, status, source)
select s.id, 'santri', d::date, '15:50', s.current_class_id, 'Sore', 'Hadir', 'rfid'
from public.santri s
cross join generate_series(date '2026-09-01', date '2026-10-30', interval '1 day') d
where s.nomor_induk_qiroati like 'TESTT1-%'
  and extract(isodow from d) between 1 and 5 and d::date <> date '2026-10-29'
  and not (s.nomor_induk_qiroati in ('TESTT1-1', 'TESTT1-4') and d::date in ('2026-10-27', '2026-10-28', '2026-10-30'))
  and not (s.nomor_induk_qiroati = 'TESTT1-2' and d::date in ('2026-10-28', '2026-10-30'))
  and not (s.nomor_induk_qiroati = 'TESTT1-3' and d::date >= date '2026-10-14')
  and not (s.nomor_induk_qiroati = 'TESTT1-5' and d::date >= date '2026-10-20');

-- S2 di Jilid 2A sejak 15-09 (45 hari - 1 libur = 44 > 30); S3 di Jilid 1A sejak 20-10.
insert into public.jilid_history (santri_id, from_jilid, to_jilid, changed_at) values
  ('7e571000-0000-0000-0000-000000000102', 'Jilid 1C', 'Jilid 2A', timestamptz '2026-09-15 10:00+07'),
  ('7e571000-0000-0000-0000-000000000103', 'Pra TK C', 'Jilid 1A', timestamptz '2026-10-20 10:00+07'),
  ('7e571000-0000-0000-0000-000000000106', 'Jilid 2B', 'Jilid 3A', timestamptz '2026-09-15 10:00+07');

-- S2: satu item hafalan macet sejak 01-09. S1: satu setoran muroja'ah belum ditinjau sejak 01-10.
insert into public.hafalan_progress (santri_id, item_id, category, item_name, status, created_at, updated_at)
select '7e571000-0000-0000-0000-000000000102', hi.id, hi.category, hi.item_name, 'proses',
  timestamptz '2026-09-01 10:00+07', timestamptz '2026-09-01 10:00+07'
from public.hafalan_items hi where hi.program_scope = 'TPQ' and btrim(hi.jilid) = '2' order by hi.item_order limit 1;
insert into public.murojaah_submissions (santri_id, target_guru_id, type, content, status, submitted_at, created_at)
values ('7e571000-0000-0000-0000-000000000101', '7e571000-0000-0000-0000-0000000000a1', 'text', 'TEST', 'menunggu',
  timestamptz '2026-10-01 10:00+07', timestamptz '2026-10-01 10:00+07');

create temp table t1_attendance_before as
  select count(*) as n, md5(string_agg(a::text, ',' order by a.id)) as h from public.attendance a;
grant select on t1_attendance_before to authenticated;

-- ===== Hak menjalankan dan mengatur =====
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin perform public.run_assistant_rules(date '2026-10-30', true); raise exception 'TEST FAIL: guru ran rules';
  exception when insufficient_privilege then null; end;
  begin perform public.save_assistant_settings('{"silent_mode": false}'); raise exception 'TEST FAIL: guru saved settings';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.assistant_settings) then raise exception 'TEST FAIL: guru read settings table'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin perform public.run_assistant_rules(date '2026-10-30', true); raise exception 'TEST FAIL: anon ran rules';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== Admin: mode senyap (default) =====
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  if (public.get_assistant_settings()->>'silent_mode')::boolean is not true then raise exception 'TEST FAIL: silent default'; end if;
  r := public.run_assistant_rules(date '2026-10-30', true);
  if (r->>'peringatan_baru')::int < 8 or (r->>'senyap')::boolean is not true then raise exception 'TEST FAIL: silent run %', r; end if;
  r := public.get_assistant_attention(null);
  if jsonb_array_length(r->'items') <> 0 or (r->>'senyap_tersimpan')::int < 7 then raise exception 'TEST FAIL: admin silent view %', r; end if;

  begin perform public.save_assistant_settings('{"attendance": {"consecutive_sessions": 1}}');
    raise exception 'TEST FAIL: invalid setting accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.save_assistant_settings('{"jilid": {"per_jilid": {"Jilid 2A": 3}}}');
    raise exception 'TEST FAIL: invalid per_jilid accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- Guru tidak melihat peringatan senyap.
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  if jsonb_array_length(public.get_assistant_attention(null)->'items') <> 0 then raise exception 'TEST FAIL: guru sees silent'; end if;
  select count(*) into n from public.assistant_alerts;
  if n <> 0 then raise exception 'TEST FAIL: guru selects silent alerts'; end if;
end $$;
reset role;

-- ===== Admin mematikan mode senyap dan menjalankan ulang =====
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.save_assistant_settings('{"silent_mode": false}');
  if (r->>'silent_mode')::boolean or (r#>>'{attendance,consecutive_sessions}')::int <> 3 then raise exception 'TEST FAIL: save merge %', r; end if;
  -- Perubahan sebagian berikutnya tidak boleh mengembalikan kunci lain ke default.
  r := public.save_assistant_settings('{"jilid": {"per_jilid": {"Jilid 3A": 90}}}');
  if (r->>'silent_mode')::boolean is not false or (r#>>'{jilid,per_jilid,Jilid 3A}')::int <> 90 then
    raise exception 'TEST FAIL: partial save reset other keys %', r; end if;
  r := public.save_assistant_settings('{"attendance": {"monthly_min_percent": 80}}');
  if (r->>'silent_mode')::boolean is not false or (r#>>'{jilid,per_jilid,Jilid 3A}')::int <> 90
     or (r#>>'{attendance,monthly_min_percent}')::int <> 80 or (r#>>'{attendance,consecutive_sessions}')::int <> 3 then
    raise exception 'TEST FAIL: second partial save %', r; end if;
  r := public.save_assistant_settings('{"jilid": {"per_jilid": {}}, "attendance": {"monthly_min_percent": 75}}');
  if r#>'{jilid,per_jilid}' <> '{}'::jsonb then raise exception 'TEST FAIL: per_jilid not cleared %', r; end if;
  r := public.run_assistant_rules(date '2026-10-30', true);
  if (r->>'peringatan_baru')::int < 8 then raise exception 'TEST FAIL: visible run %', r; end if;
  r := public.run_assistant_rules(date '2026-10-30', true);
  if (r->>'peringatan_baru')::int <> 0 then raise exception 'TEST FAIL: dedupe %', r; end if;
end $$;
reset role;

-- ===== Guru A: isi panel =====
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
create temp table t1_items on commit drop as
  select x.value as item from jsonb_array_elements(public.get_assistant_attention(null)->'items') x;
do $$
declare n int; v jsonb; a_s4 uuid;
begin
  -- S1 absen 3 sesi (libur dilewati), sedang
  select item into v from t1_items where item->>'nama' = 'TEST T1 Satu' and item->>'rule' = 'absen_beruntun';
  if v is null or (v#>>'{detail,streak}')::int <> 3 or v->>'tingkat' <> 'sedang' then raise exception 'TEST FAIL: S1 absen %', v; end if;
  if v#>'{detail,absent_dates}' ? '2026-10-29' then raise exception 'TEST FAIL: holiday counted'; end if;
  -- S3 absen 12 sesi, tinggi; kehadiran bulanan di bawah standar
  select item into v from t1_items where item->>'nama' = 'TEST T1 Tiga' and item->>'rule' = 'absen_beruntun';
  if v is null or (v#>>'{detail,streak}')::int <> 12 or v->>'tingkat' <> 'tinggi' then raise exception 'TEST FAIL: S3 absen %', v; end if;
  if not exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Tiga' and item->>'rule' = 'kehadiran_bulanan') then
    raise exception 'TEST FAIL: S3 monthly'; end if;
  -- S2: tidak ada absen (2 sesi), ada jilid lama 44 hari, hafalan macet, hafalan wajib belum lulus
  if exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'absen_beruntun') then
    raise exception 'TEST FAIL: S2 absen should not alert'; end if;
  select item into v from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'jilid_lama';
  if v is null or (v#>>'{detail,days}')::int <> 44 then raise exception 'TEST FAIL: S2 jilid %', v; end if;
  if not exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'hafalan_macet') then
    raise exception 'TEST FAIL: S2 hafalan macet'; end if;
  if not exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'hafalan_wajib_belum_lulus') then
    raise exception 'TEST FAIL: S2 hafalan wajib'; end if;
  if not exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Satu' and item->>'rule' = 'murojaah_belum_ditinjau') then
    raise exception 'TEST FAIL: S1 murojaah'; end if;
  -- Tingkat: peringatan pertama minimal sedang; naik ke tinggi hanya lintas bidang (jilid + hafalan).
  if (select item->>'tingkat' from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'jilid_lama') <> 'sedang' then
    raise exception 'TEST FAIL: S2 jilid tingkat'; end if;
  if (select item->>'tingkat' from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'hafalan_macet') <> 'tinggi' then
    raise exception 'TEST FAIL: S2 hafalan escalation'; end if;
  -- S6: jilid lama tetapi belum ada catatan hafalan -> tidak ada peringatan hafalan wajib.
  if not exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Enam' and item->>'rule' = 'jilid_lama') then
    raise exception 'TEST FAIL: S6 jilid'; end if;
  if exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Enam' and item->>'rule' = 'hafalan_wajib_belum_lulus') then
    raise exception 'TEST FAIL: S6 hafalan wajib without records'; end if;
  -- S3 jilid baru 10 hari: tidak ada peringatan jilid. S4 kelas lain dan S5 PTPT tidak terlihat.
  if exists (select 1 from t1_items where item->>'nama' = 'TEST T1 Tiga' and item->>'rule' = 'jilid_lama') then
    raise exception 'TEST FAIL: S3 jilid'; end if;
  if exists (select 1 from t1_items where item->>'nama' in ('TEST T1 Empat', 'TEST T1 Lima')) then
    raise exception 'TEST FAIL: S4/S5 visible to guru A'; end if;

  -- Kelas B ditolak
  begin perform public.get_assistant_attention('7e571000-0000-0000-0000-0000000c1b00'); raise exception 'TEST FAIL: class B panel';
  exception when insufficient_privilege then null; end;
  set local role postgres;
  select a.id into a_s4 from public.assistant_alerts a where a.santri_id = '7e571000-0000-0000-0000-000000000104' and not a.senyap limit 1;
  set local role authenticated;
  begin perform public.decide_assistant_alert(a_s4, 'ditangani', null); raise exception 'TEST FAIL: decide class B';
  exception when insufficient_privilege then null; end;
  begin perform public.record_presence_corrections(a_s4, array[date '2026-10-30'], null); raise exception 'TEST FAIL: correct class B';
  exception when insufficient_privilege then null; end;

  -- Tulis langsung ke tabel ditolak; UPDATE/DELETE ditolak.
  begin insert into public.attendance_presence_corrections (santri_id, class_id, tanggal)
      values ('7e571000-0000-0000-0000-000000000101', '7e571000-0000-0000-0000-0000000c1a00', date '2026-10-30');
    raise exception 'TEST FAIL: direct insert correction';
  exception when insufficient_privilege then null; end;
  begin insert into public.assistant_alert_decisions (alert_id, keputusan) select (item->>'alert_id')::uuid, 'ditangani' from t1_items limit 1;
    raise exception 'TEST FAIL: direct insert decision';
  exception when insufficient_privilege then null; end;
  begin update public.assistant_alerts set tingkat = 'rendah'; raise exception 'TEST FAIL: update alerts';
  exception when insufficient_privilege then null; end;
  begin delete from public.assistant_alerts; raise exception 'TEST FAIL: delete alerts';
  exception when insufficient_privilege then null; end;
end $$;

-- ===== Guru A: aksi =====
do $$
declare v jsonb; r jsonb;
begin
  -- Koreksi S1: tanggal di luar peringatan ditolak; koreksi 30-10 memutus rangkaian -> tertutup.
  select item into v from t1_items where item->>'nama' = 'TEST T1 Satu' and item->>'rule' = 'absen_beruntun';
  begin perform public.record_presence_corrections((v->>'alert_id')::uuid, array[date '2026-10-26'], null);
    raise exception 'TEST FAIL: correction date outside alert';
  exception when invalid_parameter_value then null; end;
  r := public.record_presence_corrections((v->>'alert_id')::uuid, array[date '2026-10-30'], 'kartu tertinggal');
  if (r->>'ditutup')::boolean is not true or (r->>'sisa_absen')::int <> 0 then raise exception 'TEST FAIL: correction %', r; end if;

  -- Abaikan tanpa alasan ditolak; dengan alasan menutup jilid S2.
  select item into v from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'jilid_lama';
  begin perform public.decide_assistant_alert((v->>'alert_id')::uuid, 'diabaikan', '  ');
    raise exception 'TEST FAIL: ignore without reason';
  exception when invalid_parameter_value then null; end;
  perform public.decide_assistant_alert((v->>'alert_id')::uuid, 'diabaikan', 'Sedang dipersiapkan ujian kenaikan');

  -- Wali S3 dihubungi untuk kehadiran bulanan.
  select item into v from t1_items where item->>'nama' = 'TEST T1 Tiga' and item->>'rule' = 'kehadiran_bulanan';
  begin perform public.record_alert_wali_followup(array[(v->>'alert_id')::uuid], public.jakarta_today() + 1, 'whatsapp', 'terhubung', null);
    raise exception 'TEST FAIL: future contact date';
  exception when invalid_parameter_value then null; end;
  -- Perkara dari dua santri berbeda dalam satu kontak ditolak.
  begin perform public.record_alert_wali_followup(array[(v->>'alert_id')::uuid,
      (select (item->>'alert_id')::uuid from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' = 'hafalan_macet')],
      public.jakarta_today(), 'whatsapp', 'terhubung', null);
    raise exception 'TEST FAIL: mixed santri followup';
  exception when invalid_parameter_value then null; end;
  perform public.record_alert_wali_followup(array[(v->>'alert_id')::uuid], public.jakarta_today(), 'whatsapp', 'janji_hadir', null);
  -- Kontak wali tidak menutup kartu; "Sudah ditangani" yang menutupnya.
  if not exists (select 1 from jsonb_array_elements(public.get_assistant_attention(null)->'items') x
                 where x->>'alert_id' = v->>'alert_id' and x->'wali_kontak'->>'hasil' = 'janji_hadir') then
    raise exception 'TEST FAIL: followup should keep card open with contact info';
  end if;
  perform public.decide_assistant_alert((v->>'alert_id')::uuid, 'ditangani', null);
  -- Satu kontak untuk dua perkara S2 hanya membuat satu baris tindak lanjut.
  perform public.record_alert_wali_followup(array(
      select (item->>'alert_id')::uuid from t1_items where item->>'nama' = 'TEST T1 Dua' and item->>'rule' in ('hafalan_macet', 'hafalan_wajib_belum_lulus')),
    public.jakarta_today(), 'telepon', 'terhubung', null);
  if (select count(*) from public.wali_followups where santri_id = '7e571000-0000-0000-0000-000000000102') <> 1 then
    raise exception 'TEST FAIL: one contact should be one followup row';
  end if;
  if (select count(*) from jsonb_array_elements(public.get_assistant_attention(null)->'items') x
      where x->>'nama' = 'TEST T1 Dua' and x->>'rule' in ('hafalan_macet', 'hafalan_wajib_belum_lulus')
        and x->'wali_kontak'->>'saluran' = 'telepon') <> 2 then
    raise exception 'TEST FAIL: grouped followup should show contact on both';
  end if;

  r := public.get_assistant_attention(null);
  if exists (select 1 from jsonb_array_elements(r->'items') x
             where (x->>'nama' = 'TEST T1 Satu' and x->>'rule' = 'absen_beruntun')
                or (x->>'nama' = 'TEST T1 Dua' and x->>'rule' = 'jilid_lama')
                or (x->>'nama' = 'TEST T1 Tiga' and x->>'rule' = 'kehadiran_bulanan')) then
    raise exception 'TEST FAIL: decided items still open';
  end if;
  if not exists (select 1 from jsonb_array_elements(r->'items') x where x->>'nama' = 'TEST T1 Tiga' and x->>'rule' = 'absen_beruntun') then
    raise exception 'TEST FAIL: S3 absen should remain open';
  end if;
end $$;
reset role;

-- ===== Guru B tidak melihat kelas A =====
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb; n int;
begin
  r := public.get_assistant_attention(null);
  if exists (select 1 from jsonb_array_elements(r->'items') x where x->>'class_id' <> '7e571000-0000-0000-0000-0000000c1b00') then
    raise exception 'TEST FAIL: guru B sees class A'; end if;
  if not exists (select 1 from jsonb_array_elements(r->'items') x where x->>'nama' = 'TEST T1 Empat') then
    raise exception 'TEST FAIL: guru B misses own class'; end if;
  select count(*) into n from public.attendance_presence_corrections;
  if n <> 0 then raise exception 'TEST FAIL: guru B sees class A corrections'; end if;
  select count(*) into n from public.wali_followups;
  if n <> 0 then raise exception 'TEST FAIL: guru B sees class A followups'; end if;
  select count(*) into n from public.assistant_alert_decisions;
  if n <> 0 then raise exception 'TEST FAIL: guru B sees class A decisions'; end if;
end $$;
reset role;

-- ===== Mode senyap dinyalakan kembali: peringatan lama yang sudah tampil ikut tersembunyi dari guru =====
set local role authenticated;
do $$
declare v_alert uuid; n int; r jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform public.save_assistant_settings('{"silent_mode": true}');
  select a.id into v_alert from public.assistant_alerts a
  where not a.senyap and a.class_id = '7e571000-0000-0000-0000-0000000c1a00' limit 1;
  if v_alert is null then raise exception 'TEST FAIL: no visible alert to hide'; end if;

  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  r := public.get_assistant_attention(null);
  if jsonb_array_length(r->'items') <> 0 or (r->>'mode_senyap')::boolean is not true then
    raise exception 'TEST FAIL: guru sees alerts after silent re-enabled %', r; end if;
  select count(*) into n from public.assistant_alerts;
  if n <> 0 then raise exception 'TEST FAIL: guru selects alerts after silent re-enabled'; end if;
  begin perform public.decide_assistant_alert(v_alert, 'ditangani', null); raise exception 'TEST FAIL: guru decides in silent mode';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform public.save_assistant_settings('{"silent_mode": false}');
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  if jsonb_array_length(public.get_assistant_attention(null)->'items') = 0 then
    raise exception 'TEST FAIL: alerts not back after silent off'; end if;
end $$;
reset role;

-- ===== Ringkasan santri untuk infografik: lingkup kelas dan mode senyap =====
set local role authenticated;
do $$
declare r jsonb; v jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  r := public.get_assistant_santri_snapshot(array['7e571000-0000-0000-0000-000000000102', '7e571000-0000-0000-0000-000000000104']::uuid[]);
  if jsonb_array_length(r) <> 1 or r->0->>'santri_id' <> '7e571000-0000-0000-0000-000000000102' then
    raise exception 'TEST FAIL: snapshot scope guru A %', r; end if;
  v := r->0;
  if (v->>'jilid_hari')::int is null or (v->>'jilid_batas')::int is null or jsonb_array_length(v->'sesi_terakhir') = 0
     or v->'hafalan'->>'total' is null then
    raise exception 'TEST FAIL: snapshot fields %', v; end if;

  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
  if jsonb_array_length(public.get_assistant_santri_snapshot(array['7e571000-0000-0000-0000-000000000102']::uuid[])) <> 0 then
    raise exception 'TEST FAIL: guru B sees class A snapshot'; end if;

  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform public.save_assistant_settings('{"silent_mode": true}');
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  if jsonb_array_length(public.get_assistant_santri_snapshot(array['7e571000-0000-0000-0000-000000000102']::uuid[])) <> 0 then
    raise exception 'TEST FAIL: snapshot visible in silent mode'; end if;
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  if jsonb_array_length(public.get_assistant_santri_snapshot(array['7e571000-0000-0000-0000-000000000102']::uuid[])) <> 1 then
    raise exception 'TEST FAIL: admin snapshot in silent mode'; end if;
  perform public.save_assistant_settings('{"silent_mode": false}');
end $$;
reset role;

-- ===== Telegram: sambungan akun dan penyusunan pesan =====
create temp table t1_tg (who text primary key, token text);
grant all on t1_tg to authenticated;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  begin perform public.save_assistant_settings('{"notifications": {"bot_username": "bad name!"}}'); raise exception 'TEST FAIL: invalid bot username';
  exception when invalid_parameter_value then null; end;
  v := public.save_assistant_settings('{"notifications": {"telegram_enabled": true, "bot_username": "LpqDemoBot", "summary_hour": 19}}');
  if (v->>'silent_mode')::boolean or (v#>>'{attendance,consecutive_sessions}')::int <> 3 then raise exception 'TEST FAIL: notif save merge %', v; end if;
  insert into t1_tg values ('admin', public.create_telegram_link_token());

  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  v := public.get_my_telegram_link();
  if (v->>'linked')::boolean or v->>'bot_username' <> 'LpqDemoBot' or not (v->>'enabled')::boolean then raise exception 'TEST FAIL: link status %', v; end if;
  insert into t1_tg values ('guru_a', public.create_telegram_link_token());
  begin perform public.assistant_telegram_enqueue(); raise exception 'TEST FAIL: guru ran enqueue';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.telegram_link_tokens; raise exception 'TEST FAIL: guru reads tokens';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$
declare v jsonb; n int; v_msg text;
begin
  perform set_config('request.jwt.claims', '', true);
  v := public.telegram_consume_link_token((select token from t1_tg where who = 'guru_a'), 1001);
  if not (v->>'ok')::boolean then raise exception 'TEST FAIL: consume %', v; end if;
  if (public.telegram_consume_link_token((select token from t1_tg where who = 'guru_a'), 1001)->>'ok')::boolean then
    raise exception 'TEST FAIL: token reused'; end if;
  if (public.telegram_consume_link_token('salah', 1003)->>'ok')::boolean then raise exception 'TEST FAIL: bad token'; end if;
  perform public.telegram_consume_link_token((select token from t1_tg where who = 'admin'), 1002);

  -- Pukul 07.00 WIB: hanya prioritas tinggi; 19.30 WIB: ringkasan guru juga.
  n := public.assistant_telegram_enqueue((public.jakarta_today() + time '07:00') at time zone 'Asia/Jakarta');
  if n = 0 or exists (select 1 from public.assistant_telegram_outbox where jenis = 'ringkasan') then
    raise exception 'TEST FAIL: morning enqueue %', n; end if;
  n := public.assistant_telegram_enqueue((public.jakarta_today() + time '19:30') at time zone 'Asia/Jakarta');
  if (select count(*) from public.assistant_telegram_outbox where jenis = 'ringkasan' and user_id = '7e571000-0000-0000-0000-0000000000a1') <> 1 then
    raise exception 'TEST FAIL: guru summary'; end if;
  if exists (select 1 from public.assistant_telegram_outbox where jenis = 'ringkasan' and user_id = '7e571000-0000-0000-0000-00000000000a') then
    raise exception 'TEST FAIL: admin got summary'; end if;
  if not exists (select 1 from public.assistant_telegram_outbox where jenis = 'segera' and user_id = '7e571000-0000-0000-0000-00000000000a') then
    raise exception 'TEST FAIL: admin missing high priority'; end if;
  if public.assistant_telegram_enqueue((public.jakarta_today() + time '19:40') at time zone 'Asia/Jakarta') <> 0 then
    raise exception 'TEST FAIL: dedupe'; end if;
  if (select count(*) from public.assistant_telegram_outbox where jenis = 'segera' and user_id = '7e571000-0000-0000-0000-00000000000a') <> 1 then
    raise exception 'TEST FAIL: high priority should be one batched message'; end if;
  if (select tautan from public.assistant_telegram_outbox where jenis = 'ringkasan') not like 'https://%' then
    raise exception 'TEST FAIL: dashboard button url'; end if;

  select pesan into v_msg from public.assistant_telegram_outbox where jenis = 'ringkasan';
  if v_msg ~ 'TEST T1 (Satu|Dua|Tiga|Enam)' or v_msg like '%080%' or v_msg not like '%<b>TEST</b> — %' or v_msg not like '%📅 absen%' or v_msg like '%Empat%' then
    raise exception 'TEST FAIL: summary content [%]', replace(v_msg, E'\n', ' | '); end if;

  -- Ambil di jam tenang: kosong; di jam kerja: terambil dan dihitung percobaannya.
  if exists (select 1 from public.assistant_telegram_claim(30, (public.jakarta_today() + time '22:00') at time zone 'Asia/Jakarta')) then
    raise exception 'TEST FAIL: claim in quiet hours'; end if;
  select count(*) into n from public.assistant_telegram_claim(30, (public.jakarta_today() + time '08:00') at time zone 'Asia/Jakarta');
  if n = 0 or exists (select 1 from public.assistant_telegram_outbox where percobaan = 0) then raise exception 'TEST FAIL: claim %', n; end if;
  perform public.assistant_telegram_mark((select id from public.assistant_telegram_outbox where jenis = 'ringkasan'), true);
  perform public.assistant_telegram_mark((select id from public.assistant_telegram_outbox where user_id = '7e571000-0000-0000-0000-00000000000a' limit 1), false, 'Forbidden: bot was blocked by the user', true);
  if (select active from public.telegram_links where user_id = '7e571000-0000-0000-0000-00000000000a') then
    raise exception 'TEST FAIL: blocked bot keeps link'; end if;
  perform public.telegram_stop(1001);
  if (select active from public.telegram_links where user_id = '7e571000-0000-0000-0000-0000000000a1') then
    raise exception 'TEST FAIL: /stop'; end if;
end $$;

-- Mode senyap: tidak ada pesan baru.
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform public.save_assistant_settings('{"silent_mode": true}');
end $$;
reset role;
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  update public.telegram_links set active = true;
  delete from public.assistant_telegram_outbox;
  if public.assistant_telegram_enqueue((public.jakarta_today() + time '19:30') at time zone 'Asia/Jakarta') <> 0 then
    raise exception 'TEST FAIL: telegram in silent mode'; end if;
end $$;
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform public.save_assistant_settings('{"silent_mode": false}');
end $$;
reset role;

-- ===== Pemilik/service role: tetap hanya-tambah; tap asli utuh; tutup otomatis saat kembali hadir =====
do $$
declare v_n int; v_h text; r jsonb;
begin
  begin update public.assistant_alerts set tingkat = 'rendah'; raise exception 'TEST FAIL: owner update alerts';
  exception when insufficient_privilege then null; end;
  begin delete from public.wali_followups; raise exception 'TEST FAIL: owner delete followups';
  exception when insufficient_privilege then null; end;
  begin update public.assistant_settings set settings = '{}'; raise exception 'TEST FAIL: owner update settings';
  exception when insufficient_privilege then null; end;

  select count(*), md5(string_agg(a::text, ',' order by a.id)) into v_n, v_h from public.attendance a;
  if exists (select 1 from t1_attendance_before b where b.n <> v_n or b.h is distinct from v_h) then
    raise exception 'TEST FAIL: attendance modified by assistant';
  end if;

  if not exists (select 1 from cron.job where jobname = 'assistant-rules-daily') then raise exception 'TEST FAIL: cron job'; end if;

  -- S2 naik jilid -> perkara hafalan wajib jilid lama ikut tertutup.
  update public.santri set jilid = 'Jilid 2B' where id = '7e571000-0000-0000-0000-000000000102';
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  r := public.get_assistant_attention(null);
  if exists (select 1 from jsonb_array_elements(r->'items') x where x->>'nama' = 'TEST T1 Dua' and x->>'rule' in ('hafalan_wajib_belum_lulus', 'jilid_lama')) then
    raise exception 'TEST FAIL: S2 jilid-bound alerts not closed after promotion';
  end if;

  -- Item hafalan S2 dinilai skor 4 -> hafalan macet tertutup otomatis.
  update public.hafalan_progress set score = 4, updated_at = now() where santri_id = '7e571000-0000-0000-0000-000000000102';
  r := public.get_assistant_attention(null);
  if exists (select 1 from jsonb_array_elements(r->'items') x where x->>'nama' = 'TEST T1 Dua' and x->>'rule' = 'hafalan_macet') then
    raise exception 'TEST FAIL: hafalan macet not closed after score 4';
  end if;

  -- S3 kembali hadir 02-11 -> kartu absen S3 tertutup otomatis.
  insert into public.attendance (user_id, role, attendance_date, check_in_time, class_id, sesi, status, source)
  values ('7e571000-0000-0000-0000-000000000103', 'santri', date '2026-11-02', '15:50', '7e571000-0000-0000-0000-0000000c1a00', 'Sore', 'Hadir', 'rfid');
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  r := public.get_assistant_attention(null);
  if exists (select 1 from jsonb_array_elements(r->'items') x where x->>'nama' = 'TEST T1 Tiga' and x->>'rule' = 'absen_beruntun') then
    raise exception 'TEST FAIL: S3 absen not auto-closed';
  end if;

  -- Hapus permanen santri tetap bisa (cascade melewati trigger hanya-tambah).
  delete from public.santri where id = '7e571000-0000-0000-0000-000000000101';
  if exists (select 1 from public.attendance_presence_corrections where santri_id = '7e571000-0000-0000-0000-000000000101') then
    raise exception 'TEST FAIL: cascade';
  end if;
end $$;

-- ===== Tahap 3: pengaturan & data rekomendasi AI =====
do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  v := public.get_assistant_settings();
  if v#>>'{ai,provider}' <> 'mock' or (v#>>'{ai,enabled}')::boolean then raise exception 'TEST FAIL: ai default'; end if;
  v := public.save_assistant_settings('{"ai":{"enabled":true,"provider":"anthropic","model":"claude-haiku-5-5"}}');
  if v#>>'{ai,provider}' <> 'anthropic' or (v#>>'{ai,monthly_budget_usd}')::numeric <> 10
     or v#>>'{notifications,summary_hour}' is null then
    raise exception 'TEST FAIL: ai partial save';
  end if;
  begin
    perform public.save_assistant_settings('{"ai":{"provider":"rahasia"}}');
    raise exception 'TEST FAIL: invalid provider accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_assistant_settings('{"ai":{"provider":"custom","base_url":""}}');
    raise exception 'TEST FAIL: custom without base_url accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_assistant_settings('{"ai":{"monthly_budget_usd":5000}}');
    raise exception 'TEST FAIL: budget out of range accepted';
  exception when invalid_parameter_value then null;
  end;

  insert into public.assistant_ai_recommendations (santri_id, input_hash, provider, model, hasil)
  values ('7e571000-0000-0000-0000-000000000102', 'h-a', 'mock', 'mock', '{"ringkasan":"x","langkah":[],"pesan_wali":""}'),
         ('7e571000-0000-0000-0000-000000000104', 'h-b', 'mock', 'mock', '{"ringkasan":"y","langkah":[],"pesan_wali":""}');
  insert into public.assistant_ai_usage (user_id, provider, model, status, input_tokens, output_tokens, biaya_usd)
  values ('7e571000-0000-0000-0000-0000000000a1', 'mock', 'mock', 'ok', 100, 50, 0.25),
         ('7e571000-0000-0000-0000-0000000000a1', 'mock', 'mock', 'cache', 0, 0, 0);
  v := public.get_assistant_ai_usage();
  if (v->>'biaya_usd')::numeric <> 0.25 or (v->>'permintaan')::int <> 1 or (v->>'dari_cache')::int <> 1 then
    raise exception 'TEST FAIL: ai month usage %', v;
  end if;

  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  begin
    perform public.get_assistant_ai_usage();
    raise exception 'TEST FAIL: guru read ai usage';
  exception when insufficient_privilege then null;
  end;
end $$;

-- RLS: guru A hanya melihat rekomendasi santri kelasnya; log biaya hanya admin.
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.assistant_ai_recommendations where input_hash in ('h-a', 'h-b')) <> 1
     or not exists (select 1 from public.assistant_ai_recommendations where input_hash = 'h-a') then
    raise exception 'TEST FAIL: ai recommendation RLS for guru';
  end if;
  if exists (select 1 from public.assistant_ai_usage) then raise exception 'TEST FAIL: guru sees ai usage'; end if;
  begin
    insert into public.assistant_ai_recommendations (santri_id, input_hash, provider, model, hasil)
    values ('7e571000-0000-0000-0000-000000000102', 'h-x', 'mock', 'mock', '{}');
    raise exception 'TEST FAIL: guru inserted ai recommendation';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.assistant_ai_recommendations where input_hash in ('h-a', 'h-b')) <> 2 then
    raise exception 'TEST FAIL: admin ai recommendation RLS';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ===== Tahap 3b: konteks lembaga, kelas, profil, percakapan =====
do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  if coalesce(public.get_assistant_settings()#>>'{ai,konteks_lembaga}', '') not like '%Qiroati%' then
    raise exception 'TEST FAIL: default konteks lembaga';
  end if;
  begin
    perform public.save_assistant_settings(jsonb_build_object('ai', jsonb_build_object('konteks_lembaga', repeat('x', 6001))));
    raise exception 'TEST FAIL: konteks too long accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.save_assistant_settings('{"silent_mode":false}');

  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  v := public.get_assistant_ai_classes();
  if jsonb_array_length(v) <> 1 or v->0->>'nama_kelas' <> 'TEST T1 Kelas A' then raise exception 'TEST FAIL: guru classes %', v; end if;
  v := public.get_assistant_class_roster('7e571000-0000-0000-0000-0000000c1a00');
  if exists (select 1 from jsonb_array_elements(v) x where x->>'nama_lengkap' = 'TEST T1 Lima') then
    raise exception 'TEST FAIL: roster includes non-Anak santri';
  end if;
  begin
    perform public.get_assistant_class_roster('7e571000-0000-0000-0000-0000000c1b00');
    raise exception 'TEST FAIL: guru A read class B roster';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_assistant_santri_profile('7e571000-0000-0000-0000-000000000104');
    raise exception 'TEST FAIL: guru A read class B profile';
  exception when insufficient_privilege then null;
  end;
  v := public.get_assistant_santri_profile('7e571000-0000-0000-0000-000000000102');
  if v->>'jilid' is null or jsonb_typeof(v->'hafalan') <> 'array' then raise exception 'TEST FAIL: profile shape %', v; end if;

  -- Mode senyap: guru tidak mendapat kelas/profil.
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform public.save_assistant_settings('{"silent_mode":true}');
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  if jsonb_array_length(public.get_assistant_ai_classes()) <> 0
     or public.get_assistant_santri_profile('7e571000-0000-0000-0000-000000000102') is not null then
    raise exception 'TEST FAIL: silent mode leaks ai data';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform public.save_assistant_settings('{"silent_mode":false}');

  insert into public.assistant_ai_conversations (id, user_id, class_id, judul)
  values ('7e571000-0000-0000-0000-00000000c0c0', '7e571000-0000-0000-0000-0000000000a1', '7e571000-0000-0000-0000-0000000c1a00', 'uji');
  insert into public.assistant_ai_messages (conversation_id, role, content)
  values ('7e571000-0000-0000-0000-00000000c0c0', 'user', 'halo');
end $$;

select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.assistant_ai_conversations) or exists (select 1 from public.assistant_ai_messages) then
    raise exception 'TEST FAIL: other guru reads conversation';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"7e571000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.assistant_ai_messages) <> 1 then raise exception 'TEST FAIL: owner cannot read messages'; end if;
  begin
    insert into public.assistant_ai_messages (conversation_id, role, content) values ('7e571000-0000-0000-0000-00000000c0c0', 'assistant', 'palsu');
    raise exception 'TEST FAIL: client inserted message';
  exception when insufficient_privilege then null;
  end;
  delete from public.assistant_ai_conversations where id = '7e571000-0000-0000-0000-00000000c0c0';
  if exists (select 1 from public.assistant_ai_messages) then raise exception 'TEST FAIL: delete cascade'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

select 'PASS: asisten tahap 1-3 (aturan, senyap, panel, koreksi, keputusan, RLS, hanya-tambah, telegram, ai)' as result;
rollback;
