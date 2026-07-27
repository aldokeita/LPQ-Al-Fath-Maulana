-- Use the canonical database-backed role helper for institutional Pentashih reads.
create or replace function public.is_pentashih_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_pentashih();
$$;
