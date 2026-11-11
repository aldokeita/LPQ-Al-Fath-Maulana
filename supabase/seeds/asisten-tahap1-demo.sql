\set ON_ERROR_STOP on
-- Seed Demo/Dummy asisten tahap 1. Khusus Supabase lokal (local/staging only). Semua data rekaan.
-- Jangan pernah dijalankan di produksi.
--
-- Jalankan sesudah `npx supabase db reset`:
--   docker exec -i supabase_db_lpq-al-fath-maulana-local psql -U postgres -d postgres < supabase/seeds/asisten-tahap1-demo.sql
--
-- Akun uji lokal (kata sandi sama, hanya berlaku di database lokal ini):
--   admin@lpqalfathmaulana.id, guru-t1-a@example.invalid, guru-t1-b@example.invalid
--   kata sandi: DemoLokal-T1-2026
--
-- Pola yang dibuat (relatif terhadap kemarin):
--   Aisyah  : hadir rutin, satu setoran muroja'ah menunggu 10 hari  -> muroja'ah belum ditinjau
--   Bilal   : di Jilid 2A sejak 50 hari, satu item hafalan macet     -> jilid lama, hafalan
--   Citra   : 4 sesi terakhir tidak tap                              -> tidak hadir beruntun
--   Fatimah : 8 sesi terakhir tidak tap                              -> tidak hadir beruntun (tinggi)
--   Khalid  : kelas Kenanga, 3 sesi terakhir tidak tap               -> hanya terlihat guru B
--   Nabil   : santri PTPT, tidak tap 2 pekan                         -> di luar cakupan

begin;

do $$
begin
  if exists (
    select 1 from public.santri
    where nomor_induk_qiroati not like 'DEMOT1-%' and nomor_induk_qiroati not like 'AFMLOCAL-%'
  ) then
    raise exception 'Seed demo ditolak: database berisi santri non-demo. Seed ini hanya untuk Supabase lokal kosong.';
  end if;
end $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt('DemoLokal-T1-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('d1000000-0000-4000-8000-00000000000a'::uuid, 'admin@lpqalfathmaulana.id'),
  ('d1000000-0000-4000-8000-0000000000a1'::uuid, 'guru-t1-a@example.invalid'),
  ('d1000000-0000-4000-8000-0000000000b1'::uuid, 'guru-t1-b@example.invalid')
) u(id, email)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u
where u.id in ('d1000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-0000000000a1', 'd1000000-0000-4000-8000-0000000000b1')
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into public.user_profiles (id, role, display_name, email, status) values
  ('d1000000-0000-4000-8000-00000000000a', 'admin', 'Admin Demo', 'admin@lpqalfathmaulana.id', 'active'),
  ('d1000000-0000-4000-8000-0000000000a1', 'guru', 'Ustadzah Demo A', 'guru-t1-a@example.invalid', 'active'),
  ('d1000000-0000-4000-8000-0000000000b1', 'guru', 'Ustadz Demo B', 'guru-t1-b@example.invalid', 'active')
on conflict (id) do nothing;

insert into public.guru (id, nama, email, jabatan, roles, status, jenis_kelamin) values
  ('d1000000-0000-4000-8000-0000000000a1', 'Ustadzah Demo A', 'guru-t1-a@example.invalid', 'Pengajar Demo', '{}', 'active', 'Perempuan'),
  ('d1000000-0000-4000-8000-0000000000b1', 'Ustadz Demo B', 'guru-t1-b@example.invalid', 'Pengajar Demo', '{}', 'active', 'Laki-laki')
on conflict (id) do nothing;

insert into public.classes (id, nama_kelas, id_guru, sesi, kategori, sort_order) values
  ('d1000000-0000-4000-8000-000000000c0a', 'Kelas Demo Melati', 'd1000000-0000-4000-8000-0000000000a1', 'Sore', 'Anak', 1),
  ('d1000000-0000-4000-8000-000000000c0b', 'Kelas Demo Kenanga', 'd1000000-0000-4000-8000-0000000000b1', 'Sore', 'Anak', 2)
on conflict (id) do nothing;

