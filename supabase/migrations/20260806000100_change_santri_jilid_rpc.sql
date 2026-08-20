-- Atomically change a santri's jilid and record the transition in jilid_history.
-- Only administrators or the santri's assigned guru may make this change.
-- Fixes false-success bug where RLS silently blocked the client-side UPDATE.

create or replace function public.change_santri_jilid(
  p_santri_id uuid,
  p_new_jilid text,
  p_old_jilid text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_jilid text;
  v_changed_by uuid := auth.uid();
begin
  if v_changed_by is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_santri_id is null then
    raise exception 'SANTRI_ID_REQUIRED' using errcode = '22023';
  end if;

  if p_new_jilid is null or length(btrim(p_new_jilid)) = 0 then
    raise exception 'NEW_JILID_REQUIRED' using errcode = '22023';
  end if;

  if not (
    public.is_admin()
    or (
      public.is_guru()
      and public.guru_has_santri_access(p_santri_id)
    )
  ) then
    raise exception 'JILID_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;

  select jilid into v_current_jilid
  from public.santri
  where id = p_santri_id
    and deleted_at is null
    and lower(coalesce(status, '')) in ('aktif', 'active')
  for update;

  if not found then
    raise exception 'ACTIVE_SANTRI_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_current_jilid = p_new_jilid then
    raise exception 'JILID_UNCHANGED' using errcode = '23503';
  end if;

  update public.santri
  set jilid = p_new_jilid,
      updated_by = v_changed_by,
      updated_at = now()
  where id = p_santri_id;

  insert into public.jilid_history (santri_id, from_jilid, to_jilid, changed_by)
  values (p_santri_id, coalesce(p_old_jilid, v_current_jilid), p_new_jilid, v_changed_by);

  return p_new_jilid;
end;
$$;

revoke all on function public.change_santri_jilid(uuid, text, text) from public;
revoke all on function public.change_santri_jilid(uuid, text, text) from anon;
grant execute on function public.change_santri_jilid(uuid, text, text) to authenticated;
