import { supabase } from '@/lib/customSupabaseClient';
import { pickSantriProfileFields } from '@/lib/dataMasterAdapters';
import { getFunctionErrorMessage } from '@/lib/santriArchiveAdapters';

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
  const rows = Array.isArray(records) ? records : [];
  const failures = [];
  let successCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const santri = rows[index] || {};

    try {
      const profilePayload = pickSantriProfileFields(santri);
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'create',
          role: 'santri',
          profile: profilePayload,
          initial_password: santri.password || santri.nomor_induk_qiroati || santri.nama_panggilan || '1234',
        },
      });

      if (error) {
        throw new Error(formatSantriImportError(await getFunctionErrorMessage(error, DEFAULT_IMPORT_ERROR), santri));
      }
      if (!data?.ok || !data?.data?.user_id) {
        throw new Error(formatSantriImportError(data?.error?.message, santri));
      }

      successCount += 1;
    } catch (error) {
      failures.push({
        row: santri.__importRow || index + 1,
        name: santri.nama_lengkap || 'Tanpa nama',
        niq: santri.nomor_induk_qiroati || '',
        reason: formatSantriImportError(error?.message, santri),
      });
    } finally {
      onProgress?.({ completed: index + 1, total: rows.length, successCount, failureCount: failures.length });
    }
  }

  return { successCount, failures };
};
