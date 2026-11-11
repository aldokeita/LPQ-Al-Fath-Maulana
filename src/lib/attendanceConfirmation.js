// Aturan murni untuk absen panggil guru dan ekspor berkode. Tidak memanggil Supabase agar bisa diuji.

export const CONFIRMATION_STATUSES = Object.freeze([
  { value: 'hadir', label: 'Hadir' },
  { value: 'terlambat', label: 'Terlambat' },
  { value: 'tidak_hadir', label: 'Tidak Hadir' },
]);

const STATUS_VALUES = new Set(CONFIRMATION_STATUSES.map((item) => item.value));

export const FOLLOWUP_CHANNELS = Object.freeze([
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telepon', label: 'Telepon' },
  { value: 'tatap_muka', label: 'Tatap muka' },
  { value: 'lainnya', label: 'Lainnya' },
]);

export const FOLLOWUP_RESULTS = Object.freeze([
  { value: 'terhubung', label: 'Terhubung' },
  { value: 'tidak_merespons', label: 'Tidak merespons' },
  { value: 'janji_hadir', label: 'Berjanji hadir' },
  { value: 'lainnya', label: 'Lainnya' },
]);

export const KETERANGAN_MAX = 300;
export const FOLLOWUP_NOTE_MAX = 500;

const normalizeText = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length ? text : null;
};

export const formatTapTime = (time) => {
  if (!time || typeof time !== 'string') return null;
  const [hours, minutes] = time.split(':');
  if (!hours || !minutes) return null;
  return `${hours.padStart(2, '0')}.${minutes.padStart(2, '0')}`;
};

// Saran awal dari tap RFID/wajah. Tap hanya saran; status akhir tetap ditetapkan guru.
// Tap berstatus Terlambat disarankan terlambat; tap Izin/Sakit (input manual lama) disarankan tidak hadir.
export const getTapSuggestion = (row, sesi) => {
  if (!row?.tap_status && !row?.tap_waktu) return null;
  const tapStatus = String(row.tap_status || '').toLowerCase();
  const status = tapStatus === 'terlambat' ? 'terlambat'
    : ['izin', 'sakit', 'alpa', 'tidak hadir'].includes(tapStatus) ? 'tidak_hadir'
      : 'hadir';
  const time = formatTapTime(row.tap_waktu);
  const otherSession = row.tap_sesi && sesi && row.tap_sesi !== sesi ? ` (sesi ${row.tap_sesi})` : '';
  const label = time ? `tercatat tap ${time}${otherSession}` : `tercatat ${tapStatus || 'tap'}${otherSession}`;
  return { status, label };
};

// Draf awal: status tersimpan bila sudah dikonfirmasi; selain itu saran tap; tanpa tap dibiarkan kosong.
export const buildInitialDraft = (rows = [], sesi) => Object.fromEntries(rows.map((row) => {
  const suggestion = getTapSuggestion(row, sesi);
  return [row.santri_id, {
    status: row.status || suggestion?.status || '',
    keterangan: row.keterangan || '',
  }];
}));

export const validateConfirmationEntry = (entry) => {
  if (!entry || !STATUS_VALUES.has(entry.status)) return 'Status harus Hadir, Terlambat, atau Tidak Hadir.';
  if ((entry.keterangan || '').trim().length > KETERANGAN_MAX) return `Keterangan maksimal ${KETERANGAN_MAX} karakter.`;
  return null;
};

// Partial update: hanya entri yang belum tersimpan atau berbeda dari status terkini yang dikirim.
export const buildChangedEntries = (rows = [], draft = {}) => rows.flatMap((row) => {
  const entry = draft[row.santri_id];
  if (!entry?.status) return [];
  const keterangan = normalizeText(entry.keterangan);
  const unchanged = row.status === entry.status && (normalizeText(row.keterangan) === keterangan);
  if (unchanged) return [];
  return [{ santri_id: row.santri_id, status: entry.status, keterangan }];
});

export const countDraftStatuses = (rows = [], draft = {}) => {
  const counts = { hadir: 0, terlambat: 0, tidak_hadir: 0, kosong: 0 };
  rows.forEach((row) => {
    const status = draft[row.santri_id]?.status;
    if (STATUS_VALUES.has(status)) counts[status] += 1;
    else counts.kosong += 1;
  });
  return counts;
};

export const validateFollowup = (form, today) => {
  if (!FOLLOWUP_CHANNELS.some((item) => item.value === form?.saluran)) return 'Pilih saluran kontak.';
  if (!FOLLOWUP_RESULTS.some((item) => item.value === form?.hasil)) return 'Pilih hasil kontak.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form?.tanggal_kontak || '')) return 'Tanggal kontak wajib diisi.';
  if (today && form.tanggal_kontak > today) return 'Tanggal kontak tidak boleh di masa depan.';
  if (form.tanggal_peringatan && form.tanggal_peringatan > form.tanggal_kontak) {
    return 'Tanggal kontak tidak boleh sebelum tanggal peringatan.';
  }
  if ((form.catatan || '').trim().length > FOLLOWUP_NOTE_MAX) return `Catatan maksimal ${FOLLOWUP_NOTE_MAX} karakter.`;
  return null;
};

export const buildFollowupPayload = (form, { santriId, classId }) => ({
  santri_id: santriId,
  class_id: classId,
  tanggal_peringatan: form.tanggal_peringatan || null,
  tanggal_kontak: form.tanggal_kontak,
  saluran: form.saluran,
  hasil: form.hasil,
  catatan: normalizeText(form.catatan),
});

// CSV aman untuk Excel: BOM UTF-8, kutip ganda di-escape, dan teks yang diawali =,+,-,@ dinetralkan.
const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildCsv = (rows = [], columns) => {
  const header = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [header.map(escapeCsvCell).join(',')];
  rows.forEach((row) => lines.push(header.map((key) => escapeCsvCell(row[key])).join(',')));
  return `﻿${lines.join('\r\n')}\r\n`;
};

export const REKAP_COLUMNS = Object.freeze([
  'kode_santri', 'kode_kelas', 'sesi_dikonfirmasi', 'hadir', 'terlambat', 'tidak_hadir',
  'sesi_berubah_status', 'sesi_pada_hari_libur', 'sesi_dengan_tap', 'peringatan', 'tindak_lanjut',
  'tindak_lanjut_terhubung', 'rerata_hari_peringatan_ke_kontak',
]);

export const FOLLOWUP_COLUMNS = Object.freeze([
  'kode_santri', 'kode_kelas', 'kode_guru', 'tanggal_peringatan', 'tanggal_kontak', 'selisih_hari',
  'saluran', 'hasil', 'dari_peringatan_asisten', 'dicatat_at',
]);
