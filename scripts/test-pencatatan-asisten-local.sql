\set ON_ERROR_STOP on
-- Uji kontrak pencatatan asisten AI (absen panggil, log audit, peringatan, tindak lanjut wali,
-- ekspor berkode) di Supabase lokal. Semua data rekaan dan seluruh transaksi di-rollback.
-- Jalankan: docker exec -i supabase_db_lpq-al-fath-maulana-local psql -U postgres -d postgres < scripts/test-pencatatan-asisten-local.sql
begin;

insert into auth.users (id, email) values
  ('7e570000-0000-0000-0000-00000000000a', 'admin@lpqalfathmaulana.id'),
  ('7e570000-0000-0000-0000-0000000000a1', 'TEST-pa-guru-a@local.invalid'),
  ('7e570000-0000-0000-0000-0000000000b1', 'TEST-pa-guru-b@local.invalid'),
  ('7e570000-0000-0000-0000-000000000101', 'TEST-pa-santri-a1@local.invalid'),
  ('7e570000-0000-0000-0000-000000000102', 'TEST-pa-santri-a2@local.invalid'),
  ('7e570000-0000-0000-0000-000000000201', 'TEST-pa-santri-b1@local.invalid');
insert into public.user_profiles (id, role, status, email) values
  ('7e570000-0000-0000-0000-00000000000a', 'admin', 'active', 'admin@lpqalfathmaulana.id'),
  ('7e570000-0000-0000-0000-0000000000a1', 'guru', 'active', null),
  ('7e570000-0000-0000-0000-0000000000b1', 'guru', 'active', null),
  ('7e570000-0000-0000-0000-000000000101', 'santri', 'active', null),
  ('7e570000-0000-0000-0000-000000000102', 'santri', 'active', null),
  ('7e570000-0000-0000-0000-000000000201', 'santri', 'active', null);
insert into public.guru (id, nama, email, roles) values
  ('7e570000-0000-0000-0000-0000000000a1', 'TEST PA Guru A', 'TEST-pa-guru-a@local.invalid', '{}'),
  ('7e570000-0000-0000-0000-0000000000b1', 'TEST PA Guru B', 'TEST-pa-guru-b@local.invalid', '{}');
insert into public.classes (id, nama_kelas, id_guru, sesi) values
  ('7e570000-0000-0000-0000-0000000c1a00', 'TEST PA Kelas A', '7e570000-0000-0000-0000-0000000000a1', 'Sore'),
  ('7e570000-0000-0000-0000-0000000c1b00', 'TEST PA Kelas B', '7e570000-0000-0000-0000-0000000000b1', 'Sore');
insert into public.santri (id, nomor_induk_qiroati, nama_lengkap, kategori, current_class_id, no_hp_ortu) values
  ('7e570000-0000-0000-0000-000000000101', 'TESTPA-A1', 'TEST PA Santri A1', 'Anak', '7e570000-0000-0000-0000-0000000c1a00', '081200000001'),
  ('7e570000-0000-0000-0000-000000000102', 'TESTPA-A2', 'TEST PA Santri A2', 'Anak', '7e570000-0000-0000-0000-0000000c1a00', '081200000002'),
  ('7e570000-0000-0000-0000-000000000201', 'TESTPA-B1', 'TEST PA Santri B1', 'Anak', '7e570000-0000-0000-0000-0000000c1b00', '081200000003');
insert into public.class_memberships (santri_id, class_id, start_date, status, order_in_class) values
  ('7e570000-0000-0000-0000-000000000101', '7e570000-0000-0000-0000-0000000c1a00', current_date - 30, 'active', 1),
  ('7e570000-0000-0000-0000-000000000102', '7e570000-0000-0000-0000-0000000c1a00', current_date - 30, 'active', 2),
  ('7e570000-0000-0000-0000-000000000201', '7e570000-0000-0000-0000-0000000c1b00', current_date - 30, 'active', 1);
