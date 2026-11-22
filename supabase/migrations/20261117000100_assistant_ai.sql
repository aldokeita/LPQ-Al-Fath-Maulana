-- Asisten tahap 3: rekomendasi AI per santri.
--
-- Penyedia AI dipilih admin di pengaturan (ai.provider/model); kunci API hanya ada sebagai secret
-- Edge Function assistant-ai, tidak pernah di database atau browser. Data yang dikirim ke AI sudah
-- disamarkan (tanpa nama, kelas, nomor HP). Hasil disimpan agar data yang sama tidak diproses ulang,
-- dan setiap panggilan dicatat untuk batas biaya bulanan.

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
    },
    "ai": {
      "enabled": false,
      "provider": "mock",
      "model": "",
      "base_url": "",
      "monthly_budget_usd": 10,
      "price_input_per_mtok": 0,
      "price_output_per_mtok": 0,
      "daily_limit_per_user": 40
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

  if jsonb_typeof(v#>'{ai,enabled}') <> 'boolean'
     or coalesce(v#>>'{ai,provider}', '') not in ('mock', 'anthropic', 'openai', 'gemini', 'deepseek', 'opencode', 'openrouter', 'groq', 'custom')
     or coalesce(v#>>'{ai,model}', '') !~ '^[A-Za-z0-9._:/@-]{0,100}$'
     or coalesce(v#>>'{ai,base_url}', '') !~ '^(https://[^\s]{4,200})?$'
     or (v#>>'{ai,provider}' = 'custom' and coalesce(v#>>'{ai,base_url}', '') = '')
     or (v#>>'{ai,monthly_budget_usd}')::numeric not between 0 and 1000
     or (v#>>'{ai,price_input_per_mtok}')::numeric not between 0 and 1000
     or (v#>>'{ai,price_output_per_mtok}')::numeric not between 0 and 1000
     or (v#>>'{ai,daily_limit_per_user}')::int not between 1 and 500 then
    raise exception 'INVALID_SETTINGS: ai' using errcode = 'invalid_parameter_value';
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


-- ===== Hasil rekomendasi =====

create table public.assistant_ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  alert_ids uuid[] not null default '{}',
  input_hash text not null,
  provider text not null,
  model text not null,
  hasil jsonb not null,
  created_at timestamptz not null default now()
);

create index assistant_ai_recommendations_santri_idx
  on public.assistant_ai_recommendations (santri_id, created_at desc);
create index assistant_ai_recommendations_hash_idx
  on public.assistant_ai_recommendations (santri_id, input_hash);

alter table public.assistant_ai_recommendations enable row level security;
revoke all on public.assistant_ai_recommendations from anon, authenticated;
grant select on public.assistant_ai_recommendations to authenticated;
create policy assistant_ai_recommendations_select on public.assistant_ai_recommendations
  for select to authenticated
  using (public.is_admin() or (not public.assistant_silent_mode() and public.guru_has_santri_access(santri_id)));

-- ===== Log pemakaian (biaya) =====

create table public.assistant_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  santri_id uuid references public.santri(id) on delete set null,
  fitur text not null default 'rekomendasi',
  provider text not null,
  model text not null,
  status text not null check (status in ('ok', 'cache', 'gagal', 'uji')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  biaya_usd numeric(12, 6) not null default 0,
  galat text,
  created_at timestamptz not null default now()
);

create index assistant_ai_usage_created_idx on public.assistant_ai_usage (created_at desc);
create index assistant_ai_usage_user_idx on public.assistant_ai_usage (user_id, created_at desc);

alter table public.assistant_ai_usage enable row level security;
revoke all on public.assistant_ai_usage from anon, authenticated;
grant select on public.assistant_ai_usage to authenticated;
create policy assistant_ai_usage_select_admin on public.assistant_ai_usage
  for select to authenticated using (public.is_admin());

-- Ringkasan pemakaian bulan berjalan (WIB) untuk pemeriksaan anggaran.
create or replace function public.assistant_ai_month_usage()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'bulan', to_char(public.jakarta_today(), 'YYYY-MM'),
    'biaya_usd', coalesce(sum(biaya_usd), 0),
    'permintaan', count(*) filter (where status in ('ok', 'uji')),
    'dari_cache', count(*) filter (where status = 'cache'),
    'gagal', count(*) filter (where status = 'gagal'),
    'input_tokens', coalesce(sum(input_tokens), 0),
    'output_tokens', coalesce(sum(output_tokens), 0)
  )
  from public.assistant_ai_usage
  where created_at >= (date_trunc('month', public.jakarta_today()::timestamp) at time zone 'Asia/Jakarta');
$$;

revoke all on function public.assistant_ai_month_usage() from public, anon, authenticated;
grant execute on function public.assistant_ai_month_usage() to service_role;

create or replace function public.get_assistant_ai_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  return public.assistant_ai_month_usage();
end;
$$;

revoke all on function public.get_assistant_ai_usage() from public, anon;
grant execute on function public.get_assistant_ai_usage() to authenticated;
