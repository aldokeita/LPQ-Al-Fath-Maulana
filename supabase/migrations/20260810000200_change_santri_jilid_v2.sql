-- Additive v2 RPC for atomic jilid changes with stale-state protection.
-- The legacy change_santri_jilid(uuid, text, text) function remains untouched
-- so existing clients keep working while callers migrate to this contract.

create or replace function public.change_santri_jilid_v2(
  p_santri_id uuid,
  p_expected_from_jilid text,
  p_to_jilid text
)
returns table(
  santri_id uuid,
  from_jilid text,
  to_jilid text,
  history_id uuid,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_current_jilid text;
  v_to_jilid text := nullif(btrim(coalesce(p_to_jilid, '')), '');
  v_history_id uuid;
  v_changed_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Login diperlukan untuk mengubah jilid santri.' using errcode = '28000';
  end if;

  if p_santri_id is null or v_to_jilid is null then
    raise exception 'Santri dan jilid tujuan wajib diisi.' using errcode = '22023';
  end if;

  if not (
    public.is_admin()
    or (
      public.is_guru()
      and public.guru_has_santri_access(p_santri_id)
    )
  ) then
    raise exception 'Anda tidak memiliki akses untuk mengubah jilid santri.' using errcode = '42501';
  end if;

  select s.jilid
    into v_current_jilid
  from public.santri s
  where s.id = p_santri_id
    and s.deleted_at is null
    and lower(coalesce(s.status, '')) in ('aktif', 'active')
  for update;

  if not found then
    raise exception 'Santri aktif tidak ditemukan.' using errcode = 'P0002';
  end if;

  if btrim(coalesce(v_current_jilid, '')) is distinct from btrim(coalesce(p_expected_from_jilid, '')) then
    raise exception 'Jilid santri sudah berubah. Muat ulang data lalu coba kembali.' using errcode = '40001';
  end if;

  if btrim(coalesce(v_current_jilid, '')) = v_to_jilid then
    raise exception 'Jilid tujuan harus berbeda dari jilid saat ini.' using errcode = '22023';
  end if;

  update public.santri
  set jilid = v_to_jilid,
      updated_by = v_actor,
      updated_at = now()
  where id = p_santri_id;

  insert into public.jilid_history as history (
    santri_id,
    from_jilid,
    to_jilid,
    changed_by
  )
  values (
    p_santri_id,
    v_current_jilid,
    v_to_jilid,
    v_actor
  )
  returning history.id, history.changed_at
    into v_history_id, v_changed_at;

  return query
  select p_santri_id, v_current_jilid, v_to_jilid, v_history_id, v_changed_at;
end;
$$;

revoke all on function public.change_santri_jilid_v2(uuid, text, text) from public;
revoke all on function public.change_santri_jilid_v2(uuid, text, text) from anon;
revoke all on function public.change_santri_jilid_v2(uuid, text, text) from authenticated;
grant execute on function public.change_santri_jilid_v2(uuid, text, text) to authenticated;

comment on function public.change_santri_jilid_v2(uuid, text, text)
  is 'Atomically changes an active santri jilid with expected-value protection and returns the persisted history row.';
