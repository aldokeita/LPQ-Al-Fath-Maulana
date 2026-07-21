export const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
export const LATE_GRACE_MINUTES = 15;

export const DEFAULT_SESSION_TIMES = {
  Pagi: { open: '06:00', start: '07:45', onTimeUntil: '08:00', end: '09:15', defaultQuota: 60 },
  'Pagi 2': { open: '09:15', start: '10:00', onTimeUntil: '10:15', end: '11:30', defaultQuota: 60 },
  Siang: { open: '12:00', start: '13:45', onTimeUntil: '14:00', end: '15:15', defaultQuota: 80 },
  Sore: { open: '15:00', start: '15:45', onTimeUntil: '16:00', end: '17:15', defaultQuota: 80 },
  Malam: { open: '17:45', start: '18:30', onTimeUntil: '18:45', end: '23:00', defaultQuota: 50 },
};

const SESSION_NAME_BY_VALUE = {
  0: 'Pagi',
  1: 'Pagi 2',
  2: 'Siang',
  3: 'Sore',
  4: 'Malam',
};

const pad = (num) => String(num).padStart(2, '0');

export const getJakartaDateString = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export const getJakartaTimeString = (date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

export const buildJakartaTimestamp = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const normalizedTime = String(timeStr).length === 5 ? `${timeStr}:00` : String(timeStr);
  return `${dateStr}T${normalizedTime}+07:00`;
};

export const normalizeAttendanceSessionName = (sesiName) => {
  if (sesiName === null || sesiName === undefined || sesiName === '') return null;
  const raw = String(sesiName).trim();
  return SESSION_NAME_BY_VALUE[raw] || raw;
};

export const getSessionStartTime = (sesiName, sessionTimes = DEFAULT_SESSION_TIMES) =>
  sessionTimes?.[normalizeAttendanceSessionName(sesiName)]?.start || DEFAULT_SESSION_TIMES[normalizeAttendanceSessionName(sesiName)]?.start || null;

export const getSessionOpenTime = (sesiName, sessionTimes = DEFAULT_SESSION_TIMES) =>
  sessionTimes?.[normalizeAttendanceSessionName(sesiName)]?.open || DEFAULT_SESSION_TIMES[normalizeAttendanceSessionName(sesiName)]?.open || null;

export const getSessionOnTimeDeadline = (sesiName, sessionTimes = DEFAULT_SESSION_TIMES) =>
  sessionTimes?.[normalizeAttendanceSessionName(sesiName)]?.onTimeUntil || DEFAULT_SESSION_TIMES[normalizeAttendanceSessionName(sesiName)]?.onTimeUntil || null;

export const getSessionEndTime = (sesiName, sessionTimes = DEFAULT_SESSION_TIMES) =>
  sessionTimes?.[normalizeAttendanceSessionName(sesiName)]?.end || DEFAULT_SESSION_TIMES[normalizeAttendanceSessionName(sesiName)]?.end || null;

export const buildSessionStartTimestamp = (dateStr, sesiName, sessionTimes = DEFAULT_SESSION_TIMES) => {
  const startTime = getSessionStartTime(sesiName, sessionTimes);
  return startTime ? buildJakartaTimestamp(dateStr, startTime) : null;
};

export const buildSessionOpenTimestamp = (dateStr, sesiName, sessionTimes = DEFAULT_SESSION_TIMES) => {
  const openTime = getSessionOpenTime(sesiName, sessionTimes);
  return openTime ? buildJakartaTimestamp(dateStr, openTime) : null;
};

export const buildSessionDeadlineTimestamp = (dateStr, sesiName, sessionTimes = DEFAULT_SESSION_TIMES) => {
  const deadline = getSessionOnTimeDeadline(sesiName, sessionTimes);
  return deadline ? buildJakartaTimestamp(dateStr, deadline) : null;
};

export const buildSessionEndTimestamp = (dateStr, sesiName, sessionTimes = DEFAULT_SESSION_TIMES) => {
  const endTime = getSessionEndTime(sesiName, sessionTimes);
  return endTime ? buildJakartaTimestamp(dateStr, endTime) : null;
};

