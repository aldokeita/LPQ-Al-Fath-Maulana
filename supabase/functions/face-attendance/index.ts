import { getUserFromRequest } from '../_shared/auth.ts';
import { getServiceRoleClient } from '../_shared/supabaseAdmin.ts';
import { handleOptions } from '../_shared/cors.ts';
import { ok, fail } from '../_shared/response.ts';
import { logSafe } from '../_shared/safeLogger.ts';
import { CALIBRATION_HINT, isUuid as uuid, parseCalibration, validateCapture, validateConsent, validateSelfConsent } from '../_shared/faceCapture.js';
import { getAttendanceSessionTimes } from '../_shared/attendanceConfiguration.js';
import { getJakartaDateString, normalizeAttendanceSessionName, resolveSantriAttendanceSession } from '../_shared/attendanceRules.js';
import { computeAttendancePointAward } from '../_shared/attendancePoints.js';

const messages: Record<string, string> = {
  FORBIDDEN: 'Anda tidak memiliki akses untuk operasi ini.',
  CONSENT_REQUIRED: 'Persetujuan wali tertulis dan data formulir yang valid wajib dilengkapi.',
  INVALID_CHALLENGE: 'Tantangan kamera kedaluwarsa atau sudah digunakan. Mulai lagi.',
  INVALID_CAPTURE: 'Tangkapan belum valid. Pastikan hanya satu wajah dan ikuti petunjuk kamera.',
  INVALID_REQUEST: 'Permintaan tidak valid. Muat ulang halaman lalu coba lagi.',
  INVALID_CALIBRATION: CALIBRATION_HINT,
  UNSTABLE_CAPTURE: 'Hasil beberapa frame belum konsisten. Silakan ulangi.',
  RATE_LIMITED: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.',
  ACTIVE_SANTRI_REQUIRED: 'Santri aktif tidak ditemukan.',
  ACTIVE_GURU_REQUIRED: 'Registrasi wajah mandiri hanya untuk akun guru yang aktif.',
};

