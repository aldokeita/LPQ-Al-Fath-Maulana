import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveSantriLevel } from '../src/lib/santriLevel.js';
import { DEFAULT_SESSION_TIMES } from '../src/utils/AttendanceStatusLogic.js';
import { computeAttendancePointAward } from '../src/lib/attendancePointRules.js';

const migration = await readFile(new URL('../supabase/migrations/20260810000100_finalize_fractional_santri_points.sql', import.meta.url), 'utf8');

assert.match(migration, /drop function if exists public\.increment_santri_points\(uuid, integer\)/i);
assert.match(migration, /increment_santri_points\(\s*p_santri_id uuid,\s*p_amount numeric/i);
assert.match(migration, /returns numeric/i);
assert.match(migration, /p_amount \* 2\s*<>\s*trunc\(p_amount \* 2\)/i);
assert.match(migration, /grant execute[\s\S]*increment_santri_points\(uuid, numeric\)[\s\S]*to authenticated/i);

const levelConfig = {
  male: [
    { name: 'Bronze I', min: 0, max: 30 },
    { name: 'Bronze II', min: 31, max: 60 },
  ],
  female: [
    { name: 'Bronze I', min: 0, max: 30 },
    { name: 'Bronze II', min: 31, max: 60 },
  ],
};

assert.equal(resolveSantriLevel({ points: 30.5, gender: 'putra', config: levelConfig }).name, 'Bronze I');
assert.equal(resolveSantriLevel({ points: 31, gender: 'putri', config: levelConfig }).name, 'Bronze II');

const baseAward = { role: 'santri', isAdult: false, dateStr: '2026-08-10', sesi: 'Pagi', sessionTimes: DEFAULT_SESSION_TIMES };
assert.equal(computeAttendancePointAward({ ...baseAward, status: 'Hadir', timestamp: new Date('2026-08-10T07:30:00+07:00') }), 2);
assert.equal(computeAttendancePointAward({ ...baseAward, status: 'Hadir', timestamp: new Date('2026-08-10T07:31:00+07:00') }), 1);
assert.equal(computeAttendancePointAward({ ...baseAward, status: 'Terlambat', timestamp: new Date('2026-08-10T08:02:00+07:00') }), 0.5);
assert.equal(computeAttendancePointAward({ ...baseAward, status: 'Izin', timestamp: new Date('2026-08-10T08:02:00+07:00') }), 0);

console.log('Fractional points contract tests passed.');