create temp table demo_santri (n int, nama text, kategori text, kelas uuid, jilid text);
insert into demo_santri values
  (1, 'Aisyah Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0a', 'Jilid 2B'),
  (2, 'Bilal Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0a', 'Jilid 2A'),
  (3, 'Citra Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0a', 'Jilid 1C'),
  (4, 'Dimas Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0a', 'Jilid 2B'),
  (5, 'Fatimah Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0a', 'Jilid 1B'),
  (6, 'Ghani Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0a', 'Jilid 3A'),
  (7, 'Hana Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0b', 'Jilid 3A'),
  (8, 'Ilham Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0b', 'Jilid 3B'),
  (9, 'Khalid Demo', 'Anak', 'd1000000-0000-4000-8000-000000000c0b', 'Jilid 3B'),
  (10, 'Nabil Demo', 'PTPT', 'd1000000-0000-4000-8000-000000000c0b', 'Juz 30');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('d1000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  'authenticated', 'authenticated', 'santri+demo-t1-' || n || '@auth.lpqalfathmaulana.local', now(), now()
from demo_santri
on conflict (id) do nothing;

insert into public.user_profiles (id, role, display_name, status)
select ('d1000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'santri', nama, 'active' from demo_santri
on conflict (id) do nothing;

insert into public.santri (id, nomor_induk_qiroati, nama_lengkap, nama_panggilan, kategori, status, current_class_id, sesi_mengaji, jilid, no_hp_ortu, tanggal_pendaftaran)
select ('d1000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'DEMOT1-' || lpad(n::text, 2, '0'),
  nama, split_part(nama, ' ', 1), kategori, 'Aktif', kelas, 'Sore', jilid, '0800000001' || lpad(n::text, 2, '0'),
  public.jakarta_today() - 120
from demo_santri
on conflict (id) do nothing;

insert into public.class_memberships (santri_id, class_id, start_date, status, order_in_class)
select ('d1000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, kelas, public.jakarta_today() - 120, 'active', n
from demo_santri
on conflict do nothing;

-- Riwayat jilid: semua naik ke jilid sekarang 20 hari lalu, kecuali Bilal 50 hari lalu.
insert into public.jilid_history (santri_id, from_jilid, to_jilid, changed_at)
select ('d1000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'Jilid 1A', jilid,
  (public.jakarta_today() - case when n = 2 then 50 else 20 end + time '10:00') at time zone 'Asia/Jakarta'
from demo_santri
where not exists (select 1 from public.jilid_history jh where jh.santri_id = ('d1000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid);

-- Libur demo: Rabu pekan lalu.
insert into public.academic_calendar (date, title, is_holiday, event_type)
select d, 'Libur Demo', true, 'holiday'
from (select (date_trunc('week', public.jakarta_today())::date - 5) as d) x
on conflict (date) do nothing;

-- Hari sekolah 6 pekan terakhir sampai kemarin, diurutkan dari yang terbaru.
create temp table demo_days as
select d, row_number() over (order by d desc) as urut
from public.assistant_school_days(public.jakarta_today() - 42, public.jakarta_today() - 1, '[1,2,3,4,5]'::jsonb) d;

insert into public.attendance (user_id, role, attendance_date, check_in_time, class_id, sesi, status, source)
select ('d1000000-0000-4000-8000-0000000001' || lpad(s.n::text, 2, '0'))::uuid, 'santri', dd.d,
  time '15:40' + make_interval(mins => abs(hashtext(s.n::text || dd.d::text)) % 25),
  s.kelas, 'Sore', 'Hadir', 'rfid'
from demo_santri s cross join demo_days dd
where not (s.n = 3 and dd.urut <= 4)
  and not (s.n = 5 and dd.urut <= 8)
  and not (s.n = 9 and dd.urut <= 3)
  and not (s.n = 10 and dd.urut <= 10)
  and not (s.n in (4, 6) and abs(hashtext('skip' || s.n || dd.d::text)) % 9 = 0 and dd.urut > 3)
on conflict do nothing;

-- Bilal: satu item hafalan jilid 2 berstatus proses sejak 45 hari lalu.
insert into public.hafalan_progress (santri_id, item_id, category, item_name, status, created_at, updated_at)
select 'd1000000-0000-4000-8000-000000000102', hi.id, hi.category, hi.item_name, 'proses',
  now() - interval '45 days', now() - interval '45 days'
from public.hafalan_items hi
where hi.program_scope = 'TPQ' and btrim(hi.jilid) = '2'
  and not exists (select 1 from public.hafalan_progress hp where hp.santri_id = 'd1000000-0000-4000-8000-000000000102')
order by hi.item_order limit 1;

-- Aisyah: setoran muroja'ah menunggu 10 hari.
insert into public.murojaah_submissions (santri_id, target_guru_id, type, content, status, submitted_at, created_at)
select 'd1000000-0000-4000-8000-000000000101', 'd1000000-0000-4000-8000-0000000000a1', 'text', 'Setoran demo', 'menunggu',
  now() - interval '10 days', now() - interval '10 days'
where not exists (select 1 from public.murojaah_submissions where santri_id = 'd1000000-0000-4000-8000-000000000101');

commit;

select
  (select count(*) from public.santri where nomor_induk_qiroati like 'DEMOT1-%') as santri_demo,
  (select count(*) from public.attendance a join public.santri s on s.id = a.user_id where s.nomor_induk_qiroati like 'DEMOT1-%') as tap_demo,
  (public.get_assistant_settings()->>'silent_mode') as mode_senyap;