export const evaluateAttendanceWindow = ({
  timestamp = new Date(),
  dateStr = getJakartaDateString(timestamp),
  sesi,
  sessionTimes = DEFAULT_SESSION_TIMES,
} = {}) => {
  const normalizedSession = normalizeAttendanceSessionName(sesi);
  const config = sessionTimes?.[normalizedSession] || DEFAULT_SESSION_TIMES[normalizedSession];

  if (!normalizedSession || !config) {
    return { canRecord: false, phase: 'invalid', status: null, message: `Sesi ${sesi || '-'} tidak valid.` };
  }

  const current = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const openAt = new Date(buildSessionOpenTimestamp(dateStr, normalizedSession, sessionTimes));
  const deadlineAt = new Date(buildSessionDeadlineTimestamp(dateStr, normalizedSession, sessionTimes));
  const endAt = new Date(buildSessionEndTimestamp(dateStr, normalizedSession, sessionTimes));

  if ([current, openAt, deadlineAt, endAt].some(value => Number.isNaN(value.getTime()))) {
    return { canRecord: false, phase: 'invalid', status: null, message: `Konfigurasi waktu sesi ${normalizedSession} tidak valid.` };
  }

  const currentMinute = Math.floor(current.getTime() / 60000);
  const openMinute = Math.floor(openAt.getTime() / 60000);
  const deadlineMinute = Math.floor(deadlineAt.getTime() / 60000);
  const endMinute = Math.floor(endAt.getTime() / 60000);

  if (currentMinute < openMinute) {
    return {
      canRecord: false,
      phase: 'too_early',
      status: null,
      message: `Absensi sesi ${normalizedSession} baru dibuka pukul ${config.open}.`,
      openAt: openAt.toISOString(),
      deadlineAt: deadlineAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  }

  if (config.closeAfterEnd !== false && currentMinute > endMinute) {
    return {
      canRecord: false,
      phase: 'ended',
      status: null,
      message: `Absensi sesi ${normalizedSession} sudah berakhir pukul ${config.end}.`,
      openAt: openAt.toISOString(),
      deadlineAt: deadlineAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  }

  const status = currentMinute > deadlineMinute ? 'Terlambat' : 'Hadir';

  return {
    canRecord: true,
    phase: status === 'Hadir' ? 'on_time' : 'late',
    status,
    message: '',
    openAt: openAt.toISOString(),
    deadlineAt: deadlineAt.toISOString(),
    endAt: endAt.toISOString(),
  };
};

export const resolveSantriAttendanceSession = ({
  timestamp = new Date(),
  dateStr = getJakartaDateString(timestamp),
  assignedSession,
  sessionTimes = DEFAULT_SESSION_TIMES,
} = {}) => {
  const normalizedAssignedSession = normalizeAttendanceSessionName(assignedSession);
  const assignedWindow = evaluateAttendanceWindow({
    timestamp,
    dateStr,
    sesi: normalizedAssignedSession,
    sessionTimes,
  });

  const current = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const assignedEndAt = assignedWindow.endAt ? new Date(assignedWindow.endAt) : null;
  const assignedSessionHasEnded = assignedEndAt
    && !Number.isNaN(current.getTime())
    && !Number.isNaN(assignedEndAt.getTime())
    && Math.floor(current.getTime() / 60000) > Math.floor(assignedEndAt.getTime() / 60000);

  if (assignedWindow.canRecord && !assignedSessionHasEnded) {
    return {
      can: true,
      ...assignedWindow,
      assignedSession: normalizedAssignedSession,
      attendedSession: normalizedAssignedSession,
      isAlternateSession: false,
    };
  }

  const activeSessions = Object.keys(sessionTimes || {})
    .map(sesi => ({
      sesi: normalizeAttendanceSessionName(sesi),
      window: evaluateAttendanceWindow({ timestamp, dateStr, sesi, sessionTimes }),
    }))
    .filter(item => item.window.canRecord)
    .sort((a, b) => new Date(b.window.openAt) - new Date(a.window.openAt));

  const actualSession = activeSessions[0];
  if (actualSession) {
    return {
      can: true,
      ...actualSession.window,
      assignedSession: normalizedAssignedSession,
      attendedSession: actualSession.sesi,
      isAlternateSession: actualSession.sesi !== normalizedAssignedSession,
    };
  }

  return {
    can: false,
    canRecord: false,
    phase: 'outside_all_sessions',
    status: null,
    assignedSession: normalizedAssignedSession,
    attendedSession: null,
    isAlternateSession: false,
    message: 'Tidak ada sesi absensi yang sedang dibuka saat ini.',
  };
};

export const determineAttendanceStatus = (checkInTimestamp, sessionStartTime, graceMinutes = LATE_GRACE_MINUTES) => {
  if (!checkInTimestamp) return 'Tidak Hadir';
  if (!sessionStartTime) return 'Hadir';

  const checkIn = new Date(checkInTimestamp);
  const start = new Date(sessionStartTime);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(start.getTime())) return 'Hadir';

  const diffMinutes = Math.floor((checkIn.getTime() - start.getTime()) / (1000 * 60));
  return diffMinutes > graceMinutes ? 'Terlambat' : 'Hadir';
};

const EXPLICIT_ABSENCE_STATUSES = new Set(['tidak hadir', 'alpha', 'alpa']);

export const resolveAttendanceRecordStatus = (record, sessionStartTime, graceMinutes = LATE_GRACE_MINUTES) => {
  if (!record) return 'Tidak Hadir';

  const storedStatus = String(record.status || '').trim().toLowerCase();
  if (EXPLICIT_ABSENCE_STATUSES.has(storedStatus)) return 'Tidak Hadir';
  if (storedStatus === 'izin') return 'Izin';
  if (storedStatus === 'sakit') return 'Sakit';
  if (record.attended_session && storedStatus === 'terlambat') return 'Terlambat';
  if (record.attended_session && ['hadir', 'tepat waktu'].includes(storedStatus)) return 'Hadir';

  // Older imported present records can lack check_in_timestamp. Only those
  // records may fall back to created_at; corrected absences must stay absent.
  const isStoredPresent = storedStatus === 'hadir' || storedStatus === 'terlambat';
  const timestamp = record.check_in_timestamp || (isStoredPresent ? record.created_at : null);
  return determineAttendanceStatus(timestamp, sessionStartTime, graceMinutes);
};

export const determineAttendanceStatusFromTimestamp = determineAttendanceStatus; // Alias for backward compatibility if requested

export const calculateTimeDifference = (checkInTimestamp, sessionStartTime) => {
  if (!checkInTimestamp || !sessionStartTime) return 0;

  const checkIn = new Date(checkInTimestamp);
  const start = new Date(sessionStartTime);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(start.getTime())) return 0;
  const diffMinutes = Math.floor((checkIn - start) / (1000 * 60));

  return diffMinutes > 0 ? diffMinutes : 0;
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const day = parts.day || pad(date.getDate());
  const month = parts.month || pad(date.getMonth() + 1);
  const year = parts.year || date.getFullYear();
  const hours = parts.hour || pad(date.getHours());
  const minutes = parts.minute || pad(date.getMinutes());
  const seconds = parts.second || pad(date.getSeconds());

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};
