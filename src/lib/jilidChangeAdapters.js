import { supabase } from '@/lib/customSupabaseClient';

export const getJilidChangeErrorMessage = (error) => {
  const message = String(error?.message || error || '');

  if (error?.code === '42501' || message.toLowerCase().includes('tidak memiliki akses')) {
    return 'Anda hanya dapat mengubah jilid santri yang berada di kelas Anda.';
  }
  if (error?.code === '40001' || message.toLowerCase().includes('sudah berubah')) {
    return 'Jilid santri sudah berubah. Muat ulang data lalu coba kembali.';
  }
  if (error?.code === 'P0002') {
    return 'Data santri tidak ditemukan.';
  }
  if (error?.code === '28000') {
    return 'Sesi login berakhir. Silakan login kembali.';
  }

  return message || 'Jilid santri gagal disimpan.';
};

export const changeSantriJilid = async ({ santriId, currentJilid, nextJilid }) => {
  const { data, error } = await supabase.rpc('change_santri_jilid', {
    p_santri_id: santriId,
    p_expected_from_jilid: currentJilid,
    p_to_jilid: nextJilid,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.santri_id || result.santri_id !== santriId || result.to_jilid !== nextJilid) {
    throw new Error('Database tidak mengonfirmasi perubahan jilid santri.');
  }

  return result;
};
