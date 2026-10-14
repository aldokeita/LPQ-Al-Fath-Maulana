import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./helpers/aliasLoader.mjs', import.meta.url);
const { fake } = await import('./helpers/fakeSupabase.mjs');
const { runGuruAttendanceScan, guruScanCardProps } = await import('../src/lib/guruAttendanceScan.js');
const { DEFAULT_SESSION_TIMES } = await import('../supabase/functions/_shared/attendanceRules.js');

const guru = { id:'11111111-1111-4111-8111-111111111111', nama:'TEST Ustadz', jabatan:'Guru', roles:[], foto_url:'guru.webp', jenis_kelamin:'Laki-laki' };
const mmqId = '22222222-2222-4222-8222-222222222222';
const at = time => new Date(`2026-10-14T${time}:00+07:00`); // a Wednesday
const pagiClass = [{ id:'c1', nama_kelas:'TEST Kelas', sesi:'Pagi', santri:[] }];

// Answers queries by "<op> <table>"; attendance reads are told apart by how they are filtered.
function backend({ mmq = null, existingMmq = null, classes = pagiClass, existing = null, previous = null, insertError = null } = {}) {
  fake.queries = [];
  fake.respond = q => {
    if (q.table === 'mmq_schedule') return { data: mmq };
    if (q.table === 'mmq_attendance') return q.op === 'insert' ? { error: insertError } : { data: existingMmq };
    if (q.table === 'classes') return { data: classes };
    if (q.table === 'attendance' && q.op === 'insert') return { error: insertError };
    if (q.table === 'attendance' && q.head) return { count: 4 };
    if (q.table === 'attendance' && 'sesi' in q.filters) return { data: existing };
    if (q.table === 'attendance' && 'attendance_date' in q.filters) return { data: previous };
    if (q.table === 'attendance') return { data: [] };
    return {};
  };
}
const inserts = table => fake.queries.filter(q => q.op === 'insert' && q.table === table).map(q => q.payload);
const scan = (time, extra = {}) => runGuruAttendanceScan({ guruData: guru, tag:'TAG-1', sessionTimes: DEFAULT_SESSION_TIMES, now: at(time), ...extra });

test('a guru inside a session window is checked in once, labelled with the identification source', async () => {
  backend();
  const face = await scan('07:30', { source: 'face' });
  assert.equal(face.type, 'success');
  assert.equal(face.message, 'Absensi sesi Pagi berhasil!');
  assert.deepEqual(inserts('attendance').map(({ user_id, role, sesi, source, attendance_date }) => ({ user_id, role, sesi, source, attendance_date })),
    [{ user_id: guru.id, role: 'guru', sesi: 'Pagi', source: 'face', attendance_date: '2026-10-14' }]);
  assert.ok(face.guruStats && face.pointsAward === 0);
  const card = guruScanCardProps(face);
  assert.equal(card.variant, 'teacher'); assert.equal(card.showSuccessBadge, true); assert.equal(card.status, face.status);

  backend();
  await scan('07:30');
  assert.equal(inserts('attendance')[0].source, 'rfid', 'RFID stays the default source');
});

test('a guru already checked in for the session is not recorded again', async () => {
  backend({ existing: { check_in_time: '07:05', status: 'Hadir' } });
  const result = await scan('07:40', { source: 'face' });
  assert.equal(result.message, 'Absensi sudah tercatat.');
  assert.equal(result.time, '07:05');
  assert.equal(inserts('attendance').length, 0);
});

test('outside every session window a guru gets the info card and nothing is written', async () => {
  backend();
  const result = await scan('11:45', { source: 'face' });
  assert.equal(result.type, 'guru_info');
  assert.equal(inserts('attendance').length, 0);
  const card = guruScanCardProps(result);
  assert.equal(card.status, undefined); assert.equal(card.showSuccessBadge, false);
  assert.equal(card.guruStats.session, 1);

  backend({ previous: { id:'a1', check_in_time:'07:10', status:'Hadir', sesi:'Pagi' } });
  const later = await scan('11:45');
  assert.equal(later.message, 'Absensi sudah tercatat.', 'an earlier check-in today is shown instead of the info card');
});

test('a Pentashih checks in on a flexible session at any time', async () => {
  backend({ classes: [] });
  const result = await runGuruAttendanceScan({ guruData: { ...guru, roles:['Pentashih'] }, tag:'TAG-P', sessionTimes: DEFAULT_SESSION_TIMES, now: at('11:45'), source: 'face' });
  assert.equal(result.type, 'success');
  assert.equal(inserts('attendance')[0].sesi, 'Flex');
  assert.equal(result.guruStats, null);
  assert.equal(guruScanCardProps(result).isPentashih, true);
});

test('on an MMQ day the guru is recorded for MMQ, and a second scan asks for confirmation', async () => {
  backend({ mmq: { id: mmqId, start_time: '07:00:00' } });
  const first = await scan('07:30', { source: 'face' });
  assert.equal(first.type, 'mmq_success');
  assert.equal(inserts('mmq_attendance').length, 1);
  assert.equal(inserts('attendance').length, 0);
  assert.equal(guruScanCardProps(first).variant, 'teacher');

  backend({ mmq: { id: mmqId, start_time: '07:00:00' }, existingMmq: { id: 'm1' } });
  const second = await scan('07:35', { source: 'face' });
  assert.equal(second.type, 'confirmation');
  assert.equal(guruScanCardProps(second), null, 'a confirmation is a message, not a card');
});

test('a failed write is reported as an error result', async () => {
  backend({ insertError: { message: 'boom', code: '42501' } });
  const result = await scan('07:30', { source: 'face' });
  assert.equal(result.type, 'error');
  assert.equal(guruScanCardProps(result), null);
});
