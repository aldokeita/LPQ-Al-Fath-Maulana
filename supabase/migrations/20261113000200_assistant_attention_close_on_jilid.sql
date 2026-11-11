-- Asisten: perkara "hafalan wajib belum lulus" ikut tertutup saat santri naik jilid.
--
-- Panel kini bisa menaikkan jilid langsung. Perkara hafalan wajib menyebut jilid lama, jadi setelah
-- santri naik, perkara itu tidak lagi relevan. Selain itu sama dengan definisi di
-- 20261112000400_assistant_attention_rpc.sql.

create or replace function public.get_assistant_attention(p_class_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_silent_mode boolean := public.assistant_silent_mode();
  v_items jsonb;
  v_silent_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if p_class_id is not null and not (v_admin or public.guru_has_class_access(p_class_id)) then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and not public.is_guru() and not public.is_pentashih() then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if v_silent_mode and not v_admin then
    return jsonb_build_object('items', '[]'::jsonb, 'senyap_tersimpan', 0, 'mode_senyap', true);
  end if;

  with latest as (
    select distinct on (a.santri_id, a.rule, a.episode_key) a.*
    from public.assistant_alerts a
    where a.created_at > now() - interval '60 days'
      and not a.senyap
      and (p_class_id is null or a.class_id = p_class_id)
      and (v_admin or public.guru_has_class_access(a.class_id))
    order by a.santri_id, a.rule, a.episode_key, a.created_at desc
  ),
  episode as (
    select l.*,
      (select min(a2.created_at) from public.assistant_alerts a2
        where a2.santri_id = l.santri_id and a2.rule = l.rule and a2.episode_key = l.episode_key
          and not a2.senyap) as first_alert_at,
      (select count(*) from public.assistant_alerts a2
        where a2.santri_id = l.santri_id and a2.rule = l.rule and a2.episode_key = l.episode_key
          and not a2.senyap)::int as jumlah_pengingat,
      exists (select 1 from public.assistant_alert_decisions d
        join public.assistant_alerts a2 on a2.id = d.alert_id
        where a2.santri_id = l.santri_id and a2.rule = l.rule and a2.episode_key = l.episode_key) as decided
    from latest l
  ),
  open_items as (
    select e.*, s.nama_lengkap, s.nama_panggilan, s.jilid as jilid_sekarang, c.nama_kelas
    from episode e
    join public.santri s on s.id = e.santri_id
    join public.classes c on c.id = e.class_id
    where not e.decided
      and case e.rule
        when 'absen_beruntun' then not exists (
          select 1 from public.attendance a
          where a.user_id = e.santri_id and a.attendance_date > (e.detail->>'last_absent')::date)
          and not exists (
          select 1 from public.attendance_presence_corrections pc
          where pc.santri_id = e.santri_id and pc.tanggal > (e.detail->>'last_absent')::date)
        when 'jilid_lama' then s.jilid is not distinct from e.detail->>'jilid'
        when 'hafalan_wajib_belum_lulus' then s.jilid is not distinct from e.detail->>'jilid'
          and e.created_at > now() - interval '7 days'
        else e.created_at > now() - interval '7 days'
      end
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'alert_id', o.id,
      'santri_id', o.santri_id,
      'nama', o.nama_lengkap,
      'nama_panggilan', o.nama_panggilan,
      'class_id', o.class_id,
      'nama_kelas', o.nama_kelas,
      'rule', o.rule,
      'tingkat', o.tingkat,
      'alasan', o.alasan,
      'detail', o.detail,
      'senyap', o.senyap,
      'created_at', o.created_at,
      'first_alert_at', o.first_alert_at,
      'jumlah_pengingat', o.jumlah_pengingat
    ) order by case o.tingkat when 'tinggi' then 0 when 'sedang' then 1 else 2 end, o.created_at desc), '[]'::jsonb)
  into v_items
  from open_items o;

  if v_admin then
    select count(distinct (a.santri_id, a.rule, a.episode_key))::int into v_silent_count
    from public.assistant_alerts a
    where a.senyap and a.created_at > now() - interval '60 days'
      and (p_class_id is null or a.class_id = p_class_id);
  end if;

  return jsonb_build_object(
    'items', v_items,
    'senyap_tersimpan', v_silent_count,
    'mode_senyap', v_silent_mode
  );
end;
$$;

revoke all on function public.get_assistant_attention(uuid) from public, anon;
grant execute on function public.get_assistant_attention(uuid) to authenticated;
