-- Logical migration: normalize the global points RPCs across staging schemas.
-- Some staging databases store santri.points as numeric(10,2), while the
-- original local schema uses integer. Numeric return values work with both;
-- the amount remains restricted to whole points for the existing UI contract.

drop function if exists public.list_random_name_santri();

create function public.list_random_name_santri()
returns table (
  id uuid,
  nama_lengkap text,
  foto_url text,
  avatar_path text,
  points numeric,
  jilid text,
  jenis_kelamin text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  v_role := public.current_user_role();

  if v_role is null or v_role not in (
    'admin'::public.app_role,
    'guru'::public.app_role,
    'santri'::public.app_role,
    'pentashih'::public.app_role
  ) then
    raise exception 'RANDOM_NAME_ROSTER_FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.nama_lengkap,
    s.foto_url,
    s.avatar_path,
    s.points::numeric,
    s.jilid,
    s.jenis_kelamin
  from public.santri s
  where s.deleted_at is null
    and lower(coalesce(s.status, '')) in ('aktif', 'active')
    and lower(coalesce(s.kategori, '')) = 'anak'
    and (
      v_role in ('admin'::public.app_role, 'guru'::public.app_role)
      or (v_role = 'santri'::public.app_role and s.id = auth.uid())
      or (v_role = 'pentashih'::public.app_role and public.pentashih_has_santri_access(s.id))
    )
  order by lower(s.nama_lengkap), s.id;
end;
$$;

revoke all on function public.list_random_name_santri() from public;
revoke all on function public.list_random_name_santri() from anon;
grant execute on function public.list_random_name_santri() to authenticated;

drop function if exists public.increment_santri_points(uuid, integer);
drop function if exists public.increment_santri_points(uuid, numeric);

create function public.increment_santri_points(
  p_santri_id uuid,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_points numeric;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_santri_id is null then
    raise exception 'SANTRI_ID_REQUIRED' using errcode = '22023';
  end if;

  if p_amount is null
     or p_amount = 0
     or p_amount not between -1000 and 1000
     or p_amount <> trunc(p_amount) then
    raise exception 'INVALID_POINT_AMOUNT' using errcode = '22023';
  end if;

  if not (public.is_admin() or public.is_guru()) then
    raise exception 'POINT_ADJUSTMENT_FORBIDDEN' using errcode = '42501';
  end if;

  update public.santri
  set points = greatest(0::numeric, points + p_amount),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_santri_id
    and deleted_at is null
    and lower(coalesce(status, '')) in ('aktif', 'active')
  returning points into v_points;

  if v_points is null then
    raise exception 'ACTIVE_SANTRI_NOT_FOUND' using errcode = 'P0002';
  end if;

  return v_points;
end;
$$;

revoke all on function public.increment_santri_points(uuid, numeric) from public;
revoke all on function public.increment_santri_points(uuid, numeric) from anon;
grant execute on function public.increment_santri_points(uuid, numeric) to authenticated;
