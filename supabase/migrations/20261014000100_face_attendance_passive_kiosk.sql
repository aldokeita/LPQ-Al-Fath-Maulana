-- Pilot only. Passive kiosk attendance: a kiosk issues one challenge per passing santri plus
-- periodic refreshes, so the per-operator challenge limit rises from 12 to 40 per minute.
-- Matching also returns candidate distances to the service-role edge function for calibration
-- logging; the edge function never forwards them to the browser.
create or replace function public.pilot_face_operation(p_actor uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid; v_target uuid; v_ch biometric_private.challenges%rowtype;
  v_cfg biometric_private.calibration%rowtype;
  v_results jsonb; v_distances jsonb; v_sample jsonb; v_slot smallint:=0; v_revision uuid;
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
      and created_at>clock_timestamp()-interval '1 minute')>=40 then raise exception 'RATE_LIMITED'; end if;
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
    if v_results is null then return '{"state":"unknown"}'; end if;
    -- Distances go to the service-role edge function for calibration logs only; it strips them from responses.
    v_distances:=jsonb_build_object('bestDistance',v_results->0->'distance','secondDistance',v_results->1->'distance');
    if (v_results->0->>'distance')::numeric>v_cfg.max_distance then return jsonb_build_object('state','unknown')||v_distances; end if;
    if not (v_results->0->>'consistent')::boolean then return jsonb_build_object('state','ambiguous')||v_distances; end if;
    if jsonb_array_length(v_results)>1 and
      (v_results->1->>'distance')::numeric-(v_results->0->>'distance')::numeric<v_cfg.min_margin then
      return jsonb_build_object('state','ambiguous')||v_distances;
    end if;
    v_target:=(v_results->0->>'id')::uuid;
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
