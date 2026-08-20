-- Migration: RPC for permanently deleting a santri and all associated relations
-- Callable only by service_role (via the manage-user Edge Function)

create or replace function public.permanently_delete_santri(
  p_santri_id uuid,
  p_actor_id uuid
)
returns table (
  santri_id uuid,
  deleted boolean
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
    from public.santri
   where id = p_santri_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Data santri tidak ditemukan atau sudah dihapus.';
  end if;

  -- 1. Delete associated records across all modules
  delete from public.attendance where user_id = p_santri_id;
  delete from public.hafalan_progress where santri_id = p_santri_id;
  delete from public.santri_character_scores where santri_id = p_santri_id;
  delete from public.santri_character_strengths where santri_id = p_santri_id;
  delete from public.santri_jilid_history where santri_id = p_santri_id;
  delete from public.santri_class_mutations where santri_id = p_santri_id;
  delete from public.class_memberships where santri_id = p_santri_id;
  delete from public.payments where santri_id = p_santri_id;
  delete from public.auth_login_aliases where auth_user_id = p_santri_id;
  delete from public.login_activity_logs where user_id = p_santri_id;

  -- 2. Delete santri and user_profiles record
  delete from public.santri where id = p_santri_id;
  delete from public.user_profiles where id = p_santri_id;

  return query select p_santri_id, true;
end;
$$;
revoke all on function public.permanently_delete_santri(uuid, uuid) from public;
revoke all on function public.permanently_delete_santri(uuid, uuid) from anon;
revoke all on function public.permanently_delete_santri(uuid, uuid) from authenticated;
grant execute on function public.permanently_delete_santri(uuid, uuid) to service_role;
comment on function public.permanently_delete_santri(uuid, uuid) is
  'Permanently deletes a santri and all related attendance, hafalan, character, class history, payments, and profile records.';
