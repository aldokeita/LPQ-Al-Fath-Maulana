-- Profil santri untuk asisten AI: tambah daftar hafalan wajib jilid (termasuk yang belum dinilai) agar AI
-- bisa menyebut hafalan apa saja yang sudah aman (skor 4), masih dilatih, atau belum dinilai.

create or replace function public.get_assistant_santri_profile(p_santri_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  s record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and not public.guru_has_santri_access(p_santri_id) then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and public.assistant_silent_mode() then
    return null;
  end if;

  select * into s from public.santri where id = p_santri_id and deleted_at is null;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'santri_id', s.id,
    'nama_lengkap', s.nama_lengkap,
    'nama_panggilan', s.nama_panggilan,
    'jenis_kelamin', s.jenis_kelamin,
    'usia', case when s.tanggal_lahir is not null then extract(year from age(public.jakarta_today(), s.tanggal_lahir))::int end,
    'jilid', s.jilid,
    'poin', round(coalesce(s.points, 0)::numeric, 1),
    'riwayat_jilid', (select coalesce(jsonb_agg(jsonb_build_object('dari', h.from_jilid, 'ke', h.to_jilid,
        'hari_lalu', public.jakarta_today() - (h.changed_at at time zone 'Asia/Jakarta')::date) order by h.changed_at desc), '[]'::jsonb)
      from (select * from public.jilid_history where santri_id = s.id order by changed_at desc limit 6) h),
    'hafalan', (select coalesce(jsonb_agg(jsonb_build_object('kategori', p.category, 'materi', p.item_name, 'skor', p.score,
        'hari_sejak_dinilai', public.jakarta_today() - (p.updated_at at time zone 'Asia/Jakarta')::date)
        order by p.category, i.item_order nulls last, p.item_name), '[]'::jsonb)
      from (select * from public.hafalan_progress where santri_id = s.id order by updated_at desc limit 200) p
      left join public.hafalan_items i on i.id = p.item_id),
    -- Hafalan wajib jilid saat ini, termasuk yang belum pernah dinilai (skor null).
    'hafalan_wajib_jilid', (select coalesce(jsonb_agg(jsonb_build_object('kategori', hi.category, 'materi', hi.item_name,
        'skor', hp.score, 'status', coalesce(hp.status, 'belum')) order by hi.category, hi.item_order nulls last, hi.item_name), '[]'::jsonb)
      from public.hafalan_items hi
      left join public.hafalan_progress hp on hp.item_id = hi.id and hp.santri_id = s.id
      where hi.is_active and hi.program_scope = 'TPQ' and btrim(hi.jilid) = public.assistant_hafalan_jilid_key(s.jilid)),
    'karakter', (select coalesce(jsonb_agg(jsonb_build_object('indikator', ci.item_name, 'skor', cs.score) order by ci.item_order), '[]'::jsonb)
      from public.santri_character_scores cs join public.character_assessment_items ci on ci.id = cs.item_id
      where cs.santri_id = s.id),
    'kekuatan', (select coalesce(jsonb_agg(st.strength_key), '[]'::jsonb) from public.santri_character_strengths st where st.santri_id = s.id),
    'perilaku', (select coalesce(jsonb_agg(jsonb_build_object('tingkat', b.level, 'perilaku', left(b.behavior, 200),
        'tindak_lanjut', left(b.follow_up, 200), 'hari_lalu', public.jakarta_today() - b.incident_date) order by b.incident_date desc), '[]'::jsonb)
      from (select * from public.santri_behavior_records where santri_id = s.id and incident_date >= public.jakarta_today() - 180
            order by incident_date desc limit 10) b),
    'catatan_guru', (select coalesce(jsonb_agg(jsonb_build_object('catatan', left(n.note, 300),
        'hari_lalu', public.jakarta_today() - (n.created_at at time zone 'Asia/Jakarta')::date) order by n.created_at desc), '[]'::jsonb)
      from (select * from public.santri_notes where santri_id = s.id and (v_admin or visibility = 'internal')
            order by created_at desc limit 8) n)
  );
end;
$$;

revoke all on function public.get_assistant_santri_profile(uuid) from public, anon;
grant execute on function public.get_assistant_santri_profile(uuid) to authenticated;
