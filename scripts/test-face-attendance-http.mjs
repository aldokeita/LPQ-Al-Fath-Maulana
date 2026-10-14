import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { captureSteps, FACE_MODEL_VERSION } from '../supabase/functions/_shared/faceCapture.js';
import { skipWithoutLocalBackend } from './faceLocalBackend.mjs';

if (!skipWithoutLocalBackend('face attendance HTTP integration')) {
  const status=JSON.parse(execFileSync('supabase',['status','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  if (status.API_URL!=='http://127.0.0.1:55321') throw new Error('Only the LPQ local backend is allowed.');
  const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const existingCalibration=execFileSync('docker',['exec','supabase_db_lpq-al-fath-maulana-local','psql','-U','postgres','-d','postgres','-At','-c','select count(*) from biometric_private.calibration'],{encoding:'utf8'}).trim();
  if(existingCalibration!=='0') throw new Error('A local calibration already exists; do not overwrite it for fixtures.');
  const ids=[];const accounts=[];let classId;
  const samples=()=>Array.from({length:5},()=>Array(128).fill(0.01));
  async function call(token,body) {
    const response=await fetch(status.API_URL+'/functions/v1/face-attendance',{method:'POST',
      headers:{'content-type':'application/json',apikey:status.ANON_KEY,Authorization:'Bearer '+token},body:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }
  async function query(promise) { const result=await promise;if(result.error) throw new Error(result.error.message);return result.data; }
  try {
    for(const role of ['admin','guru','guru','santri']) {
      const password='TEST-'+randomUUID();const email='test-face-'+randomUUID()+'@local.invalid';
      const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
      if(error) throw new Error(error.message); ids.push(data.user.id);
      await query(admin.from('user_profiles').insert({id:data.user.id,role,status:'active',display_name:'TEST FACE '+role}));
      if(role==='guru') await query(admin.from('guru').insert({id:data.user.id,nama:'TEST Guru',email}));
      const client=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const login=await client.auth.signInWithPassword({email,password});if(login.error) throw new Error(login.error.message);
      accounts.push({id:data.user.id,token:login.data.session.access_token});
    }
    classId=randomUUID();const student=accounts[3].id;
    await query(admin.from('classes').insert({id:classId,nama_kelas:'TEST Face HTTP class',id_guru:accounts[1].id,sesi:'Pagi'}));
    await query(admin.from('santri').insert({id:student,nomor_induk_qiroati:'TEST'+randomUUID().replaceAll('-',''),nama_lengkap:'TEST SANTRI UNTUK PENGUJIAN OTOMATIS',nama_panggilan:'TEST',kategori:'Anak',current_class_id:classId,sesi_mengaji:'Pagi',rfid_tag:'TEST'+student}));
    await query(admin.from('class_memberships').insert({santri_id:student,class_id:classId,start_date:new Date().toISOString().slice(0,10),status:'active'}));
    assert.equal((await call(status.ANON_KEY,{action:'status',santriId:student})).status,401);
    assert.equal((await call(accounts[1].token,{action:'status',santriId:student})).body.error.code,'FORBIDDEN');
    assert.equal((await call(accounts[3].token,{action:'challenge',purpose:'attendance'})).body.error.code,'FORBIDDEN');
    assert.equal((await call(accounts[0].token,{action:'challenge',purpose:'enroll',santriId:student})).body.error.code,'CONSENT_REQUIRED');
    const consent={confirmed:true,guardianName:'TEST Wali',date:new Date().toISOString().slice(0,10),noticeVersion:'TEST-1',formReference:'TEST-SYNTHETIC-ONLY'};
    const ch=(await call(accounts[0].token,{action:'challenge',purpose:'enroll',santriId:student,consent})).body.data;
    assert.ok(ch?.id,'admin enrollment challenge');
    const capture=challenge=>({challengeId:challenge.id,modelVersion:FACE_MODEL_VERSION,descriptors:samples(),
      evidence:captureSteps(challenge.firstDirection).map((pose,i)=>({pose,faceCount:1,quality:true,elapsedMs:(i+1)*500}))});
    // Kiosk attendance is passive: five frontal frames, no head-turn order.
    const passive=challenge=>({challengeId:challenge.id,modelVersion:FACE_MODEL_VERSION,descriptors:samples(),
      evidence:Array.from({length:5},(_,i)=>({pose:'center',faceCount:1,quality:true,elapsedMs:(i+1)*200}))});
    assert.equal((await call(accounts[0].token,{action:'enroll',santriId:student,consent,...capture(ch)})).body.data?.registered,true);
    assert.equal((await call(accounts[0].token,{action:'enroll',santriId:student,consent,...capture(ch)})).body.error.code,'INVALID_CHALLENGE');
    assert.equal((await call(accounts[0].token,{action:'calibrate',maxDistance:0.4,minMargin:0.1,testReference:'TEST HTTP SYNTHETIC ONLY'})).body.data?.saved,true);
    const challenge=async operator=>(await call(operator.token,{action:'challenge',purpose:'attendance'})).body.data;
    const unknown=await challenge(accounts[1]);const unknownCapture=passive(unknown);unknownCapture.descriptors.forEach(row=>row.fill(0.9));
    const unknownResult=(await call(accounts[1].token,{action:'recognize',...unknownCapture})).body.data;
    assert.equal(unknownResult?.state,'unknown');
    assert.ok(!('bestDistance' in unknownResult) && !('secondDistance' in unknownResult),'distances must stay server-side');
    const bad=await challenge(accounts[1]);const badCapture=passive(bad);badCapture.evidence[0].faceCount=2;
    assert.equal((await call(accounts[1].token,{action:'recognize',...badCapture})).body.error.code,'INVALID_CAPTURE');
    const print=await challenge(accounts[1]);const printCapture=passive(print);printCapture.evidence.forEach((frame,i)=>frame.elapsedMs=200+i*10);
    assert.equal((await call(accounts[1].token,{action:'recognize',...printCapture})).body.error.code,'INVALID_CAPTURE');
    const out=await challenge(accounts[2]);
    assert.equal((await call(accounts[2].token,{action:'recognize',...passive(out)})).body.data?.state,'unknown');
    const valid=await challenge(accounts[1]);const receipt=randomUUID();
    const race=await Promise.all([call(accounts[1].token,{action:'recognize',...passive(valid)}),
      call(accounts[1].token,{action:'rfid',rfidTag:'TEST'+student,receiptId:receipt})]);
    assert.ok(race.every(result=>['saved','already_recorded'].includes(result.body.data?.state)),JSON.stringify(race.map(r=>({status:r.status,code:r.body.error?.code,state:r.body.data?.state}))));
    assert.equal(race.filter(r=>r.body.data.state==='saved').length,1);
    const rows=await query(admin.from('attendance').select('id').eq('user_id',student));assert.equal(rows.length,1);
    const before=await query(admin.from('santri').select('points').eq('id',student).single());
    assert.equal((await call(accounts[1].token,{action:'retry',receiptId:valid.id})).body.data?.attendance.id,rows[0].id);
    const after=await query(admin.from('santri').select('points').eq('id',student).single());assert.equal(after.points,before.points);
    assert.equal((await call(accounts[0].token,{action:'delete',santriId:student})).body.data?.deleted,true);
    assert.equal((await call(accounts[1].token,{action:'retry',receiptId:valid.id})).body.error.code,'INVALID_CHALLENGE');
    // Guru self-enrolment: only an active guru row, own consent, and a guru match records nothing server-side.
    const selfConsent={confirmed:true,noticeVersion:'TEST-GURU-1'};
    assert.equal((await call(accounts[0].token,{action:'challenge',purpose:'self_enroll',consent:selfConsent})).body.error.code,'ACTIVE_GURU_REQUIRED');
    assert.equal((await call(accounts[3].token,{action:'self_status'})).body.error.code,'FORBIDDEN');
    assert.equal((await call(accounts[2].token,{action:'challenge',purpose:'self_enroll',consent:{confirmed:true}})).body.error.code,'CONSENT_REQUIRED');
    assert.equal((await call(accounts[2].token,{action:'challenge',purpose:'self_enroll',santriId:student,consent:selfConsent})).body.error.code,'INVALID_REQUEST');
    const selfChallenge=(await call(accounts[2].token,{action:'challenge',purpose:'self_enroll',consent:selfConsent})).body.data;
    assert.equal((await call(accounts[2].token,{action:'self_enroll',consent:selfConsent,...capture(selfChallenge)})).body.data?.registered,true);
    assert.equal((await call(accounts[2].token,{action:'self_status'})).body.data?.enrollment.registered,true);
    const guruSeen=(await call(accounts[1].token,{action:'recognize',...passive(await challenge(accounts[1]))})).body.data;
    assert.deepEqual(Object.keys(guruSeen||{}).sort(),['guruId','receiptId','state'],'a guru match returns only the guru id');
    assert.equal(guruSeen.state,'guru_matched');assert.equal(guruSeen.guruId,accounts[2].id);
    assert.equal((await call(accounts[1].token,{action:'retry',receiptId:guruSeen.receiptId})).body.data?.guruId,accounts[2].id);
    assert.equal((await query(admin.from('attendance').select('id').eq('user_id',accounts[2].id))).length,0,'a guru match records nothing');
    assert.equal((await call(accounts[2].token,{action:'self_delete'})).body.data?.deleted,true);
    assert.equal((await call(accounts[1].token,{action:'recognize',...passive(await challenge(accounts[1]))})).body.data?.state,'unknown');
    console.log('Face HTTP integration PASS: auth, admin consent/enrollment, nonce replay, passive kiosk protocol (multiple faces, replayed burst), no distances in responses, unknown, teacher scope, concurrent RFID-face, retry, deletion, guru self-enrolment, guru match.');
  } finally {
    // Remove only the calibration row tagged by this isolated fixture run.
    execFileSync('docker',['exec','supabase_db_lpq-al-fath-maulana-local','psql','-U','postgres','-d','postgres','-c',"delete from biometric_private.calibration where test_reference='TEST HTTP SYNTHETIC ONLY'"],{stdio:'ignore'});
    if(accounts[3]) await admin.auth.admin.deleteUser(accounts[3].id);
    if(classId) await query(admin.from('classes').delete().eq('id',classId));
    for(const id of ids.filter(id=>id!==accounts[3]?.id).reverse()) {
      const result=await admin.auth.admin.deleteUser(id); if(result.error) throw new Error('Fixture cleanup failed: '+result.error.message);
    }
  }
}
