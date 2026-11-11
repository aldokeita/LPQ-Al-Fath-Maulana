-- Asisten tahap 1: peringatan dari aturan, keputusan guru, koreksi "sebenarnya hadir", dan
-- tindak lanjut wali. Semua tabel hanya-tambah. Tap RFID/wajah di public.attendance tidak disentuh.

create table public.assistant_alerts (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  rule text not null,
  tingkat text not null,
  alasan text not null,
  detail jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  episode_key text not null,
  senyap boolean not null default false,
  ref_date date not null,
  settings_id bigint references public.assistant_settings(id),
  created_at timestamptz not null default now(),
  constraint assistant_alerts_rule_check check (rule in (
    'absen_beruntun', 'jilid_lama', 'kehadiran_bulanan', 'hafalan_macet', 'hafalan_wajib_belum_lulus',
    'murojaah_belum_ditinjau'
  )),
  constraint assistant_alerts_tingkat_check check (tingkat in ('rendah', 'sedang', 'tinggi')),
  constraint assistant_alerts_alasan_check check (length(btrim(alasan)) between 1 and 1000),
  constraint assistant_alerts_unique unique (santri_id, rule, dedupe_key, senyap)
);

create index assistant_alerts_class_idx on public.assistant_alerts(class_id, created_at desc);
create index assistant_alerts_santri_idx on public.assistant_alerts(santri_id, rule, created_at desc);
create index assistant_alerts_episode_idx on public.assistant_alerts(santri_id, rule, episode_key);

create table public.assistant_alert_decisions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.assistant_alerts(id) on delete cascade,
  keputusan text not null,
  catatan text,
  diputuskan_oleh uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint assistant_alert_decisions_keputusan_check check (
    keputusan in ('ditangani', 'wali_dihubungi', 'diabaikan', 'peringatan_keliru')
  ),
  constraint assistant_alert_decisions_catatan_check check (catatan is null or length(catatan) <= 500),
  constraint assistant_alert_decisions_abaikan_alasan check (
    keputusan <> 'diabaikan' or length(btrim(coalesce(catatan, ''))) > 0
  )
);

create index assistant_alert_decisions_alert_idx on public.assistant_alert_decisions(alert_id, created_at desc);

-- Koreksi guru: santri sebenarnya hadir pada tanggal itu (kartu hilang/lupa tap).
create table public.attendance_presence_corrections (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  tanggal date not null,
  keterangan text,
  alert_id uuid references public.assistant_alerts(id) on delete set null,
  dikoreksi_oleh uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint attendance_presence_corrections_unique unique (santri_id, tanggal),
  constraint attendance_presence_corrections_keterangan_check check (keterangan is null or length(keterangan) <= 300)
);

create index attendance_presence_corrections_class_idx on public.attendance_presence_corrections(class_id, tanggal);

create table public.wali_followups (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  guru_id uuid not null default auth.uid() references auth.users(id),
  alert_id uuid references public.assistant_alerts(id) on delete set null,
  tanggal_kontak date not null,
  saluran text not null,
  hasil text not null,
  catatan text,
  created_at timestamptz not null default now(),
  constraint wali_followups_saluran_check check (saluran in ('whatsapp', 'telepon', 'tatap_muka', 'lainnya')),
  constraint wali_followups_hasil_check check (hasil in ('terhubung', 'tidak_merespons', 'janji_hadir', 'lainnya')),
  constraint wali_followups_catatan_check check (catatan is null or length(catatan) <= 500)
);

create index wali_followups_santri_idx on public.wali_followups(santri_id, tanggal_kontak desc);

create trigger assistant_alerts_append_only before update or delete on public.assistant_alerts
  for each row execute function public.block_append_only_mutation();
create trigger assistant_alert_decisions_append_only before update or delete on public.assistant_alert_decisions
  for each row execute function public.block_append_only_mutation();
create trigger attendance_presence_corrections_append_only before update or delete on public.attendance_presence_corrections
  for each row execute function public.block_append_only_mutation();
create trigger wali_followups_append_only before update or delete on public.wali_followups
  for each row execute function public.block_append_only_mutation();

alter table public.assistant_alerts enable row level security;
alter table public.assistant_alert_decisions enable row level security;
alter table public.attendance_presence_corrections enable row level security;
alter table public.wali_followups enable row level security;

revoke all on public.assistant_alerts, public.assistant_alert_decisions,
  public.attendance_presence_corrections, public.wali_followups from anon, authenticated;
grant select on public.assistant_alerts, public.assistant_alert_decisions,
  public.attendance_presence_corrections, public.wali_followups to authenticated;

-- Peringatan dibuat hanya oleh pemeriksa aturan (security definer). Guru tidak melihat peringatan
-- senyap; admin melihat semuanya.
create policy assistant_alerts_select_scope on public.assistant_alerts
  for select to authenticated
  using (public.is_admin() or (not senyap and public.guru_has_class_access(class_id)));

create policy assistant_alert_decisions_select_scope on public.assistant_alert_decisions
  for select to authenticated
  using (exists (
    select 1 from public.assistant_alerts a
    where a.id = assistant_alert_decisions.alert_id
      and (public.is_admin() or (not a.senyap and public.guru_has_class_access(a.class_id)))
  ));

create policy attendance_presence_corrections_select_scope on public.attendance_presence_corrections
  for select to authenticated
  using (public.is_admin() or public.guru_has_class_access(class_id));

create policy wali_followups_select_scope on public.wali_followups
  for select to authenticated
  using (public.is_admin() or public.guru_has_class_access(class_id));

-- Penulisan oleh guru/admin hanya lewat RPC di migration berikutnya, yang memeriksa akses kelas,
-- keanggotaan santri, dan isi peringatan.
