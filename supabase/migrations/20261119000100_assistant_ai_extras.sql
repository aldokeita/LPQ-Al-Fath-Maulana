-- Asisten tahap 3c: umpan balik, pustaka materi, rapor wali, ringkasan kelas pekanan via Telegram,
-- dan data evaluasi untuk admin.

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
      "daily_limit_per_user": 40,
      "konteks_lembaga": ""
    }
  }'::jsonb
  || jsonb_build_object('ai', ('{"enabled": false, "provider": "mock", "model": "", "base_url": "",
       "monthly_budget_usd": 10, "price_input_per_mtok": 0, "price_output_per_mtok": 0,
       "daily_limit_per_user": 40, "weekly_digest": false}'::jsonb) || jsonb_build_object('konteks_lembaga', public.assistant_default_konteks()));
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
     or (v#>>'{ai,daily_limit_per_user}')::int not between 1 and 500
     or jsonb_typeof(v#>'{ai,konteks_lembaga}') <> 'string'
     or length(v#>>'{ai,konteks_lembaga}') > 6000
     or jsonb_typeof(v#>'{ai,weekly_digest}') <> 'boolean' then
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




-- ===== Umpan balik 👍/👎 =====

create table public.assistant_ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jenis text not null check (jenis in ('rekomendasi', 'kelas', 'chat', 'rapor')),
  target_id uuid not null,
  nilai smallint not null check (nilai in (-1, 1)),
  komentar text check (komentar is null or length(komentar) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, jenis, target_id)
);

alter table public.assistant_ai_feedback enable row level security;
revoke all on public.assistant_ai_feedback from anon, authenticated;
grant select, insert, update, delete on public.assistant_ai_feedback to authenticated;
create policy assistant_ai_feedback_select on public.assistant_ai_feedback
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy assistant_ai_feedback_insert on public.assistant_ai_feedback
  for insert to authenticated with check (user_id = auth.uid() and (public.is_admin() or public.is_guru()));
create policy assistant_ai_feedback_update on public.assistant_ai_feedback
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assistant_ai_feedback_delete on public.assistant_ai_feedback
  for delete to authenticated using (user_id = auth.uid());

-- ===== Pustaka materi Qiroati =====

create table public.assistant_ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  judul text not null check (length(btrim(judul)) between 3 and 120),
  kategori text not null default 'Umum' check (length(kategori) <= 40),
  isi text not null check (length(btrim(isi)) between 10 and 8000),
  aktif boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_ai_knowledge enable row level security;
revoke all on public.assistant_ai_knowledge from anon, authenticated;
grant select, insert, update, delete on public.assistant_ai_knowledge to authenticated;
create policy assistant_ai_knowledge_select on public.assistant_ai_knowledge
  for select to authenticated using (public.is_admin() or (aktif and public.is_guru()));
create policy assistant_ai_knowledge_admin_write on public.assistant_ai_knowledge
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== Rapor wali =====

create table public.assistant_ai_reports (
  id uuid primary key default gen_random_uuid(),
  santri_id uuid not null references public.santri(id) on delete cascade,
  bulan text not null check (bulan ~ '^\d{4}-\d{2}$'),
  requested_by uuid references auth.users(id) on delete set null,
  input_hash text not null,
  provider text not null,
  model text not null,
  hasil jsonb not null,
  created_at timestamptz not null default now()
);

create index assistant_ai_reports_santri_idx on public.assistant_ai_reports (santri_id, created_at desc);

alter table public.assistant_ai_reports enable row level security;
revoke all on public.assistant_ai_reports from anon, authenticated;
grant select on public.assistant_ai_reports to authenticated;
create policy assistant_ai_reports_select on public.assistant_ai_reports
  for select to authenticated
  using (public.is_admin() or (not public.assistant_silent_mode() and public.guru_has_santri_access(santri_id)));

-- ===== Ringkasan kelas pekanan via Telegram =====

alter table public.assistant_telegram_outbox drop constraint assistant_telegram_outbox_jenis;
alter table public.assistant_telegram_outbox add constraint assistant_telegram_outbox_jenis
  check (jenis in ('segera', 'ringkasan', 'pekanan'));

-- Penerima ringkasan pekanan: guru aktif yang menyambungkan Telegram, per kelas TPQ anak miliknya.
create or replace function public.assistant_ai_digest_targets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb := public.get_assistant_settings();
begin
  if (v_settings->>'silent_mode')::boolean
     or not coalesce((v_settings#>>'{ai,enabled}')::boolean, false)
     or not coalesce((v_settings#>>'{ai,weekly_digest}')::boolean, false)
     or not coalesce((v_settings#>>'{notifications,telegram_enabled}')::boolean, false) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', tl.user_id, 'class_id', c.id, 'nama_kelas', c.nama_kelas))
    from public.telegram_links tl
    join public.user_profiles up on up.id = tl.user_id and up.status = 'active' and up.role::text = 'guru'
    join public.classes c on c.id_guru = tl.user_id and c.deleted_at is null
    where tl.active and exists (
      select 1 from public.class_memberships cm join public.santri s on s.id = cm.santri_id
      where cm.class_id = c.id and cm.status = 'active' and s.deleted_at is null and s.kategori = 'Anak')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.assistant_ai_digest_targets() from public, anon, authenticated;
grant execute on function public.assistant_ai_digest_targets() to service_role;

-- Data kelas sebagaimana dilihat guru tertentu (dipakai Edge Function untuk ringkasan pekanan).
create or replace function public.assistant_ai_class_data_as(p_user uuid, p_class uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_prev text := current_setting('request.jwt.claims', true);
  v_roster jsonb;
  v_result jsonb;
begin
  if auth.uid() is not null then
    raise exception 'SERVICE_ONLY' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  v_roster := public.get_assistant_class_roster(p_class);
  v_result := jsonb_build_object(
    'roster', v_roster,
    'snapshots', public.get_assistant_santri_snapshot(array(select (x->>'santri_id')::uuid from jsonb_array_elements(v_roster) x)),
    'items', coalesce(public.get_assistant_attention(p_class)->'items', '[]'::jsonb),
    'konteks', public.get_assistant_settings()#>>'{ai,konteks_lembaga}'
  );
  perform set_config('request.jwt.claims', coalesce(v_prev, ''), true);
  return v_result;
end;
$$;

revoke all on function public.assistant_ai_class_data_as(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assistant_ai_class_data_as(uuid, uuid) to service_role;

-- Pemicu pekanan: memanggil Edge Function assistant-ai dengan rahasia pengirim yang sama.
create or replace function public.assistant_ai_weekly_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if jsonb_array_length(public.assistant_ai_digest_targets()) = 0 then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'assistant_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'telegram_dispatch_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/assistant-ai',
    headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', v_secret),
    body := '{"action":"weekly_digest"}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.assistant_ai_weekly_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'assistant-ai-weekly') then
    perform cron.unschedule('assistant-ai-weekly');
  end if;
  -- Senin 06.30 WIB = Minggu 23.30 UTC.
  perform cron.schedule('assistant-ai-weekly', '30 23 * * 0', 'select public.assistant_ai_weekly_tick()');
end $$;

-- ===== Evaluasi (admin) =====

create or replace function public.get_assistant_ai_evaluation(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'INVALID_RANGE' using errcode = 'invalid_parameter_value';
  end if;
  v_from := p_from::timestamp at time zone 'Asia/Jakarta';
  v_to := (p_to + 1)::timestamp at time zone 'Asia/Jakarta';

  return jsonb_build_object(
    'pemakaian', (select coalesce(jsonb_agg(x order by x->>'fitur'), '[]'::jsonb) from (
      select jsonb_build_object('fitur', fitur,
        'ok', count(*) filter (where status in ('ok', 'uji')), 'cache', count(*) filter (where status = 'cache'),
        'gagal', count(*) filter (where status = 'gagal'), 'biaya_usd', round(coalesce(sum(biaya_usd), 0), 4),
        'pengguna', count(distinct user_id)) x
      from public.assistant_ai_usage where created_at >= v_from and created_at < v_to group by fitur) t),
    'biaya_bulanan', (select coalesce(jsonb_agg(x order by x->>'bulan'), '[]'::jsonb) from (
      select jsonb_build_object('bulan', to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM'),
        'biaya_usd', round(coalesce(sum(biaya_usd), 0), 4), 'permintaan', count(*) filter (where status = 'ok')) x
      from public.assistant_ai_usage where created_at >= v_from and created_at < v_to
      group by to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM')) t),
    'umpan_balik', (select coalesce(jsonb_agg(x order by x->>'jenis'), '[]'::jsonb) from (
      select jsonb_build_object('jenis', jenis, 'suka', count(*) filter (where nilai = 1), 'tidak_suka', count(*) filter (where nilai = -1)) x
      from public.assistant_ai_feedback where updated_at >= v_from and updated_at < v_to group by jenis) t),
    'peringatan', (
      with al as (
        select a.id, a.created_at,
          exists (select 1 from public.assistant_ai_recommendations r where a.id = any(r.alert_ids)) as dengan_ai,
          (select min(d.created_at) from public.assistant_alert_decisions d
            where d.alert_id = a.id and d.keputusan in ('ditangani', 'wali_dihubungi')) as ditindak
        from public.assistant_alerts a
        where not a.senyap and a.created_at >= v_from and a.created_at < v_to
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'kelompok', case when dengan_ai then 'dengan_saran_ai' else 'tanpa_saran_ai' end,
        'jumlah', n, 'ditindaklanjuti', d, 'median_hari', m) order by dengan_ai desc), '[]'::jsonb)
      from (
        select dengan_ai, count(*) n, count(ditindak) d,
          round((percentile_cont(0.5) within group (order by extract(epoch from ditindak - created_at) / 86400))::numeric, 1) m
        from al group by dengan_ai) g),
    'kontak_wali', (select count(*) from public.wali_followups where created_at >= v_from and created_at < v_to),
    'saran_santri', (select count(distinct santri_id) from public.assistant_ai_recommendations where created_at >= v_from and created_at < v_to),
    'percakapan', (select count(*) from public.assistant_ai_messages where role = 'user' and created_at >= v_from and created_at < v_to)
  );
end;
$$;

revoke all on function public.get_assistant_ai_evaluation(date, date) from public, anon;
grant execute on function public.get_assistant_ai_evaluation(date, date) to authenticated;