insert into public.attendance (user_id, role, attendance_date, check_in_time, class_id, sesi, status, source) values
  ('7e570000-0000-0000-0000-000000000101', 'santri', current_date - 1, '15:52', '7e570000-0000-0000-0000-0000000c1a00', 'Sore', 'Hadir', 'rfid');
insert into public.academic_calendar (date, title, is_holiday) values (current_date - 3, 'TEST PA Libur', true)
  on conflict (date) do nothing;

create temp table pa_attendance_before as select count(*) as n, md5(string_agg(a::text, ',' order by a.id)) as h from public.attendance a;
grant select on pa_attendance_before to authenticated;

-- Data kelas B oleh admin (untuk membuktikan guru A tidak bisa melihatnya).
select set_config('request.jwt.claims', '{"sub":"7e570000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.save_attendance_confirmations('7e570000-0000-0000-0000-0000000c1b00', current_date - 1, 'Sore',
  '[{"santri_id":"7e570000-0000-0000-0000-000000000201","status":"alpa"}]');
insert into public.assistant_alerts (santri_id, class_id, jenis, tingkat, alasan)
  values ('7e570000-0000-0000-0000-000000000201', '7e570000-0000-0000-0000-0000000c1b00', 'alpa_beruntun', 'sedang', 'TEST alpa 2 sesi');
insert into public.assistant_alerts (santri_id, class_id, jenis, tingkat, alasan)
  values ('7e570000-0000-0000-0000-000000000101', '7e570000-0000-0000-0000-0000000c1a00', 'alpa_beruntun', 'sedang', 'TEST alpa 2 sesi');
insert into public.assistant_audit_log (user_id, peran, aksi) values ('7e570000-0000-0000-0000-00000000000a', 'admin', 'TEST admin');
reset role;

