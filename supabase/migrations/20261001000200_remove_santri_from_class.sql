create or replace function public.remove_santri_from_class(
  p_santri_id uuid,
  p_reason text default null
)
returns table(
  santri_id uuid, from_class_id uuid, to_class_id uuid,
  mutation_id uuid, changed boolean, message text, active_memberships integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_santri record;
  v_from_class_id uuid;
  v_membership_count integer;
  v_mutation_id uuid;
begin
  if v_actor is null then
    raise exception 'Login diperlukan untuk mengeluarkan santri dari kelas.' using errcode = '28000';
  end if;
  if public.is_admin() is not true then
    raise exception 'Hanya admin yang boleh mengeluarkan santri dari kelas.' using errcode = '42501';
  end if;

  select s.id, s.current_class_id, s.status into v_santri
  from public.santri s
  where s.id = p_santri_id and s.deleted_at is null
  for update;
  if not found then
    raise exception 'Santri tidak ditemukan.' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_santri.status, '')) not in ('aktif', 'active') then
    raise exception 'Santri tidak aktif sehingga kelasnya tidak dapat diubah.' using errcode = '22023';
  end if;

  select cm.class_id into v_from_class_id
  from public.class_memberships cm
  where cm.santri_id = p_santri_id and cm.status = 'active'
  order by cm.created_at desc limit 1 for update;
  v_from_class_id := coalesce(v_from_class_id, v_santri.current_class_id);

  select count(*)::integer into v_membership_count
  from public.class_memberships cm
  where cm.santri_id = p_santri_id and cm.status = 'active';
  if v_santri.current_class_id is null and v_membership_count = 0 then
    return query select p_santri_id, null::uuid, null::uuid, null::uuid,
      false, 'Santri sudah berada di daftar Belum Masuk Kelas.'::text, 0;
    return;
  end if;

  update public.class_memberships cm
  set status = 'inactive', end_date = current_date, updated_by = v_actor
  where cm.santri_id = p_santri_id and cm.status = 'active';

  update public.santri s
  set current_class_id = null, order_in_class = null,
      updated_by = v_actor, updated_at = now()
  where s.id = p_santri_id;

  insert into public.class_mutations (santri_id, from_class_id, to_class_id, reason, created_by)
  values (p_santri_id, v_from_class_id, null,
    coalesce(nullif(btrim(p_reason), ''), 'Dikeluarkan dari kelas oleh admin'), v_actor)
  returning id into v_mutation_id;

  return query select p_santri_id, v_from_class_id, null::uuid, v_mutation_id,
    true, 'Santri dipindahkan ke daftar Belum Masuk Kelas.'::text, 0;
end;
$$;

revoke all on function public.remove_santri_from_class(uuid, text) from public;
revoke all on function public.remove_santri_from_class(uuid, text) from anon;
grant execute on function public.remove_santri_from_class(uuid, text) to authenticated;
