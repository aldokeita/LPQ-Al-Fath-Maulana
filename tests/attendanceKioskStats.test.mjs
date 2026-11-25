import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveSession, summarizeTodayAttendance } from '../src/lib/attendanceKioskStats.js';

const SESSIONS = {
  Pagi: { open: '06:00', start: '08:00', end: '09:15' },
  Sore: { open: '14:45', start: '16:00', end: '17:15' },
};
// 15:30 WIB = 08:30 UTC
const at = (hhmmUtc) => new Date(`2026-11-25T${hhmmUtc}:00Z`);

test('picks the session whose window holds the current Jakarta time', () => {
  assert.deepEqual(resolveActiveSession(SESSIONS, at('08:30')), { name: 'Sore', running: true, range: '16.00 – 17.15' });
});

test('falls back to the next session today, then to none', () => {
  assert.equal(resolveActiveSession(SESSIONS, at('05:00')).name, 'Sore');
  assert.equal(resolveActiveSession(SESSIONS, at('05:00')).running, false);
  assert.equal(resolveActiveSession(SESSIONS, at('12:00')), null);
});

test('summarises today: first check-in per santri, late share and newest first', () => {
  const rows = [
    { user_id: 'a', status: 'Hadir', check_in_time: '15:30:00', check_in_timestamp: '2026-11-25T08:30:00Z' },
    { user_id: 'a', status: 'Hadir', check_in_time: '15:50:00', check_in_timestamp: '2026-11-25T08:50:00Z' },
    { user_id: 'b', status: 'Terlambat', check_in_time: '16:20:00', check_in_timestamp: '2026-11-25T09:20:00Z' },
    { user_id: 'c', status: 'Izin', check_in_time: null, check_in_timestamp: null },
  ];
  const summary = summarizeTodayAttendance({ rows, names: { a: 'Aisyah', b: 'Fathan' }, activeSantri: 10 });
  assert.equal(summary.present, 2);
  assert.equal(summary.notYet, 8);
  assert.equal(summary.onTimePercent, 50);
  assert.deepEqual(summary.recent.map((r) => [r.name, r.late]), [['Fathan', true], ['Aisyah', false]]);
});
