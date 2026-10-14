import { supabase } from '@/lib/customSupabaseClient';
import {
  DEFAULT_SESSION_TIMES,
  calculateTimeDifference,
  determineAttendanceStatus,
  evaluateAttendanceWindow,
  getJakartaTimeString,
  normalizeAttendanceSessionName,
} from '@/utils/AttendanceStatusLogic';
import { getAttendanceErrorMessage, getLocalDateString } from '@/lib/attendanceAdapters';
import { resolveAvatarUrl } from '@/lib/storageAdapters';

// One guru check-in flow for every way a guru is identified: an RFID tap and a recognised face both
// end here, so sessions, MMQ, the off-session info card and Pentashih behave exactly the same.
export const guruQuotes = [
    "Mengajar adalah belajar dua kali.",
    "Guru terbaik mengajar dari hati, bukan hanya dari buku.",
    "Pendidikan adalah senjata paling ampuh untuk mengubah dunia.",
    "Satu anak, satu guru, satu pena bisa mengubah dunia.",
    "Kesabaran Anda adalah jembatan masa depan mereka.",
    "Lelahmu hari ini akan menjadi saksi amal jariyahmu nanti.",
    "Mendidik pikiran tanpa mendidik hati adalah bukan pendidikan sama sekali.",
    "Jadilah inspirasi sebelum mengajarkan materi."
];

export const adultQuotes = [
    "Tak ada kata terlambat untuk belajar Al-Qur'an.",
    "Sebaik-baik kalian adalah yang belajar Al-Qur'an dan mengajarkannya.",
    "Lelah bekerja seharian, sembuhkan dengan lantunan ayat suci.",
    "Setiap huruf yang dibaca adalah pahala yang berlipat ganda.",
    "Kesabaran dunia jangan sampai melalaikan akhirat.",
    "Istiqomah itu berat, tapi hadiahnya surga.",
    "Allah melihat usahamu, bukan hanya hasilmu.",
    "Membaca Al-Qur'an dengan terbata-bata pun mendapat dua pahala."
];

const pick = list => list[Math.floor(Math.random() * list.length)];

export const isPentashihGuru = guru => Boolean((guru.roles && guru.roles.includes('Pentashih'))
  || (guru.jabatan && guru.jabatan.toLowerCase().includes('pentashih')));

