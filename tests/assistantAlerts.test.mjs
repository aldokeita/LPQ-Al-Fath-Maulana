import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./helpers/aliasLoader.mjs', import.meta.url);
const {
  buildSettingsPatch, countByTingkat, formatSchoolDate, getAbsentDates, groupAttentionByClass,
  isAttendanceAlert, updateSetting, validateFollowup, validateSettings,
} = await import('../src/lib/assistantAlerts.js');

const defaults = {
  version: 1, silent_mode: true, school_days: [1, 2, 3, 4, 5],
  attendance: { consecutive_sessions: 3, repeat_every_sessions: 3, high_consecutive_sessions: 6, monthly_min_percent: 75 },
  jilid: { default_days: 30, per_jilid: {}, repeat_every_days: 14 },
  hafalan: { proses_max_days: 30, required_items_after_percent: 50, murojaah_review_max_days: 7 },
};

test('tanggal sekolah diformat tanpa bergeser zona waktu', () => {
  assert.equal(formatSchoolDate('2026-10-27'), 'Sel, 27 Okt');
  assert.deepEqual(getAbsentDates({ detail: { absent_dates: ['2026-10-30', '2026-10-27'] } }), ['2026-10-27', '2026-10-30']);
  assert.equal(isAttendanceAlert({ rule: 'absen_beruntun' }), true);
  assert.equal(isAttendanceAlert({ rule: 'jilid_lama' }), false);
});

test('kelompok per kelas dan hitungan tingkat', () => {
  const items = [
    { class_id: 'a', nama_kelas: 'A', tingkat: 'tinggi' },
    { class_id: 'b', nama_kelas: 'B', tingkat: 'sedang' },
    { class_id: 'a', nama_kelas: 'A', tingkat: 'sedang' },
  ];
  assert.deepEqual(groupAttentionByClass(items).map((g) => [g.classId, g.items.length]), [['a', 2], ['b', 1]]);
  assert.deepEqual(countByTingkat(items), { tinggi: 1, sedang: 2, rendah: 0 });
});

test('pengaturan: validasi batas dan partial update', () => {
  assert.equal(validateSettings(defaults), null);
  assert.match(validateSettings(updateSetting(defaults, 'attendance.consecutive_sessions', 1)), /attendance\.consecutive_sessions/);
  assert.match(validateSettings(updateSetting(defaults, 'attendance.high_consecutive_sessions', 2)), /tingkat tinggi/);
  assert.match(validateSettings({ ...defaults, school_days: [] }), /hari/);
  assert.match(validateSettings(updateSetting(defaults, 'jilid.per_jilid', { 'Jilid 2A': 3 })), /Jilid 2A/);

  assert.deepEqual(buildSettingsPatch(defaults, defaults), {});
  let draft = updateSetting(defaults, 'silent_mode', false);
  draft = updateSetting(draft, 'jilid.default_days', 45);
  draft = updateSetting(draft, 'jilid.per_jilid', { "Al-Qur'an": 90 });
  assert.deepEqual(buildSettingsPatch(defaults, draft), { silent_mode: false, jilid: { default_days: 45, per_jilid: { "Al-Qur'an": 90 } } });
  assert.equal(defaults.jilid.default_days, 30, 'updateSetting tidak mengubah objek asal');
});

test('validasi kontak wali', () => {
  const form = { saluran: 'whatsapp', hasil: 'terhubung', tanggal_kontak: '2026-11-10', catatan: '' };
  assert.equal(validateFollowup(form, '2026-11-11'), null);
  assert.match(validateFollowup({ ...form, tanggal_kontak: '2026-11-12' }, '2026-11-11'), /masa depan/);
  assert.match(validateFollowup({ ...form, hasil: 'x' }, '2026-11-11'), /hasil/);
});

test('satu kartu per santri, tingkat tertinggi di depan', async () => {
  const { groupAttentionBySantri } = await import('../src/lib/assistantAlerts.js');
  const groups = groupAttentionBySantri([
    { santri_id: 'b', nama: 'Bilal', class_id: 'k', tingkat: 'sedang', rule: 'jilid_lama' },
    { santri_id: 'c', nama: 'Citra', class_id: 'k', tingkat: 'sedang', rule: 'absen_beruntun' },
    { santri_id: 'b', nama: 'Bilal', class_id: 'k', tingkat: 'tinggi', rule: 'hafalan_macet' },
  ]);
  assert.deepEqual(groups.map((g) => [g.nama, g.tingkat, g.items.map((i) => i.rule)]), [
    ['Bilal', 'tinggi', ['hafalan_macet', 'jilid_lama']],
    ['Citra', 'sedang', ['absen_beruntun']],
  ]);
});
