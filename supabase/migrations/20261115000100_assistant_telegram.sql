-- Asisten tahap 2: notifikasi Telegram.
--
-- Satu bot milik lembaga. Guru/admin menyambungkan akun lewat token sekali pakai
-- (t.me/<bot>?start=<token>); Edge Function telegram-webhook mencocokkan token dan menyimpan chat_id.
-- Penyusun pesan berjalan di database dan menaruh pesan di antrean; Edge Function
-- telegram-dispatch mengirimnya. Isi pesan hanya nama depan santri, kelas, alasan singkat, dan
-- tautan dasbor; tanpa nama lengkap, nomor HP, atau catatan karakter.
--
-- Penerima: guru pengampu (ringkasan harian + prioritas tinggi) dan admin (prioritas tinggi).
-- Tidak ada yang dikirim selama mode senyap atau bila Telegram dimatikan admin, dan tidak ada
-- pengiriman pada jam tenang 21.00–06.00 WIB (pesan menunggu sampai pagi).

-- ===== Pengaturan: tambah kelompok notifications =====

create or replace function public.assistant_default_settings()
returns jsonb
language sql
immutable
as $$
  select '{
    "version": 1,
    "silent_mode": true,
    "school_days": [1, 2, 3, 4, 5],
    "attendance": {
      "consecutive_sessions": 3,
      "repeat_every_sessions": 3,
      "high_consecutive_sessions": 6,
      "monthly_min_percent": 75
    },
    "jilid": {
      "default_days": 30,
      "per_jilid": {},
      "repeat_every_days": 14
    },
    "hafalan": {
      "proses_max_days": 30,
      "required_items_after_percent": 50,
      "murojaah_review_max_days": 7
    },
    "notifications": {
      "telegram_enabled": false,
      "bot_username": "",
      "summary_hour": 19,
      "dashboard_url": "https://www.lpqalfathmaulana.id/dashboard"
    }
  }'::jsonb;
$$;