export const canCheckIn = (sesi, userRole, isPentashih = false, timestamp = new Date(), sessionTimes = DEFAULT_SESSION_TIMES) => {
    if (isPentashih) return { can: true, message: '' };

    const today = timestamp;
    const dayOfWeek = today.getDay();
    if (userRole === 'guru' && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return { can: false, message: 'Absensi libur pada hari Sabtu dan Minggu.' };
    }

    const windowState = evaluateAttendanceWindow({ timestamp, sesi, sessionTimes });
    return { can: windowState.canRecord, ...windowState };
};

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function recordMmqAttendance({ user, tag, mmqSchedule, todayStr }) {
  try {
    const timestamp = new Date().toISOString();
    const sessionStart = `${todayStr}T${mmqSchedule.start_time}+07:00`;

    let rawStatus = determineAttendanceStatus(timestamp, sessionStart);
    const timeDiff = calculateTimeDifference(timestamp, sessionStart);

    const allowedStatuses = ['Hadir', 'Terlambat', 'Tidak Hadir', 'Alpha', 'Izin', 'Sakit'];
    let validStatus = 'Hadir';

    if (rawStatus === 'Terlambat') validStatus = 'Terlambat';
    else if (['Tidak Hadir', 'Alpha', 'Ghaib'].includes(rawStatus)) validStatus = 'Tidak Hadir';
    else if (['Tepat Waktu', 'Hadir'].includes(rawStatus)) validStatus = 'Hadir';
    else if (rawStatus === 'Izin') validStatus = 'Izin';
    else if (rawStatus === 'Sakit') validStatus = 'Sakit';

    if (!allowedStatuses.includes(validStatus)) {
        throw new Error(`Sistem Error: Status absensi '${validStatus}' tidak diizinkan.`);
    }

    if (!mmqSchedule.id) {
        const { data: fallbackSchedule } = await supabase.from('mmq_schedule').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (fallbackSchedule?.id) {
            mmqSchedule.id = fallbackSchedule.id;
        } else {
            throw new Error("Gagal: Sesi MMQ untuk hari ini tidak ditemukan di database.");
        }
    }

    if (!isValidUUID(mmqSchedule.id)) {
        throw new Error("Gagal: Format ID Jadwal MMQ tidak valid.");
    }

    if (!user.id || !isValidUUID(user.id)) {
        throw new Error("Gagal: Format ID Guru tidak valid.");
    }

    const { data: existingMMQ, error: checkError } = await supabase.from('mmq_attendance')
        .select('id')
        .eq('schedule_id', mmqSchedule.id)
        .eq('guru_id', user.id)
        .eq('attendance_date', todayStr)
        .maybeSingle();

    if (checkError) {
        throw new Error("Gagal memeriksa status absensi sebelumnya.");
    }

    const randomQuote = pick(adultQuotes);

    if (existingMMQ) {
        return {
            type: 'confirmation',
            role: 'guru',
            isMMQ: true,
            message: 'Konfirmasi Kehadiran MMQ',
            name: user.nama,
            photo: user.foto_url,
            rfid: tag,
            attendanceId: existingMMQ.id,
            pendingQuote: randomQuote
        };
    }

    const insertPayload = {
        guru_id: user.id,
        schedule_id: mmqSchedule.id,
        attendance_date: todayStr,
        check_in_timestamp: timestamp,
        status: validStatus
    };

    const { error: mmqError } = await supabase.from('mmq_attendance').insert(insertPayload);

    if (mmqError) {
        let friendlyMessage = "Gagal menyimpan absensi MMQ ke database.";
        if (mmqError.message.includes("mmq_attendance_status_check")) {
            friendlyMessage = `Gagal: Status "${validStatus}" tidak sesuai dengan aturan database. Hubungi admin.`;
        } else if (mmqError.code === '23505') {
            friendlyMessage = 'Guru sudah tercatat hadir pada jadwal MMQ ini.';
        }
        throw new Error(friendlyMessage);
    }

    let msg = `Absensi MMQ: ${validStatus}`;
    if (validStatus === 'Terlambat') msg += ` (${timeDiff} menit)`;

    return {
        type: 'mmq_success',
        name: user.nama,
        photo: user.foto_url,
        status: validStatus,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        message: msg,
        quote: randomQuote
    };
  } catch (err) {
    return {
        type: 'error',
        message: err.message || "Terjadi kesalahan sistem saat absensi MMQ.",
        name: user.nama || "Error",
        photo: user?.foto_url
    };
  }
}

