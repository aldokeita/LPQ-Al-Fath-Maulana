import { supabase } from '@/lib/customSupabaseClient';
import { DEFAULT_SESSION_TIMES } from '@/utils/AttendanceStatusLogic';

export const ATTENDANCE_CONFIGURATION_KEY = 'attendance_session_config';

const SESSION_NAMES = Object.keys(DEFAULT_SESSION_TIMES);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const cloneDefaultSessions = () => Object.fromEntries(
  SESSION_NAMES.map(name => [name, { ...DEFAULT_SESSION_TIMES[name] }]),
);

export const DEFAULT_ATTENDANCE_CONFIGURATION = {
  version: 1,
  enforceSessionEnd: true,
  sessions: cloneDefaultSessions(),
};

const normalizeTime = (value, fallback) => (
  TIME_PATTERN.test(String(value || '').trim()) ? String(value).trim() : fallback
);

export const normalizeAttendanceConfiguration = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  const sourceSessions = source.sessions && typeof source.sessions === 'object'
    ? source.sessions
    : source;

  return {
    version: 1,
    enforceSessionEnd: source.enforceSessionEnd !== false,
    sessions: Object.fromEntries(SESSION_NAMES.map(name => {
      const defaults = DEFAULT_SESSION_TIMES[name];
      const session = sourceSessions?.[name] || {};
      return [name, {
        open: normalizeTime(session.open, defaults.open),
        start: normalizeTime(session.start, defaults.start),
        onTimeUntil: normalizeTime(session.onTimeUntil, defaults.onTimeUntil),
        end: normalizeTime(session.end, defaults.end),
        defaultQuota: Number.isFinite(Number(session.defaultQuota))
          ? Number(session.defaultQuota)
          : defaults.defaultQuota,
      }];
    })),
  };
};

const toMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
};

export const validateAttendanceConfiguration = (value) => {
  const configuration = normalizeAttendanceConfiguration(value);

  for (const name of SESSION_NAMES) {
    const session = configuration.sessions[name];
    const values = [session.open, session.start, session.onTimeUntil, session.end];
    if (values.some(time => !TIME_PATTERN.test(time))) {
      throw new Error(`Format waktu sesi ${name} tidak valid.`);
    }

    const [open, start, deadline, end] = values.map(toMinutes);
    if (!(open <= start && start <= deadline && deadline <= end)) {
      throw new Error(`Urutan waktu sesi ${name} harus: dibuka, mulai, batas tepat waktu, lalu berakhir.`);
    }
  }

  return configuration;
};

export const getAttendanceSessionTimes = (value) => {
  const configuration = normalizeAttendanceConfiguration(value);
  return Object.fromEntries(SESSION_NAMES.map(name => [name, {
    ...configuration.sessions[name],
    closeAfterEnd: configuration.enforceSessionEnd,
  }]));
};

export const fetchAttendanceConfiguration = async () => {
  const { data, error } = await supabase
    .from('website_content')
    .select('content')
    .eq('key', ATTENDANCE_CONFIGURATION_KEY)
    .maybeSingle();
  if (error) throw error;
  return normalizeAttendanceConfiguration(data?.content);
};

export const saveAttendanceConfiguration = async (value) => {
  const configuration = validateAttendanceConfiguration(value);
  const { data, error } = await supabase
    .from('website_content')
    .upsert({
      key: ATTENDANCE_CONFIGURATION_KEY,
      content: configuration,
      is_public: true,
    }, { onConflict: 'key' })
    .select('content')
    .single();
  if (error) throw error;
  return normalizeAttendanceConfiguration(data.content);
};