-- ===== Guru A =====
select set_config('request.jwt.claims', '{"sub":"7e570000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb; n integer; s text;
begin
  -- Daftar absen panggil dengan saran dari tap.
  r := public.get_attendance_roll_call('7e570000-0000-0000-0000-0000000c1a00', current_date - 1, 'Sore');
  if jsonb_array_length(r->'santri') <> 2 then raise exception 'TEST FAIL: roll call rows %', r; end if;
  if (r->'santri'->0->>'tap_waktu') <> '15:52:00' then raise exception 'TEST FAIL: tap suggestion %', r; end if;
  r := public.get_attendance_roll_call('7e570000-0000-0000-0000-0000000c1a00', current_date - 3, 'Sore');
  if (r->'libur'->>'is_holiday')::boolean is not true then raise exception 'TEST FAIL: holiday flag %', r; end if;

  begin perform public.get_attendance_roll_call('7e570000-0000-0000-0000-0000000c1b00', current_date - 1, 'Sore');
    raise exception 'TEST FAIL: guru A read class B roll call';
  exception when insufficient_privilege then null; end;

  -- Simpan, lalu ubah: perubahan masuk riwayat, baris pertama tetap.
  r := public.save_attendance_confirmations('7e570000-0000-0000-0000-0000000c1a00', current_date - 1, 'Sore',
    '[{"santri_id":"7e570000-0000-0000-0000-000000000101","status":"hadir"},{"santri_id":"7e570000-0000-0000-0000-000000000102","status":"alpa"}]');
  if (r->>'baru')::int <> 2 then raise exception 'TEST FAIL: first save %', r; end if;
  r := public.save_attendance_confirmations('7e570000-0000-0000-0000-0000000c1a00', current_date - 1, 'Sore',
    '[{"santri_id":"7e570000-0000-0000-0000-000000000101","status":"hadir"},{"santri_id":"7e570000-0000-0000-0000-000000000102","status":"sakit","keterangan":"demam"}]');
  if (r->>'diubah')::int <> 1 or (r->>'tetap')::int <> 1 then raise exception 'TEST FAIL: second save %', r; end if;
  select status into s from public.attendance_confirmations_current
    where santri_id = '7e570000-0000-0000-0000-000000000102' and tanggal = current_date - 1 and sesi = 'Sore';
  if s <> 'sakit' then raise exception 'TEST FAIL: current status %', s; end if;
  select status into s from public.attendance_confirmations
    where santri_id = '7e570000-0000-0000-0000-000000000102' and tanggal = current_date - 1 and sesi = 'Sore';
  if s <> 'alpa' then raise exception 'TEST FAIL: original row overwritten (%)', s; end if;

  -- Kelas lain dan santri kelas lain ditolak.
  begin perform public.save_attendance_confirmations('7e570000-0000-0000-0000-0000000c1b00', current_date - 1, 'Sore',
      '[{"santri_id":"7e570000-0000-0000-0000-000000000201","status":"hadir"}]');
    raise exception 'TEST FAIL: guru A wrote class B';
  exception when insufficient_privilege then null; end;
  begin perform public.save_attendance_confirmations('7e570000-0000-0000-0000-0000000c1a00', current_date - 1, 'Sore',
      '[{"santri_id":"7e570000-0000-0000-0000-000000000201","status":"hadir"}]');
    raise exception 'TEST FAIL: guru A wrote santri of class B through own class';
  exception when insufficient_privilege then null; end;
  begin perform public.save_attendance_confirmations('7e570000-0000-0000-0000-0000000c1a00', current_date + 1, 'Sore',
      '[{"santri_id":"7e570000-0000-0000-0000-000000000101","status":"hadir"}]');
    raise exception 'TEST FAIL: future date accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.save_attendance_confirmations('7e570000-0000-0000-0000-0000000c1a00', current_date - 1, 'Sore',
      '[{"santri_id":"7e570000-0000-0000-0000-000000000101","status":"bolos"}]');
    raise exception 'TEST FAIL: invalid status accepted';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.attendance_confirmations (santri_id, class_id, tanggal, sesi, status)
      values ('7e570000-0000-0000-0000-000000000201', '7e570000-0000-0000-0000-0000000c1b00', current_date - 2, 'Sore', 'hadir');
    raise exception 'TEST FAIL: direct insert into class B';
  exception when insufficient_privilege then null; end;

  select count(*) into n from public.attendance_confirmations where class_id = '7e570000-0000-0000-0000-0000000c1b00';
  if n <> 0 then raise exception 'TEST FAIL: guru A sees class B confirmations'; end if;
  select count(*) into n from public.attendance_confirmations_current where class_id = '7e570000-0000-0000-0000-0000000c1b00';
  if n <> 0 then raise exception 'TEST FAIL: guru A sees class B via view'; end if;
  select count(*) into n from public.attendance_confirmation_changes;
  if n <> 1 then raise exception 'TEST FAIL: guru A change rows %', n; end if;

  -- UPDATE/DELETE ditolak untuk semua tabel pencatatan.
  begin update public.attendance_confirmations set status = 'hadir'; raise exception 'TEST FAIL: update confirmations';
  exception when insufficient_privilege then null; end;
  begin delete from public.attendance_confirmations; raise exception 'TEST FAIL: delete confirmations';
  exception when insufficient_privilege then null; end;
  begin delete from public.attendance_confirmation_changes; raise exception 'TEST FAIL: delete changes';
  exception when insufficient_privilege then null; end;

  -- Tindak lanjut wali.
  insert into public.wali_followups (santri_id, class_id, tanggal_peringatan, tanggal_kontak, saluran, hasil)
    values ('7e570000-0000-0000-0000-000000000102', '7e570000-0000-0000-0000-0000000c1a00', current_date - 1, current_date, 'whatsapp', 'terhubung');
  begin
    insert into public.wali_followups (santri_id, class_id, tanggal_kontak, saluran, hasil)
      values ('7e570000-0000-0000-0000-000000000201', '7e570000-0000-0000-0000-0000000c1b00', current_date, 'whatsapp', 'terhubung');
    raise exception 'TEST FAIL: followup for class B';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.wali_followups (santri_id, class_id, guru_id, tanggal_kontak, saluran, hasil)
      values ('7e570000-0000-0000-0000-000000000101', '7e570000-0000-0000-0000-0000000c1a00', '7e570000-0000-0000-0000-0000000000b1', current_date, 'telepon', 'terhubung');
    raise exception 'TEST FAIL: followup impersonating another guru';
  exception when insufficient_privilege then null; end;
  begin update public.wali_followups set hasil = 'lainnya'; raise exception 'TEST FAIL: update followups';
  exception when insufficient_privilege then null; end;
  begin delete from public.wali_followups; raise exception 'TEST FAIL: delete followups';
  exception when insufficient_privilege then null; end;

  -- Peringatan: guru membaca kelasnya saja dan tidak bisa membuat peringatan.
  select count(*) into n from public.assistant_alerts;
  if n <> 1 then raise exception 'TEST FAIL: guru A alert visibility %', n; end if;
  begin
    insert into public.assistant_alerts (santri_id, class_id, jenis, tingkat, alasan)
      values ('7e570000-0000-0000-0000-000000000101', '7e570000-0000-0000-0000-0000000c1a00', 'x', 'rendah', 'x');
    raise exception 'TEST FAIL: guru created alert';
  exception when insufficient_privilege then null; end;
  insert into public.assistant_alert_decisions (alert_id, keputusan)
    select id, 'ditindaklanjuti' from public.assistant_alerts;
  begin update public.assistant_alerts set tingkat = 'tinggi'; raise exception 'TEST FAIL: update alerts';
  exception when insufficient_privilege then null; end;

  -- Log audit: hanya atas nama sendiri dan peran sendiri; tidak bisa diubah atau dihapus.
  insert into public.assistant_audit_log (user_id, peran, aksi, tool) values (auth.uid(), 'guru', 'TEST tanya', 'daftar_absen');
  begin insert into public.assistant_audit_log (user_id, peran, aksi) values (auth.uid(), 'admin', 'TEST');
    raise exception 'TEST FAIL: role spoof in audit log';
  exception when insufficient_privilege then null; end;
  begin insert into public.assistant_audit_log (user_id, peran, aksi) values ('7e570000-0000-0000-0000-0000000000b1', 'guru', 'TEST');
    raise exception 'TEST FAIL: user spoof in audit log';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.assistant_audit_log;
  if n <> 1 then raise exception 'TEST FAIL: guru A sees other audit rows %', n; end if;
  begin update public.assistant_audit_log set aksi = 'x'; raise exception 'TEST FAIL: update audit log';
  exception when insufficient_privilege then null; end;
  begin delete from public.assistant_audit_log; raise exception 'TEST FAIL: delete audit log';
  exception when insufficient_privilege then null; end;

  -- Ekspor khusus admin; tabel kode tidak terbaca.
  begin perform * from public.export_rekap_penelitian_berkode(current_date - 7, current_date);
    raise exception 'TEST FAIL: guru exported';
  exception when insufficient_privilege then null; end;
  begin perform * from public.research_subject_codes; raise exception 'TEST FAIL: guru read code map';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== Guru B tidak melihat data kelas A =====
