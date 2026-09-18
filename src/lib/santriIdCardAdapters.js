import { supabase } from '@/lib/customSupabaseClient';
import { resolveAvatarRecords } from '@/lib/storageAdapters';
import { getSessionName } from '@/utils/sessionMapping';

export const SANTRI_ID_CARD_SELECT = [
  'id',
  'nama_lengkap',
  'nama_panggilan',
  'nomor_induk_qiroati',
  'jenis_kelamin',
  'kategori',
  'tanggal_lahir',
  'sesi_mengaji',
  'jilid',
  'foto_url',
  'avatar_path',
  'status',
  'deleted_at',
].join(', ');

const BATCH_SIZE = 500;

export const fetchSantriForIdCards = async () => {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('santri')
      .select(SANTRI_ID_CARD_SELECT)
      .is('deleted_at', null)
      .or('status.is.null,status.ilike.aktif,status.ilike.active')
      .order('nama_lengkap', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);

    if (batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  const resolvedRows = await resolveAvatarRecords(rows, { ownerType: 'santri' });
  return resolvedRows.map((row) => ({
    ...row,
    sesi_label: getSessionName(row.sesi_mengaji),
  }));
};
