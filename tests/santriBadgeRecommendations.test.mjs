import test from 'node:test';
import assert from 'node:assert/strict';
import { rankDiscipline, rankHafalan } from '../src/lib/santriBadgeRecommendations.js';

const santri = [
  { id: 'a', nama_lengkap: 'Ahmad', jenis_kelamin: 'Laki-laki', sesi_mengaji: 'Pagi' },
  { id: 'b', nama_lengkap: 'Bilal', jenis_kelamin: 'Laki-laki', sesi_mengaji: 'Pagi' },
  { id: 'c', nama_lengkap: 'Cahya', jenis_kelamin: 'Laki-laki', sesi_mengaji: 'Pagi' },
  { id: 'd', nama_lengkap: 'Dinda', jenis_kelamin: 'Perempuan', sesi_mengaji: 'Pagi' },
];

// Ten days; Ahmad always first, Bilal second, Cahya alternates first/last, Dinda third.
const days = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
const row = (user, date, minute, extra = {}) => ({
  user_id: user, attendance_date: date, sesi: 'Pagi', status: 'Hadir', source: 'rfid',
  check_in_timestamp: `${date}T00:${String(minute).padStart(2, '0')}:00Z`, ...extra,
});
const attendance = days.flatMap((date, i) => [
  row('a', date, 10), row('b', date, 20), row('d', date, 30),
  row('c', date, i % 2 ? 5 : 50),
]);

test('ranks the consistently earliest santri first per sesi and gender', () => {
  const result = rankDiscipline({ attendance, santri });
  assert.deepEqual(result.Pagi.putra.map((c) => c.name), ['Ahmad', 'Bilal', 'Cahya']);
  assert.deepEqual(result.Pagi.putri.map((c) => c.name), ['Dinda']);
  assert.equal(result.Pagi.putra[0].medianTime, '07.10');
  assert.equal(result.Pagi.putra[0].attended, 10);
});

test('ignores manual entries and santri below the attendance threshold', () => {
  const sparse = [...attendance.filter((r) => r.user_id !== 'b'), row('b', days[0], 1), row('b', days[1], 1)];
  const manual = sparse.map((r) => (r.user_id === 'a' ? { ...r, source: 'manual' } : r));
  const result = rankDiscipline({ attendance: manual, santri });
  assert.deepEqual(result.Pagi.putra.map((c) => c.name), ['Cahya']);
});

test('ranks hafalan by completed items, then average score', () => {
  const progress = [
    { santri_id: 'a', status: 'lulus', score: 4 }, { santri_id: 'a', status: 'proses', score: 2 },
    { santri_id: 'b', status: 'lulus', score: 4 }, { santri_id: 'b', status: 'proses', score: 3 },
    { santri_id: 'c', status: 'lulus', score: 4 }, { santri_id: 'c', status: 'lulus', score: 4 },
    { santri_id: 'd', status: 'proses', score: 2 },
  ];
  const result = rankHafalan({ progress, santri });
  assert.deepEqual(result.Pagi.putra.map((c) => [c.name, c.completed]), [['Cahya', 2], ['Bilal', 1], ['Ahmad', 1]]);
  assert.deepEqual(result.Pagi.putri, []);
});

test('treats attendance sesi codes and names as the same sesi', () => {
  const coded = attendance.map((r, i) => (i % 2 ? { ...r, sesi: '0' } : r));
  const result = rankDiscipline({ attendance: coded, santri });
  assert.deepEqual(result.Pagi.putra.map((c) => c.name), ['Ahmad', 'Bilal', 'Cahya']);
});
