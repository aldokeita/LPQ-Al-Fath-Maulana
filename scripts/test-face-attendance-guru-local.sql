\set ON_ERROR_STOP on
begin;
-- Synthetic guru face contract; everything rolls back. Existing calibration is set aside inside the
-- transaction so the rollback restores it.
delete from biometric_private.calibration;
do $$
declare
  a uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); g2 uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();
  s uuid:=gen_random_uuid(); cls uuid:=gen_random_uuid();
  ch jsonb; r jsonb; santri_capture jsonb; guru_capture jsonb; near_capture jsonb; v jsonb; rid uuid;
  consent jsonb:=jsonb_build_object('confirmed',true,'noticeVersion','TEST-GURU-1');
  model text:='faceapi-1.7.15-resnet128';
begin
  insert into auth.users(id,email) values(a,'TEST-gf-admin@local.invalid'),(g,'TEST-gf-guru@local.invalid'),
    (g2,'TEST-gf-guru2@local.invalid'),(p,'TEST-gf-pentashih@local.invalid'),(s,'TEST-gf-santri@local.invalid');
  insert into public.user_profiles(id,role,status) values(a,'admin','active'),(g,'guru','active'),(g2,'guru','active'),
    (p,'pentashih','active'),(s,'santri','active');
  insert into public.guru(id,nama,email,roles) values(g,'TEST GF Guru','TEST-gf-guru@local.invalid','{}'),
    (g2,'TEST GF Guru 2','TEST-gf-guru2@local.invalid','{}'),(p,'TEST GF Pentashih','TEST-gf-pentashih@local.invalid','{Pentashih}');
  insert into public.classes(id,nama_kelas,id_guru,sesi) values(cls,'TEST GF class',g,'Pagi');
  insert into public.santri(id,nomor_induk_qiroati,nama_lengkap,kategori,current_class_id,sesi_mengaji)
    values(s,'TESTGF01','TEST GF Student','Anak',cls,'Pagi');
  select jsonb_agg(0.01) into v from generate_series(1,128); select jsonb_agg(v) into santri_capture from generate_series(1,5);
  select jsonb_agg(case when i<=64 then 0.01 else 0.09 end) into v from generate_series(1,128) i;
  select jsonb_agg(v) into guru_capture from generate_series(1,5);
  select jsonb_agg(0.012) into v from generate_series(1,128); select jsonb_agg(v) into near_capture from generate_series(1,5);

  -- Who may self-enrol: an active guru row (guru or pentashih). Admin without a guru row and santri may not.
  begin perform public.pilot_face_operation(a,'challenge','{"purpose":"self_enroll"}'); raise exception 'TEST FAIL: admin without guru row';
  exception when raise_exception then if sqlerrm<>'ACTIVE_GURU_REQUIRED' then raise; end if; end;
  begin perform public.pilot_face_operation(s,'challenge','{"purpose":"self_enroll"}'); raise exception 'TEST FAIL: santri self-enrol';
  exception when insufficient_privilege then null; end;
  update public.guru set status='inactive' where id=g2;
  begin perform public.pilot_face_operation(g2,'challenge','{"purpose":"self_enroll"}'); raise exception 'TEST FAIL: inactive guru';
  exception when raise_exception then if sqlerrm<>'ACTIVE_GURU_REQUIRED' then raise; end if; end;
  update public.guru set status='active' where id=g2;

  -- Consent and challenge binding.
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"self_enroll"}');
  begin perform public.pilot_face_operation(g2,'self_enroll',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',guru_capture,'consent',consent));
    raise exception 'TEST FAIL: another guru used the challenge';
  exception when raise_exception then if sqlerrm<>'INVALID_CHALLENGE' then raise; end if; end;
  begin perform public.pilot_face_operation(g,'self_enroll',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',guru_capture,'consent','{}'::jsonb));
    raise exception 'TEST FAIL: missing consent accepted';
  exception when raise_exception then if sqlerrm<>'CONSENT_REQUIRED' then raise; end if; end;
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"self_enroll"}');
  begin perform public.pilot_face_operation(a,'enroll',jsonb_build_object('challengeId',ch->>'id','santriId',s,'modelVersion',model,'descriptors',guru_capture,'consent',consent));
    raise exception 'TEST FAIL: santri enrolment consumed a self challenge';
  exception when raise_exception then if sqlerrm<>'INVALID_CHALLENGE' then raise; end if; end;
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"self_enroll"}');
  r:=public.pilot_face_operation(g,'self_enroll',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',guru_capture,'consent',consent));
  if r->>'registered'<>'true' or (select count(*) from biometric_private.guru_samples where guru_id=g)<>5 then raise exception 'TEST FAIL: guru enrolment'; end if;
  if public.pilot_face_operation(g,'self_status','{}')->'enrollment'->>'registered'<>'true'
    or public.pilot_face_operation(g2,'self_status','{}')->'enrollment'->>'registered'<>'false' then raise exception 'TEST FAIL: self status'; end if;
  ch:=public.pilot_face_operation(p,'challenge','{"purpose":"self_enroll"}');
  perform public.pilot_face_operation(p,'self_enroll',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',near_capture,'consent',consent));
  ch:=public.pilot_face_operation(a,'challenge',jsonb_build_object('purpose','enroll','santriId',s));
  perform public.pilot_face_operation(a,'enroll',jsonb_build_object('challengeId',ch->>'id','santriId',s,'modelVersion',model,'descriptors',santri_capture,
    'consent',jsonb_build_object('confirmed',true,'guardianName','TEST Wali','date',current_date,'noticeVersion','TEST-1','formReference','TEST-FORM')));
  perform public.pilot_face_operation(a,'calibrate','{"maxDistance":0.4,"minMargin":0.1,"testReference":"TEST GURU SYNTHETIC ONLY"}');

  -- A guru face is matched for any kiosk operator and returns only the guru id.
  ch:=public.pilot_face_operation(g2,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g2,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',guru_capture));
  if r->>'state'<>'guru_matched' or r->>'guruId'<>g::text or r ? 'santriId' or r->>'bestDistance' is null then raise exception 'TEST FAIL: guru match %',r; end if;
  rid:=(r->>'receiptId')::uuid;
  r:=public.pilot_face_operation(g2,'resume',jsonb_build_object('receiptId',rid));
  if r->>'state'<>'guru_matched' or r->>'guruId'<>g::text then raise exception 'TEST FAIL: guru resume'; end if;
  -- A guru receipt can never record santri attendance, even for the santri's own class guru.
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',guru_capture));
  begin perform public.pilot_record_santri_attendance(g,s,(r->>'receiptId')::uuid,'face',clock_timestamp(),'Hadir','Pagi','Pagi',1);
    raise exception 'TEST FAIL: guru receipt recorded santri attendance';
  exception when raise_exception then if sqlerrm<>'INVALID_CHALLENGE' then raise; end if; end;
  if exists(select 1 from public.attendance where user_id in (g,s)) then raise exception 'TEST FAIL: attendance written by match'; end if;

  -- A santri and a near-identical pentashih compete in one ranking: ambiguous, never a guess.
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',santri_capture));
  if r->>'state'<>'ambiguous' then raise exception 'TEST FAIL: santri/guru ambiguity %',r->>'state'; end if;
  perform public.pilot_face_operation(p,'self_delete','{}');
  if exists(select 1 from biometric_private.guru_samples where guru_id=p) then raise exception 'TEST FAIL: self delete'; end if;
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',santri_capture));
  if r->>'state'<>'matched' or r->>'santriId'<>s::text then raise exception 'TEST FAIL: santri match after guru delete %',r->>'state'; end if;

  -- Inactive or deleted guru rows stop matching.
  update public.guru set status='inactive' where id=g;
  ch:=public.pilot_face_operation(g2,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g2,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion',model,'descriptors',guru_capture));
  if r->>'state'<>'unknown' then raise exception 'TEST FAIL: inactive guru matched'; end if;
  update public.guru set status='active' where id=g;
  update public.classes set id_guru=g2 where id=cls; delete from public.guru where id=g;
  if exists(select 1 from biometric_private.guru_enrollments where guru_id=g) then raise exception 'TEST FAIL: guru deletion cascade'; end if;
  raise notice 'Face guru SQL integration: self-enrol scope, consent, challenge binding, guru match, resume, receipt isolation, santri/guru ambiguity, self delete, inactive, cascade PASS';
end $$;
set local role authenticated;
do $$ begin
  begin perform 1 from biometric_private.guru_samples; raise exception 'TEST FAIL: guru template access';
  exception when insufficient_privilege then null; end;
  begin perform public.pilot_face_operation(gen_random_uuid(),'self_status','{}'); raise exception 'TEST FAIL: authenticated RPC access';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
