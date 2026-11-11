-- Catatan tindak lanjut wali: kapan guru menghubungi wali, lewat apa, dan hasilnya.
-- Hanya-tambah. Koreksi dicatat sebagai baris baru, bukan mengubah baris lama.

create table public.wali_followups (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  guru_id uuid not null default auth.uid() references auth.users(id),
  alert_id uuid references public.assistant_alerts(id) on delete set null,
  tanggal_peringatan date,
  tanggal_kontak date not null,
  saluran text not null,
  hasil text not null,
  catatan text,
  created_at timestamptz not null default now(),
  constraint wali_followups_saluran_check check (saluran in ('whatsapp', 'telepon', 'tatap_muka', 'lainnya')),
  constraint wali_followups_hasil_check check (
    hasil in ('terhubung', 'tidak_merespons', 'janji_hadir', 'lainnya')
  ),
  constraint wali_followups_tanggal_check check (
    tanggal_peringatan is null or tanggal_kontak >= tanggal_peringatan
  ),
  constraint wali_followups_catatan_check check (catatan is null or length(catatan) <= 500)
);

create index wali_followups_class_idx on public.wali_followups(class_id, tanggal_kontak desc);
create index wali_followups_santri_idx on public.wali_followups(santri_id, tanggal_kontak desc);

-- alert_id memakai ON DELETE SET NULL, yang merupakan UPDATE berantai. Trigger hanya menolak
-- UPDATE langsung; UPDATE dari aksi foreign key (kedalaman trigger > 1) dibiarkan.
create or replace function public.block_wali_followups_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'APPEND_ONLY: % pada % tidak diizinkan; catatan hanya bisa ditambah', tg_op, tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.block_wali_followups_mutation() from public, anon, authenticated;

create trigger wali_followups_append_only
  before update or delete on public.wali_followups
  for each row execute function public.block_wali_followups_mutation();

alter table public.wali_followups enable row level security;
revoke all on public.wali_followups from anon, authenticated;
grant select, insert on public.wali_followups to authenticated;

create policy wali_followups_select_scope on public.wali_followups
  for select to authenticated
  using (public.is_admin() or public.guru_has_class_access(class_id));

create policy wali_followups_insert_scope on public.wali_followups
  for insert to authenticated
  with check (
    guru_id = auth.uid()
    and tanggal_kontak <= public.jakarta_today()
    and (public.is_admin() or public.guru_has_class_access(class_id))
    and exists (
      select 1 from public.class_memberships cm
      where cm.santri_id = wali_followups.santri_id
        and cm.class_id = wali_followups.class_id
        and cm.status = 'active'
    )
    and (
      alert_id is null
      or exists (
        select 1 from public.assistant_alerts a
        where a.id = wali_followups.alert_id and a.santri_id = wali_followups.santri_id
      )
    )
  );
