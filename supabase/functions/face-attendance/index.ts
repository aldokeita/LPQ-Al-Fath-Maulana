import { getUserFromRequest } from '../_shared/auth.ts';
import { getServiceRoleClient } from '../_shared/supabaseAdmin.ts';
import { handleOptions } from '../_shared/cors.ts';
import { ok, fail } from '../_shared/response.ts';
import { logSafe } from '../_shared/safeLogger.ts';
import { isUuid as uuid, validateCapture, validateConsent } from '../_shared/faceCapture.js';
import { getAttendanceSessionTimes } from '../_shared/attendanceConfiguration.js';
import { getJakartaDateString, normalizeAttendanceSessionName, resolveSantriAttendanceSession } from '../_shared/attendanceRules.js';
import { computeAttendancePointAward } from '../_shared/attendancePoints.js';

const messages: Record<string, string> = {
  FORBIDDEN: 'Anda tidak memiliki akses untuk operasi ini.',
  CONSENT_REQUIRED: 'Persetujuan wali tertulis dan data formulir yang valid wajib dilengkapi.',
  INVALID_CHALLENGE: 'Tantangan kamera kedaluwarsa atau sudah digunakan. Mulai lagi.',
  INVALID_CAPTURE: 'Tangkapan belum valid. Pastikan hanya satu wajah dan ikuti petunjuk kamera.',
  INVALID_REQUEST: 'Permintaan tidak valid. Muat ulang halaman lalu coba lagi.',
  UNSTABLE_CAPTURE: 'Hasil beberapa frame belum konsisten. Silakan ulangi.',
  RATE_LIMITED: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.',
  ACTIVE_SANTRI_REQUIRED: 'Santri aktif tidak ditemukan.',
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
      challenge:['action','purpose','santriId','consent'],
      enroll:['action','santriId','consent','challengeId','modelVersion','descriptors','evidence'],
      recognize:['action','challengeId','modelVersion','descriptors','evidence'],
      retry:['action','receiptId'],rfid:['action','rfidTag','receiptId'],
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
      return ok(req, await operation(payload.action, payload));
    }
    if (payload.action === 'challenge') {
      if (!['enroll', 'attendance'].includes(payload.purpose)) throw new Error('INVALID_CAPTURE');
      if (payload.purpose === 'enroll') {
        if (!uuid(payload.santriId)) throw new Error('INVALID_REQUEST');
        validateConsent(payload.consent, getJakartaDateString());
      }
      return ok(req, await operation('challenge', payload));
    }
    let santriId; let receiptId; let source;
    if (payload.action === 'enroll' || payload.action === 'recognize') {
      if (!uuid(payload.challengeId)) throw new Error('INVALID_REQUEST');
      const challenge = await operation('inspect', { challengeId: payload.challengeId });
      validateCapture(payload, challenge);
      if (payload.action === 'enroll') {
        validateConsent(payload.consent, getJakartaDateString());
        return ok(req, await operation('enroll', payload));
      }
      const { bestDistance, secondDistance, ...match } = await operation('match', payload);
      // Calibration aid: distances stay in server logs and never reach the browser.
      logSafe('info', 'face_match', { state: match.state, best_distance: bestDistance ?? null, second_distance: secondDistance ?? null });
      if (match.state !== 'matched') return ok(req, match);
      santriId = match.santriId; receiptId = match.receiptId; source = 'face';
    } else if (payload.action === 'retry') {
      if (!uuid(payload.receiptId)) throw new Error('INVALID_REQUEST');
      const match = await operation('resume', payload);
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
