-- Leaderboard global: guru (dan pentashih) dapat melihat peringkat poin seluruh santri, bukan hanya
-- kelasnya. RLS tabel santri tetap membatasi guru ke kelasnya; fungsi ini hanya membuka kolom yang
-- memang tampil di leaderboard (nama, foto, sesi, jilid, poin), tanpa data pribadi lain.

create or replace function public.get_global_leaderboard(p_page integer default 1, p_page_size integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_size int := greatest(1, least(coalesce(p_page_size, 10), 100));
  v_offset int := (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, least(coalesce(p_page_size, 10), 100));
begin
  if auth.uid() is null or not (public.is_admin() or public.is_guru() or public.is_pentashih()) then
    raise exception 'LEADERBOARD_ROLE_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from public.santri s where s.deleted_at is null),
    'students', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.points desc nulls last, x.nama_lengkap)
      from (
        select s.id, s.nama_lengkap, s.points, s.foto_url, s.avatar_path, s.sesi_mengaji, s.jilid
        from public.santri s
        where s.deleted_at is null
        order by s.points desc nulls last, s.nama_lengkap
        limit v_size offset v_offset
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_global_leaderboard(integer, integer) from public, anon;
grant execute on function public.get_global_leaderboard(integer, integer) to authenticated;
