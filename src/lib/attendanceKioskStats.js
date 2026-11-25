// Live numbers for the themed RFID kiosk: today's santri attendance summary, the last few
// check-ins, and which session is running now. Pure helpers are exported for tests.

const PRESENT_STATUSES = new Set(['hadir', 'tepat waktu', 'terlambat']);
const LATE_STATUSES = new Set(['terlambat']);

const toMinutes = (value) => {
  const [h, m] = String(value || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

const jakartaMinutes = (now) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return (get('hour') % 24) * 60 + get('minute');
};

const dotted = (value) => String(value || '').slice(0, 5).replace(':', '.');

// The session whose open..end window holds `now` (latest opened wins), else the next one today.
export const resolveActiveSession = (sessionTimes = {}, now = new Date()) => {
  const minutes = jakartaMinutes(now);
  const sessions = Object.entries(sessionTimes || {})
    .map(([name, times]) => ({
      name,
      open: toMinutes(times?.open ?? times?.start),
      start: times?.start,
      end: times?.end,
      endMin: toMinutes(times?.end),
    }))
    .filter((s) => s.open !== null && s.endMin !== null)
    .sort((a, b) => a.open - b.open);

  const running = sessions.filter((s) => minutes >= s.open && minutes <= s.endMin).pop();
  const session = running || sessions.find((s) => s.open > minutes) || null;
  if (!session) return null;
  return {
    name: session.name,
    running: Boolean(running),
    range: session.start && session.end ? `${dotted(session.start)} – ${dotted(session.end)}` : '',
  };
};

// rows: today's santri attendance rows; names: { [santriId]: name }; activeSantri: active count.
export const summarizeTodayAttendance = ({ rows = [], names = {}, activeSantri = 0, limit = 3 } = {}) => {
  const firstBySantri = new Map();
  rows.forEach((row) => {
    const status = String(row.status || '').trim().toLowerCase();
    if (!PRESENT_STATUSES.has(status) || !row.user_id) return;
    const previous = firstBySantri.get(row.user_id);
    const stamp = row.check_in_timestamp || '';
    if (!previous || stamp < (previous.check_in_timestamp || '')) firstBySantri.set(row.user_id, row);
  });

  const present = [...firstBySantri.values()];
  const late = present.filter((row) => LATE_STATUSES.has(String(row.status).trim().toLowerCase())).length;
  const onTimePercent = present.length ? Math.round(((present.length - late) / present.length) * 100) : null;
  const recent = [...present]
    .sort((a, b) => String(b.check_in_timestamp || '').localeCompare(String(a.check_in_timestamp || '')))
    .slice(0, limit)
    .map((row) => ({
      id: row.user_id,
      time: String(row.check_in_time || '').slice(0, 8),
      name: names[row.user_id] || 'Santri',
      late: LATE_STATUSES.has(String(row.status).trim().toLowerCase()),
    }));

  return {
    present: present.length,
    notYet: Math.max(Number(activeSantri || 0) - present.length, 0),
    onTimePercent,
    recent,
  };
};

export const fetchTodayKioskStats = async ({ supabase, today }) => {
  const [attendanceResult, activeResult] = await Promise.all([
    supabase
      .from('attendance')
      .select('user_id, status, check_in_time, check_in_timestamp')
      .eq('attendance_date', today)
      .eq('role', 'santri'),
    supabase
      .from('santri')
      .select('id', { count: 'exact', head: true })
      .in('status', ['Aktif', 'aktif', 'Active', 'active']),
  ]);
  const rows = attendanceResult.error ? [] : (attendanceResult.data || []);
  const draft = summarizeTodayAttendance({ rows, activeSantri: activeResult.count || 0 });
  const ids = draft.recent.map((item) => item.id);
  let names = {};
  if (ids.length) {
    const { data } = await supabase.from('santri').select('id, nama_lengkap, nama_panggilan').in('id', ids);
    names = Object.fromEntries((data || []).map((s) => [s.id, s.nama_lengkap || s.nama_panggilan]));
  }
  return summarizeTodayAttendance({ rows, names, activeSantri: activeResult.count || 0 });
};
