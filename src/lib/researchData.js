// Penyusun CSV data penelitian asisten (bahan Bab 4 tesis). Murni, tanpa Supabase, agar mudah diuji.
import { RULE_LABELS } from './assistantAlerts.js';

export const KEPUTUSAN_LABELS = Object.freeze({
  ditangani: 'Ditangani',
  wali_dihubungi: 'Wali dihubungi',
  diabaikan: 'Diabaikan',
  peringatan_keliru: 'Peringatan keliru',
});

export const MASA_LABELS = Object.freeze({ sebelum: 'Sebelum (mode senyap)', sesudah: 'Sesudah (peringatan tampil)' });

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export const toCsvText = (rows) => `﻿${rows.map((r) => r.map(cell).join(',')).join('\n')}`;

const persen = (hadir, sesi) => (Number(sesi) > 0 ? Math.round((1000 * Number(hadir)) / Number(sesi)) / 10 : '');

// Satu baris per peringatan; santri dan kelas sudah berupa kode samaran dari server.
export const researchAlertsCsv = (rows = []) => toCsvText([
  ['tanggal', 'tanggal_acuan', 'kode_santri', 'kode_kelas', 'aturan', 'tingkat', 'masa', 'peringatan_pertama_episode',
    'keputusan_pertama', 'jam_tanggap', 'wali_dihubungi', 'koreksi_hadir', 'keliru',
    'hadir_sebelum', 'sesi_sebelum', 'persen_sebelum', 'hadir_sesudah', 'sesi_sesudah', 'persen_sesudah'],
  ...rows.map((r) => [
    r.tanggal, r.ref_date, r.kode_santri, r.kode_kelas, r.aturan, r.tingkat, r.masa, r.pertama_episode ? 1 : 0,
    r.keputusan_pertama || '', r.jam_tanggap ?? '', r.wali_dihubungi ? 1 : 0, r.koreksi_hadir ? 1 : 0, r.keliru ? 1 : 0,
    r.sebelum_hadir, r.sebelum_sesi, persen(r.sebelum_hadir, r.sebelum_sesi),
    r.sesudah_hadir, r.sesudah_sesi, persen(r.sesudah_hadir, r.sesudah_sesi),
  ]),
]);

// Ringkasan metrik dalam format panjang (bagian, indikator, nilai) agar mudah dipivot.
export const researchSummaryCsv = (m) => {
  if (!m) return toCsvText([['bagian', 'indikator', 'nilai']]);
  const rows = [['bagian', 'indikator', 'nilai']];
  rows.push(['periode', 'dari', m.periode?.dari], ['periode', 'sampai', m.periode?.sampai]);
  (m.masa_senyap || []).forEach((s) => rows.push(['riwayat_mode_senyap', s.mulai, s.senyap ? 'senyap (sebelum)' : 'aktif (sesudah)']));
  (m.masa || []).forEach((x) => {
    rows.push([`masa_${x.masa}`, 'peringatan', x.peringatan], [`masa_${x.masa}`, 'episode', x.episode], [`masa_${x.masa}`, 'santri', x.santri]);
    Object.entries(x.per_aturan || {}).forEach(([k, v]) => rows.push([`masa_${x.masa}`, `aturan:${k}`, v]));
    Object.entries(x.per_tingkat || {}).forEach(([k, v]) => rows.push([`masa_${x.masa}`, `tingkat:${k}`, v]));
  });
  Object.entries(m.ketepatan || {}).forEach(([k, v]) => rows.push(['ketepatan', k, v ?? '']));
  Object.entries(m.tanggap || {}).forEach(([k, v]) => {
    if (k === 'per_keputusan') Object.entries(v || {}).forEach(([kk, vv]) => rows.push(['tanggap', `keputusan:${kk}`, vv]));
    else rows.push(['tanggap', k, v ?? '']);
  });
  (m.dampak || []).forEach((d) => Object.entries(d).forEach(([k, v]) => k !== 'masa' && rows.push([`dampak_${d.masa}`, k, v ?? ''])));
  return toCsvText(rows);
};

export const ruleLabel = (rule) => RULE_LABELS[rule] || rule;
