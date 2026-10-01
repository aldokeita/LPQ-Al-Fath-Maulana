import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import XLSX from 'xlsx';
import { createImportSource, IMPORT_FIELDS, inferImportDateOrder, normalizeImportGender, normalizeImportJilid, parseImportDate, parseSantriImport, readImportWorkbook, validateImportMapping } from '../src/lib/santriImportParsing.js';
import { allocateImportNiq, buildSantriImportPayload, fetchSantriImportIdentities, submitSantriImport, validateSantriImport } from '../src/lib/santriImportWorkflow.js';

const headers = ['Nama Lengkap', 'Kelas', 'Nama Panggilan', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Nama Ayah', 'Alamat', 'No WA', 'Tanggal Masuk Pendaftaran', 'Nama Ibu'];
const rows = [headers, ...Array.from({length:4}, (_,i)=>[`Fixture ${i+1}`, '1 A', `Fixture${i+1}`, i===0?'Wanita':'Pria', 'Kota fixture', '09/15/2019', 'Ayah fixture', 'Alamat fixture', '082100000000', '09/07/2026', 'Ibu fixture'])];
const parse = (source = createImportSource(rows), options = {}) => parseSantriImport(source, {defaultSession:'3', ...options});
const record = (extra = {}) => ({nama_lengkap:'Fixture Satu',tanggal_lahir:'2019-09-15',nomor_induk_qiroati:'001234',sesi_mengaji:'3',__importRow:2,...extra});
const parsed = records => ({records,errors:[],warnings:[],ignoredColumns:[]});
const sequentialGenerator = () => {let i=2600000;return used => {while(used.has(String(++i))) {} const value=String(i);used.add(value);return value;};};

test('sample header shape maps all 11 columns without placing santri in a teacher class',()=>{
  const result=parse();assert.equal(result.records.length,4);assert.equal(result.errors.length,0);
  const r=result.records[0];assert.equal(r.nama_panggilan,'Fixture1');assert.equal(r.jilid,'Jilid 1A');assert.equal(r.jenis_kelamin,'Perempuan');
  assert.equal(r.tanggal_lahir,'2019-09-15');assert.equal(r.tanggal_pendaftaran,'2026-09-07');assert.equal(r.no_hp_ortu,'082100000000');assert.equal(r.current_class_id,null);
});
test('column order is arbitrary and unknown columns are ignored',()=>{
  const reordered=rows.map(r=>[r[8],r[3],r[0],r[5],r[1],'Ignored fixture']);reordered[0][5]='Kolom eksternal';
  const result=parse(createImportSource(reordered));assert.equal(result.records.length,4);assert.deepEqual(result.ignoredColumns,['Kolom eksternal']);
  assert.equal(result.records[0].jilid,'Jilid 1A');assert.equal(result.records[0].no_hp_ortu,'082100000000');
});
test('case, BOM, punctuation, DB keys and template annotations normalize consistently',()=>{
  const source=createImportSource([['\ufeff  NAMA_LENGKAP ', 'Tgl. Lahir (MM-DD-YYYY)', 'No. WA', 'Jenis Kelamin (Laki-laki/Perempuan)'],['Fixture','09/07/2019','00123','Pria']]);
  const result=parse(source);assert.equal(result.records[0].tanggal_lahir,'2019-09-07');assert.equal(result.records[0].no_hp_ortu,'00123');
});
test('missing and ambiguous header mappings require correction',()=>{
  assert.throws(()=>validateImportMapping(['','alamat']),/Nama Lengkap/);
  assert.throws(()=>validateImportMapping(['nama_lengkap','jilid','jilid']),/Dua kolom/);
  assert.throws(()=>createImportSource([['Nama Lengkap']]),/Tidak ada baris/);
});
test('missing session is an error; chosen fallback fills only empty session cells',()=>{
  assert.equal(parse(createImportSource(rows),{defaultSession:''}).errors.length,4);
  const source=createImportSource([['Nama Lengkap','Sesi'],['Fixture 1','Pagi'],['Fixture 2','']]);
  assert.deepEqual(parse(source).records.map(r=>r.sesi_mengaji),['0','3']);
  assert.equal(parse(createImportSource([['Nama Lengkap','Sesi'],['Fixture','Tidak dikenal']])).errors.length,1);
});
test('missing nickname uses first name while other optional fields remain empty',()=>{
  const r=parse(createImportSource([['Nama Lengkap'],['Fixture Satu']])).records[0];
  assert.equal(r.nama_panggilan,'Fixture');assert.equal(r.jilid,null);assert.equal(r.jenis_kelamin,null);assert.equal(r.tanggal_pendaftaran,undefined);
  assert.equal(buildSantriImportPayload({...r,nomor_induk_qiroati:'1234567'}).profile.tanggal_pendaftaran,null);
});
test('calendar validation, ISO, serial dates and the Excel 1904 epoch',()=>{
  assert.equal(parseImportDate('2024-02-29'),'2024-02-29');assert.equal(parseImportDate('15/09/2019','dmy'),'2019-09-15');
  assert.equal(parseImportDate(43723),'2019-09-15');assert.equal(parseImportDate(0,null,true),'1904-01-01');
  for(const v of ['2023-02-29','31/04/2026','garbage'])assert.throws(()=>parseImportDate(v,'dmy'));
  assert.throws(()=>parseImportDate(60));assert.throws(()=>parseImportDate('09/07/2026'));
});
test('ambiguous date order requires selection, mixed signals do not silently guess',()=>{
  const s=createImportSource([['Nama Lengkap','Tanggal Lahir'],['Fixture','09/07/2019']]);assert.equal(inferImportDateOrder(s,s.mapping).needsChoice,true);
  assert.throws(()=>parse(s),/Pilih/);assert.equal(parse(s,{dateOrder:'dmy'}).records[0].tanggal_lahir,'2019-07-09');
  const mixed=createImportSource([['Nama Lengkap','Tanggal Lahir'],['Fixture','15/09/2019'],['Fixture 2','09/15/2019']]);assert.throws(()=>parse(mixed),/bercampur/);
});
test('legacy no-header input is explicit and requires all 16 columns',()=>{
  const r=Array(16).fill('');r[0]='Fixture';r[2]='Jilid 1A';r[4]='09/15/2019';r[5]='L';
  assert.equal(parse(createImportSource([r],{mode:'legacy'})).records[0].__importRow,1);
  assert.throws(()=>createImportSource([r]),/Tidak ada baris/);assert.throws(()=>createImportSource([r.slice(0,11)],{mode:'legacy'}),/16 kolom/);
  assert.equal(IMPORT_FIELDS.length,16);
});
test('gender and jilid synonyms are exact and invalid values are rejected',()=>{
  assert.equal(normalizeImportGender('Wanita'),'Perempuan');assert.equal(normalizeImportGender('Pria'),'Laki-laki');assert.throws(()=>normalizeImportGender('X'));
  assert.equal(normalizeImportJilid('1 A'),'Jilid 1A');assert.equal(normalizeImportJilid('juz 27'),'Jilid Juz 27');assert.equal(normalizeImportJilid('JUZ 30','PTPT'),'Juz 30');assert.throws(()=>normalizeImportJilid('Kelas sembarang'));
});
test('numeric identifiers warn; unsafe Excel digits are rejected rather than invented',()=>{
  const s=createImportSource([['Nama Lengkap','No WA','NIQ'],['Fixture',821234567,'001234']],{formats:{'2:1':{numeric:true,formatted:'0821234567'}}});
  const result=parse(s);assert.equal(result.records[0].no_hp_ortu,'0821234567');assert.equal(result.records[0].nomor_induk_qiroati,'001234');assert.equal(result.warnings.length,1);
  assert.equal(parse(createImportSource([['Nama Lengkap','No NIK'],['Fixture',1234567890123456]])).errors.length,1);
});
test('CSV preserves zero prefixes and date text instead of coercing columns before mapping',()=>{
  const w=XLSX.read('Nama Lengkap,No WA,NIQ,Tanggal Lahir\nFixture,0821234,001234,09/15/2019',{type:'string',raw:true});
  const r=parse(readImportWorkbook(w,XLSX)).records[0];assert.equal(r.no_hp_ortu,'0821234');assert.equal(r.nomor_induk_qiroati,'001234');assert.equal(r.tanggal_lahir,'2019-09-15');
});
test('paginated identity lookup sees records past 1000 including archived/nonactive identities',async()=>{
  const all=Array.from({length:1102},(_,i)=>record({id:String(i),nomor_induk_qiroati:String(i),deleted_at:i===1101?'2026-01-01':null,status:'Nonaktif'}));
  const calls=[];const list=await fetchSantriImportIdentities(async(a,b)=>{calls.push([a,b]);return {data:all.slice(a,b+1),count:all.length};});
  assert.equal(calls.length,3);assert.equal(list.length,1102);assert.equal(validateSantriImport(parsed([record({nomor_induk_qiroati:'1101'})]),list).errors.length,1);
});
test('lookup errors and malformed responses fail closed',async()=>{
  await assert.rejects(()=>fetchSantriImportIdentities(async()=>({error:{message:'fixture failure'}})),/gagal/);
  await assert.rejects(()=>fetchSantriImportIdentities(async()=>({data:null})),/tidak valid/);
});
test('lookup follows a server row cap smaller than the requested page size',async()=>{
  const all=Array.from({length:1201},(_,i)=>({id:String(i)}));let calls=0;
  const rows=await fetchSantriImportIdentities(async from=>{calls++;return {data:all.slice(from,from+100),count:all.length};});
  assert.equal(rows.length,1201);assert.equal(calls,13);
  await assert.rejects(()=>fetchSantriImportIdentities(async()=>({data:[],count:1})),/belum lengkap/);
});
test('NIQ/RFID collisions in DB or within file are hard errors',()=>{
  assert.equal(validateSantriImport(parsed([record()]),[record()]).errors.length,1);
  assert.equal(validateSantriImport(parsed([record({rfid_tag:'RF1'})]),[record({nomor_induk_qiroati:'999',rfid_tag:'RF1'})]).errors.length,1);
  assert.equal(validateSantriImport(parsed([record(),record({__importRow:3})]),[]).errors.length,2);
});
test('same name and birth date requires explicit different-person decision or skip',()=>{
  const incoming=record({nomor_induk_qiroati:'NEW'}),existing=record({nama_lengkap:'  fixture   satu ',nomor_induk_qiroati:'OLD'});
  assert.equal(validateSantriImport(parsed([incoming]),[existing]).review.length,1);
  assert.equal(validateSantriImport(parsed([incoming]),[existing],{decisions:{2:'new'}}).ready.length,1);
  assert.equal(validateSantriImport(parsed([incoming]),[existing],{decisions:{2:'skip'}}).skipped.length,1);
  assert.equal(validateSantriImport(parsed([incoming,record({nomor_induk_qiroati:'NEW2',__importRow:3})]),[]).review.length,2);
});
test('generated NIQ is unique, stable across preview decisions, and never uses an unchecked fallback',()=>{
  const cache=new Map(),generateNiq=sequentialGenerator();const p=parsed([record({nomor_induk_qiroati:null})]);
  const first=validateSantriImport(p,[],{niqCache:cache,generateNiq});const second=validateSantriImport(p,[],{niqCache:cache,generateNiq});
  assert.equal(first.ready[0].nomor_induk_qiroati,second.ready[0].nomor_induk_qiroati);assert.equal(first.ready[0].is_auto_niq,true);
  assert.throws(()=>allocateImportNiq(new Set(['2610000']),{year:2026,random:()=>0}),/unik/);
});
test('creation payload uses existing endpoint contract and never contains import metadata or class assignment',()=>{
  const payload=buildSantriImportPayload(record({jilid:'Jilid 1A',current_class_id:null,password:'fixture-password'}));
  assert.equal(payload.action,'create');assert.equal(payload.role,'santri');assert.equal(payload.profile.current_class_id,null);assert.equal(payload.initial_password,'fixture-password');assert.ok(!('__importRow' in payload.profile));assert.ok(!('password' in payload.profile));
});
test('partial import reports every row, progress, and retry takes only failed records',async()=>{
  const inputs=[record(),record({__importRow:3,nomor_induk_qiroati:'999999'})],calls=[],progress=[];
  const result=await submitSantriImport(inputs,{createRecord:async body=>{calls.push(body);if(body.profile.nomor_induk_qiroati==='999999')throw Error('fixture failure');return {ok:true,data:{user_id:'fixture-id'}};},onProgress:p=>progress.push(p)});
  assert.equal(result.successCount,1);assert.equal(result.failures.length,1);assert.equal(progress.at(-1).completed,2);
  const retried=[];await submitSantriImport(result.failures.map(f=>f.record),{createRecord:async body=>{retried.push(body);return {ok:true,data:{user_id:'fixture-id'}};}});
  assert.deepEqual(retried.map(p=>p.profile.nomor_induk_qiroati),['999999']);assert.equal(inputs[0].__importRow,2);
});
test('permission-denied/invalid backend responses do not count as successes; admin-only guard remains',async()=>{
  const result=await submitSantriImport([record()],{createRecord:async()=>({ok:false,error:{message:'FORBIDDEN'}})});assert.equal(result.successCount,0);
  const backend=await readFile(new URL('../supabase/functions/manage-user/index.ts',import.meta.url),'utf8');assert.match(backend,/await requireRole\(user.id, \["admin"\]\)/);
});
test('expired authorization stops further creation requests and preserves unattempted rows for review',async()=>{
  let calls=0;const r=await submitSantriImport([record(),record({__importRow:3})],{createRecord:async()=>{calls++;throw Object.assign(Error('Session tidak valid'),{code:'UNAUTHORIZED'});}});
  assert.equal(calls,1);assert.equal(r.failures.length,2);assert.match(r.failures[1].reason,/Belum diproses/);
});
test('real uploaded workbook maps four rows without sending or logging private data',{skip:!process.env.LPQ_IMPORT_EXAMPLE},()=>{
  const w=XLSX.readFile(process.env.LPQ_IMPORT_EXAMPLE);const p=parse(readImportWorkbook(w,XLSX));assert.equal(p.records.length,4);assert.equal(p.errors.length,0);assert.ok(p.records.every(r=>r.jilid==='Jilid 1A'&&r.current_class_id===null));assert.ok(p.records.every(r=>r.no_hp_ortu.startsWith('0')));
});
