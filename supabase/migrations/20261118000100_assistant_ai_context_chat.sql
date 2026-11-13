-- Asisten tahap 3b: pengetahuan lembaga, profil santri lengkap, saran kelas, dan chatbot guru.
--
-- Pengetahuan dasar LPQ & Qiroati disimpan di pengaturan (ai.konteks_lembaga) dan bisa diubah admin.
-- Profil santri dan daftar kelas dibaca lewat RPC dengan aturan akses panel (admin semua, guru
-- kelasnya, kosong untuk guru saat mode senyap). Edge Function assistant-ai menyamarkan nama
-- sebelum dikirim ke penyedia AI. Percakapan chatbot hanya bisa dibaca pemiliknya.

create or replace function public.assistant_default_konteks()
returns text
language sql
immutable
as $k$ select $t$LPQ Al-Fath Maulana adalah lembaga pendidikan Al-Qur'an (TPQ) yang memakai metode Qiroati. Asisten ini membantu guru TPQ anak (kategori Anak) yang mengaji Senin–Jumat.

Metode Qiroati:
- Santri belajar membaca Al-Qur'an langsung dengan tartil sesuai kaidah tajwid, tanpa mengeja.
- Urutan tingkat di lembaga ini: Pra TK A, B, C; Jilid 1A–1C, 2A–2B, 3A–3B, 4A–4B, 5A–5B, Jilid Juz 27, 6A–6B; lalu Al-Qur'an, Ghorib Tajwid, dan Finishing.
- Santri naik jilid hanya bila bacaannya sudah lancar dan benar pada jilid saat ini dan lulus tes kenaikan oleh pentashih. Santri tidak dipaksa naik bila belum siap; yang dicari adalah penyebab tertahan dan latihan yang tepat.
- Prinsip santri: Lancar, Cepat, Tepat, Benar (LCTB). Prinsip guru: Teliti, Waspada, Tegas (TIWAGAS).

Penilaian di aplikasi:
- Hafalan pendamping (Doa harian, bacaan Sholat, Surat pendek, Tahfizh) dinilai skor 1–4; skor 4 berarti sudah hafal/aman, skor 1–3 masih perlu dilatih.
- Karakter dinilai skor 1–4 per indikator: 1 Belum Berkembang, 2 Mulai Berkembang, 3 Berkembang Sesuai Harapan, 4 Sangat Berkembang. Guru juga memilih kekuatan karakter santri.
- Catatan perilaku bertingkat Ringan, Sedang, Berat, masing-masing dengan tindak lanjut (nasihat; pembinaan dan kabar ke orang tua; pertemuan dengan orang tua dan keputusan kepala LPQ).
- Poin gamifikasi diperoleh santri dari kehadiran dan kegiatan; cocok dipakai untuk apresiasi, bukan hukuman.
- Kehadiran dicatat otomatis lewat kartu RFID atau wajah; guru hanya mengoreksi bila santri sebenarnya hadir.

Gaya saran yang diharapkan: lembut dan beradab, menguatkan anak dan orang tua, memakai apresiasi sebelum koreksi, dan selalu bisa dilakukan guru di sesi mengaji atau bersama wali.$t$ $k$;

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
       "daily_limit_per_user": 40}'::jsonb) || jsonb_build_object('konteks_lembaga', public.assistant_default_konteks()));
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
     or length(v#>>'{ai,konteks_lembaga}') > 6000 then
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



-- ===== Daftar kelas & profil untuk AI =====

create or replace function public.get_assistant_ai_classes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and public.assistant_silent_mode() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'nama_kelas', c.nama_kelas) order by c.nama_kelas)
    from public.classes c
    where c.deleted_at is null
      and (v_admin or public.guru_has_class_access(c.id))
      and exists (
        select 1 from public.class_memberships cm join public.santri s on s.id = cm.santri_id
        where cm.class_id = c.id and cm.status = 'active' and s.deleted_at is null and s.kategori = 'Anak')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_assistant_ai_classes() from public, anon;
