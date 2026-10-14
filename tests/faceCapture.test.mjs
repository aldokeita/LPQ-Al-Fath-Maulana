import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { captureSteps, isUuid, parseCalibration, validateCapture, validateConsent, FACE_MODEL_VERSION, getCameraErrorMessage, PASSIVE_MIN_SPAN_MS } from '../supabase/functions/_shared/faceCapture.js';

const valid = () => ({ modelVersion:FACE_MODEL_VERSION, descriptors:Array.from({length:5},()=>Array(128).fill(0.01)),
  evidence:captureSteps('left').map((pose,i)=>({pose,faceCount:1,quality:true,elapsedMs:(i+1)*500})) });
test('five consistent descriptors and server challenge order are required',()=>{
  assert.doesNotThrow(()=>validateCapture(valid(),{firstDirection:'left'}));
  assert.throws(()=>validateCapture(valid(),{firstDirection:'right'}));
  for (const change of [p=>p.descriptors.pop(),p=>p.descriptors[0].pop(),p=>p.descriptors[0][0]=NaN,
    p=>p.descriptors[0][0]=Infinity,p=>p.descriptors[0].fill(0),p=>p.descriptors[4].fill(1),
    p=>p.modelVersion='other',p=>p.evidence[1].faceCount=2,p=>p.evidence[1].quality=false,
    p=>p.evidence[1].elapsedMs=0,p=>p.evidence[4].elapsedMs=45000,p=>p.evidence.forEach(e=>e.pose='center')]) {
    const p=valid(); change(p); assert.throws(()=>validateCapture(p,{firstDirection:'left'}));
  }
});
test('guardian consent cannot omit fields or use impossible/future dates',()=>{
  const consent={ confirmed:true,guardianName:'TEST wali',date:'2026-10-01',noticeVersion:'TEST-1',formReference:'TEST-FORM' };
  assert.doesNotThrow(()=>validateConsent(consent,'2026-10-07'));
  for(const change of [p=>p.confirmed=false,p=>p.guardianName='',p=>p.noticeVersion='',p=>p.formReference='',
    p=>p.date='2026-02-30',p=>p.date='2026-10-08',p=>p.date='invalid']) {
    const p={...consent};change(p);assert.throws(()=>validateConsent(p,'2026-10-07'));
  }
});
test('enrollment allows captured pose variations, attendance still requires stable frontal descriptors',()=>{
  const payload=valid();payload.descriptors[1][0]+=0.35;
  assert.doesNotThrow(()=>validateCapture(payload,{firstDirection:'left',purpose:'enroll'}));
  assert.throws(()=>validateCapture(payload,{firstDirection:'left',purpose:'attendance'}));
});
test('camera failure messages identify denied, missing and disconnected devices',()=>{
  assert.match(getCameraErrorMessage({name:'NotAllowedError'}),/ditolak/);
  assert.match(getCameraErrorMessage({name:'NotFoundError'}),/tidak tersedia/);
  assert.match(getCameraErrorMessage({name:'NotReadableError'}),/aplikasi lain/);
});
test('only three approved models exist, with integrity hashes',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/face-models/1.7.15/integrity.json',import.meta.url),'utf8'));
  assert.equal(manifest.version,FACE_MODEL_VERSION);assert.equal(Object.keys(manifest.files).length,6);
  for(const [name,meta] of Object.entries(manifest.files)) {
    assert.doesNotMatch(name,/age|gender|expression/);assert.match(meta.sha256,/^[a-f0-9]{64}$/);
    const {createHash}=await import('node:crypto');const bytes=await readFile(new URL('../public/face-models/1.7.15/'+name,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
  }
});
test('request ids accept seeded non-v4 UUIDs and reject malformed values',()=>{
  assert.ok(isUuid('a1fa7a10-0000-0000-0000-000000000101'));
  assert.ok(isUuid('3F2504E0-4F89-41D3-9A0C-0305E82C3301'));
  for (const value of ['', 'a1fa7a10-0000-0000-0000-00000000010', 'a1fa7a10000000000000000000000101', 'g1fa7a10-0000-0000-0000-000000000101', null, 42]) {
    assert.equal(isUuid(value),false);
  }
});
const passive = () => ({ modelVersion:FACE_MODEL_VERSION, descriptors:Array.from({length:5},()=>Array(128).fill(0.01)),
  evidence:Array.from({length:5},(_,i)=>({pose:'center',faceCount:1,quality:true,elapsedMs:1000+i*150})) });
test('kiosk attendance accepts five frontal frames without a head-turn challenge',()=>{
  assert.doesNotThrow(()=>validateCapture(passive(),{purpose:'attendance',firstDirection:'left'}));
  for (const change of [p=>p.evidence[2].pose='left',p=>p.evidence[1].faceCount=2,p=>p.evidence[3].quality=false,
    p=>p.evidence.forEach((e,i)=>e.elapsedMs=1000+i*10),p=>p.evidence[4].elapsedMs=41000,p=>p.evidence[2].elapsedMs=p.evidence[1].elapsedMs,
    p=>p.descriptors[4].fill(1)]) {
    const p=passive(); change(p); assert.throws(()=>validateCapture(p,{purpose:'attendance',firstDirection:'left'}));
  }
  assert.ok(PASSIVE_MIN_SPAN_MS>0);
});
test('enrollment still requires the ordered head-turn challenge',()=>{
  assert.throws(()=>validateCapture(passive(),{purpose:'enroll',firstDirection:'left'}));
});
test('calibration accepts comma or dot decimals and rejects implausible thresholds',()=>{
  assert.deepEqual(parseCalibration({maxDistance:'0,40',minMargin:'0.08',testReference:' LOKAL '}),{maxDistance:0.4,minMargin:0.08,testReference:'LOKAL'});
  assert.equal(parseCalibration({maxDistance:0.55,minMargin:0.1,testReference:'x'}).maxDistance,0.55);
  for (const bad of [{maxDistance:'0.055',minMargin:'0.08'},{maxDistance:'0.4',minMargin:'0.001'},{maxDistance:'0.7',minMargin:'0.08'},
    {maxDistance:'0.4.1',minMargin:'0.08'},{maxDistance:'',minMargin:'0.08'},{maxDistance:'abc',minMargin:'0.08'}]) {
    assert.throws(()=>parseCalibration({...bad,testReference:'x'}),/INVALID_CALIBRATION/);
  }
  assert.throws(()=>parseCalibration({maxDistance:'0.4',minMargin:'0.08',testReference:'  '}),/INVALID_CALIBRATION/);
});
