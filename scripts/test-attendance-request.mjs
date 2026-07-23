import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ATTENDANCE_REQUEST_TIMEOUT_CODE,
  ATTENDANCE_STATUS_UNCERTAIN_CODE,
  executeVerifiedAttendanceMutation,
  withAttendanceRequestTimeout,
} from '../src/lib/attendanceRequest.js';

const resolved = await withAttendanceRequestTimeout(Promise.resolve('ok'), { timeoutMs: 20 });
assert.equal(resolved, 'ok');

await assert.rejects(
  withAttendanceRequestTimeout(new Promise(() => {}), { timeoutMs: 5 }),
  error => error.code === ATTENDANCE_REQUEST_TIMEOUT_CODE,
);

const recoveredAfterTimeout = await executeVerifiedAttendanceMutation({
  mutation: new Promise(() => {}),
  verify: async () => ({ data: { id: 'attendance-1' }, error: null }),
  timeoutMs: 5,
  verificationTimeoutMs: 20,
});
assert.equal(recoveredAfterTimeout.recovered, true);
assert.equal(recoveredAfterTimeout.recoveryReason, 'timeout');

const recoveredAfterDuplicate = await executeVerifiedAttendanceMutation({
  mutation: Promise.resolve({ data: null, error: { code: '23505' } }),
  verify: async () => ({ data: { id: 'attendance-1' }, error: null }),
  timeoutMs: 20,
  verificationTimeoutMs: 20,
});
assert.equal(recoveredAfterDuplicate.recovered, true);
assert.equal(recoveredAfterDuplicate.recoveryReason, 'duplicate');

await assert.rejects(
  executeVerifiedAttendanceMutation({
    mutation: new Promise(() => {}),
    verify: async () => ({ data: null, error: null }),
    timeoutMs: 5,
    verificationTimeoutMs: 20,
  }),
  error => error.code === ATTENDANCE_STATUS_UNCERTAIN_CODE,
);

const publicAttendance = await readFile(
  new URL('../src/pages/DigitalAttendancePage.jsx', import.meta.url),
  'utf8',
);
assert.match(publicAttendance, /scanLockRef\.current/);
assert.match(publicAttendance, /\.select\('id, sesi'\)/);
assert.match(publicAttendance, /executeVerifiedAttendanceMutation/);
assert.match(publicAttendance, /detailsLoading/);
assert.doesNotMatch(publicAttendance, /while \(true\)/);

console.log('attendance request resilience checks passed');
