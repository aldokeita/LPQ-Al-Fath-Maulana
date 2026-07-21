import { supabase } from '@/lib/customSupabaseClient';
import { mapSantriForLegacyUi } from '@/lib/dataMasterAdapters';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

const ARCHIVE_SELECT = [
  'id',
  'nama_lengkap',
  'nama_panggilan',
  'nomor_induk_qiroati',
  'kategori',
  'status',
  'deleted_at',
  'archive_reason',
  'current_class_id',
  'sesi_mengaji',
  'jilid',
  'foto_url',
  'avatar_path',
].join(',');

export const getFunctionErrorMessage = async (error, fallback) => {
  if (!error) return fallback;

  try {
    const response = error.context;
    if (response && typeof response.clone === 'function') {
      const payload = await response.clone().json();
      return payload?.error?.message || payload?.message || fallback;
    }
  } catch {
    // Fall through to the safe message below.
  }

  return error.message || fallback;
};

export const getArchivedSantri = async (categories = []) => {
  const [{ data: santriRows, error: santriError }, { data: classRows, error: classError }] = await Promise.all([
    supabase
      .from('santri')
      .select(ARCHIVE_SELECT)
      .or('status.eq.Nonaktif,status.eq.inactive,deleted_at.not.is.null')
      .order('deleted_at', { ascending: false, nullsFirst: false }),
    supabase.from('classes').select('id,nama_kelas'),
  ]);

  if (santriError) throw santriError;
  if (classError) throw classError;

  const normalizedCategories = new Set(categories.map((category) => String(category).toLowerCase()));
  const classNames = new Map((classRows || []).map((item) => [item.id, item.nama_kelas]));
  const filteredRows = (santriRows || []).filter((item) => (
    normalizedCategories.size === 0 || normalizedCategories.has(String(item.kategori || 'Anak').toLowerCase())
  ));
  const resolvedRows = await resolveAvatarRecords(filteredRows, { ownerType: 'santri' });

  return resolvedRows.map((item) => ({
    ...mapSantriForLegacyUi(item),
    class_name: classNames.get(item.current_class_id) || 'Belum ditempatkan',
  }));
};

export const setSantriArchived = async ({ santriId, archived, reason }) => {
  const action = archived ? 'archive' : 'restore';
  const fallback = archived
    ? 'Santri gagal dipindahkan ke arsip.'
    : 'Santri gagal dipulihkan dari arsip.';
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: {
      action,
      role: 'santri',
      target_user_id: santriId,
      reason: reason || undefined,
    },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error, fallback));
  if (!data?.ok) throw new Error(data?.error?.message || fallback);
  return data.data;
};

export const archiveSantriAccounts = async (santriIds, reason) => {
  for (const santriId of santriIds) {
    await setSantriArchived({ santriId, archived: true, reason });
  }
};
