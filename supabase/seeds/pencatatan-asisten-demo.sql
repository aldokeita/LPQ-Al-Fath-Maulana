\set ON_ERROR_STOP on
-- Seed Demo/Dummy untuk pengembangan pencatatan asisten AI. Khusus Supabase lokal (local/staging only).
-- Semua nama, nomor, dan kehadiran di sini rekaan. Jangan pernah dijalankan di produksi.
--
-- Jalankan sesudah `npx supabase db reset --local`:
--   docker exec -i supabase_db_lpq-al-fath-maulana-local psql -U postgres -d postgres < supabase/seeds/pencatatan-asisten-demo.sql
--
-- Akun uji lokal (kata sandi sama untuk semua, hanya berlaku di database lokal ini):
--   admin@lpqalfathmaulana.id, guru-pa-a@example.invalid, guru-pa-b@example.invalid
--   kata sandi: DemoLokal-PA-2026

begin;

-- Pengaman: tolak bila database berisi santri yang bukan data demo.
do $$
begin
  if exists (
    select 1 from public.santri
    where nomor_induk_qiroati not like 'DEMOPA-%' and nomor_induk_qiroati not like 'AFMLOCAL-%'
  ) then
    raise exception 'Seed demo ditolak: database berisi santri non-demo. Seed ini hanya untuk Supabase lokal kosong.';
  end if;
end $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt('DemoLokal-PA-2026', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-00000000000a'::uuid, 'admin@lpqalfathmaulana.id'),
  ('d0000000-0000-4000-8000-0000000000a1'::uuid, 'guru-pa-a@example.invalid'),
  ('d0000000-0000-4000-8000-0000000000b1'::uuid, 'guru-pa-b@example.invalid')
) as u(id, email)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u
where u.id in ('d0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000b1')
on conflict do nothing;

-- Santri demo juga butuh baris auth.users karena attendance.user_id merujuk ke auth.users.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated',
  'santri+' || s.id || '@auth.lpqalfathmaulana.local', now(), now()
