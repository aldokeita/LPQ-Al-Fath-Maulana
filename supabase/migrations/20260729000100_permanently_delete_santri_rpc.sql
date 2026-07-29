-- Migration: RPC for permanently deleting a santri and all associated relations
-- Callable only by service_role (via the manage-user Edge Function)

drop function if exists public.permanently_delete_santri(uuid, uuid);

create or replace function public.permanently_delete_santri(
  p_santri_id uuid,
  p_actor_id uuid
)
returns table (
  out_santri_id uuid,
  out_deleted boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_santri public.santri%rowtype;
begin
  select *
    into v_santri
    from public.santri s
   where s.id = p_santri_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Data santri tidak ditemukan atau sudah dihapus.';
  end if;

  -- 1. Delete associated records across all modules with explicit table aliases
  delete from public.attendance a where a.user_id = p_santri_id;
  delete from public.hafalan_progress hp where hp.santri_id = p_santri_id;
  delete from public.santri_character_scores scs where scs.santri_id = p_santri_id;
  delete from public.santri_character_strengths scst where scst.santri_id = p_santri_id;
  delete from public.santri_jilid_history sjh where sjh.santri_id = p_santri_id;
  delete from public.santri_class_mutations scm where scm.santri_id = p_santri_id;
  delete from public.class_memberships cm where cm.santri_id = p_santri_id;
  delete from public.payments p where p.santri_id = p_santri_id;
  delete from public.auth_login_aliases ala where ala.auth_user_id = p_santri_id;
  delete from public.login_activity_logs lal where lal.user_id = p_santri_id;

  -- 2. Delete santri and user_profiles record
  delete from public.santri s where s.id = p_santri_id;
  delete from public.user_profiles up where up.id = p_santri_id;

  return query select p_santri_id, true;
end;
$$;

revoke all on function public.permanently_delete_santri(uuid, uuid) from public;
revoke all on function public.permanently_delete_santri(uuid, uuid) from anon;
revoke all on function public.permanently_delete_santri(uuid, uuid) from authenticated;
grant execute on function public.permanently_delete_santri(uuid, uuid) to service_role;

comment on function public.permanently_delete_santri(uuid, uuid) is
  'Permanently deletes a santri and all related attendance, hafalan, character, class history, payments, and profile records.';
