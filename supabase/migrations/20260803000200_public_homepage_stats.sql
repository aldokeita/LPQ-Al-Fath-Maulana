-- Purpose: expose exact active homepage counters without opening operational tables to anon.
-- Safety: read-only aggregate values; no personal data is returned.

create or replace function public.get_public_homepage_stats()
returns table(
  santri bigint,
  guru bigint,
  sessions bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (
      select count(*)
      from public.santri s
      where s.status = 'Aktif'
        and s.deleted_at is null
    ) as santri,
    (
      select count(*)
      from public.guru g
      where g.status = 'active'
        and g.deleted_at is null
    ) as guru,
    (
      select count(distinct lower(btrim(c.sesi)))
      from public.classes c
      where c.is_active is true
        and c.deleted_at is null
        and nullif(btrim(c.sesi), '') is not null
    ) as sessions;
$$;

revoke all on function public.get_public_homepage_stats() from public;
revoke all on function public.get_public_homepage_stats() from anon;
revoke all on function public.get_public_homepage_stats() from authenticated;
grant execute on function public.get_public_homepage_stats() to anon, authenticated;

comment on function public.get_public_homepage_stats() is
  'Returns active santri, active guru, and distinct active learning-session counts for the public homepage.';
