import { supabase } from '@/lib/customSupabaseClient';

export const getJilidChangeErrorMessage = (error) => {
  const message = String(error?.message || error || '');

  if (message.includes('Login diperlukan') || message.includes('AUTHENTICATION_REQUIRED') || error?.code === '28000') {
    return 'Sesi login berakhir. Silakan login kembali.';
  }
  if (error?.code === '42501' || message.toLowerCase().includes('tidak memiliki akses')) {
    return 'Anda hanya dapat mengubah jilid santri yang berada di kelas Anda.';
  }
  if (error?.code === '40001' || message.toLowerCase().includes('sudah berubah')) {
    return 'Jilid santri sudah berubah. Muat ulang data lalu coba kembali.';
  }
  if (error?.code === 'P0002') {
    return 'Data santri tidak ditemukan.';
  }
  if (message.includes('Jilid tujuan harus berbeda')) {
    return 'Jilid tujuan harus berbeda dari jilid saat ini.';
  }

  return message || 'Jilid santri gagal disimpan.';
};

export const changeSantriJilid = async ({ santriId, currentJilid, nextJilid }) => {
  const { data, error } = await supabase.rpc('change_santri_jilid_v2', {
    p_santri_id: santriId,
    p_expected_from_jilid: currentJilid,
    p_to_jilid: nextJilid,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.santri_id || result.santri_id !== santriId || result.to_jilid !== nextJilid || !result.history_id || !result.changed_at) {
    throw new Error('Database tidak mengonfirmasi perubahan jilid santri.');
  }

  return result;
};
