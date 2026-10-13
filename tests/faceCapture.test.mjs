import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { captureSteps, validateCapture, validateConsent, FACE_MODEL_VERSION, getCameraErrorMessage } from '../supabase/functions/_shared/faceCapture.js';

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
