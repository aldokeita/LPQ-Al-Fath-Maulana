create or replace function public.get_my_classmates_today()
returns table(
  id uuid,
  nama_lengkap text,
  jilid text,
  foto_url text,
  avatar_path text,
  attendance_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with my_class as (
    select cm_self.class_id
    from public.class_memberships cm_self
    join public.classes c_self on c_self.id = cm_self.class_id
    join public.santri s_self on s_self.id = cm_self.santri_id
    where cm_self.santri_id = auth.uid()
      and cm_self.status = 'active'
      and c_self.is_active is true
      and c_self.deleted_at is null
      and s_self.status = 'Aktif'
      and s_self.deleted_at is null
    order by cm_self.created_at desc
    limit 1
  )
  select
    s.id,
    s.nama_lengkap,
    coalesce(nullif(btrim(s.jilid), ''), 'Belum ditentukan') as jilid,
    s.foto_url,
    s.avatar_path,
    case
      when a.id is null then 'Belum Hadir'
      else coalesce(nullif(btrim(a.status), ''), 'Hadir')
    end as attendance_status
  from my_class mc
  join public.class_memberships cm_peer
    on cm_peer.class_id = mc.class_id
   and cm_peer.status = 'active'
  join public.santri s
    on s.id = cm_peer.santri_id
   and s.status = 'Aktif'
   and s.deleted_at is null
  left join lateral (
    select attendance_row.id, attendance_row.status
    from public.attendance attendance_row
    where attendance_row.user_id = s.id
      and attendance_row.role = 'santri'::public.app_role
      and attendance_row.attendance_date = (now() at time zone 'Asia/Jakarta')::date
    order by attendance_row.created_at asc
    limit 1
  ) a on true
  where cm_peer.santri_id <> auth.uid()
  order by cm_peer.order_in_class asc nulls last, s.nama_lengkap asc;
$$;

revoke all on function public.get_my_classmates_today() from public;
revoke all on function public.get_my_classmates_today() from anon;
revoke all on function public.get_my_classmates_today() from authenticated;
grant execute on function public.get_my_classmates_today() to authenticated;

comment on function public.get_my_classmates_today() is
  'Returns only minimal profile and current-day attendance fields for active peers in the signed-in santri class.';
