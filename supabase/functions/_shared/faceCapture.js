export const FACE_MODEL_VERSION = 'faceapi-1.7.15-resnet128';
export const FACE_DESCRIPTOR_SIZE = 128;
export const CAPTURE_SAMPLE_COUNT = 5;
// Five frames must span a short real interval, so one replayed frame cannot satisfy a passive capture.
export const PASSIVE_MIN_SPAN_MS = 300;
export const captureSteps = (first) => ['center', first, 'center', first === 'left' ? 'right' : 'left', 'center'];
// Any canonical UUID is accepted: seeded and imported rows are not always version 4.
export const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const validateConsent = (consent, today) => {
  const parsed = new Date((consent?.date || '') + 'T00:00:00Z');
  if (consent?.confirmed !== true || !/^\d{4}-\d{2}-\d{2}$/.test(consent.date || '') || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== consent.date || consent.date > today) {
    throw new Error('CONSENT_REQUIRED');
  }
  for (const [field, limit] of [['guardianName', 150], ['noticeVersion', 100], ['formReference', 150]]) {
    if (typeof consent[field] !== 'string' || !consent[field].trim() || consent[field].length > limit) throw new Error('CONSENT_REQUIRED');
  }
};

// A guru's consent is one confirmation plus the notice version shown: given by the guru themself, or
// attested by an admin who registers the guru from Manajemen Guru.
export const GURU_SELF_NOTICE_VERSION = 'guru-wajah-2026-10';
export const GURU_ADMIN_NOTICE_VERSION = 'guru-wajah-admin-2026-10';
export const validateSelfConsent = (consent) => {
  if (consent?.confirmed !== true || typeof consent.noticeVersion !== 'string' || !consent.noticeVersion.trim()
    || consent.noticeVersion.length > 100) throw new Error('CONSENT_REQUIRED');
};

// Practical calibration bounds: a genuine match is usually 0.1-0.4 and other people 0.5+, so values
// outside these ranges are almost always typos (for example 0.055 instead of 0.55).
export const CALIBRATION_LIMITS = { maxDistance:[0.2, 0.6], minMargin:[0.01, 0.3] };
export const CALIBRATION_HINT = 'Jarak maksimum harus 0,20–0,60 dan selisih minimum 0,01–0,30. Gunakan titik atau koma, misalnya 0,40.';
const parseDecimal = value => (typeof value === 'number' ? value
  : /^\s*\d+(?:[.,]\d+)?\s*$/.test(String(value ?? '')) ? Number(String(value).trim().replace(',', '.')) : NaN);
export const parseCalibration = ({ maxDistance, minMargin, testReference }) => {
  const parsed = { maxDistance:parseDecimal(maxDistance), minMargin:parseDecimal(minMargin), testReference:String(testReference ?? '').trim() };
  const within = (value, [low, high]) => Number.isFinite(value) && value >= low && value <= high;
  if (!within(parsed.maxDistance, CALIBRATION_LIMITS.maxDistance) || !within(parsed.minMargin, CALIBRATION_LIMITS.minMargin)
    || !parsed.testReference || parsed.testReference.length > 150) throw new Error('INVALID_CALIBRATION');
  return parsed;
};

export const descriptorDistance = (a, b) => Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0));

export const validateCapture = (payload, challenge) => {
  if (payload.modelVersion !== FACE_MODEL_VERSION || !Array.isArray(payload.descriptors)
    || payload.descriptors.length !== CAPTURE_SAMPLE_COUNT || !Array.isArray(payload.evidence)
    || payload.evidence.length !== 5) throw new Error('INVALID_CAPTURE');
  for (const vector of payload.descriptors) {
    if (!Array.isArray(vector) || vector.length !== FACE_DESCRIPTOR_SIZE
      || vector.some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10)
      || vector.every(value => value === 0)) throw new Error('INVALID_CAPTURE');
  }
  // Enrolment samples span head turns, so they may differ more than five frontal attendance frames.
  const stabilityLimit = challenge.purpose === 'attendance' ? 0.25 : 0.45;
  if (payload.descriptors.some(vector => descriptorDistance(vector, payload.descriptors[0]) > stabilityLimit)) throw new Error('UNSTABLE_CAPTURE');
  // Supervised kiosk attendance is passive: five consecutive frontal frames, no head-turn challenge.
  // Enrollment keeps the head-turn order so templates come from a live, present santri.
  const steps = challenge.purpose === 'attendance' ? Array(CAPTURE_SAMPLE_COUNT).fill('center') : captureSteps(challenge.firstDirection);
  let previous = -1;
  for (const [index, frame] of payload.evidence.entries()) {
    if (frame.pose !== steps[index] || frame.faceCount !== 1 || frame.quality !== true
      || !Number.isFinite(frame.elapsedMs) || frame.elapsedMs <= previous || frame.elapsedMs > 40000) throw new Error('INVALID_CAPTURE');
    previous = frame.elapsedMs;
  }
  const tooFast = challenge.purpose === 'attendance' ? previous - payload.evidence[0].elapsedMs < PASSIVE_MIN_SPAN_MS : previous < 1800;
  if (tooFast) throw new Error('INVALID_CAPTURE');
};

export const getCameraErrorMessage = (error) => ({
  NotAllowedError: 'Izin kamera ditolak. Izinkan kamera di pengaturan browser atau gunakan kartu RFID.',
  NotFoundError: 'Kamera tidak tersedia. Hubungkan webcam terlebih dahulu.',
  NotReadableError: 'Kamera sedang digunakan aplikasi lain atau tidak dapat dibuka.',
  OverconstrainedError: 'Pengaturan kamera tidak didukung perangkat ini.',
}[error?.name] || 'Kamera atau model tidak dapat dimuat. Coba lagi atau gunakan kartu RFID.');