grant execute on function public.get_assistant_ai_classes() to authenticated;

-- Ringkasan per santri satu kelas (TPQ anak). Nama dikembalikan hanya untuk penyamaran di server.
create or replace function public.get_assistant_class_roster(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and not public.guru_has_class_access(p_class_id) then
    raise exception 'CLASS_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  if not v_admin and public.assistant_silent_mode() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'santri_id', s.id,
      'nama_lengkap', s.nama_lengkap,
      'nama_panggilan', s.nama_panggilan,
      'jenis_kelamin', s.jenis_kelamin,
      'usia', case when s.tanggal_lahir is not null then extract(year from age(public.jakarta_today(), s.tanggal_lahir))::int end,
      'poin', round(coalesce(s.points, 0)::numeric, 1),
      'karakter_rata', (select round(avg(cs.score)::numeric, 1) from public.santri_character_scores cs where cs.santri_id = s.id),
      'kekuatan', (select coalesce(jsonb_agg(st.strength_key), '[]'::jsonb) from public.santri_character_strengths st where st.santri_id = s.id),
      'perilaku_90_hari', (select count(*) from public.santri_behavior_records b
                            where b.santri_id = s.id and b.incident_date >= public.jakarta_today() - 90)
    ) order by s.nama_lengkap)
    from public.class_memberships cm
    join public.santri s on s.id = cm.santri_id
    where cm.class_id = p_class_id and cm.status = 'active' and s.deleted_at is null and s.kategori = 'Anak'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_assistant_class_roster(uuid) from public, anon;
grant execute on function public.get_assistant_class_roster(uuid) to authenticated;

-- Profil lengkap satu santri: hafalan, karakter, perilaku, catatan, riwayat jilid, poin.
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
      from (select * from public.hafalan_progress where santri_id = s.id order by updated_at desc limit 120) p
      left join public.hafalan_items i on i.id = p.item_id),
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

-- ===== Saran kelas =====

create table public.assistant_ai_class_insights (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  input_hash text not null,
  provider text not null,
  model text not null,
  hasil jsonb not null,
  kode_santri jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index assistant_ai_class_insights_class_idx on public.assistant_ai_class_insights (class_id, created_at desc);

alter table public.assistant_ai_class_insights enable row level security;
revoke all on public.assistant_ai_class_insights from anon, authenticated;
grant select on public.assistant_ai_class_insights to authenticated;
create policy assistant_ai_class_insights_select on public.assistant_ai_class_insights
  for select to authenticated
  using (public.is_admin() or (not public.assistant_silent_mode() and public.guru_has_class_access(class_id)));

-- ===== Chatbot =====

create table public.assistant_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  santri_id uuid references public.santri(id) on delete set null,
  judul text not null default 'Percakapan baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_ai_conversations_user_idx on public.assistant_ai_conversations (user_id, updated_at desc);

create table public.assistant_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 8000),
  created_at timestamptz not null default now()
);

create index assistant_ai_messages_conversation_idx on public.assistant_ai_messages (conversation_id, created_at);

alter table public.assistant_ai_conversations enable row level security;
alter table public.assistant_ai_messages enable row level security;
revoke all on public.assistant_ai_conversations, public.assistant_ai_messages from anon, authenticated;
grant select, delete on public.assistant_ai_conversations to authenticated;
grant select on public.assistant_ai_messages to authenticated;
create policy assistant_ai_conversations_own on public.assistant_ai_conversations
  for select to authenticated using (user_id = auth.uid());
create policy assistant_ai_conversations_delete_own on public.assistant_ai_conversations
  for delete to authenticated using (user_id = auth.uid());
create policy assistant_ai_messages_own on public.assistant_ai_messages
  for select to authenticated using (exists (
    select 1 from public.assistant_ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