async function buildGuruInfo({ user, tag, guruClasses, sessionTimes }) {
  const [classesResult, attendanceCountResult, historyResult] = await Promise.all([
      guruClasses.length > 0
        ? Promise.resolve({ data: guruClasses })
        : supabase.from('classes').select('*, santri(id, nama_lengkap, jilid, foto_url)').eq('id_guru', user.id).order('sesi'),
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('attendance_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('attendance').select('attendance_date').eq('user_id', user.id).order('attendance_date', { ascending: false }).limit(30)
  ]);
  const infoClasses = classesResult.data;
  const uniqueSessions = [...new Set((infoClasses || []).map(c => c.sesi))];
  const scheduledSessionsCount = uniqueSessions.length;
  const totalMonthAttendance = attendanceCountResult.count || 0;
  const hoursTaught = (totalMonthAttendance * 1.25).toFixed(2);
  const uniqueDates = [...new Set(historyResult.data?.map(h => h.attendance_date) || [])];
  let streak = 0;
  const checkDate = new Date(); checkDate.setDate(checkDate.getDate() - 1);
  while (true) {
      const dateStr = checkDate.toLocaleDateString('en-CA');
      if (uniqueDates.includes(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else { const day = checkDate.getDay(); if (day === 0 || day === 6) { checkDate.setDate(checkDate.getDate() - 1); continue; } break; }
  }
  if ((attendanceCountResult.count || 0) > 0) streak++;
  const timeMap = { 'Pagi': 8, 'Siang': 14, 'Sore': 16, 'Malam': 18 };
  const sortedSessions = uniqueSessions.sort((a, b) => (timeMap[a] || 0) - (timeMap[b] || 0));
  const currentHour = new Date().getHours();
  let nextSession = sortedSessions.find(s => (timeMap[s] || 0) > currentHour);
  if (!nextSession && sortedSessions.length > 0) { nextSession = `${sortedSessions[0]} (Besok)`; } else if (!nextSession) { nextSession = "-"; } else { const startTime = sessionTimes[nextSession]?.start || ''; nextSession = `${nextSession} (${startTime})`; }
  const quote = pick(guruQuotes);
  return { type: 'guru_info', rfid: tag, role: 'guru', name: user.nama, photo: user.foto_url, quote, classesData: infoClasses, roles: user.roles || [], jabatan: user.jabatan, gender: user.jenis_kelamin || 'Laki-laki', no_hp: user.no_hp, stats: { sessions: scheduledSessionsCount, hours: hoursTaught, streak: streak, nextSession }};
}

async function buildGuruStats({ user, sesiUser }) {
  const { count: totalMonthAttendance } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('attendance_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  const hoursTaught = ((totalMonthAttendance || 1) * 1.25).toFixed(2);
  const { data: historyResult } = await supabase.from('attendance').select('attendance_date').eq('user_id', user.id).order('attendance_date', { ascending: false }).limit(30);
  const uniqueDates = [...new Set(historyResult?.map(h => h.attendance_date) || [])];
  let streak = 0;
  const checkDate = new Date(); checkDate.setDate(checkDate.getDate() - 1);
  while (true) {
      const dateStr = checkDate.toLocaleDateString('en-CA');
      if (uniqueDates.includes(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else { const day = checkDate.getDay(); if (day === 0 || day === 6) { checkDate.setDate(checkDate.getDate() - 1); continue; } break; }
  }
  streak++;
  return { hours: hoursTaught, streak, session: sesiUser };
}

// Returns the scan result object the RFID page renders (success, guru_info, warning, error,
// confirmation, mmq_success). `source` labels the attendance row: 'rfid' or 'face'.
export async function runGuruAttendanceScan({ guruData, tag, sessionTimes, source = 'rfid', now = new Date() }) {
  const todayDate = now;
  const todayStr = getLocalDateString(todayDate);
  let sesiUser = '';
  let guruClasses = [];

  const foto_url = await resolveAvatarUrl({
      ownerType: 'guru',
      ownerId: guruData.id,
      fallbackUrl: guruData.foto_url,
  });
  const user = { ...guruData, foto_url };
  const todayDay = todayDate.getDay();
  const { data: mmqSchedule } = await supabase.from('mmq_schedule')
      .select('*')
      .eq('day_of_week', todayDay)
      .eq('is_active', true)
      .maybeSingle();

  if (mmqSchedule) return recordMmqAttendance({ user, tag, mmqSchedule, todayStr });

  // Normal Guru Attendance Session Assignment
  const { data: assignedClasses } = await supabase
    .from('classes')
    .select('*, santri(id, nama_lengkap, jilid, foto_url)')
    .eq('id_guru', user.id)
    .eq('is_active', true);
  guruClasses = assignedClasses || [];
  const assignedSessions = [...new Set(guruClasses.map(item => normalizeAttendanceSessionName(item.sesi)).filter(Boolean))];
  const matchingSessions = assignedSessions
    .map(sesi => ({ sesi, window: evaluateAttendanceWindow({ timestamp: todayDate, dateStr: todayStr, sesi, sessionTimes }) }))
    .filter(item => item.window.canRecord)
    .sort((a, b) => new Date(b.window.openAt) - new Date(a.window.openAt));
  sesiUser = matchingSessions[0]?.sesi || '';

  if (!sesiUser && assignedSessions.length > 0) {
    const { data: previousAttendance } = await supabase
      .from('attendance')
      .select('id, check_in_time, status, sesi')
      .eq('user_id', user.id)
      .eq('attendance_date', todayStr)
      .in('sesi', assignedSessions)
      .order('check_in_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousAttendance) {
      return {
        type: 'success',
        role: 'guru',
        name: user.nama,
        photo: user.foto_url,
        rfid: tag,
        sesi: normalizeAttendanceSessionName(previousAttendance.sesi),
        time: previousAttendance.check_in_time,
        status: previousAttendance.status,
        message: 'Absensi sudah tercatat.',
      };
    }
  }

  const isPentashih = isPentashihGuru(user);
  if (!sesiUser && !isPentashih) return buildGuruInfo({ user, tag, guruClasses, sessionTimes });

  const { data: existingAttendance } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('attendance_date', todayStr).eq('sesi', sesiUser).maybeSingle();
  const successData = { type: 'success', role: 'guru', kategori: '', name: user.nama || user.nama_lengkap, photo: user.foto_url, quote: pick(guruQuotes), points: user.points, jilid: user.jilid, jabatan: user.jabatan, no_hp: user.no_hp, rfid: tag, gender: user.jenis_kelamin, isPentashih, sesi: sesiUser };

  if (existingAttendance) {
    return { ...successData, message: 'Absensi sudah tercatat.', time: existingAttendance.check_in_time, status: existingAttendance.status };
  }

  const checkInStatus = canCheckIn(sesiUser, 'guru', isPentashih, todayDate, sessionTimes);
  if (!checkInStatus.can) {
    return { type: 'warning', message: checkInStatus.message, name: user.nama || user.nama_lengkap, photo: user.foto_url, role: 'guru', rfid: tag };
  }

  const timestamp = todayDate.toISOString();
  const attendanceStatusText = checkInStatus.status || 'Hadir';
  const newAttendance = {
      user_id: user.id,
      role: 'guru',
      attendance_date: todayStr,
      check_in_time: getJakartaTimeString(new Date(timestamp)),
      check_in_timestamp: timestamp,
      class_id: null,
      sesi: sesiUser || (isPentashih ? 'Flex' : 'Pagi'),
      status: attendanceStatusText,
      source,
  };
  const { error: insertError } = await supabase.from('attendance').insert(newAttendance);
  if (insertError) return { type: 'error', message: getAttendanceErrorMessage(insertError), name: user.nama || user.nama_lengkap, photo: user.foto_url };

  // Guru check-ins never award santri points.
  const guruStats = isPentashih ? null : await buildGuruStats({ user, sesiUser });
  return {
    ...successData,
    message: `Absensi ${isPentashih ? '' : `sesi ${sesiUser}`} berhasil!`,
    time: newAttendance.check_in_time,
    status: newAttendance.status,
    points: 0,
    pointsAward: 0,
    levelInfo: null,
    monthlyStats: undefined,
    adultStats: null,
    guruStats,
  };
}

// AttendanceProfileCard props for the guru results the kiosk can show; the RFID page renders the
// same fields. Returns null for results that are a message, not a card.
export function guruScanCardProps(scan) {
  if (scan.type === 'mmq_success') {
    return { variant: 'teacher', name: scan.name, photo: scan.photo, status: scan.status === 'Terlambat' ? 'Terlambat' : 'Hadir',
      time: scan.time, message: scan.message, quote: scan.quote, showSuccessBadge: true };
  }
  if (scan.type === 'guru_info' || (scan.type === 'success' && scan.role === 'guru')) {
    const success = scan.type === 'success';
    return {
      variant: 'teacher', name: scan.name, photo: scan.photo,
      status: success ? (scan.status || 'Hadir') : undefined, time: success ? scan.time : undefined,
      jabatan: scan.jabatan,
      guruStats: success && scan.guruStats ? scan.guruStats : (!success && scan.stats ? { session: scan.stats.sessions, hours: scan.stats.hours, streak: scan.stats.streak } : undefined),
      quote: scan.quote, message: success ? scan.message : undefined, showSuccessBadge: success,
      isPentashih: success ? scan.isPentashih : isPentashihGuru(scan),
    };
  }
  return null;
}
