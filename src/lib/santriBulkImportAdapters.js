import { supabase } from '@/lib/customSupabaseClient';
import { getFunctionErrorMessage } from '@/lib/santriArchiveAdapters';
import { fetchSantriImportIdentities, submitSantriImport } from './santriImportWorkflow.js';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from './featureFlags';

const DEFAULT_IMPORT_ERROR = 'Gagal menyimpan data santri ke database.';

export const formatSantriImportError = (message, santri = {}) => {
  const rawMessage = String(message || '').trim();
  if (!rawMessage) return DEFAULT_IMPORT_ERROR;

  if (rawMessage.includes('DUPLICATE_NOMOR_INDUK') || rawMessage.includes('Nomor Induk Qiroati sudah digunakan')) {
    return `Nomor Induk Qiroati (${santri.nomor_induk_qiroati || '-'}) sudah terdaftar pada santri lain.`;
  }
  if (rawMessage.includes('23505') || rawMessage.toLowerCase().includes('duplicate key')) {
    return `Data identitas santri (${santri.nomor_induk_qiroati || santri.nama_lengkap || '-'}) bentrok dengan data lain.`;
  }
  if (rawMessage.includes('Password') || rawMessage.includes('password')) {
    return 'Password awal login santri tidak memenuhi ketentuan.';
  }
  if (rawMessage.includes('INVALID_SANTRI_CATEGORY')) {
    return 'Kategori santri tidak sesuai. Gunakan Anak, PTPT, atau Dewasa.';
  }
  if (rawMessage.includes('UNAUTHORIZED') || rawMessage.includes('Session')) {
    return 'Sesi login Anda telah berakhir. Silakan login kembali.';
  }
  if (rawMessage.includes('PROFILE_CREATE_FAILED')) return 'Profil akun santri gagal dibuat.';
  if (rawMessage.includes('ALIAS_CREATE_FAILED')) return 'Alias login santri gagal dibuat.';
  if (rawMessage.includes('SANTRI_CREATE_FAILED')) return 'Detail data santri gagal disimpan.';
  if (rawMessage.includes('CREATE_USER_FAILED')) return 'Akun login santri gagal dibuat.';

  return rawMessage
    .replace(/([A-Z0-9_]{5,}:|errcode\s*=\s*['"]?[A-Z0-9]+['"]?|PostgREST error|SQLState\s*\w+)/gi, '')
    .trim() || DEFAULT_IMPORT_ERROR;
};

export const importSantriAccounts = async (records, { onProgress } = {}) => {
  if (!enableEdgeFunctions) throw new Error(edgeFunctionDisabledMessage);
  return submitSantriImport(Array.isArray(records) ? records : [], {
    onProgress,
    createRecord: async body => {
      const { data, error } = await supabase.functions.invoke('manage-user', { body });
      if (error) throw Object.assign(new Error(formatSantriImportError(await getFunctionErrorMessage(error, DEFAULT_IMPORT_ERROR), body.profile)), {
        code: [401, 403].includes(error.context?.status) ? 'UNAUTHORIZED' : undefined,
      });
      if (!data?.ok) throw Object.assign(new Error(formatSantriImportError(data?.error?.message, body.profile)), { code: data?.error?.code });
      return data;
    },
  });
};

export const loadSantriImportIdentities = () => fetchSantriImportIdentities((from, to) =>
  supabase.from('santri')
    .select('id, nama_lengkap, tanggal_lahir, nomor_induk_qiroati, rfid_tag', { count: 'exact' })
    .order('id').range(from, to));
