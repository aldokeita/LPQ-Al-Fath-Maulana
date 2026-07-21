import { supabase } from '@/lib/customSupabaseClient';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';

const ALLOWED_ATTENDANCE_STATUSES = new Set(['Hadir', 'Terlambat', 'Tidak Hadir', 'Alpha', 'Izin', 'Sakit']);

const toDbTime = (value) => {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
};

export const getMmqErrorMessage = (error) => {
  if (!error) return 'Terjadi kesalahan pada fitur MMQ.';
  const message = error.message || '';

  if (error.code === '23505' || message.toLowerCase().includes('duplicate')) {
    return 'Kehadiran MMQ untuk guru, jadwal, dan tanggal tersebut sudah tercatat.';
  }

  if (error.code === '42501' || message.toLowerCase().includes('row-level security')) {
    return 'Akses MMQ tidak diizinkan untuk akun ini.';
  }

  if (message.includes('mmq_attendance_status_check')) {
    return 'Status kehadiran MMQ tidak sesuai aturan database.';
  }

  return message || 'Terjadi kesalahan pada fitur MMQ.';
};

const sanitizeSchedulePayload = (payload) => ({
  day_of_week: Number(payload.day_of_week),
  start_time: toDbTime(payload.start_time),
  end_time: toDbTime(payload.end_time),
  location: payload.location || null,
  is_active: payload.is_active ?? true,
});

const sanitizeAttendancePayload = (payload) => {
  const status = ALLOWED_ATTENDANCE_STATUSES.has(payload.status) ? payload.status : 'Hadir';

  return {
    schedule_id: payload.schedule_id,
    guru_id: payload.guru_id,
    attendance_date: payload.attendance_date,
    check_in_timestamp: payload.check_in_timestamp || null,
    status,
    notes: payload.notes || null,
  };
};

export const fetchMmqSchedules = async () => {
  const { data, error } = await supabase
    .from('mmq_schedule')
    .select('id, day_of_week, start_time, end_time, location, is_active')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const saveMmqSchedule = async (payload) => {
  const schedulePayload = sanitizeSchedulePayload(payload);
  const query = payload.id
    ? supabase.from('mmq_schedule').update(schedulePayload).eq('id', payload.id)
    : supabase.from('mmq_schedule').insert(schedulePayload);

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
};

export const deleteMmqSchedule = async (id) => {
  const { error } = await supabase.from('mmq_schedule').delete().eq('id', id);
  if (error) throw error;
};

export const fetchMmqAttendance = async ({ date } = {}) => {
  let query = supabase
    .from('mmq_attendance')
    .select(`
      id,
      schedule_id,
      guru_id,
      attendance_date,
      check_in_timestamp,
      status,
      notes,
      guru:guru_id(id, nama, foto_url, no_hp),
      schedule:schedule_id(id, day_of_week, start_time, end_time, location)
    `)
    .order('attendance_date', { ascending: false })
    .order('check_in_timestamp', { ascending: false, nullsFirst: false });

  if (date) {
    query = query.eq('attendance_date', date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Promise.all((data || []).map(async (record) => ({
    ...record,
    guru: await resolveAvatarRecord(record.guru, { ownerType: 'guru' }),
  })));
};

export const saveMmqAttendance = async (payload) => {
  const attendancePayload = sanitizeAttendancePayload(payload);
  const query = payload.id
    ? supabase.from('mmq_attendance').update(attendancePayload).eq('id', payload.id)
    : supabase.from('mmq_attendance').insert(attendancePayload);

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
};

export const createMmqAttendance = async (payload) => {
  const attendancePayload = sanitizeAttendancePayload(payload);
  const { data, error } = await supabase
    .from('mmq_attendance')
    .insert(attendancePayload)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteMmqAttendance = async (id) => {
  const { error } = await supabase.from('mmq_attendance').delete().eq('id', id);
  if (error) throw error;
};

export const fetchMmqNotulensi = async () => {
  const { data, error } = await supabase
    .from('mmq_notulensi')
    .select(`
      id,
      schedule_id,
      tanggal,
      judul,
      isi,
      notulen_id,
      notulen:notulen_id(id, nama),
      schedule:schedule_id(id, day_of_week, start_time, end_time, location)
    `)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createMmqNotulensi = async ({ schedule_id, tanggal, judul, isi, notulen_id }) => {
  const { data, error } = await supabase
    .from('mmq_notulensi')
    .insert({ schedule_id, tanggal, judul, isi, notulen_id })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateMmqNotulensi = async (id, payload) => {
  const { data, error } = await supabase
    .from('mmq_notulensi')
    .update({
      judul: payload.judul,
      isi: payload.isi,
      tanggal: payload.tanggal,
      schedule_id: payload.schedule_id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteMmqNotulensi = async (id) => {
  const { error } = await supabase.from('mmq_notulensi').delete().eq('id', id);
  if (error) throw error;
};

export const fetchGuruForMmq = async () => {
  const { data, error } = await supabase
    .from('guru')
    .select('id, nama, email, no_hp, foto_url, rfid_tag, is_notulen')
    .order('nama', { ascending: true });

  if (error) throw error;
  return resolveAvatarRecords(data, { ownerType: 'guru' });
};

export const findGuruByRfid = async (rfidTag) => {
  const { data, error } = await supabase
    .from('guru')
    .select('id, nama, foto_url, rfid_tag, is_notulen')
    .eq('rfid_tag', rfidTag)
    .maybeSingle();

  if (error) throw error;
  return resolveAvatarRecord(data, { ownerType: 'guru' });
};

export const pickScheduleForToday = (schedules, date = new Date()) => {
  const activeSchedules = (schedules || []).filter((schedule) => schedule.is_active);
  if (activeSchedules.length === 0) return null;

  const todaySchedule = activeSchedules.find((schedule) => Number(schedule.day_of_week) === date.getDay());
  return todaySchedule || activeSchedules[0];
};
