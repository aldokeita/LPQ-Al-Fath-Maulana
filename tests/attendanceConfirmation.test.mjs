import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./helpers/aliasLoader.mjs', import.meta.url);
const {
  buildChangedEntries, buildCsv, buildFollowupPayload, buildInitialDraft, countDraftStatuses,
  formatTapTime, getTapSuggestion, REKAP_COLUMNS, validateConfirmationEntry, validateFollowup,
} = await import('../src/lib/attendanceConfirmation.js');

const rows = [
  { santri_id: 'a', nama: 'TEST A', tap_waktu: '15:52:00', tap_status: 'Hadir', tap_sesi: 'Sore' },
  { santri_id: 'b', nama: 'TEST B' },
  { santri_id: 'c', nama: 'TEST C', status: 'alpa', keterangan: null },
  { santri_id: 'd', nama: 'TEST D', tap_waktu: '07:05:00', tap_status: 'Terlambat', tap_sesi: 'Pagi' },
];

test('tap RFID/wajah menjadi saran hadir dengan label jam', () => {
  assert.equal(formatTapTime('07:52:10'), '07.52');
  assert.deepEqual(getTapSuggestion(rows[0], 'Sore'), { status: 'hadir', label: 'tercatat tap 15.52' });
  assert.equal(getTapSuggestion(rows[3], 'Sore').label, 'tercatat tap 07.05 (sesi Pagi)');
  assert.equal(getTapSuggestion(rows[1], 'Sore'), null);
  assert.equal(getTapSuggestion({ tap_status: 'Izin' }, 'Sore').status, 'izin');
});

test('draf awal: status tersimpan menang, tanpa tap dibiarkan kosong', () => {
  const draft = buildInitialDraft(rows, 'Sore');
  assert.equal(draft.a.status, 'hadir');
  assert.equal(draft.b.status, '');
  assert.equal(draft.c.status, 'alpa');
  assert.deepEqual(countDraftStatuses(rows, draft), { hadir: 2, izin: 0, sakit: 0, alpa: 1, kosong: 1 });
});

test('hanya entri baru atau berubah yang dikirim (partial update)', () => {
  const draft = buildInitialDraft(rows, 'Sore');
  assert.deepEqual(buildChangedEntries(rows, draft).map((e) => e.santri_id), ['a', 'd']);
  draft.c = { status: 'alpa', keterangan: '  ' };
  assert.equal(buildChangedEntries(rows, draft).some((e) => e.santri_id === 'c'), false);
  draft.c = { status: 'sakit', keterangan: ' demam ' };
  assert.deepEqual(buildChangedEntries(rows, draft).find((e) => e.santri_id === 'c'), { santri_id: 'c', status: 'sakit', keterangan: 'demam' });
});

test('validasi status dan tindak lanjut', () => {
  assert.equal(validateConfirmationEntry({ status: 'hadir' }), null);
  assert.match(validateConfirmationEntry({ status: 'bolos' }), /Status/);
  assert.match(validateConfirmationEntry({ status: 'izin', keterangan: 'x'.repeat(301) }), /maksimal/);
  const form = { saluran: 'whatsapp', hasil: 'terhubung', tanggal_kontak: '2026-11-10', tanggal_peringatan: '', catatan: '' };
  assert.equal(validateFollowup(form, '2026-11-11'), null);
  assert.match(validateFollowup({ ...form, tanggal_kontak: '2026-11-12' }, '2026-11-11'), /masa depan/);
  assert.match(validateFollowup({ ...form, tanggal_peringatan: '2026-11-11' }, '2026-11-11'), /sebelum/);
  assert.match(validateFollowup({ ...form, saluran: 'surat' }, '2026-11-11'), /saluran/);
  assert.deepEqual(buildFollowupPayload({ ...form, catatan: ' ' }, { santriId: 's', classId: 'k' }), {
    santri_id: 's', class_id: 'k', tanggal_peringatan: null, tanggal_kontak: '2026-11-10', saluran: 'whatsapp', hasil: 'terhubung', catatan: null,
  });
});

test('CSV berkode aman untuk Excel', () => {
  const csv = buildCsv([{ kode_santri: 'K-001', kode_kelas: 'Kelas-01', hadir: 5, rerata_hari_peringatan_ke_kontak: null, x: '=HYPERLINK("a")' }], ['kode_santri', 'hadir', 'rerata_hari_peringatan_ke_kontak', 'x']);
  assert.ok(csv.startsWith('﻿kode_santri,hadir,rerata_hari_peringatan_ke_kontak,x\r\n'));
  assert.ok(csv.includes('K-001,5,,"\'=HYPERLINK(""a"")"'));
  assert.ok(REKAP_COLUMNS.every((column) => !/nama|induk|hp/i.test(column)));
});
