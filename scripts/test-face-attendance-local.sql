\set ON_ERROR_STOP on
begin;
-- Isolate the synthetic browser fixture in this transaction; rollback restores it.
delete from biometric_private.enrollments where form_reference='TEST UI SYNTHETIC ONLY';
delete from biometric_private.calibration where test_reference='TEST UI SYNTHETIC ONLY';
do $$
declare
  a uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); g2 uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
  cls uuid:=gen_random_uuid(); ch jsonb; capture jsonb; vector jsonb; r jsonb; rid uuid; aid uuid; day date;
begin
  insert into auth.users(id,email) values(a,'TEST-face-admin@local.invalid'),(g,'TEST-face-guru@local.invalid'),
    (g2,'TEST-face-other@local.invalid'),(s,'TEST-face-santri@local.invalid'),(s2,'TEST-face-second@local.invalid');
  insert into public.user_profiles(id,role,status) values(a,'admin','active'),(g,'guru','active'),(g2,'guru','active'),(s,'santri','active'),(s2,'santri','active');
  insert into public.guru(id,nama,email) values(g,'TEST Guru','TEST-face-guru@local.invalid'),(g2,'TEST Guru 2','TEST-face-other@local.invalid');
  insert into public.classes(id,nama_kelas,id_guru,sesi) values(cls,'TEST Face class',g,'Pagi');
  insert into public.santri(id,nomor_induk_qiroati,nama_lengkap,kategori,current_class_id,sesi_mengaji)
    values(s,'TESTFACE01','TEST Face Student','Anak',cls,'Pagi'),(s2,'TESTFACE02','TEST Face Student 2','Anak',cls,'Pagi');
  select jsonb_agg(0.01) into vector from generate_series(1,128);
  select jsonb_agg(vector) into capture from generate_series(1,5);
  ch:=public.pilot_face_operation(a,'challenge',jsonb_build_object('purpose','enroll','santriId',s));
  begin
    perform public.pilot_face_operation(g,'enroll',jsonb_build_object('challengeId',ch->>'id'));
    raise exception 'TEST FAIL: guru enrollment accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.pilot_face_operation(a,'enroll',jsonb_build_object('challengeId',ch->>'id','santriId',s,
      'modelVersion','faceapi-1.7.15-resnet128','descriptors',capture,'consent','{}'::jsonb));
    raise exception 'TEST FAIL: missing consent accepted';
  exception when raise_exception then if sqlerrm<>'CONSENT_REQUIRED' then raise; end if; end;
  r:=public.pilot_face_operation(a,'enroll',jsonb_build_object('challengeId',ch->>'id','santriId',s,
    'modelVersion','faceapi-1.7.15-resnet128','descriptors',capture,
    'consent',jsonb_build_object('confirmed',true,'guardianName','TEST Wali','date',current_date,'noticeVersion','TEST-1','formReference','TEST-FORM')));
  if r->>'registered'<>'true' or (select count(*) from biometric_private.samples where santri_id=s)<>5 then raise exception 'TEST FAIL: enrollment'; end if;
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion','faceapi-1.7.15-resnet128','descriptors',capture));
  -- No saved calibration: the built-in defaults (0.40 / 0.08) apply.
  if r->>'state'<>'matched' or r->>'santriId'<>s::text then raise exception 'TEST FAIL: default calibration matching %',r->>'state'; end if;
  if public.pilot_face_operation(a,'status',jsonb_build_object('santriId',s))->'defaultCalibration'->>'maxDistance'<>'0.40' then raise exception 'TEST FAIL: default calibration status'; end if;
  perform public.pilot_face_operation(a,'calibrate','{"maxDistance":0.4,"minMargin":0.1,"testReference":"TEST SYNTHETIC ONLY"}');
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion','faceapi-1.7.15-resnet128','descriptors',capture));
  if r->>'state'<>'matched' or r->>'santriId'<>s::text then raise exception 'TEST FAIL: valid matching %',r->>'state'; end if;
  rid:=(r->>'receiptId')::uuid;
  r:=public.pilot_record_santri_attendance(g,s,rid,'face',clock_timestamp(),'Terlambat','Pagi','Pagi',0.5);
  aid:=(r->'attendance'->>'id')::uuid;day:=(r->'attendance'->>'attendance_date')::date;
  if r->>'pointsAward'<>'0.5' or (select points from public.santri where id=s)<>0.5 then raise exception 'TEST FAIL: fractional point'; end if;
  r:=public.pilot_record_santri_attendance(g,s,gen_random_uuid(),'rfid',clock_timestamp(),'Hadir','Pagi','Pagi',1);
  if (r->>'created')::boolean or (r->'attendance'->>'id')::uuid<>aid or (select points from public.santri where id=s)<>0.5 then raise exception 'TEST FAIL: cross-method duplicate'; end if;
  r:=public.pilot_record_santri_attendance(g,s,rid,'face',clock_timestamp(),'Hadir','Pagi','Pagi',1);
  if (select points from public.santri where id=s)<>0.5 then raise exception 'TEST FAIL: receipt retry award'; end if;
  begin
    perform public.pilot_record_santri_attendance(g2,s,gen_random_uuid(),'rfid',clock_timestamp(),'Hadir','Pagi','Pagi',1);
    raise exception 'TEST FAIL: out-of-scope guru accepted';
  exception when insufficient_privilege then null; end;
  update public.santri set status='Nonaktif' where id=s;
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion','faceapi-1.7.15-resnet128','descriptors',capture));
  if r->>'state'<>'unknown' then raise exception 'TEST FAIL: inactive recognized'; end if;
  update public.santri set status='Aktif' where id=s;
  insert into biometric_private.enrollments(santri_id,model_version,guardian_name,consent_date,notice_version,form_reference,enrolled_by)
    values(s2,'faceapi-1.7.15-resnet128','TEST Wali',current_date,'TEST-1','TEST-FORM',a);
  insert into biometric_private.samples select s2,slot,embedding from biometric_private.samples where santri_id=s;
  ch:=public.pilot_face_operation(g,'challenge','{"purpose":"attendance"}');
  r:=public.pilot_face_operation(g,'match',jsonb_build_object('challengeId',ch->>'id','modelVersion','faceapi-1.7.15-resnet128','descriptors',capture));
  if r->>'state'<>'ambiguous' then raise exception 'TEST FAIL: ambiguous accepted'; end if;
  perform public.pilot_face_operation(a,'delete',jsonb_build_object('santriId',s));
  if exists(select 1 from biometric_private.samples where santri_id=s) or not exists(select 1 from public.attendance where id=aid) then raise exception 'TEST FAIL: deletion'; end if;
  begin
    perform public.pilot_record_santri_attendance(g,s,rid,'face',clock_timestamp(),'Hadir','Pagi','Pagi',1);
    raise exception 'TEST FAIL: revoked receipt accepted';
  exception when raise_exception then if sqlerrm<>'INVALID_CHALLENGE' then raise; end if; end;
  insert into public.attendance(user_id,role,attendance_date,status,sesi,source) values(s2,'santri',day,'Tidak Hadir','Pagi','manual');
  r:=public.pilot_record_santri_attendance(g,s2,gen_random_uuid(),'rfid',clock_timestamp(),'Hadir','Pagi','Pagi',1);
  if (select count(*) from public.attendance where user_id=s2 and attendance_date=day)<>1
    or (select points from public.santri where id=s2)<>1 then raise exception 'TEST FAIL: absent restore'; end if;
  update public.attendance set status='Tidak Hadir' where user_id=s2 and attendance_date=day;
  execute format('alter table public.santri add constraint test_face_save_failure check(id<>%L::uuid or points<1.5)',s2);
  begin
    perform public.pilot_record_santri_attendance(g,s2,gen_random_uuid(),'rfid',clock_timestamp(),'Hadir','Pagi','Pagi',1);
    raise exception 'TEST FAIL: simulated save failure accepted';
  exception when check_violation then null; end;
  if (select points from public.santri where id=s2)<>1 or
    (select status from public.attendance where user_id=s2 and attendance_date=day)<>'Tidak Hadir' then raise exception 'TEST FAIL: partial save not rolled back'; end if;
  alter table public.santri drop constraint test_face_save_failure;
  raise notice 'Face SQL integration: permissions, consent, calibration, default calibration, matching, ambiguity, fractional points, cross-method duplicate, retry, inactive, deletion, absent restore, save rollback PASS';
end $$;
set local role authenticated;
do $$ begin
  begin perform public.pilot_face_operation(gen_random_uuid(),'status','{}'); raise exception 'TEST FAIL: authenticated RPC access';
  exception when insufficient_privilege then null; end;
  begin perform 1 from biometric_private.samples; raise exception 'TEST FAIL: template access';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.pilot_face_operation(gen_random_uuid(),'status','{}'); raise exception 'TEST FAIL: anonymous RPC access';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