create or replace function public.save_assistant_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_key text;
  v_value jsonb;
  v_days jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception 'INVALID_SETTINGS' using errcode = 'invalid_parameter_value';
  end if;

  -- Gabungkan dengan pengaturan tersimpan terakhir (bukan default), agar perubahan sebagian tidak
  -- mengembalikan kunci lain ke nilai default.
  v := public.jsonb_deep_merge(public.get_assistant_settings(), p_settings);

  if jsonb_typeof(v->'silent_mode') <> 'boolean' then
    raise exception 'INVALID_SETTINGS: silent_mode' using errcode = 'invalid_parameter_value';
  end if;

  v_days := v->'school_days';
  if jsonb_typeof(v_days) <> 'array' or jsonb_array_length(v_days) = 0 or exists (
    select 1 from jsonb_array_elements(v_days) d
    where jsonb_typeof(d) <> 'number' or (d)::text::int not between 1 and 7
  ) then
    raise exception 'INVALID_SETTINGS: school_days' using errcode = 'invalid_parameter_value';
  end if;

  if not (
    (v#>>'{attendance,consecutive_sessions}')::int between 2 and 20
    and (v#>>'{attendance,repeat_every_sessions}')::int between 1 and 20
    and (v#>>'{attendance,high_consecutive_sessions}')::int between (v#>>'{attendance,consecutive_sessions}')::int and 40
    and (v#>>'{attendance,monthly_min_percent}')::int between 1 and 100
    and (v#>>'{jilid,default_days}')::int between 7 and 730
    and (v#>>'{jilid,repeat_every_days}')::int between 1 and 90
    and (v#>>'{hafalan,proses_max_days}')::int between 3 and 365
    and (v#>>'{hafalan,required_items_after_percent}')::int between 10 and 100
    and (v#>>'{hafalan,murojaah_review_max_days}')::int between 1 and 60
    and (v#>>'{notifications,summary_hour}')::int between 6 and 20
  ) then
    raise exception 'INVALID_SETTINGS: angka di luar batas' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(v#>'{notifications,telegram_enabled}') <> 'boolean'
     or coalesce(v#>>'{notifications,bot_username}', '') !~ '^([A-Za-z][A-Za-z0-9_]{3,31})?$'
     or coalesce(v#>>'{notifications,dashboard_url}', '') !~ '^https://[^\s]{4,200}$' then
    raise exception 'INVALID_SETTINGS: notifications' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(v#>'{jilid,per_jilid}') <> 'object' then
    raise exception 'INVALID_SETTINGS: per_jilid' using errcode = 'invalid_parameter_value';
  end if;
  for v_key, v_value in select key, value from jsonb_each(v#>'{jilid,per_jilid}') loop
    if length(v_key) > 40 or jsonb_typeof(v_value) <> 'number' or (v_value)::text::int not between 7 and 730 then
      raise exception 'INVALID_SETTINGS: per_jilid %', v_key using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  insert into public.assistant_settings (settings, created_by) values (v, auth.uid());
  return v;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_SETTINGS: angka tidak valid' using errcode = 'invalid_parameter_value';
end;
$$;

-- ===== Tabel =====

-- Sambungan akun ke chat Telegram pribadi. Bisa diputus (active=false) oleh pemilik atau lewat /stop.
create table public.telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint not null,
  active boolean not null default true,
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz
);

alter table public.telegram_links enable row level security;
revoke all on public.telegram_links from anon, authenticated;
grant select on public.telegram_links to authenticated;
create policy telegram_links_select_own on public.telegram_links
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Token sekali pakai; hanya hash yang disimpan. Tidak dapat dibaca klien.
create table public.telegram_link_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.telegram_link_tokens enable row level security;
revoke all on public.telegram_link_tokens from anon, authenticated;

-- Antrean dan catatan pengiriman. dedupe_key mencegah pesan ganda untuk perkara yang sama.
create table public.assistant_telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jenis text not null,
  alert_ids uuid[] not null default '{}',
  pesan text not null,
  dedupe_key text not null,
  status text not null default 'menunggu',
  percobaan integer not null default 0,
  galat text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint assistant_telegram_outbox_jenis check (jenis in ('segera', 'ringkasan')),
  constraint assistant_telegram_outbox_status check (status in ('menunggu', 'terkirim', 'gagal')),
  constraint assistant_telegram_outbox_dedupe unique (user_id, dedupe_key)
);

alter table public.assistant_telegram_outbox enable row level security;
revoke all on public.assistant_telegram_outbox from anon, authenticated;
grant select on public.assistant_telegram_outbox to authenticated;
create policy assistant_telegram_outbox_select_admin on public.assistant_telegram_outbox
  for select to authenticated using (public.is_admin());

-- ===== RPC pengguna (guru/admin) =====

create or replace function public.get_my_telegram_link()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'linked', coalesce((select tl.active from public.telegram_links tl where tl.user_id = auth.uid()), false),
    'linked_at', (select tl.linked_at from public.telegram_links tl where tl.user_id = auth.uid() and tl.active),
    'enabled', coalesce((public.get_assistant_settings()#>>'{notifications,telegram_enabled}')::boolean, false),
    'bot_username', nullif(public.get_assistant_settings()#>>'{notifications,bot_username}', '')
  )
  where auth.uid() is not null;
$$;

create or replace function public.create_telegram_link_token()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not (public.is_admin() or public.is_guru()) then
    raise exception 'TELEGRAM_ROLE_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.telegram_link_tokens t
      where t.user_id = auth.uid() and t.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TELEGRAM_TOO_MANY_TOKENS' using errcode = 'program_limit_exceeded';
  end if;
  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.telegram_link_tokens (token_hash, user_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), now() + interval '15 minutes');
  return v_token;
end;
$$;

create or replace function public.unlink_my_telegram()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.telegram_links set active = false, unlinked_at = now()
  where user_id = auth.uid() and active;
$$;

revoke all on function public.get_my_telegram_link() from public, anon;
revoke all on function public.create_telegram_link_token() from public, anon;
revoke all on function public.unlink_my_telegram() from public, anon;
grant execute on function public.get_my_telegram_link() to authenticated;
grant execute on function public.create_telegram_link_token() to authenticated;
grant execute on function public.unlink_my_telegram() to authenticated;

-- ===== RPC untuk Edge Function (service role) =====

create or replace function public.telegram_consume_link_token(p_token text, p_chat_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.telegram_link_tokens;
  v_name text;
begin
  select * into v_row from public.telegram_link_tokens
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if v_row.token_hash is null or v_row.used_at is not null or v_row.expires_at < now() then
    return jsonb_build_object('ok', false);
  end if;
  update public.telegram_link_tokens set used_at = now() where token_hash = v_row.token_hash;
  -- Satu chat hanya untuk satu akun.
  update public.telegram_links set active = false, unlinked_at = now()
  where chat_id = p_chat_id and user_id <> v_row.user_id and active;
  insert into public.telegram_links (user_id, chat_id, active, linked_at, unlinked_at)
  values (v_row.user_id, p_chat_id, true, now(), null)
  on conflict (user_id) do update set chat_id = excluded.chat_id, active = true, linked_at = now(), unlinked_at = null;
  select coalesce(nullif(up.display_name, ''), 'Bapak/Ibu') into v_name from public.user_profiles up where up.id = v_row.user_id;
  return jsonb_build_object('ok', true, 'nama', split_part(coalesce(v_name, 'Bapak/Ibu'), ' ', 1));
end;
$$;

create or replace function public.telegram_stop(p_chat_id bigint)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.telegram_links set active = false, unlinked_at = now() where chat_id = p_chat_id and active;
$$;

-- Satu baris alasan singkat per perkara, memakai nama depan saja.
create or replace function public.assistant_telegram_reason(p_item jsonb)
returns text
language sql
immutable
as $$
  select case p_item->>'rule'
    when 'absen_beruntun' then format('tidak hadir %s sesi beruntun', p_item#>>'{detail,streak}')
    when 'kehadiran_bulanan' then format('kehadiran 4 pekan %s%%', p_item#>>'{detail,percent}')
    when 'jilid_lama' then format('%s hari di %s', p_item#>>'{detail,days}', p_item#>>'{detail,jilid}')
    when 'hafalan_macet' then 'hafalan belum aman'
    when 'hafalan_wajib_belum_lulus' then 'hafalan belum aman'
    when 'murojaah_belum_ditinjau' then 'setoran muroja''ah menunggu ditinjau'
    else p_item->>'rule'
  end;
$$;

create or replace function public.assistant_telegram_first_name(p_item jsonb)
returns text
language sql
immutable
as $$ select coalesce(nullif(btrim(p_item->>'nama_panggilan'), ''), split_part(coalesce(p_item->>'nama', 'Santri'), ' ', 1)); $$;

-- Menyusun pesan ke antrean untuk semua akun yang tersambung. Dipanggil oleh pg_cron.
-- Memakai get_assistant_attention atas nama tiap penerima, sehingga isi pesan sama persis dengan
-- panel dasbornya (lingkup kelas, mode senyap, kartu yang sudah tertutup).
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
  g record;
  v_items jsonb;
  v_lines text;
  v_count int;
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

    -- Prioritas tinggi: satu pesan per santri per hari.
    for g in
      select x->>'santri_id' as santri_id,
        min(public.assistant_telegram_first_name(x)) as nama,
        min(x->>'nama_kelas') as kelas,
        string_agg(distinct public.assistant_telegram_reason(x), '; ') as alasan,
        array_agg((x->>'alert_id')::uuid) filter (where x->>'tingkat' = 'tinggi') as alert_ids
      from jsonb_array_elements(v_items) x
      group by x->>'santri_id'
      having bool_or(x->>'tingkat' = 'tinggi')
    loop
      insert into public.assistant_telegram_outbox (user_id, jenis, alert_ids, pesan, dedupe_key)
      values (r.user_id, 'segera', g.alert_ids,
        format(E'Prioritas tinggi\n%s (%s): %s.\n\nBuka dasbor: %s', g.nama, g.kelas, g.alasan, v_url),
        'segera:' || g.santri_id || ':' || v_today)
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count;
      v_inserted := v_inserted + v_n;
    end loop;

    -- Ringkasan harian untuk guru, sekali sehari setelah jam ringkasan.
    if r.role = 'guru' and v_hour >= (v_settings#>>'{notifications,summary_hour}')::int
       and jsonb_array_length(v_items) > 0 then
      select count(*), string_agg(line, E'\n' order by ord, line)
      into v_count, v_lines
      from (
        select row_number() over (order by min(case x->>'tingkat' when 'tinggi' then 0 when 'sedang' then 1 else 2 end), min(x->>'nama')) as ord,
          format('• %s (%s): %s', min(public.assistant_telegram_first_name(x)), min(x->>'nama_kelas'),
            string_agg(distinct public.assistant_telegram_reason(x), '; ')) as line
        from jsonb_array_elements(v_items) x
        group by x->>'santri_id'
      ) s
      where ord <= 15;

      insert into public.assistant_telegram_outbox (user_id, jenis, alert_ids, pesan, dedupe_key)
      select r.user_id, 'ringkasan', array(select (x->>'alert_id')::uuid from jsonb_array_elements(v_items) x),
        format(E'Ringkasan Perlu Perhatian, %s\n\n%s%s\n\nBuka dasbor: %s',
          to_char(v_today, 'DD-MM-YYYY'), v_lines,
          case when (select count(distinct x->>'santri_id') from jsonb_array_elements(v_items) x) > 15
            then format(E'\n• dan %s santri lainnya', (select count(distinct x->>'santri_id') from jsonb_array_elements(v_items) x) - 15)
            else '' end,
          v_url),
        'ringkasan:' || v_today
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count;
      v_inserted := v_inserted + v_n;
    end if;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_prev_claims, ''), true);
  return v_inserted;
end;
$$;

-- Mengambil pesan siap kirim (jam 06.00–20.59 WIB), menaikkan hitungan percobaan agar tidak
-- terkirim ganda bila pengirim berjalan bersamaan.
create or replace function public.assistant_telegram_claim(p_limit integer default 30, p_now timestamptz default now())
returns table (id uuid, chat_id bigint, pesan text)
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
    returning o.id, o.user_id, o.pesan
  )
  select b.id, tl.chat_id, b.pesan from bumped b join public.telegram_links tl on tl.user_id = b.user_id;
end;
$$;

create or replace function public.assistant_telegram_mark(p_id uuid, p_ok boolean, p_error text default null, p_blocked boolean default false)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  update public.assistant_telegram_outbox
  set status = case when p_ok then 'terkirim' when percobaan >= 3 or p_blocked then 'gagal' else 'menunggu' end,
      sent_at = case when p_ok then now() else sent_at end,
      galat = case when p_ok then null else left(p_error, 300) end
  where id = p_id
  returning user_id into v_user;
  -- Pengguna memblokir bot: putuskan sambungannya.
  if p_blocked and v_user is not null then
    update public.telegram_links set active = false, unlinked_at = now() where user_id = v_user and active;
  end if;
end;
$$;

revoke all on function public.telegram_consume_link_token(text, bigint) from public, anon, authenticated;
revoke all on function public.telegram_stop(bigint) from public, anon, authenticated;
revoke all on function public.assistant_telegram_enqueue(timestamptz) from public, anon, authenticated;
revoke all on function public.assistant_telegram_claim(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.assistant_telegram_mark(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.telegram_consume_link_token(text, bigint) to service_role;
grant execute on function public.telegram_stop(bigint) to service_role;
grant execute on function public.assistant_telegram_enqueue(timestamptz) to service_role;
grant execute on function public.assistant_telegram_claim(integer, timestamptz) to service_role;
grant execute on function public.assistant_telegram_mark(uuid, boolean, text, boolean) to service_role;

-- ===== Penjadwal =====
-- Tiap 10 menit: susun pesan, lalu bangunkan telegram-dispatch bila alamat dan rahasianya sudah
-- disimpan admin di Vault (nama: assistant_functions_url, telegram_dispatch_secret). Sebelum itu
-- penjadwal hanya menyusun antrean.

create extension if not exists pg_net with schema extensions;

create or replace function public.assistant_telegram_tick()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n int;
  v_url text;
  v_secret text;
begin
  v_n := public.assistant_telegram_enqueue();
  if extract(hour from now() at time zone 'Asia/Jakarta')::int not between 6 and 20 then
    return v_n;
  end if;
  if not exists (select 1 from public.assistant_telegram_outbox where status = 'menunggu') then
    return v_n;
  end if;
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'assistant_functions_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'telegram_dispatch_secret';
  exception when others then
    return v_n;
  end;
  if v_url is null or v_secret is null then
    return v_n;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/telegram-dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', v_secret),
    body := '{}'::jsonb
  );
  return v_n;
end;
$$;

revoke all on function public.assistant_telegram_tick() from public, anon, authenticated;

select cron.schedule('assistant-telegram-tick', '*/10 * * * *', $$select public.assistant_telegram_tick()$$);
