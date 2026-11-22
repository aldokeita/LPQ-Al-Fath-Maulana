-- Tanya asisten AI lewat bot Telegram.
-- Guru yang sudah menyambungkan Telegram dapat mengirim pertanyaan ke bot. telegram-webhook membaca data
-- sebagaimana dilihat guru itu (RLS dan mode senyap berlaku lewat peniruan sesi), memanggil AI dengan
-- nama tersamar, lalu menyimpan percakapan di tabel yang sama dengan chat dasbor.

-- Asal percakapan: dasbor atau Telegram.
alter table public.assistant_ai_conversations add column if not exists sumber text not null default 'dasbor';
alter table public.assistant_ai_conversations add constraint assistant_ai_conversations_sumber
  check (sumber in ('dasbor', 'telegram'));

-- Pilihan aktif guru di Telegram: kelas, santri yang dibahas, dan percakapan berjalan. Hanya service role.
create table public.assistant_ai_telegram_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  santri_id uuid references public.santri(id) on delete set null,
  conversation_id uuid references public.assistant_ai_conversations(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.assistant_ai_telegram_state enable row level security;
revoke all on public.assistant_ai_telegram_state from anon, authenticated;

-- Pembaruan Telegram yang sudah diproses; mencegah jawaban ganda bila Telegram mengirim ulang.
create table public.assistant_telegram_updates (
  update_id bigint primary key,
  created_at timestamptz not null default now()
);

alter table public.assistant_telegram_updates enable row level security;
revoke all on public.assistant_telegram_updates from anon, authenticated;

-- Data untuk satu pesan Telegram, dibaca sebagai guru pemilik chat. p_class/p_santri opsional; bila
-- kosong dipakai pilihan tersimpan di assistant_ai_telegram_state.
-- Mengembalikan null bila chat belum tersambung.
create or replace function public.assistant_ai_telegram_data(p_chat_id bigint, p_class uuid default null, p_santri uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_prev text := current_setting('request.jwt.claims', true);
  v_user uuid;
  v_nama text;
  v_settings jsonb;
  v_classes jsonb;
  v_class uuid := p_class;
  v_santri uuid := p_santri;
  v_state public.assistant_ai_telegram_state;
  v_roster jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if auth.uid() is not null then
    raise exception 'SERVICE_ONLY' using errcode = 'insufficient_privilege';
  end if;
  select tl.user_id, coalesce(nullif(btrim(up.display_name), ''), 'Bapak/Ibu') into v_user, v_nama
  from public.telegram_links tl
  join public.user_profiles up on up.id = tl.user_id and up.status = 'active' and up.role::text in ('guru', 'admin')
  where tl.chat_id = p_chat_id and tl.active
  order by tl.linked_at desc limit 1;
  if v_user is null then
    return null;
  end if;

  select * into v_state from public.assistant_ai_telegram_state s where s.user_id = v_user;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  v_settings := public.get_assistant_settings();
  v_classes := public.get_assistant_ai_classes();
  if v_class is null or not exists (select 1 from jsonb_array_elements(v_classes) c where (c->>'id')::uuid = v_class) then
    v_class := v_state.class_id;
    if v_class is null or not exists (select 1 from jsonb_array_elements(v_classes) c where (c->>'id')::uuid = v_class) then
      v_class := (v_classes->0->>'id')::uuid;
    end if;
  end if;

  if v_class is not null then
    v_roster := public.get_assistant_class_roster(v_class);
  end if;
  if v_santri is null and v_state.class_id is not distinct from v_class then
    v_santri := v_state.santri_id;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_roster) x where (x->>'santri_id')::uuid = v_santri) then
    v_santri := null;
  end if;

  v_result := jsonb_build_object(
    'user_id', v_user,
    'nama', v_nama,
    'ai', v_settings->'ai',
    'silent', coalesce((v_settings->>'silent_mode')::boolean, false),
    'dashboard_url', v_settings#>>'{notifications,dashboard_url}',
    'classes', v_classes,
    'class_id', v_class,
    'santri_id', v_santri,
    'conversation_id', case when v_state.class_id is not distinct from v_class then v_state.conversation_id end,
    'roster', v_roster,
    'snapshots', case when jsonb_array_length(v_roster) > 0 then public.get_assistant_santri_snapshot(
      array(select (x->>'santri_id')::uuid from jsonb_array_elements(v_roster) x)) else '[]'::jsonb end,
    'items', case when v_class is null then '[]'::jsonb else coalesce(public.get_assistant_attention(v_class)->'items', '[]'::jsonb) end,
    'profile', case when v_santri is not null then public.get_assistant_santri_profile(v_santri) end
  );
  perform set_config('request.jwt.claims', coalesce(v_prev, ''), true);
  return v_result;
end;
$$;

revoke all on function public.assistant_ai_telegram_data(bigint, uuid, uuid) from public, anon, authenticated;
grant execute on function public.assistant_ai_telegram_data(bigint, uuid, uuid) to service_role;

-- Memperbarui pendaftaran webhook bot agar juga menerima tombol (callback_query). Dipanggil sekali
-- sesudah telegram-webhook versi baru di-deploy:  select public.assistant_telegram_refresh_webhook();
create or replace function public.assistant_telegram_refresh_webhook()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'assistant_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'telegram_dispatch_secret';
  if v_url is null or v_secret is null then
    return 'Vault belum berisi alamat fungsi atau rahasia pengirim; jalankan setup Telegram dulu.';
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/telegram-webhook',
    headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', v_secret),
    body := '{"action":"daftar_ulang"}'::jsonb,
    timeout_milliseconds := 15000
  );
  return 'Permintaan daftar ulang webhook dikirim.';
end;
$$;

revoke all on function public.assistant_telegram_refresh_webhook() from public, anon, authenticated;
