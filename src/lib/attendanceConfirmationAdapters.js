import { supabase } from '@/lib/customSupabaseClient';
import { buildChangedEntries, buildFollowupPayload } from '@/lib/attendanceConfirmation';

const ERROR_MESSAGES = {
  CLASS_ACCESS_DENIED: 'Anda tidak memiliki akses ke kelas ini.',
  SANTRI_NOT_IN_CLASS: 'Ada santri yang sudah tidak aktif di kelas ini. Muat ulang daftar.',
  FUTURE_DATE_NOT_ALLOWED: 'Absen panggil tidak bisa diisi untuk tanggal yang akan datang.',
  INVALID_ROLL_CALL_INPUT: 'Tanggal atau sesi tidak valid.',
  INVALID_ROLL_CALL_ENTRIES: 'Ada status yang tidak valid.',
  KETERANGAN_TOO_LONG: 'Keterangan terlalu panjang.',
  ADMIN_REQUIRED: 'Ekspor hanya untuk admin.',
  INVALID_EXPORT_RANGE: 'Rentang tanggal tidak valid (maksimal sekitar 13 bulan).',
  AUTH_REQUIRED: 'Sesi login berakhir. Silakan masuk kembali.',
};

export const getConfirmationErrorMessage = (error) => {
  const message = String(error?.message || '');
  const code = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
  if (code) return ERROR_MESSAGES[code];
  if (error?.code === '42501' || /row-level security/i.test(message)) return 'Akses ditolak untuk data ini.';
  return message || 'Terjadi kesalahan. Coba lagi.';
};

export const fetchRollCall = async ({ classId, tanggal, sesi }) => {
  const { data, error } = await supabase.rpc('get_attendance_roll_call', {
    p_class_id: classId,
    p_tanggal: tanggal,
    p_sesi: sesi,
  });
  if (error) throw error;
  return data || { santri: [], libur: null };
};

// Mengirim hanya entri yang berubah. Mengembalikan null bila tidak ada yang perlu disimpan.
export const saveRollCall = async ({ classId, tanggal, sesi, rows, draft }) => {
  const entries = buildChangedEntries(rows, draft);
  if (!entries.length) return null;
  const { data, error } = await supabase.rpc('save_attendance_confirmations', {
    p_class_id: classId,
    p_tanggal: tanggal,
    p_sesi: sesi,
    p_entries: entries,
  });
  if (error) throw error;
  return data;
};

export const fetchClassFollowups = async (classId) => {
  const { data, error } = await supabase
    .from('wali_followups')
    .select('id, santri_id, tanggal_kontak, saluran, hasil, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
};

export const recordWaliFollowup = async ({ form, santriId, classId }) => {
  const { data, error } = await supabase
    .from('wali_followups')
    .insert(buildFollowupPayload(form, { santriId, classId }))
    .select('id, santri_id, tanggal_kontak, saluran, hasil, created_at')
    .single();
  if (error) throw error;
  return data;
};

export const fetchCodedResearchExport = async ({ dari, sampai }) => {
  const params = { p_dari: dari, p_sampai: sampai };
  const [rekap, tindakLanjut] = await Promise.all([
    supabase.rpc('export_rekap_penelitian_berkode', params),
    supabase.rpc('export_tindak_lanjut_berkode', params),
  ]);
  if (rekap.error) throw rekap.error;
  if (tindakLanjut.error) throw tindakLanjut.error;
  return { rekap: rekap.data || [], tindakLanjut: tindakLanjut.data || [] };
};
