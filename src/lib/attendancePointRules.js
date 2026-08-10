import { buildSessionStartTimestamp } from '../utils/AttendanceStatusLogic.js';

export const EARLY_BONUS_MINUTES = 30;

const NON_ATTENDING_STATUSES = new Set(['tidak hadir', 'alpha', 'ghaib', 'absen', 'izin', 'sakit']);

const isNonAttendingStatus = (status) => (
  NON_ATTENDING_STATUSES.has(String(status || '').trim().toLowerCase())
);

export const computeAttendancePointAward = ({
  role,
  isAdult,
  status,
  timestamp,
  dateStr,
  sesi,
  sessionTimes,
}) => {
  if (role !== 'santri' || isAdult || isNonAttendingStatus(status)) return 0;

  const startTimestamp = buildSessionStartTimestamp(dateStr, sesi, sessionTimes);
  const startMs = startTimestamp ? new Date(startTimestamp).getTime() : Number.NaN;
  const arrivalMs = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();

  if (Number.isFinite(startMs) && Number.isFinite(arrivalMs)) {
    const minutesBeforeStart = Math.floor((startMs - arrivalMs) / 60000);
    if (minutesBeforeStart >= EARLY_BONUS_MINUTES) return 2;
  }

  return status === 'Terlambat' ? 0.5 : 1;
};
