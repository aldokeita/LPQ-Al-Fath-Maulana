// Aturan murni untuk panel "Perlu Perhatian" dan pengaturan asisten. Tidak memanggil Supabase.

export const RULE_LABELS = Object.freeze({
  absen_beruntun: 'Tidak hadir beruntun',
  jilid_lama: 'Lama di jilid',
  kehadiran_bulanan: 'Kehadiran bulanan rendah',
  hafalan_macet: 'Hafalan macet',
  hafalan_wajib_belum_lulus: 'Hafalan wajib belum lulus',
  murojaah_belum_ditinjau: "Muroja'ah belum ditinjau",
});

export const TINGKAT_LABELS = Object.freeze({ tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Pengingat' });

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

export const WEEKDAYS = Object.freeze([
  { value: 1, label: 'Senin' }, { value: 2, label: 'Selasa' }, { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' }, { value: 5, label: 'Jumat' }, { value: 6, label: 'Sabtu' }, { value: 7, label: 'Minggu' },
]);

const dayFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// "2026-10-27" -> "Sel, 27 Okt". Tanggal tanpa jam diperlakukan sebagai UTC agar tidak bergeser.
export const formatSchoolDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || '';
  return dayFormatter.format(new Date(`${value}T00:00:00Z`));
};

export const getAbsentDates = (item) => (
  Array.isArray(item?.detail?.absent_dates) ? [...item.detail.absent_dates].sort() : []
);

export const isAttendanceAlert = (item) => item?.rule === 'absen_beruntun';

export const groupAttentionByClass = (items = []) => {
  const groups = new Map();
  items.forEach((item) => {
    const key = item.class_id;
    if (!groups.has(key)) groups.set(key, { classId: key, namaKelas: item.nama_kelas, items: [] });
    groups.get(key).items.push(item);
  });
  return [...groups.values()];
};

const TINGKAT_ORDER = { tinggi: 0, sedang: 1, rendah: 2 };

// Satu kartu per santri: semua perkara terbukanya, tingkat tertinggi di depan.
export const groupAttentionBySantri = (items = []) => {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.santri_id)) {
      groups.set(item.santri_id, { santriId: item.santri_id, nama: item.nama, classId: item.class_id, namaKelas: item.nama_kelas, items: [] });
    }
    groups.get(item.santri_id).items.push(item);
  });
  return [...groups.values()]
    .map((group) => {
      const sorted = [...group.items].sort((a, b) => TINGKAT_ORDER[a.tingkat] - TINGKAT_ORDER[b.tingkat]);
      return { ...group, items: sorted, tingkat: sorted[0].tingkat };
    })
    .sort((a, b) => TINGKAT_ORDER[a.tingkat] - TINGKAT_ORDER[b.tingkat] || b.items.length - a.items.length);
};

export const countByTingkat = (items = []) => items.reduce(
  (acc, item) => ({ ...acc, [item.tingkat]: (acc[item.tingkat] || 0) + 1 }),
  { tinggi: 0, sedang: 0, rendah: 0 },
);

export const validateFollowup = (form, today) => {
  if (!FOLLOWUP_CHANNELS.some((item) => item.value === form?.saluran)) return 'Pilih saluran kontak.';
  if (!FOLLOWUP_RESULTS.some((item) => item.value === form?.hasil)) return 'Pilih hasil kontak.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form?.tanggal_kontak || '')) return 'Tanggal kontak wajib diisi.';
  if (today && form.tanggal_kontak > today) return 'Tanggal kontak tidak boleh di masa depan.';
  if ((form.catatan || '').trim().length > 500) return 'Catatan maksimal 500 karakter.';
  return null;
};

// ===== Pengaturan =====

export const SETTINGS_LIMITS = Object.freeze({
  'attendance.consecutive_sessions': [2, 20],
  'attendance.repeat_every_sessions': [1, 20],
  'attendance.high_consecutive_sessions': [2, 40],
  'attendance.monthly_min_percent': [1, 100],
  'jilid.default_days': [7, 730],
  'jilid.repeat_every_days': [1, 90],
  'hafalan.proses_max_days': [3, 365],
  'hafalan.required_items_after_percent': [10, 100],
  'hafalan.murojaah_review_max_days': [1, 60],
});

const getPath = (obj, path) => path.split('.').reduce((acc, key) => acc?.[key], obj);

const setPath = (obj, path, value) => {
  const keys = path.split('.');
  const next = { ...obj };
  let cursor = next;
  keys.slice(0, -1).forEach((key) => { cursor[key] = { ...(cursor[key] || {}) }; cursor = cursor[key]; });
  cursor[keys[keys.length - 1]] = value;
  return next;
};

export const updateSetting = (settings, path, value) => setPath(settings, path, value);

export const validateSettings = (settings) => {
  if (typeof settings?.silent_mode !== 'boolean') return 'Mode senyap tidak valid.';
  if (!Array.isArray(settings.school_days) || settings.school_days.length === 0) return 'Pilih minimal satu hari sekolah.';
  for (const [path, [min, max]] of Object.entries(SETTINGS_LIMITS)) {
    const value = Number(getPath(settings, path));
    if (!Number.isInteger(value) || value < min || value > max) return `Nilai ${path} harus bilangan bulat ${min}–${max}.`;
  }
  if (settings.attendance.high_consecutive_sessions < settings.attendance.consecutive_sessions) {
    return 'Ambang tingkat tinggi tidak boleh lebih kecil dari ambang peringatan.';
  }
  for (const [jilid, days] of Object.entries(settings.jilid?.per_jilid || {})) {
    if (!Number.isInteger(days) || days < 7 || days > 730) return `Batas ${jilid} harus 7–730 hari.`;
  }
  return null;
};

// Partial update: hanya kunci yang berbeda dari pengaturan tersimpan yang dikirim. Server
// menggabungkannya dengan versi terakhir. per_jilid dikirim utuh bila berubah.
export const buildSettingsPatch = (saved, draft) => {
  const patch = {};
  if (saved.silent_mode !== draft.silent_mode) patch.silent_mode = draft.silent_mode;
  if (JSON.stringify([...saved.school_days].sort()) !== JSON.stringify([...draft.school_days].sort())) {
    patch.school_days = [...draft.school_days].sort((a, b) => a - b);
  }
  Object.keys(SETTINGS_LIMITS).forEach((path) => {
    const next = Number(getPath(draft, path));
    if (Number(getPath(saved, path)) !== next) {
      const [group, key] = path.split('.');
      patch[group] = { ...(patch[group] || {}), [key]: next };
    }
  });
  if (JSON.stringify(saved.jilid?.per_jilid || {}) !== JSON.stringify(draft.jilid?.per_jilid || {})) {
    patch.jilid = { ...(patch.jilid || {}), per_jilid: draft.jilid.per_jilid };
  }
  return patch;
};
