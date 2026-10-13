-- Pilot only. Apply to the local/test backend, never production without approval.
create extension if not exists vector with schema extensions;
create schema if not exists biometric_private;
revoke all on schema biometric_private from public, anon, authenticated;

create table biometric_private.enrollments (
  santri_id uuid primary key references public.santri(id) on delete cascade,
  revision uuid not null default gen_random_uuid(),
  model_version text not null check (model_version = 'faceapi-1.7.15-resnet128'),
  guardian_name text not null check (length(btrim(guardian_name)) between 1 and 150),
  consent_date date not null check (consent_date <= (now() at time zone 'Asia/Jakarta')::date),
  notice_version text not null check (length(btrim(notice_version)) between 1 and 100),
  form_reference text not null check (length(btrim(form_reference)) between 1 and 150),
  enrolled_by uuid not null references auth.users(id),
  enrolled_at timestamptz not null default now()
);
create table biometric_private.samples (
  santri_id uuid not null references biometric_private.enrollments(santri_id) on delete cascade,
  slot smallint not null check (slot between 0 and 4),
  embedding extensions.vector(128) not null,
  primary key (santri_id, slot)
);
create table biometric_private.challenges (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('enroll', 'attendance')),
  target_id uuid references public.santri(id) on delete cascade,
  first_direction text not null check (first_direction in ('left','right')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '45 seconds',
  used boolean not null default false,
  matched_id uuid references public.santri(id) on delete cascade,
  matched_revision uuid
);
create index on biometric_private.challenges(operator_id, created_at);
create table biometric_private.calibration (
  singleton boolean primary key default true check (singleton),
  model_version text not null check (model_version = 'faceapi-1.7.15-resnet128'),
  max_distance numeric not null check (max_distance > 0 and max_distance <= 0.6),
  min_margin numeric not null check (min_margin > 0 and min_margin < 1),
  test_reference text not null check (length(btrim(test_reference)) between 1 and 150),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table biometric_private.receipts (
  id uuid primary key,
  operator_id uuid not null references auth.users(id) on delete cascade,
  santri_id uuid not null references public.santri(id) on delete cascade,
  source text not null check (source in ('face','rfid')),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  points_award numeric not null,
  created boolean not null,
  created_at timestamptz not null default now()
);
alter table biometric_private.enrollments enable row level security;
alter table biometric_private.samples enable row level security;
alter table biometric_private.challenges enable row level security;
alter table biometric_private.calibration enable row level security;
alter table biometric_private.receipts enable row level security;
revoke all on all tables in schema biometric_private from public, anon, authenticated;
alter default privileges in schema biometric_private revoke all on tables from public, anon, authenticated;

alter table public.attendance drop constraint attendance_source_check;
alter table public.attendance add constraint attendance_source_check
  check (source in ('rfid','face','manual','correction','import'));

-- Only service-role endpoints can choose an actor. Existing helpers remain the
-- authority for roles and class scopes after the verified actor is installed.
create function biometric_private.install_actor(p_actor uuid, p_admin_only boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.user_profiles where id=p_actor and status='active') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
  if public.current_user_role() is null or public.current_user_role() not in ('admin','guru','pentashih')
     or (p_admin_only and not public.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
end $$;
revoke all on function biometric_private.install_actor(uuid,boolean) from public,anon,authenticated;

create function public.pilot_face_operation(p_actor uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid; v_target uuid; v_ch biometric_private.challenges%rowtype;
  v_cfg biometric_private.calibration%rowtype;
  v_results jsonb; v_sample jsonb; v_slot smallint:=0; v_revision uuid;
begin
  perform biometric_private.install_actor(p_actor,p_action in ('status','enroll','delete','calibrate'));
  if p_action in ('enroll','delete') then
    perform 1 from public.santri where id=(p_payload->>'santriId')::uuid for update;
  end if;
  if p_action='status' then
    v_target:=(p_payload->>'santriId')::uuid;
    select jsonb_build_object('registered',true,'enrolledAt',enrolled_at,
      'guardianName',guardian_name,'consentDate',consent_date,'noticeVersion',notice_version,
      'formReference',form_reference,'modelVersion',model_version)
      into v_results from biometric_private.enrollments where santri_id=v_target;
    return jsonb_build_object('enrollment',coalesce(v_results,'{"registered":false}'::jsonb),
      'calibration',(select jsonb_build_object('maxDistance',max_distance,'minMargin',min_margin,
      'testReference',test_reference) from biometric_private.calibration));
  elsif p_action='calibrate' then
    insert into biometric_private.calibration(singleton,model_version,max_distance,min_margin,test_reference,updated_by)
    values(true,'faceapi-1.7.15-resnet128',(p_payload->>'maxDistance')::numeric,
      (p_payload->>'minMargin')::numeric,p_payload->>'testReference',p_actor)
    on conflict(singleton) do update set max_distance=excluded.max_distance,min_margin=excluded.min_margin,
      test_reference=excluded.test_reference,updated_by=p_actor,updated_at=now();
    return '{"saved":true}';
  elsif p_action='delete' then
    update biometric_private.challenges set used=true where target_id=(p_payload->>'santriId')::uuid and purpose='enroll';
    delete from biometric_private.enrollments where santri_id=(p_payload->>'santriId')::uuid;
    return '{"deleted":true}';
  elsif p_action='resume' then
    select * into v_ch from biometric_private.challenges where id=(p_payload->>'receiptId')::uuid;
    if v_ch.id is null or v_ch.operator_id<>p_actor or not v_ch.used or v_ch.matched_id is null
      or v_ch.purpose<>'attendance' or v_ch.expires_at+interval '30 seconds'<clock_timestamp() then
      raise exception 'INVALID_CHALLENGE';
    end if;
    return jsonb_build_object('state','matched','santriId',v_ch.matched_id,'receiptId',v_ch.id);
  elsif p_action='inspect' then
    select * into v_ch from biometric_private.challenges where id=(p_payload->>'challengeId')::uuid;
    if v_ch.id is null or v_ch.operator_id<>p_actor or v_ch.used or v_ch.expires_at<clock_timestamp() then
      raise exception 'INVALID_CHALLENGE';
    end if;
    return jsonb_build_object('firstDirection',v_ch.first_direction,'purpose',v_ch.purpose);
  elsif p_action='challenge' then
    if p_payload->>'purpose'='enroll' then
      perform biometric_private.install_actor(p_actor,true);
      v_target:=(p_payload->>'santriId')::uuid;
      if not exists(select 1 from public.santri where id=v_target and deleted_at is null
        and lower(coalesce(status,'')) in ('aktif','active')) then raise exception 'ACTIVE_SANTRI_REQUIRED'; end if;
    end if;
    delete from biometric_private.challenges where expires_at<clock_timestamp()-interval '10 minutes';
    delete from biometric_private.receipts where created_at<clock_timestamp()-interval '1 day';
    perform pg_advisory_xact_lock(hashtextextended('face-rate:'||p_actor::text,0));
    if (select count(*) from biometric_private.challenges where operator_id=p_actor
      and created_at>clock_timestamp()-interval '1 minute')>=12 then raise exception 'RATE_LIMITED'; end if;
    insert into biometric_private.challenges(operator_id,purpose,target_id,first_direction)
      values(p_actor,p_payload->>'purpose',v_target,
        case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end)
      returning * into v_ch;
    return jsonb_build_object('id',v_ch.id,'firstDirection',v_ch.first_direction,'expiresAt',v_ch.expires_at);
  elsif p_action in ('enroll','match') then
    select * into v_ch from biometric_private.challenges where id=(p_payload->>'challengeId')::uuid for update;
    if v_ch.id is null or v_ch.operator_id<>p_actor or v_ch.used or v_ch.expires_at<clock_timestamp()
      or v_ch.purpose<>(case when p_action='enroll' then 'enroll' else 'attendance' end) then
      raise exception 'INVALID_CHALLENGE';
    end if;
    update biometric_private.challenges set used=true where id=v_ch.id;
    if p_payload->>'modelVersion' is distinct from 'faceapi-1.7.15-resnet128' or
      jsonb_typeof(p_payload->'descriptors') is distinct from 'array' or jsonb_array_length(p_payload->'descriptors') is distinct from 5 then
      raise exception 'INVALID_CAPTURE';
    end if;
    for v_sample in select value from jsonb_array_elements(p_payload->'descriptors') loop
      if jsonb_typeof(v_sample)<>'array' or jsonb_array_length(v_sample)<>128 then raise exception 'INVALID_CAPTURE'; end if;
      perform v_sample::text::extensions.vector(128);
    end loop;
    if p_action='enroll' then
      if v_ch.target_id is distinct from (p_payload->>'santriId')::uuid or p_payload->'consent'->>'confirmed' is distinct from 'true'
        or not exists(select 1 from public.santri where id=v_ch.target_id and deleted_at is null
          and lower(coalesce(status,'')) in ('aktif','active')) then raise exception 'CONSENT_REQUIRED'; end if;
      insert into biometric_private.enrollments(santri_id,model_version,guardian_name,consent_date,
        notice_version,form_reference,enrolled_by)
        values(v_ch.target_id,'faceapi-1.7.15-resnet128',p_payload->'consent'->>'guardianName',
        (p_payload->'consent'->>'date')::date,p_payload->'consent'->>'noticeVersion',
        p_payload->'consent'->>'formReference',p_actor)
      on conflict(santri_id) do update set revision=gen_random_uuid(),guardian_name=excluded.guardian_name,
        consent_date=excluded.consent_date,notice_version=excluded.notice_version,
        form_reference=excluded.form_reference,enrolled_by=p_actor,enrolled_at=now();
      delete from biometric_private.samples where santri_id=v_ch.target_id;
      for v_sample in select value from jsonb_array_elements(p_payload->'descriptors') loop
        insert into biometric_private.samples values(v_ch.target_id,v_slot,v_sample::text::extensions.vector(128));
        v_slot:=v_slot+1;
      end loop;
      return '{"registered":true}';
    end if;
    select * into v_cfg from biometric_private.calibration;
    if v_cfg.singleton is null then return '{"state":"calibration_required"}'; end if;
    with probes as (
      select ordinality,value::text::extensions.vector(128) as embedding
      from jsonb_array_elements(p_payload->'descriptors') with ordinality
    ), distances as (
      select s.santri_id,p.ordinality,min(s.embedding operator(extensions.<->) p.embedding) as distance
      from biometric_private.samples s cross join probes p
      join biometric_private.enrollments e on e.santri_id=s.santri_id
      join public.santri st on st.id=s.santri_id
      where e.model_version=v_cfg.model_version and st.deleted_at is null
        and lower(coalesce(st.status,'')) in ('aktif','active')
      group by s.santri_id,p.ordinality
    ), ranked as (
      select d.santri_id,max(d.distance) as distance,
        bool_and(d.distance=(select min(d2.distance) from distances d2 where d2.ordinality=d.ordinality)) as consistent
      from distances d group by d.santri_id order by max(d.distance),d.santri_id limit 2
    ) select jsonb_agg(jsonb_build_object('id',santri_id,'distance',distance,'consistent',consistent) order by distance,santri_id)
      into v_results from ranked;
    if v_results is null or (v_results->0->>'distance')::numeric>v_cfg.max_distance then return '{"state":"unknown"}'; end if;
    if not (v_results->0->>'consistent')::boolean then return '{"state":"ambiguous"}'; end if;
    if jsonb_array_length(v_results)>1 and
      (v_results->1->>'distance')::numeric-(v_results->0->>'distance')::numeric<v_cfg.min_margin then
      return '{"state":"ambiguous"}';
    end if;
    v_target:=(v_results->0->>'id')::uuid;
    if not (public.is_admin() or public.guru_has_class_access((select current_class_id from public.santri where id=v_target))
      or public.pentashih_has_class_access((select current_class_id from public.santri where id=v_target))) then
      return '{"state":"unknown"}';
    end if;
    select revision into v_revision from biometric_private.enrollments where santri_id=v_target;
    update biometric_private.challenges set matched_id=v_target,matched_revision=v_revision where id=v_ch.id;
    return jsonb_build_object('state','matched','santriId',v_target,'receiptId',v_ch.id);
  end if;
  raise exception 'INVALID_ACTION';
end $$;
revoke all on function public.pilot_face_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.pilot_face_operation(uuid,text,jsonb) to service_role;

create function public.pilot_record_santri_attendance(p_actor uuid,p_santri uuid,p_receipt uuid,
  p_source text,p_when timestamptz,p_status text,p_assigned text,p_actual text,p_award numeric)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare
  v_student public.santri%rowtype; v_row public.attendance%rowtype;
  v_day date:=(p_when at time zone 'Asia/Jakarta')::date;
  v_receipt biometric_private.receipts%rowtype; v_created boolean:=false; v_award numeric:=0; v_revision uuid;
begin
  perform biometric_private.install_actor(p_actor);
  select * into v_student from public.santri where id=p_santri for update;
  if v_student.id is null or v_student.deleted_at is not null or lower(coalesce(v_student.status,'')) not in ('aktif','active') then
    raise exception 'ACTIVE_SANTRI_REQUIRED';
  end if;
  if not (public.is_admin() or public.guru_has_class_access(v_student.current_class_id)
    or public.pentashih_has_class_access(v_student.current_class_id)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_source not in ('rfid','face') or p_status not in ('Hadir','Terlambat') or p_actual is null
    or p_award not in (0,0.5,1,2) or abs(extract(epoch from clock_timestamp()-p_when))>60 then raise exception 'INVALID_RECORD'; end if;
  if p_source='face' then
    -- Serialize revocation/re-enrollment with the final attendance commit.
    select revision into v_revision from biometric_private.enrollments where santri_id=p_santri for share;
  end if;
  if p_source='face' and not exists(select 1 from biometric_private.challenges c
    join biometric_private.enrollments e on e.santri_id=c.matched_id and e.revision=c.matched_revision
    where c.id=p_receipt and c.operator_id=p_actor and c.matched_id=p_santri and c.used and c.purpose='attendance'
      and c.expires_at+interval '30 seconds'>clock_timestamp()) then raise exception 'INVALID_CHALLENGE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_santri::text||':'||v_day::text,0));
  select * into v_receipt from biometric_private.receipts where id=p_receipt;
  if v_receipt.id is not null then
    if v_receipt.operator_id<>p_actor or v_receipt.santri_id<>p_santri or v_receipt.source<>p_source then
      raise exception 'INVALID_RECEIPT';
    end if;
    select * into v_row from public.attendance where id=v_receipt.attendance_id;
    return jsonb_build_object('attendance',to_jsonb(v_row)-array['correction_reason','corrected_by','created_by','updated_by','created_at','updated_at','user_id','role'],
      'created',v_receipt.created,'points',v_student.points,'pointsAward',v_receipt.points_award);
  end if;
  select * into v_row from public.attendance where user_id=p_santri and attendance_date=v_day
    order by check_in_timestamp asc nulls last,created_at asc limit 1 for update;
  if v_row.id is null or lower(v_row.status) in ('tidak hadir','alpha','ghaib','absen') then
    v_created:=true;
    v_award:=case when lower(coalesce(v_student.kategori,''))='dewasa' then 0 else p_award end;
    if v_row.id is not null then
      update public.attendance set check_in_timestamp=p_when,check_in_time=(date_trunc('second',p_when) at time zone 'Asia/Jakarta')::time,
        class_id=v_student.current_class_id,sesi=p_assigned,attended_session=p_actual,status=p_status,source=p_source,
        updated_by=p_actor where id=v_row.id returning * into v_row;
    else
      insert into public.attendance(user_id,role,attendance_date,check_in_time,check_in_timestamp,class_id,sesi,
        attended_session,status,source,created_by,updated_by)
      values(p_santri,'santri',v_day,(date_trunc('second',p_when) at time zone 'Asia/Jakarta')::time,p_when,v_student.current_class_id,
        p_assigned,p_actual,p_status,p_source,p_actor,p_actor) returning * into v_row;
    end if;
    if v_award>0 then
      update public.santri set points=coalesce(points,0)+v_award,updated_by=p_actor where id=p_santri returning * into v_student;
    end if;
  end if;
  insert into biometric_private.receipts values(p_receipt,p_actor,p_santri,p_source,v_row.id,v_award,v_created,now());
  return jsonb_build_object('attendance',to_jsonb(v_row)-array['correction_reason','corrected_by','created_by','updated_by','created_at','updated_at','user_id','role'],
    'created',v_created,'points',v_student.points,'pointsAward',v_award);
end $$;
revoke all on function public.pilot_record_santri_attendance(uuid,uuid,uuid,text,timestamptz,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.pilot_record_santri_attendance(uuid,uuid,uuid,text,timestamptz,text,text,text,numeric) to service_role;
