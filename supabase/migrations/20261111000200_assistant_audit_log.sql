-- Log audit asisten AI. Setiap permintaan ke asisten dicatat di sini oleh Edge Function `asisten`.
-- Hanya INSERT dan SELECT; tidak ada kebijakan UPDATE/DELETE dan trigger menolak keduanya.
-- Ringkasan permintaan disimpan dalam versi yang sudah disaring (tanpa nama santri atau nomor HP).

create table public.assistant_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  peran public.app_role not null,
  aksi text not null,
  tool text,
  ringkasan_permintaan text,
  ringkasan_hasil text,
  model text,
  token_masuk integer,
  token_keluar integer,
  galat text,
  created_at timestamptz not null default now(),
  constraint assistant_audit_log_aksi_check check (length(btrim(aksi)) between 1 and 80),
  constraint assistant_audit_log_tool_check check (tool is null or length(tool) <= 80),
  constraint assistant_audit_log_permintaan_check check (ringkasan_permintaan is null or length(ringkasan_permintaan) <= 2000),
  constraint assistant_audit_log_hasil_check check (ringkasan_hasil is null or length(ringkasan_hasil) <= 4000),
  constraint assistant_audit_log_model_check check (model is null or length(model) <= 120),
  constraint assistant_audit_log_token_check check (
    (token_masuk is null or token_masuk >= 0) and (token_keluar is null or token_keluar >= 0)
  ),
  constraint assistant_audit_log_galat_check check (galat is null or length(galat) <= 2000)
);

create index assistant_audit_log_created_idx on public.assistant_audit_log(created_at desc);
create index assistant_audit_log_user_idx on public.assistant_audit_log(user_id, created_at desc);

create trigger assistant_audit_log_append_only
  before update or delete on public.assistant_audit_log
  for each row execute function public.block_append_only_mutation();

alter table public.assistant_audit_log enable row level security;
revoke all on public.assistant_audit_log from anon, authenticated;
grant select, insert on public.assistant_audit_log to authenticated;

create policy assistant_audit_log_select_scope on public.assistant_audit_log
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- Pengguna hanya bisa mencatat atas nama dirinya sendiri dan dengan perannya yang sebenarnya.
create policy assistant_audit_log_insert_own on public.assistant_audit_log
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and peran = public.current_user_role()
    and peran in ('admin', 'guru')
  );
