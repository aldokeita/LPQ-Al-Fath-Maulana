-- Purpose: persist jilid changes atomically for admins and assigned gurus.
-- Dependencies: 20260716000400_jilid_history.sql and guru_has_santri_access(uuid).
-- Safety: gurus can only change the jilid of active santri assigned to their class.

-- The staging database may already contain an older function with the same
-- arguments but a different return shape. Drop that legacy signature before
-- recreating the atomic RPC so PostgreSQL does not reject the return type.
drop function if exists public.change_santri_jilid(uuid, text, text);

create or replace function public.change_santri_jilid(
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
  v_role public.app_role := public.current_user_role();
  v_from_jilid text;
  v_to_jilid text := nullif(btrim(p_to_jilid), '');
  v_status text;
  v_history_id uuid;
  v_changed_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Login diperlukan untuk mengubah jilid santri.' using errcode = '28000';
  end if;

  if p_santri_id is null or v_to_jilid is null then
    raise exception 'Santri dan jilid tujuan wajib diisi.' using errcode = '22023';
  end if;

  if v_role is distinct from 'admin'::public.app_role
     and v_role is distinct from 'guru'::public.app_role then
    raise exception 'Anda tidak memiliki akses untuk mengubah jilid santri.' using errcode = '42501';
  end if;

  if v_role = 'guru'::public.app_role
     and not public.guru_has_santri_access(p_santri_id) then
    raise exception 'Santri ini tidak berada di kelas Anda.' using errcode = '42501';
  end if;

  select s.jilid, s.status
    into v_from_jilid, v_status
  from public.santri s
  where s.id = p_santri_id
  for update;

  if not found then
    raise exception 'Santri tidak ditemukan.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_status, '')) not in ('aktif', 'active') then
    raise exception 'Jilid hanya dapat diubah untuk santri aktif.' using errcode = '22023';
  end if;

  if btrim(coalesce(v_from_jilid, '')) is distinct from btrim(coalesce(p_expected_from_jilid, '')) then
    raise exception 'Jilid santri sudah berubah. Muat ulang data lalu coba kembali.' using errcode = '40001';
  end if;

  if btrim(coalesce(v_from_jilid, '')) = v_to_jilid then
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
    v_from_jilid,
    v_to_jilid,
    v_actor
  )
  returning history.id, history.changed_at
    into v_history_id, v_changed_at;

  return query
  select p_santri_id, v_from_jilid, v_to_jilid, v_history_id, v_changed_at;
end;
$$;

revoke all on function public.change_santri_jilid(uuid, text, text) from public;
revoke all on function public.change_santri_jilid(uuid, text, text) from anon;
revoke all on function public.change_santri_jilid(uuid, text, text) from authenticated;
grant execute on function public.change_santri_jilid(uuid, text, text) to authenticated;

comment on function public.change_santri_jilid(uuid, text, text)
  is 'Atomically changes an active santri jilid and appends its history for admins or the assigned guru.';