from (
  select ('d0000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid as id
  from generate_series(1, 12) n
) s
on conflict (id) do nothing;

insert into public.user_profiles (id, role, display_name, email, status) values
  ('d0000000-0000-4000-8000-00000000000a', 'admin', 'Admin Demo', 'admin@lpqalfathmaulana.id', 'active'),
  ('d0000000-0000-4000-8000-0000000000a1', 'guru', 'Ustadzah Demo A', 'guru-pa-a@example.invalid', 'active'),
  ('d0000000-0000-4000-8000-0000000000b1', 'guru', 'Ustadz Demo B', 'guru-pa-b@example.invalid', 'active')
on conflict (id) do nothing;

insert into public.guru (id, nama, email, jabatan, roles, status, jenis_kelamin) values
  ('d0000000-0000-4000-8000-0000000000a1', 'Ustadzah Demo A', 'guru-pa-a@example.invalid', 'Pengajar Demo', '{}', 'active', 'Perempuan'),
  ('d0000000-0000-4000-8000-0000000000b1', 'Ustadz Demo B', 'guru-pa-b@example.invalid', 'Pengajar Demo', '{}', 'active', 'Laki-laki')
on conflict (id) do nothing;

insert into public.classes (id, nama_kelas, id_guru, sesi, kategori, sort_order) values
  ('d0000000-0000-4000-8000-000000000c0a', 'Kelas Demo Melati', 'd0000000-0000-4000-8000-0000000000a1', 'Sore', 'Anak', 1),
  ('d0000000-0000-4000-8000-000000000c0b', 'Kelas Demo Kenanga', 'd0000000-0000-4000-8000-0000000000b1', 'Sore', 'Anak', 2)
on conflict (id) do nothing;

-- 12 santri rekaan: 01–07 di Melati, 08–12 di Kenanga.
insert into public.user_profiles (id, role, display_name, status)
select ('d0000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'santri', 'Santri Demo ' || n, 'active'
from generate_series(1, 12) n
on conflict (id) do nothing;

insert into public.santri (id, nomor_induk_qiroati, nama_lengkap, kategori, status, current_class_id, sesi_mengaji, jilid, no_hp_ortu)
select
  ('d0000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  'DEMOPA-' || lpad(n::text, 2, '0'),
  (array['Aisyah','Bilal','Citra','Dimas','Fatimah','Ghani','Hana','Ilham','Jihan','Khalid','Laila','Musa'])[n] || ' Demo',
  'Anak', 'Aktif',
  case when n <= 7 then 'd0000000-0000-4000-8000-000000000c0a'::uuid else 'd0000000-0000-4000-8000-000000000c0b'::uuid end,
  'Sore', 'Jilid 2A', '0800000000' || lpad(n::text, 2, '0')
from generate_series(1, 12) n
on conflict (id) do nothing;

insert into public.class_memberships (santri_id, class_id, start_date, status, order_in_class)
select s.id, s.current_class_id, public.jakarta_today() - 60, 'active',
  row_number() over (partition by s.current_class_id order by s.nomor_induk_qiroati)
from public.santri s
where s.nomor_induk_qiroati like 'DEMOPA-%'
on conflict do nothing;

-- Sesi Sore Senin–Kamis selama empat pekan terakhir sampai hari ini.
create temp table demo_sessions as
select d::date as tanggal
from generate_series(public.jakarta_today() - 27, public.jakarta_today(), interval '1 day') d
where extract(isodow from d) between 1 and 4;

-- Satu hari libur di pekan kedua.
insert into public.academic_calendar (date, title, is_holiday, event_type)
select min(tanggal), 'Libur Demo', true, 'holiday'
from demo_sessions where tanggal >= public.jakarta_today() - 20
on conflict (date) do nothing;

-- Tap RFID rekaan. Santri 03 dan 10 sering lupa tap; santri 05 dua kali berturut-turut tidak hadir
-- di pekan terakhir.
insert into public.attendance (user_id, role, attendance_date, check_in_time, check_in_timestamp, class_id, sesi, status, source)
select s.id, 'santri', ds.tanggal,
  (time '15:40' + make_interval(mins => abs(hashtext(s.id::text || ds.tanggal::text)) % 25)),
  (ds.tanggal + (time '15:40' + make_interval(mins => abs(hashtext(s.id::text || ds.tanggal::text)) % 25))) at time zone 'Asia/Jakarta',
  s.current_class_id, 'Sore',
  case when abs(hashtext(s.id::text || ds.tanggal::text)) % 25 > 20 then 'Terlambat' else 'Hadir' end,
  'rfid'
from public.santri s
cross join demo_sessions ds
left join public.academic_calendar ac on ac.date = ds.tanggal and ac.is_holiday
where s.nomor_induk_qiroati like 'DEMOPA-%'
  and ac.id is null
  and abs(hashtext('tap' || s.id::text || ds.tanggal::text)) % 100 >= case
    when s.nomor_induk_qiroati in ('DEMOPA-03', 'DEMOPA-10') then 45
    else 10
  end
  and not (s.nomor_induk_qiroati = 'DEMOPA-05' and ds.tanggal >= public.jakarta_today() - 7)
on conflict do nothing;

-- Absen panggil yang sudah dikonfirmasi guru untuk dua pekan pertama (pekan terakhir dibiarkan
-- kosong agar layar absen panggil menampilkan saran dari tap).
insert into public.attendance_confirmations (santri_id, class_id, tanggal, sesi, status, keterangan, dikonfirmasi_oleh)
select s.id, s.current_class_id, ds.tanggal, 'Sore',
  case
    when a.status = 'Terlambat' then 'terlambat'
    when a.id is not null then 'hadir'
    when abs(hashtext('ket' || s.id::text || ds.tanggal::text)) % 2 = 0 then 'hadir'
    else 'tidak_hadir'
  end,
  null,
  c.id_guru
from public.santri s
join public.classes c on c.id = s.current_class_id
cross join demo_sessions ds
left join public.attendance a on a.user_id = s.id and a.attendance_date = ds.tanggal
left join public.academic_calendar ac on ac.date = ds.tanggal and ac.is_holiday
where s.nomor_induk_qiroati like 'DEMOPA-%'
  and ac.id is null
  and ds.tanggal < public.jakarta_today() - 13
on conflict (santri_id, tanggal, sesi) do nothing;

-- Satu koreksi status sebagai riwayat dan satu tindak lanjut wali.
insert into public.attendance_confirmation_changes (confirmation_id, status, keterangan, diubah_oleh)
select c.id, 'hadir', 'Demo: kartu tertinggal, hadir di kelas', c.dikonfirmasi_oleh
from public.attendance_confirmations c
join public.santri s on s.id = c.santri_id
where s.nomor_induk_qiroati = 'DEMOPA-03' and c.status <> 'hadir'
  and not exists (select 1 from public.attendance_confirmation_changes ch where ch.confirmation_id = c.id)
order by c.tanggal
limit 1;

insert into public.wali_followups (santri_id, class_id, guru_id, tanggal_peringatan, tanggal_kontak, saluran, hasil)
select s.id, s.current_class_id, 'd0000000-0000-4000-8000-0000000000a1', public.jakarta_today() - 15, public.jakarta_today() - 14, 'whatsapp', 'terhubung'
from public.santri s
where s.nomor_induk_qiroati = 'DEMOPA-03'
  and not exists (select 1 from public.wali_followups f where f.santri_id = s.id);

commit;

select
  (select count(*) from public.santri where nomor_induk_qiroati like 'DEMOPA-%') as santri_demo,
  (select count(*) from public.attendance a join public.santri s on s.id = a.user_id where s.nomor_induk_qiroati like 'DEMOPA-%') as tap_demo,
  (select count(*) from public.attendance_confirmations) as konfirmasi;