async function readBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('INVALID_CAPTURE');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 32768) { await reader.cancel(); throw new Error('INVALID_CAPTURE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 'Gunakan POST.', 405);
  // An explicit test-backend switch is required; deploying this code does not enable biometrics.
  if (Deno.env.get('FACE_ATTENDANCE_PILOT') !== 'true') return fail(req, 'PILOT_DISABLED', 'Backend pilot absensi wajah belum diaktifkan.', 403);
  try {
    const { user, client } = await getUserFromRequest(req);
    if (!user || !client) return fail(req, 'UNAUTHORIZED', 'Silakan login kembali.', 401);
    const payload = await readBody(req);
    const fields: Record<string,string[]> = {
      status:['action','santriId'],delete:['action','santriId'],
      calibrate:['action','maxDistance','minMargin','testReference'],
      challenge:['action','purpose','santriId','guruId','consent'],
      enroll:['action','santriId','consent','challengeId','modelVersion','descriptors','evidence'],
      recognize:['action','challengeId','modelVersion','descriptors','evidence'],
      retry:['action','receiptId'],rfid:['action','rfidTag','receiptId'],
      self_status:['action'],self_delete:['action'],
      self_enroll:['action','challengeId','modelVersion','descriptors','evidence','consent'],
      guru_status:['action','guruId'],guru_delete:['action','guruId'],
      guru_enroll:['action','guruId','challengeId','modelVersion','descriptors','evidence','consent'],
    };
    if (!payload || !fields[payload.action] || Object.keys(payload).some(key=>!fields[payload.action].includes(key))) throw new Error('INVALID_CAPTURE');
    const admin = getServiceRoleClient();
    const operation = async (action: string, body: unknown) => {
      const { data, error } = await admin.rpc('pilot_face_operation', { p_actor: user.id, p_action: action, p_payload: body });
      if (error) throw new Error(messages[error.message] ? error.message : 'BACKEND_ERROR');
      return data;
    };
    if (['status', 'delete', 'calibrate'].includes(payload.action)) {
      if (payload.action !== 'calibrate' && !uuid(payload.santriId)) throw new Error('INVALID_REQUEST');
      if (payload.action === 'calibrate') return ok(req, await operation('calibrate', { action:'calibrate', ...parseCalibration(payload) }));
      return ok(req, await operation(payload.action, payload));
    }
    // A guru acts only on their own face; the database checks the caller has an active guru row.
    if (payload.action === 'self_status' || payload.action === 'self_delete') return ok(req, await operation(payload.action, {}));
    // An admin manages another guru's face from Manajemen Guru; the database enforces admin-only.
    if (payload.action === 'guru_status' || payload.action === 'guru_delete') {
      if (!uuid(payload.guruId)) throw new Error('INVALID_REQUEST');
      return ok(req, await operation(payload.action, { guruId: payload.guruId }));
    }
    if (payload.action === 'challenge') {
      if (!['enroll', 'self_enroll', 'guru_enroll', 'attendance'].includes(payload.purpose)) throw new Error('INVALID_CAPTURE');
      if (payload.guruId !== undefined && payload.purpose !== 'guru_enroll') throw new Error('INVALID_REQUEST');
      if (payload.purpose === 'enroll') {
        if (!uuid(payload.santriId)) throw new Error('INVALID_REQUEST');
        validateConsent(payload.consent, getJakartaDateString());
      }
      if (payload.purpose === 'self_enroll') {
        if (payload.santriId !== undefined) throw new Error('INVALID_REQUEST');
        validateSelfConsent(payload.consent);
        return ok(req, await operation('challenge', { purpose: 'self_enroll' }));
      }
      if (payload.purpose === 'guru_enroll') {
        if (!uuid(payload.guruId) || payload.santriId !== undefined) throw new Error('INVALID_REQUEST');
        validateSelfConsent(payload.consent);
        return ok(req, await operation('challenge', { purpose: 'guru_enroll', guruId: payload.guruId }));
      }
      return ok(req, await operation('challenge', payload));
    }
    let santriId; let receiptId; let source;
    if (['enroll', 'self_enroll', 'guru_enroll', 'recognize'].includes(payload.action)) {
      if (!uuid(payload.challengeId)) throw new Error('INVALID_REQUEST');
      const challenge = await operation('inspect', { challengeId: payload.challengeId });
      validateCapture(payload, challenge);
      if (payload.action === 'enroll') {
        validateConsent(payload.consent, getJakartaDateString());
        return ok(req, await operation('enroll', payload));
      }
      if (payload.action === 'self_enroll' || payload.action === 'guru_enroll') {
        if (payload.action === 'guru_enroll' && !uuid(payload.guruId)) throw new Error('INVALID_REQUEST');
        validateSelfConsent(payload.consent);
        return ok(req, await operation(payload.action, payload));
      }
      const { bestDistance, secondDistance, ...match } = await operation('match', payload);
      // Calibration aid: distances stay in server logs and never reach the browser.
      logSafe('info', 'face_match', { state: match.state, best_distance: bestDistance ?? null, second_distance: secondDistance ?? null });
      // A guru match records nothing here: the kiosk runs the same guru flow as an RFID tap.
      if (match.state === 'guru_matched') return ok(req, { state: match.state, guruId: match.guruId, receiptId: match.receiptId });
      if (match.state !== 'matched') return ok(req, match);
      santriId = match.santriId; receiptId = match.receiptId; source = 'face';
    } else if (payload.action === 'retry') {
      if (!uuid(payload.receiptId)) throw new Error('INVALID_REQUEST');
      const match = await operation('resume', payload);
      if (match.state === 'guru_matched') return ok(req, { state: match.state, guruId: match.guruId, receiptId: match.receiptId });
      santriId = match.santriId; receiptId = match.receiptId; source = 'face';
    } else if (payload.action === 'rfid') {
      if (typeof payload.rfidTag !== 'string' || !payload.rfidTag.trim() || payload.rfidTag.length > 64 || !uuid(payload.receiptId)) throw new Error('INVALID_REQUEST');
      const { data, error } = await client.from('santri').select('id').eq('rfid_tag', payload.rfidTag.trim()).maybeSingle();
      if (error || !data) throw new Error('ACTIVE_SANTRI_REQUIRED');
      santriId = data.id; receiptId = payload.receiptId; source = 'rfid';
    } else throw new Error('INVALID_CAPTURE');
    const { data: santri, error: studentError } = await client.from('santri')
      .select('id,kategori,sesi_mengaji,current_class_id,class:current_class_id(sesi)')
      .eq('id', santriId).maybeSingle();
    if (studentError || !santri) throw new Error('ACTIVE_SANTRI_REQUIRED');
    const { data: settings, error: settingsError } = await admin.from('website_content').select('content')
      .eq('key', 'attendance_session_config').maybeSingle();
    if (settingsError) throw new Error('BACKEND_ERROR');
    const timestamp = new Date(); const dateStr = getJakartaDateString(timestamp);
    const sessionTimes = getAttendanceSessionTimes(settings?.content);
    const assigned = santri.sesi_mengaji || santri.class?.sesi || 'Pagi';
    const window = resolveSantriAttendanceSession({ timestamp, dateStr, assignedSession: assigned, sessionTimes });
    // Existing valid attendance must be returned even outside the current session window.
    const { data: existing, error: existingError } = await client.from('attendance').select('status,sesi,attended_session')
      .eq('user_id', santriId).eq('attendance_date', dateStr)
      .order('check_in_timestamp', { ascending: true, nullsFirst: false }).order('created_at').limit(1).maybeSingle();
    if (existingError) throw new Error('BACKEND_ERROR');
    if (!window.can && (!existing || ['tidak hadir','alpha','ghaib','absen'].includes(existing.status.toLowerCase()))) {
      return ok(req, { state: 'outside_session', message: window.message });
    }
    const status = window.status || existing?.status;
    const actual = window.attendedSession || existing?.attended_session || existing?.sesi;
    const award = computeAttendancePointAward({ role: 'santri', isAdult: santri.kategori === 'Dewasa',
      status, timestamp, dateStr, sesi: actual, sessionTimes });
    const { data: result, error } = await admin.rpc('pilot_record_santri_attendance', {
      p_actor: user.id, p_santri: santriId, p_receipt: receiptId, p_source: source,
      p_when: timestamp.toISOString(), p_status: window.status || 'Hadir', p_assigned: normalizeAttendanceSessionName(assigned),
      p_actual: actual, p_award: award,
    });
    if (error) throw new Error(messages[error.message] ? error.message : 'BACKEND_ERROR');
    return ok(req, { state: result.created ? 'saved' : 'already_recorded', santriId, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'BACKEND_ERROR';
    return fail(req, messages[code] ? code : 'BACKEND_ERROR', messages[code] || 'Proses belum berhasil dikonfirmasi. Coba lagi atau gunakan RFID.', code === 'FORBIDDEN' ? 403 : 400);
  }
});
