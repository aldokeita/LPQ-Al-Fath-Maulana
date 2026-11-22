-- Asisten: kehadiran satu santri sepanjang satu bulan untuk kartu profil yang dibagikan ke wali.
--
-- Hanya membaca. Memakai hari sekolah dan libur kalender yang sama dengan snapshot asisten.
-- Sesi dihitung dari awal bulan (atau tanggal masuk kelas bila lebih akhir) sampai kemarin; sesi hari ini
-- ikut hanya bila absensinya sudah tercatat. Status: hadir (tepat waktu), terlambat, koreksi
-- (koreksi "sebenarnya hadir"), atau absen. Akses: admin semua santri, guru hanya santri di kelasnya,
-- dan guru tidak mendapat apa pun selama mode senyap.

create or replace function public.get_assistant_santri_month_attendance(p_santri_id uuid, p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_days jsonb := public.get_assistant_settings()->'school_days';
  v_today date := public.jakarta_today();
  v_month date := date_trunc('month', coalesce(p_month, v_today))::date;
  v_end date;
  r record;
  v_sesi jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and not public.is_guru() and not public.is_pentashih() then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and public.assistant_silent_mode() then
    return null;
  end if;

  select s.id, s.tanggal_pendaftaran, cm.start_date into r
  from public.santri s
  join public.class_memberships cm on cm.santri_id = s.id and cm.status = 'active'
  where s.id = p_santri_id
    and s.deleted_at is null
    and (v_admin or public.guru_has_class_access(cm.class_id))
  limit 1;
  if not found then
    return null;
  end if;

  v_end := least((v_month + interval '1 month - 1 day')::date, v_today);

  select coalesce(jsonb_agg(jsonb_build_object('t', x.d, 's', x.s) order by x.d), '[]'::jsonb) into v_sesi
  from (
    select d.d,
      case
        when a.status is not null and a.status ilike '%terlambat%' then 'terlambat'
        when a.status is not null then 'hadir'
        when exists (select 1 from public.attendance_presence_corrections c where c.santri_id = r.id and c.tanggal = d.d) then 'koreksi'
        else 'absen'
      end as s
    from public.assistant_school_days(greatest(v_month, coalesce(r.start_date, r.tanggal_pendaftaran, v_month)), v_end, v_days) d
    left join lateral (
      select at.status from public.attendance at
      where at.user_id = r.id and at.attendance_date = d.d
      order by at.check_in_time nulls last limit 1
    ) a on true
    -- Sesi hari ini belum tentu sudah berlangsung: ikut hanya bila absensinya sudah ada.
    where d.d < v_today or a.status is not null
  ) x;

  return jsonb_build_object(
    'bulan', v_month,
    'sampai', v_end,
    'sesi', v_sesi,
    'total', jsonb_array_length(v_sesi),
    'hadir', (select count(*) from jsonb_array_elements(v_sesi) e where e->>'s' <> 'absen')
  );
end;
$$;

revoke all on function public.get_assistant_santri_month_attendance(uuid, date) from public, anon;
grant execute on function public.get_assistant_santri_month_attendance(uuid, date) to authenticated;
