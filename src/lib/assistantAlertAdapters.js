import { supabase } from '@/lib/customSupabaseClient';

const ERROR_MESSAGES = {
  ADMIN_REQUIRED: 'Hanya admin yang bisa melakukan ini.',
  CLASS_ACCESS_DENIED: 'Anda tidak memiliki akses ke kelas ini.',
  ALERT_NOT_FOUND: 'Peringatan tidak ditemukan atau bukan untuk kelas Anda.',
  DATE_NOT_IN_ALERT: 'Tanggal yang dipilih tidak termasuk dalam peringatan ini.',
  INVALID_DATES: 'Pilih minimal satu tanggal.',
  REASON_REQUIRED: 'Tulis alasan mengabaikan peringatan.',
  INVALID_CONTACT_DATE: 'Tanggal kontak tidak valid.',
  INVALID_SETTINGS: 'Ada pengaturan di luar batas yang diizinkan.',
  FUTURE_DATE_NOT_ALLOWED: 'Tanggal tidak boleh di masa depan.',
  AUTH_REQUIRED: 'Sesi login berakhir. Silakan masuk kembali.',
};

export const getAssistantErrorMessage = (error) => {
  const message = String(error?.message || '');
  const code = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
  if (code) return ERROR_MESSAGES[code];
  if (error?.code === '42501') return 'Akses ditolak.';
  return message || 'Terjadi kesalahan. Coba lagi.';
};

const rpc = async (name, params) => {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
};

export const fetchAttention = (classId = null) => rpc('get_assistant_attention', { p_class_id: classId });

export const recordPresenceCorrections = ({ alertId, dates, keterangan }) => rpc('record_presence_corrections', {
  p_alert_id: alertId, p_dates: dates, p_keterangan: keterangan || null,
});

export const decideAlert = ({ alertId, keputusan, catatan }) => rpc('decide_assistant_alert', {
  p_alert_id: alertId, p_keputusan: keputusan, p_catatan: catatan || null,
});

// Satu kontak wali untuk satu atau beberapa perkara santri yang sama; tercatat sebagai satu kontak.
export const recordAlertFollowup = ({ alertIds, form }) => rpc('record_alert_wali_followup', {
  p_alert_ids: alertIds,
  p_tanggal_kontak: form.tanggal_kontak,
  p_saluran: form.saluran,
  p_hasil: form.hasil,
  p_catatan: form.catatan?.trim() || null,
});

export const fetchAssistantSettings = () => rpc('get_assistant_settings');

export const saveAssistantSettings = (patch) => rpc('save_assistant_settings', { p_settings: patch });

// Manual oleh admin: memeriksa sampai kemarin, termasuk aturan pekanan (dedupe per pekan mencegah ganda).
export const runAssistantRulesNow = () => rpc('run_assistant_rules', { p_ref: null, p_weekly: true });
