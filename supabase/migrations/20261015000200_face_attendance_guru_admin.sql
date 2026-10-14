-- Pilot only. Admins can also register a guru's face from Manajemen Guru, attesting the guru's consent,
-- alongside the guru's own self-enrolment. Each enrolment records who registered it and how consent
-- was given. Matching and attendance are unchanged.
alter table biometric_private.guru_enrollments
  add column consent_source text not null default 'self' check (consent_source in ('self','admin')),
  add column enrolled_by uuid references auth.users(id) on delete set null;
update biometric_private.guru_enrollments set enrolled_by=guru_id where enrolled_by is null;
alter table biometric_private.challenges drop constraint challenges_purpose_check;
alter table biometric_private.challenges add constraint challenges_purpose_check
  check (purpose in ('enroll', 'self_enroll', 'guru_enroll', 'attendance'));

create or replace function public.pilot_face_operation(p_actor uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid; v_target uuid; v_kind text; v_ch biometric_private.challenges%rowtype;
  v_cfg biometric_private.calibration%rowtype;
  v_results jsonb; v_distances jsonb; v_sample jsonb; v_slot smallint:=0; v_revision uuid;
begin
  perform biometric_private.install_actor(p_actor,p_action in ('status','enroll','delete','calibrate','guru_status','guru_enroll','guru_delete'));
  if p_action in ('enroll','delete') then
    perform 1 from public.santri where id=(p_payload->>'santriId')::uuid for update;
  end if;
  -- Self-service actions act only on the caller's own guru row.
  if p_action in ('self_status','self_enroll','self_delete')
    or (p_action='challenge' and p_payload->>'purpose'='self_enroll') then
    perform 1 from public.guru where id=p_actor and deleted_at is null and status='active' for update;
    if not found then raise exception 'ACTIVE_GURU_REQUIRED'; end if;
  end if;
  -- Admin actions on another guru's face need that guru's row to be active.
  if p_action in ('guru_enroll','guru_delete') or (p_action='challenge' and p_payload->>'purpose'='guru_enroll') then
    perform 1 from public.guru where id=(p_payload->>'guruId')::uuid and deleted_at is null and status='active' for update;
    if not found then raise exception 'ACTIVE_GURU_REQUIRED'; end if;
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
  elsif p_action in ('self_status','guru_status') then
    select jsonb_build_object('registered',true,'enrolledAt',enrolled_at,'noticeVersion',notice_version,
      'consentSource',consent_source,'modelVersion',model_version) into v_results from biometric_private.guru_enrollments
      where guru_id=case when p_action='self_status' then p_actor else (p_payload->>'guruId')::uuid end;
    return jsonb_build_object('enrollment',coalesce(v_results,'{"registered":false}'::jsonb));
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
  elsif p_action in ('self_delete','guru_delete') then
    v_target:=case when p_action='self_delete' then p_actor else (p_payload->>'guruId')::uuid end;
    update biometric_private.challenges set used=true where target_guru_id=v_target and purpose in ('self_enroll','guru_enroll');
    delete from biometric_private.guru_enrollments where guru_id=v_target;
    return '{"deleted":true}';
  elsif p_action='resume' then
    select * into v_ch from biometric_private.challenges where id=(p_payload->>'receiptId')::uuid;
    if v_ch.id is null or v_ch.operator_id<>p_actor or not v_ch.used
      or (v_ch.matched_id is null and v_ch.matched_guru_id is null)
      or v_ch.purpose<>'attendance' or v_ch.expires_at+interval '30 seconds'<clock_timestamp() then
      raise exception 'INVALID_CHALLENGE';
    end if;
    if v_ch.matched_guru_id is not null then
      return jsonb_build_object('state','guru_matched','guruId',v_ch.matched_guru_id,'receiptId',v_ch.id);
    end if;
    return jsonb_build_object('state','matched','santriId',v_ch.matched_id,'receiptId',v_ch.id);
  elsif p_action='inspect' then
    select * into v_ch from biometric_private.challenges where id=(p_payload->>'challengeId')::uuid;
    if v_ch.id is null or v_ch.operator_id<>p_actor or v_ch.used or v_ch.expires_at<clock_timestamp() then
      raise exception 'INVALID_CHALLENGE';
    end if;
    return jsonb_build_object('firstDirection',v_ch.first_direction,'purpose',v_ch.purpose);
  elsif p_action='challenge' then
    if coalesce(p_payload->>'purpose','') not in ('enroll','self_enroll','guru_enroll','attendance') then raise exception 'INVALID_CAPTURE'; end if;
    if p_payload->>'purpose'='guru_enroll' then perform biometric_private.install_actor(p_actor,true); end if;
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
      and created_at>clock_timestamp()-interval '1 minute')>=40 then raise exception 'RATE_LIMITED'; end if;
    insert into biometric_private.challenges(operator_id,purpose,target_id,target_guru_id,first_direction)
      values(p_actor,p_payload->>'purpose',v_target,
        case p_payload->>'purpose' when 'self_enroll' then p_actor when 'guru_enroll' then (p_payload->>'guruId')::uuid end,
        case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end)
      returning * into v_ch;
    return jsonb_build_object('id',v_ch.id,'firstDirection',v_ch.first_direction,'expiresAt',v_ch.expires_at);
  elsif p_action in ('enroll','self_enroll','guru_enroll','match') then
    select * into v_ch from biometric_private.challenges where id=(p_payload->>'challengeId')::uuid for update;
    if v_ch.id is null or v_ch.operator_id<>p_actor or v_ch.used or v_ch.expires_at<clock_timestamp()
      or v_ch.purpose<>(case p_action when 'match' then 'attendance' else p_action end) then
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
    elsif p_action in ('self_enroll','guru_enroll') then
      -- self_enroll: the guru consents for themself. guru_enroll: an admin attests the guru's consent.
      v_target:=case when p_action='self_enroll' then p_actor else (p_payload->>'guruId')::uuid end;
      if v_ch.target_guru_id is distinct from v_target or p_payload->'consent'->>'confirmed' is distinct from 'true'
        or length(btrim(coalesce(p_payload->'consent'->>'noticeVersion',''))) not between 1 and 100 then
        raise exception 'CONSENT_REQUIRED';
      end if;
      insert into biometric_private.guru_enrollments(guru_id,model_version,notice_version,consent_source,enrolled_by)
        values(v_target,'faceapi-1.7.15-resnet128',p_payload->'consent'->>'noticeVersion',
          case when p_action='self_enroll' then 'self' else 'admin' end,p_actor)
      on conflict(guru_id) do update set revision=gen_random_uuid(),notice_version=excluded.notice_version,
        consent_source=excluded.consent_source,enrolled_by=excluded.enrolled_by,consented_at=now(),enrolled_at=now();
      delete from biometric_private.guru_samples where guru_id=v_target;
      for v_sample in select value from jsonb_array_elements(p_payload->'descriptors') loop
        insert into biometric_private.guru_samples values(v_target,v_slot,v_sample::text::extensions.vector(128));
        v_slot:=v_slot+1;
      end loop;
      return '{"registered":true}';
    end if;
    select * into v_cfg from biometric_private.calibration;
    if v_cfg.singleton is null then return '{"state":"calibration_required"}'; end if;
    -- Santri and guru compete in one ranking, so the margin test also separates a santri from a guru.
    with probes as (
      select ordinality,value::text::extensions.vector(128) as embedding
      from jsonb_array_elements(p_payload->'descriptors') with ordinality
    ), candidates as (
      select 'santri'::text as kind,s.santri_id as id,s.embedding
      from biometric_private.samples s
      join biometric_private.enrollments e on e.santri_id=s.santri_id
      join public.santri st on st.id=s.santri_id
      where e.model_version=v_cfg.model_version and st.deleted_at is null
        and lower(coalesce(st.status,'')) in ('aktif','active')
      union all
      select 'guru',g.guru_id,g.embedding
      from biometric_private.guru_samples g
      join biometric_private.guru_enrollments ge on ge.guru_id=g.guru_id
      join public.guru gr on gr.id=g.guru_id
      where ge.model_version=v_cfg.model_version and gr.deleted_at is null and gr.status='active'
    ), distances as (
      select c.kind,c.id,p.ordinality,min(c.embedding operator(extensions.<->) p.embedding) as distance
      from candidates c cross join probes p
      group by c.kind,c.id,p.ordinality
    ), ranked as (
      select d.kind,d.id,max(d.distance) as distance,
        bool_and(d.distance=(select min(d2.distance) from distances d2 where d2.ordinality=d.ordinality)) as consistent
      from distances d group by d.kind,d.id order by max(d.distance),d.id limit 2
    ) select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'distance',distance,'consistent',consistent) order by distance,id)
      into v_results from ranked;
    if v_results is null then return '{"state":"unknown"}'; end if;
    -- Distances go to the service-role edge function for calibration logs only; it strips them from responses.
    v_distances:=jsonb_build_object('bestDistance',v_results->0->'distance','secondDistance',v_results->1->'distance');
    if (v_results->0->>'distance')::numeric>v_cfg.max_distance then return jsonb_build_object('state','unknown')||v_distances; end if;
    if not (v_results->0->>'consistent')::boolean then return jsonb_build_object('state','ambiguous')||v_distances; end if;
    if jsonb_array_length(v_results)>1 and
      (v_results->1->>'distance')::numeric-(v_results->0->>'distance')::numeric<v_cfg.min_margin then
      return jsonb_build_object('state','ambiguous')||v_distances;
    end if;
    v_target:=(v_results->0->>'id')::uuid; v_kind:=v_results->0->>'kind';
    if v_kind='guru' then
      -- Every kiosk operator (admin, guru, pentashih) may already look a guru up by RFID tag.
      select revision into v_revision from biometric_private.guru_enrollments where guru_id=v_target;
      update biometric_private.challenges set matched_guru_id=v_target,matched_revision=v_revision where id=v_ch.id;
      return jsonb_build_object('state','guru_matched','guruId',v_target,'receiptId',v_ch.id)||v_distances;
    end if;
    if not (public.is_admin() or public.guru_has_class_access((select current_class_id from public.santri where id=v_target))
      or public.pentashih_has_class_access((select current_class_id from public.santri where id=v_target))) then
      return '{"state":"unknown"}';
    end if;
    select revision into v_revision from biometric_private.enrollments where santri_id=v_target;
    update biometric_private.challenges set matched_id=v_target,matched_revision=v_revision where id=v_ch.id;
    return jsonb_build_object('state','matched','santriId',v_target,'receiptId',v_ch.id)||v_distances;
  end if;
  raise exception 'INVALID_ACTION';
end $$;
revoke all on function public.pilot_face_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.pilot_face_operation(uuid,text,jsonb) to service_role;
