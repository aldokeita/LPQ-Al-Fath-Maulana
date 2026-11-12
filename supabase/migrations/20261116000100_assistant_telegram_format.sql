-- Asisten: pesan Telegram yang lebih ringkas dan rapi.
--
-- Sebelumnya setiap santri prioritas tinggi menjadi satu pesan tersendiri dan teks polos dengan
-- tautan panjang. Kini: satu pesan per pengiriman berisi semua santri baru, satu baris per santri
-- dengan ikon bidang, nama tebal (HTML Telegram), dikelompokkan per kelas, paling banyak 12 santri,
-- dan tombol "Buka dasbor" (tautan disimpan terpisah di kolom tautan).

alter table public.assistant_telegram_outbox add column if not exists tautan text;

create or replace function public.assistant_telegram_escape(p_text text)
returns text
language sql
immutable
as $$ select replace(replace(replace(coalesce(p_text, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'); $$;

-- Satu baris ringkas untuk seluruh perkara satu santri, mis.
-- "🔴 <b>Aira</b> — 📅 absen 6× · hadir 20% · 📘 97 hari di Pra TK C · 🌱 hafalan".
create or replace function public.assistant_telegram_santri_line(p_items jsonb)
returns text
language sql
immutable
as $$
  with x as (select value as i from jsonb_array_elements(p_items)),
  parts as (
    select
      (select string_agg(p, ' · ') from (
        select format('absen %s× berturut', max((i#>>'{detail,streak}')::int)) as p from x where i->>'rule' = 'absen_beruntun' having count(*) > 0
        union all
        select format('hadir %s%%', min((i#>>'{detail,percent}')::int)) from x where i->>'rule' = 'kehadiran_bulanan' having count(*) > 0
      ) a) as kehadiran,
      (select format('%s hari di %s', max((i#>>'{detail,days}')::int), min(i#>>'{detail,jilid}'))
         from x where i->>'rule' = 'jilid_lama' having count(*) > 0) as jilid,
      exists (select 1 from x where i->>'rule' in ('hafalan_macet', 'hafalan_wajib_belum_lulus')) as hafalan,
      exists (select 1 from x where i->>'rule' = 'murojaah_belum_ditinjau') as murojaah,
      exists (select 1 from x where i->>'tingkat' = 'tinggi') as tinggi,
      (select public.assistant_telegram_first_name(i) from x limit 1) as nama
  )
  select (case when tinggi then '🔴' else '🟡' end) || ' <b>' || public.assistant_telegram_escape(nama) || '</b> — '
    || concat_ws(' · ',
      case when kehadiran is not null then '📅 ' || kehadiran end,
      case when jilid is not null then '📘 ' || public.assistant_telegram_escape(jilid) end,
      case when hafalan then '🌱 hafalan' end,
      case when murojaah then '🎙 setoran menunggu' end)
  from parts;
$$;

-- Daftar santri dikelompokkan per kelas; judul kelas hanya bila lebih dari satu kelas.
create or replace function public.assistant_telegram_list(p_items jsonb, p_limit integer default 12)
returns text
language sql
immutable
as $$
  with per_santri as (
    select x->>'santri_id' as santri_id, min(x->>'nama_kelas') as kelas,
      jsonb_agg(x) as items,
      bool_or(x->>'tingkat' = 'tinggi') as tinggi,
      min(x->>'nama') as nama
    from jsonb_array_elements(p_items) x
    group by x->>'santri_id'
  ),
  ranked as (
    select *, row_number() over (order by tinggi desc, nama) as rn from per_santri
  ),
  shown as (select * from ranked where rn <= p_limit),
  classes as (select count(distinct kelas) as n from shown)
  select string_agg(block, E'\n\n' order by kelas)
    || case when (select count(*) from per_santri) > p_limit
         then format(E'\n\n<i>+%s santri lainnya di dasbor</i>', (select count(*) from per_santri) - p_limit) else '' end
  from (
    select kelas,
      case when (select n from classes) > 1 then '<b>' || public.assistant_telegram_escape(kelas) || E'</b>\n' else '' end
        || string_agg(public.assistant_telegram_santri_line(items), E'\n' order by tinggi desc, nama) as block
    from shown
    group by kelas
  ) b;
$$;

create or replace function public.assistant_telegram_enqueue(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_settings jsonb := public.get_assistant_settings();
  v_today date := (p_now at time zone 'Asia/Jakarta')::date;
  v_hour int := extract(hour from p_now at time zone 'Asia/Jakarta')::int;
  v_url text := v_settings#>>'{notifications,dashboard_url}';
  v_prev_claims text := current_setting('request.jwt.claims', true);
  v_inserted int := 0;
  v_n int;
  r record;
  v_items jsonb;
  v_new jsonb;
  v_new_ids uuid[];
  v_santri int;
  v_tinggi int;
  v_kelas text;
  v_single_class text;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if (v_settings->>'silent_mode')::boolean
     or not coalesce((v_settings#>>'{notifications,telegram_enabled}')::boolean, false) then
    return 0;
  end if;

  for r in
    select tl.user_id, up.role::text as role
    from public.telegram_links tl
    join public.user_profiles up on up.id = tl.user_id
    where tl.active and up.status = 'active' and up.role::text in ('admin', 'guru')
  loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
    v_items := coalesce(public.get_assistant_attention(null)->'items', '[]'::jsonb);

    -- Prioritas tinggi: satu pesan berisi santri tinggi yang belum diberitahukan hari ini.
    with santri_tinggi as (
      select x->>'santri_id' as santri_id
      from jsonb_array_elements(v_items) x
      group by x->>'santri_id'
      having bool_or(x->>'tingkat' = 'tinggi')
        and not exists (
          select 1 from public.assistant_telegram_outbox o
          where o.user_id = r.user_id and o.jenis = 'segera'
            and (o.created_at at time zone 'Asia/Jakarta')::date = v_today
            and o.alert_ids && array_agg((x->>'alert_id')::uuid))
    )
    select coalesce(jsonb_agg(x), '[]'::jsonb), array_agg((x->>'alert_id')::uuid order by x->>'alert_id')
    into v_new, v_new_ids
    from jsonb_array_elements(v_items) x
    where x->>'santri_id' in (select santri_id from santri_tinggi);

    if jsonb_array_length(v_new) > 0 then
      select count(distinct x->>'santri_id') into v_santri from jsonb_array_elements(v_new) x;
      select case when count(distinct x->>'nama_kelas') = 1 then min(x->>'nama_kelas') end
      into v_single_class from jsonb_array_elements(v_new) x;
      insert into public.assistant_telegram_outbox (user_id, jenis, alert_ids, pesan, tautan, dedupe_key)
      values (r.user_id, 'segera', v_new_ids,
        format(E'🔴 <b>Perlu perhatian segera</b> · %s santri%s\n\n%s',
          v_santri,
          case when v_single_class is not null then E'\n<i>' || public.assistant_telegram_escape(v_single_class) || '</i>' else '' end,
          public.assistant_telegram_list(v_new)),
        v_url,
        'segera:' || v_today || ':' || md5(array_to_string(v_new_ids, ',')))
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count;
      v_inserted := v_inserted + v_n;
    end if;

    -- Ringkasan harian untuk guru, sekali sehari setelah jam ringkasan.
    if r.role = 'guru' and v_hour >= (v_settings#>>'{notifications,summary_hour}')::int
       and jsonb_array_length(v_items) > 0 then
      select count(distinct x->>'santri_id'),
        count(distinct x->>'santri_id') filter (where x->>'tingkat' = 'tinggi'),
        case when count(distinct x->>'nama_kelas') = 1 then min(x->>'nama_kelas') end
      into v_santri, v_tinggi, v_kelas
      from jsonb_array_elements(v_items) x;

      insert into public.assistant_telegram_outbox (user_id, jenis, alert_ids, pesan, tautan, dedupe_key)
      values (r.user_id, 'ringkasan',
        array(select (x->>'alert_id')::uuid from jsonb_array_elements(v_items) x),
        format(E'📋 <b>Ringkasan hari ini</b> · %s\n%s santri perlu perhatian%s%s\n\n%s',
          to_char(v_today, 'DD-MM-YYYY'), v_santri,
          case when v_tinggi > 0 then format(', %s prioritas tinggi', v_tinggi) else '' end,
          case when v_kelas is not null then E'\n<i>' || public.assistant_telegram_escape(v_kelas) || '</i>' else '' end,
          public.assistant_telegram_list(v_items)),
        v_url,
        'ringkasan:' || v_today)
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count;
      v_inserted := v_inserted + v_n;
    end if;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_prev_claims, ''), true);
  return v_inserted;
end;
$$;

drop function if exists public.assistant_telegram_claim(integer, timestamptz);

create function public.assistant_telegram_claim(p_limit integer default 30, p_now timestamptz default now())
returns table (id uuid, chat_id bigint, pesan text, tautan text)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if extract(hour from p_now at time zone 'Asia/Jakarta')::int not between 6 and 20 then
    return;
  end if;
  return query
  with picked as (
    select o.id from public.assistant_telegram_outbox o
    join public.telegram_links tl on tl.user_id = o.user_id and tl.active
    where o.status = 'menunggu' and o.percobaan < 3 and o.created_at > p_now - interval '2 days'
    order by o.jenis = 'segera' desc, o.created_at
    limit greatest(1, least(coalesce(p_limit, 30), 100))
    for update of o skip locked
  ),
  bumped as (
    update public.assistant_telegram_outbox o set percobaan = o.percobaan + 1
    from picked where o.id = picked.id
    returning o.id, o.user_id, o.pesan, o.tautan
  )
  select b.id, tl.chat_id, b.pesan, b.tautan from bumped b join public.telegram_links tl on tl.user_id = b.user_id;
end;
$$;

revoke all on function public.assistant_telegram_claim(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.assistant_telegram_claim(integer, timestamptz) to service_role;
