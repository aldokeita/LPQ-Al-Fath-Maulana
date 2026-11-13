import test from 'node:test';
import assert from 'node:assert/strict';

const { researchAlertsCsv, researchSummaryCsv } = await import('../src/lib/researchData.js');

test('CSV per peringatan: kode samaran, persen kehadiran, dan BOM untuk Excel', () => {
  const csv = researchAlertsCsv([{
    tanggal: '2026-01-12', ref_date: '2026-01-12', kode_santri: 'S1A2B3C', kode_kelas: 'K9F0E', aturan: 'absen_beruntun', tingkat: 'sedang',
    masa: 'sesudah', pertama_episode: true, keputusan_pertama: 'ditangani', jam_tanggap: 6, wali_dihubungi: false, koreksi_hadir: false,
    keliru: false, sebelum_hadir: 15, sebelum_sesi: 20, sesudah_hadir: 18, sesudah_sesi: 20,
  }]);
  assert.ok(csv.startsWith('﻿"tanggal"'));
  const line = csv.split('\n')[1];
  assert.equal(line, '"2026-01-12","2026-01-12","S1A2B3C","K9F0E","absen_beruntun","sedang","sesudah","1","ditangani","6","0","0","0","15","20","75","18","20","90"');
});

test('CSV ringkasan memuat masa, ketepatan, tanggap, dan dampak', () => {
  const csv = researchSummaryCsv({
    periode: { dari: '2026-01-01', sampai: '2026-01-31' },
    masa_senyap: [{ mulai: '2026-01-01', senyap: true }],
    masa: [{ masa: 'sesudah', peringatan: 3, episode: 3, santri: 1, per_aturan: { absen_beruntun: 1 }, per_tingkat: { sedang: 1 } }],
    ketepatan: { dinilai: 3, keliru: 2, koreksi_hadir: 1, presisi_persen: 33.3 },
    tanggap: { median_jam: 27, per_keputusan: { ditangani: 1 } },
    dampak: [{ masa: 'sesudah', episode: 2, dengan_data: 1, rata_sebelum_persen: 70, rata_sesudah_persen: 85, selisih_poin: 15 }],
  });
  for (const expected of ['"riwayat_mode_senyap","2026-01-01","senyap (sebelum)"', '"masa_sesudah","aturan:absen_beruntun","1"',
    '"ketepatan","presisi_persen","33.3"', '"tanggap","keputusan:ditangani","1"', '"dampak_sesudah","selisih_poin","15"']) {
    assert.ok(csv.includes(expected), expected);
  }
  assert.equal(researchSummaryCsv(null), '﻿"bagian","indikator","nilai"');
});
