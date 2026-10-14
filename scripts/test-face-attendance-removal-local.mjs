import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FACE_DB_CONTAINER, skipWithoutLocalBackend } from './faceLocalBackend.mjs';

// Rehearses scripts/face-attendance-pilot-removal.sql against the real local schema inside a transaction
// that always rolls back, so the local pilot data is untouched.
if (!skipWithoutLocalBackend('face attendance pilot removal rehearsal')) {
  const removal = readFileSync(new URL('./face-attendance-pilot-removal.sql', import.meta.url), 'utf8');
  const sql = `\\set ON_ERROR_STOP on
begin;
${removal}
do $$
begin
  if to_regnamespace('biometric_private') is not null then raise exception 'TEST FAIL: biometric_private still exists'; end if;
  if to_regprocedure('public.pilot_face_operation(uuid,text,jsonb)') is not null then raise exception 'TEST FAIL: pilot_face_operation still exists'; end if;
  if exists (select 1 from public.attendance where source = 'face') then raise exception 'TEST FAIL: face attendance rows remain'; end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'attendance_source_check')) like '%face%' then
    raise exception 'TEST FAIL: attendance_source_check still allows face';
  end if;
  raise notice 'Face pilot removal rehearsal PASS (rolled back)';
end $$;
rollback;
`;
  const output = execFileSync('docker', ['exec', '-i', FACE_DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  console.log(output.trim());
  // psql reports the NOTICE on stderr, which is captured here; reaching this line means every check passed.
  console.log('Face pilot removal rehearsal PASS (rolled back)');
}
