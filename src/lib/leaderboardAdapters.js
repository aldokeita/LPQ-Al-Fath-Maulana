import { supabase } from '@/lib/customSupabaseClient';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

export const LEADERBOARD_PAGE_SIZE = 10;

const LEADERBOARD_COLUMNS = 'id, nama_lengkap, points, foto_url, avatar_path, sesi_mengaji, jilid';

export const canReadLeaderboard = (role) => ['admin', 'guru'].includes(role);

export const canManageLeaderboard = (role) => role === 'admin';

export const getLeaderboardRank = ({ page = 1, index = 0, pageSize = LEADERBOARD_PAGE_SIZE } = {}) => (
  ((Math.max(1, Number(page) || 1) - 1) * Math.max(1, Number(pageSize) || LEADERBOARD_PAGE_SIZE)) + index + 1
);

export const fetchLeaderboardPage = async ({ page = 1, pageSize = LEADERBOARD_PAGE_SIZE } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || LEADERBOARD_PAGE_SIZE);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const { data, count, error } = await supabase
    .from('santri')
    .select(LEADERBOARD_COLUMNS, { count: 'exact' })
    .order('points', { ascending: false, nullsFirst: false })
    .order('nama_lengkap', { ascending: true })
    .range(from, to);

  if (error) throw error;

  return {
    students: await resolveAvatarRecords(data || [], { ownerType: 'santri' }),
    totalStudents: count || 0,
    page: safePage,
    pageSize: safePageSize,
  };
};

// Peringkat seluruh santri (lintas kelas) lewat RPC; guru hanya melihat kolom leaderboard.
export const fetchGlobalLeaderboardPage = async ({ page = 1, pageSize = LEADERBOARD_PAGE_SIZE } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || LEADERBOARD_PAGE_SIZE);
  const { data, error } = await supabase.rpc('get_global_leaderboard', { p_page: safePage, p_page_size: safePageSize });
  if (error) {
    if (error.code === 'PGRST202' || /get_global_leaderboard/.test(error.message || '')) {
      const notReady = new Error('Leaderboard global belum aktif di server.');
      notReady.code = 'GLOBAL_LEADERBOARD_UNAVAILABLE';
      throw notReady;
    }
    throw error;
  }
  return {
    students: await resolveAvatarRecords(data?.students || [], { ownerType: 'santri' }),
    totalStudents: Number(data?.total) || 0,
    page: safePage,
    pageSize: safePageSize,
  };
};