select set_config('request.jwt.claims', '{"sub":"7e570000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.attendance_confirmations where class_id = '7e570000-0000-0000-0000-0000000c1a00';
  if n <> 0 then raise exception 'TEST FAIL: guru B sees class A'; end if;
  select count(*) into n from public.attendance_confirmation_changes;
  if n <> 0 then raise exception 'TEST FAIL: guru B sees class A changes'; end if;
  select count(*) into n from public.wali_followups;
  if n <> 0 then raise exception 'TEST FAIL: guru B sees class A followups'; end if;
  select count(*) into n from public.assistant_alert_decisions;
  if n <> 0 then raise exception 'TEST FAIL: guru B sees class A decisions'; end if;
  select count(*) into n from public.assistant_audit_log;
  if n <> 0 then raise exception 'TEST FAIL: guru B sees other audit rows'; end if;
end $$;
reset role;

-- ===== Anon tidak punya akses =====
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin perform * from public.attendance_confirmations; raise exception 'TEST FAIL: anon read';
  exception when insufficient_privilege then null; end;
  begin perform * from public.assistant_audit_log; raise exception 'TEST FAIL: anon read audit';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== Admin: ekspor berkode =====
select set_config('request.jwt.claims', '{"sub":"7e570000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer; k1 text; k2 text; leaked integer;
begin
  select count(*) into n from public.export_rekap_penelitian_berkode(current_date - 7, current_date);
  if n <> 3 then raise exception 'TEST FAIL: rekap rows %', n; end if;
  select string_agg(kode_santri || kode_kelas, ',' order by kode_santri) into k1 from public.export_rekap_penelitian_berkode(current_date - 7, current_date);
  select string_agg(kode_santri || kode_kelas, ',' order by kode_santri) into k2 from public.export_rekap_penelitian_berkode(current_date - 7, current_date);
  if k1 is null or k1 !~ '^K-[0-9]{3}Kelas-[0-9]{2}' or k1 <> k2 then raise exception 'TEST FAIL: unstable or malformed code % %', k1, k2; end if;
  select count(*) into n from public.export_rekap_penelitian_berkode(current_date - 7, current_date) where sakit = 1 and sesi_berubah_status = 1;
  if n <> 1 then raise exception 'TEST FAIL: change not reflected in rekap'; end if;
  select count(*) into n from public.export_tindak_lanjut_berkode(current_date - 7, current_date) where selisih_hari = 1 and kode_guru ~ '^G-[0-9]{2}$';
  if n <> 1 then raise exception 'TEST FAIL: followup export'; end if;
  select count(*) into leaked from public.export_rekap_penelitian_berkode(current_date - 7, current_date) r
    where r::text ~* 'TEST PA|TESTPA|0812';
  if leaked <> 0 then raise exception 'TEST FAIL: identity leaked in export'; end if;
  begin perform * from public.export_rekap_penelitian_berkode(current_date, current_date - 1);
    raise exception 'TEST FAIL: reversed range accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- ===== Service role / pemilik: tetap tidak bisa mengubah; tap asli utuh; hapus santri tetap bisa =====
do $$
declare v_n integer; v_h text; n integer;
begin
  begin update public.attendance_confirmations set status = 'hadir'; raise exception 'TEST FAIL: owner update';
  exception when insufficient_privilege then null; end;
  begin delete from public.assistant_audit_log; raise exception 'TEST FAIL: owner delete audit';
  exception when insufficient_privilege then null; end;
  begin update public.research_subject_codes set kode = 'K-999'; raise exception 'TEST FAIL: owner update codes';
  exception when insufficient_privilege then null; end;

  select count(*), md5(string_agg(a::text, ',' order by a.id)) into v_n, v_h from public.attendance a;
  if exists (select 1 from pa_attendance_before b where b.n <> v_n or b.h is distinct from v_h) then
    raise exception 'TEST FAIL: attendance table was modified';
  end if;

  delete from public.santri where id = '7e570000-0000-0000-0000-000000000102';
  select count(*) into n from public.attendance_confirmations where santri_id = '7e570000-0000-0000-0000-000000000102';
  if n <> 0 then raise exception 'TEST FAIL: cascade from santri delete'; end if;
end $$;

select 'PASS: pencatatan asisten (absen panggil, log audit, peringatan, tindak lanjut, ekspor berkode)' as result;
rollback;
