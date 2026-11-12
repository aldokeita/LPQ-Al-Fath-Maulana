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
  notifications: { telegram_enabled: false, bot_username: '', summary_hour: 19, dashboard_url: 'https://www.lpqalfathmaulana.id/dashboard' },
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
  assert.match(validateSettings(updateSetting(defaults, 'attendance.consecutive_sessions', 1)), /^Peringatan setelah \(sesi beruntun\) harus bilangan bulat 2–20/);
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

const infographic = await import('../src/lib/assistantAlerts.js');

test('meteran jilid membagi bagian dalam batas dan yang terlewat', () => {
  const over = infographic.getJilidMeter({ jilid_hari: 45, jilid_batas: 30 });
  assert.equal(over.over, 15);
  assert.equal(Math.round(over.markerPct), 67);
  assert.equal(Math.round(over.withinPct + over.overPct), 100);
  const within = infographic.getJilidMeter({ jilid_hari: 12, jilid_batas: 30 });
  assert.equal(within.over, 0);
  assert.equal(within.markerPct, 100);
  assert.equal(within.withinPct, 40);
  assert.equal(infographic.getJilidMeter({ jilid_hari: null, jilid_batas: 30 }), null);
});

test('ringkasan kehadiran dan cincin hafalan', () => {
  const pulse = [{ t: '2026-11-02', s: 'hadir' }, { t: '2026-11-03', s: 'absen' }, { t: '2026-11-04', s: 'koreksi' }, { t: '2026-11-05', s: 'terlambat' }];
  assert.deepEqual(infographic.summarizePulse(pulse), { total: 4, hadir: 3, absen: 1 });
  assert.equal(infographic.percentOf(11, 19), 58);
  assert.equal(infographic.percentOf(1, 0), null);
  assert.equal(infographic.getHafalanRing({ total: 20, lulus: 5, proses: 2, dicatat: 7 }).pct, 25);
  assert.equal(infographic.getHafalanRing({ total: 0 }), null);
});

test('jumlah santri per bidang tidak menghitung ganda', () => {
  const counts = infographic.countSantriByArea([
    { santri_id: 'a', rule: 'absen_beruntun' }, { santri_id: 'a', rule: 'kehadiran_bulanan' },
    { santri_id: 'b', rule: 'jilid_lama' }, { santri_id: 'b', rule: 'hafalan_macet' }, { santri_id: 'b', rule: 'hafalan_wajib_belum_lulus' },
  ]);
  assert.deepEqual(counts, { kehadiran: 1, jilid: 1, hafalan: 1, murojaah: 0 });
});

test('draf pesan wali memakai nama panggilan dan alasan yang relevan', () => {
  const text = infographic.buildWaliMessage({
    nama: 'Citra Ayu', namaPanggilan: 'Citra',
    items: [
      { rule: 'absen_beruntun', detail: { streak: 4, absent_dates: ['2026-11-05', '2026-11-02'] } },
      { rule: 'hafalan_macet', detail: {} }, { rule: 'hafalan_wajib_belum_lulus', detail: {} },
      { rule: 'murojaah_belum_ditinjau', detail: {} },
    ],
  }, { guruName: 'Ustadzah A' });
  assert.match(text, /ananda Citra/);
  assert.match(text, /belum hadir mengaji 4 kali berturut-turut sejak Sen, 2 Nov/);
  assert.equal((text.match(/ada hafalan/g) || []).length, 1);
  assert.doesNotMatch(text, /muroja/i);
  assert.match(text, /Ustadzah A$/);
});

test('perkara hafalan memakai istilah skor dan kontak wali terbaru dipilih', () => {
  const lines = infographic.describeHafalanAlerts([
    { rule: 'hafalan_macet', detail: { count: 2, max_days: 30 } },
    { rule: 'hafalan_wajib_belum_lulus', detail: { count: 5, jilid: 'Jilid 2A' } },
  ]);
  assert.deepEqual(lines, [
    '2 item masih skor 1–3 dan belum dinilai ulang lebih dari 30 hari.',
    '5 item hafalan wajib Jilid 2A belum mencapai skor 4.',
  ]);
  const latest = infographic.latestWaliContact([
    { wali_kontak: { tanggal: '2026-11-03', hasil: 'terhubung' } }, { wali_kontak: null },
    { wali_kontak: { tanggal: '2026-11-10', hasil: 'janji_hadir' } },
  ]);
  assert.equal(latest.hasil, 'janji_hadir');
  assert.equal(infographic.latestWaliContact([{}]), null);
  assert.equal(infographic.labelOf(infographic.FOLLOWUP_RESULTS, 'janji_hadir'), 'Berjanji hadir');
});

test('pengaturan notifikasi divalidasi dan dikirim sebagian', () => {
  const draft = updateSetting(updateSetting(defaults, 'notifications.telegram_enabled', true), 'notifications.bot_username', 'LpqDemoBot');
  assert.equal(validateSettings(draft), null);
  assert.deepEqual(buildSettingsPatch(defaults, draft), { notifications: { telegram_enabled: true, bot_username: 'LpqDemoBot' } });
  assert.match(validateSettings(updateSetting(defaults, 'notifications.bot_username', '@bot salah')), /bot Telegram tidak valid/);
  assert.match(validateSettings(updateSetting(defaults, 'notifications.summary_hour', 22)), /Jam ringkasan harian \(WIB\) harus bilangan bulat 6–20/);
  assert.deepEqual(buildSettingsPatch(defaults, updateSetting(defaults, 'notifications.summary_hour', 7)), { notifications: { summary_hour: 7 } });
});
