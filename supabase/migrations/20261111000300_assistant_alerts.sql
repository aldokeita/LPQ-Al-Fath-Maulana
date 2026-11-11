-- Peringatan dini asisten. Untuk saat ini hanya tabel: logika aturan dan penilaian AI dibuat
-- bersama Edge Function `asisten`. Peringatan dan keputusan guru sama-sama hanya-tambah, sehingga
-- keputusan guru dicatat di tabel terpisah alih-alih mengubah baris peringatan.

create table public.assistant_alerts (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  jenis text not null,
  tingkat text not null,
  alasan text not null,
  sumber text not null default 'aturan',
  model text,
  dibuat_oleh uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint assistant_alerts_jenis_check check (length(btrim(jenis)) between 1 and 80),
  constraint assistant_alerts_tingkat_check check (tingkat in ('rendah', 'sedang', 'tinggi')),
  constraint assistant_alerts_alasan_check check (length(btrim(alasan)) between 1 and 2000),
  constraint assistant_alerts_sumber_check check (sumber in ('aturan', 'ai')),
  constraint assistant_alerts_model_check check (model is null or length(model) <= 120)
);

create index assistant_alerts_class_created_idx on public.assistant_alerts(class_id, created_at desc);
create index assistant_alerts_santri_idx on public.assistant_alerts(santri_id, created_at desc);

create table public.assistant_alert_decisions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.assistant_alerts(id) on delete cascade,
  keputusan text not null,
  catatan text,
  diputuskan_oleh uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint assistant_alert_decisions_keputusan_check check (
    keputusan in ('ditindaklanjuti', 'diabaikan', 'tidak_tepat')
  ),
  constraint assistant_alert_decisions_catatan_check check (catatan is null or length(catatan) <= 500)
);

create index assistant_alert_decisions_alert_idx on public.assistant_alert_decisions(alert_id, created_at desc);

create trigger assistant_alerts_append_only
  before update or delete on public.assistant_alerts
  for each row execute function public.block_append_only_mutation();

create trigger assistant_alert_decisions_append_only
  before update or delete on public.assistant_alert_decisions
  for each row execute function public.block_append_only_mutation();

alter table public.assistant_alerts enable row level security;
alter table public.assistant_alert_decisions enable row level security;
revoke all on public.assistant_alerts from anon, authenticated;
revoke all on public.assistant_alert_decisions from anon, authenticated;
grant select, insert on public.assistant_alerts to authenticated;
grant select, insert on public.assistant_alert_decisions to authenticated;

create policy assistant_alerts_select_scope on public.assistant_alerts
  for select to authenticated
  using (public.is_admin() or public.guru_has_class_access(class_id));

-- Peringatan dibuat oleh Edge Function (service role) atau admin; guru tidak membuat peringatan.
create policy assistant_alerts_insert_admin on public.assistant_alerts
  for insert to authenticated
  with check (public.is_admin() and dibuat_oleh = auth.uid());

create policy assistant_alert_decisions_select_scope on public.assistant_alert_decisions
  for select to authenticated
  using (exists (
    select 1 from public.assistant_alerts a
    where a.id = assistant_alert_decisions.alert_id
      and (public.is_admin() or public.guru_has_class_access(a.class_id))
  ));

create policy assistant_alert_decisions_insert_scope on public.assistant_alert_decisions
  for insert to authenticated
  with check (
    diputuskan_oleh = auth.uid()
    and exists (
      select 1 from public.assistant_alerts a
      where a.id = assistant_alert_decisions.alert_id
        and (public.is_admin() or public.guru_has_class_access(a.class_id))
    )
  );
