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
  TELEGRAM_ROLE_REQUIRED: 'Hanya guru dan admin yang bisa menyambungkan Telegram.',
  TELEGRAM_TOO_MANY_TOKENS: 'Terlalu banyak tautan dibuat. Coba lagi satu jam lagi.',
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

export const fetchSantriSnapshots = async (santriIds = []) => {
  if (!santriIds.length) return [];
  const data = await rpc('get_assistant_santri_snapshot', { p_santri_ids: santriIds });
  return Array.isArray(data) ? data : [];
};

export const getMyTelegramLink = () => rpc('get_my_telegram_link');
export const createTelegramLinkToken = () => rpc('create_telegram_link_token');
export const unlinkMyTelegram = () => rpc('unlink_my_telegram');

// ===== Rekomendasi AI (Edge Function assistant-ai) =====

const invokeAssistantAi = async (body) => {
  const { data, error } = await supabase.functions.invoke('assistant-ai', { body });
  if (error) {
    let payload = null;
    try {
      if (error.context && typeof error.context.clone === 'function') payload = await error.context.clone().json();
    } catch { /* bukan JSON */ }
    const err = new Error(payload?.error?.message || error.message || 'Asisten AI tidak dapat dihubungi.');
    err.code = payload?.error?.code || 'AI_UNAVAILABLE';
    throw err;
  }
  if (!data?.ok) {
    const err = new Error(data?.error?.message || 'Asisten AI tidak dapat dihubungi.');
    err.code = data?.error?.code || 'AI_UNAVAILABLE';
    throw err;
  }
  return data.data;
};

export const requestAiRecommendation = (santriId, { refresh = false } = {}) =>
  invokeAssistantAi({ action: 'recommend', santri_id: santriId, refresh });

export const fetchAiStatus = () => invokeAssistantAi({ action: 'status' });
export const testAiConnection = () => invokeAssistantAi({ action: 'test' });

// Rekomendasi terakhir per santri (RLS: admin semua, guru hanya santri kelasnya).
export const fetchLatestAiRecommendations = async (santriIds = []) => {
  if (!santriIds.length) return {};
  const { data, error } = await supabase
    .from('assistant_ai_recommendations')
    .select('id, santri_id, hasil, provider, model, created_at')
    .in('santri_id', santriIds)
    .order('created_at', { ascending: false })
    .limit(santriIds.length * 3);
  if (error) throw error;
  const latest = {};
  for (const row of data || []) if (!latest[row.santri_id]) latest[row.santri_id] = row;
  return latest;
};

export const requestClassInsight = (classId, { refresh = false, onlyCached = false } = {}) =>
  invokeAssistantAi({ action: 'class_insight', class_id: classId, refresh, only_cached: onlyCached });

export const sendAiChat = ({ conversationId, classId, santriId, message }) => invokeAssistantAi({
  action: 'chat', conversation_id: conversationId || null, class_id: classId, santri_id: santriId || null, message,
});

export const fetchAiClasses = async () => {
  const data = await rpc('get_assistant_ai_classes');
  return Array.isArray(data) ? data : [];
};

export const fetchAiClassRoster = async (classId) => {
  const data = await rpc('get_assistant_class_roster', { p_class_id: classId });
  return (Array.isArray(data) ? data : []).map((r) => ({ id: r.santri_id, nama: r.nama_lengkap, panggilan: r.nama_panggilan }));
};

export const fetchAiConversations = async () => {
  const { data, error } = await supabase.from('assistant_ai_conversations')
    .select('id, judul, class_id, santri_id, updated_at').order('updated_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
};

export const fetchAiMessages = async (conversationId) => {
  const { data, error } = await supabase.from('assistant_ai_messages')
    .select('id, role, content, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const deleteAiConversation = async (conversationId) => {
  const { error } = await supabase.from('assistant_ai_conversations').delete().eq('id', conversationId);
  if (error) throw error;
};
