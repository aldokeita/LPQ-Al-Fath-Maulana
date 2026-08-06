-- Allow a santri to edit their own profile.
--
-- Table public.santri has exactly one write policy, santri_admin_all, gated on
-- is_admin(). A santri editing their own row was therefore blocked by RLS, and
-- because PostgREST reports an RLS-blocked UPDATE as HTTP 200 with 0 rows and
-- error=null, the dashboard showed a success toast while nothing was saved.
--
-- The column allow-list below is the security boundary and is enforced here on
-- the server. The client previously stripped privileged fields by destructuring,
-- which is not a control. jilid, points, nomor_induk_qiroati, sesi_mengaji,
-- status, kategori and class assignment are deliberately absent and stay
-- writable only by an admin.

create or replace function public.update_santri_self_profile(p_profile jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'INVALID_PROFILE_PAYLOAD' using errcode = '22023';
  end if;

  -- `p_profile ? 'key'` distinguishes "field omitted" (keep current value) from
  -- "field sent as null/empty" (clear it), which the photo-removal flow needs.
  update public.santri s
  set
    nama_lengkap = case when p_profile ? 'nama_lengkap'
      then coalesce(nullif(btrim(p_profile ->> 'nama_lengkap'), ''), s.nama_lengkap)
      else s.nama_lengkap end,
    tempat_lahir = case when p_profile ? 'tempat_lahir'
      then nullif(btrim(p_profile ->> 'tempat_lahir'), '') else s.tempat_lahir end,
    tanggal_lahir = case when p_profile ? 'tanggal_lahir'
      then nullif(btrim(p_profile ->> 'tanggal_lahir'), '')::date else s.tanggal_lahir end,
    nama_ayah = case when p_profile ? 'nama_ayah'
      then nullif(btrim(p_profile ->> 'nama_ayah'), '') else s.nama_ayah end,
    nama_ibu = case when p_profile ? 'nama_ibu'
      then nullif(btrim(p_profile ->> 'nama_ibu'), '') else s.nama_ibu end,
    no_hp_ortu = case when p_profile ? 'no_hp_ortu'
      then nullif(btrim(p_profile ->> 'no_hp_ortu'), '') else s.no_hp_ortu end,
    alamat = case when p_profile ? 'alamat'
      then nullif(btrim(p_profile ->> 'alamat'), '') else s.alamat end,
    avatar_path = case when p_profile ? 'avatar_path'
      then nullif(btrim(p_profile ->> 'avatar_path'), '') else s.avatar_path end,
    foto_url = case when p_profile ? 'foto_url'
      then nullif(btrim(p_profile ->> 'foto_url'), '') else s.foto_url end,
    updated_by = v_id,
    updated_at = now()
  where s.id = v_id
    and s.deleted_at is null;

  if not found then
    raise exception 'ACTIVE_SANTRI_NOT_FOUND' using errcode = 'P0002';
  end if;

  return v_id;
end;
$$;

revoke all on function public.update_santri_self_profile(jsonb) from public;
revoke all on function public.update_santri_self_profile(jsonb) from anon;
grant execute on function public.update_santri_self_profile(jsonb) to authenticated;

comment on function public.update_santri_self_profile(jsonb)
  is 'Self-service profile update for the authenticated santri. Only the columns listed in the function body may be changed; jilid, points and identifiers remain admin-only.';
