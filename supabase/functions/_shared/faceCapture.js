export const FACE_MODEL_VERSION = 'faceapi-1.7.15-resnet128';
export const FACE_DESCRIPTOR_SIZE = 128;
export const CAPTURE_SAMPLE_COUNT = 5;
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
  const stabilityLimit = challenge.purpose === 'enroll' ? 0.45 : 0.25;
  if (payload.descriptors.some(vector => descriptorDistance(vector, payload.descriptors[0]) > stabilityLimit)) throw new Error('UNSTABLE_CAPTURE');
  const steps = captureSteps(challenge.firstDirection);
  let previous = -1;
  for (const [index, frame] of payload.evidence.entries()) {
    if (frame.pose !== steps[index] || frame.faceCount !== 1 || frame.quality !== true
      || !Number.isFinite(frame.elapsedMs) || frame.elapsedMs <= previous || frame.elapsedMs > 40000) throw new Error('INVALID_CAPTURE');
    previous = frame.elapsedMs;
  }
  if (previous < 1800) throw new Error('INVALID_CAPTURE');
};

export const getCameraErrorMessage = (error) => ({
  NotAllowedError: 'Izin kamera ditolak. Izinkan kamera di pengaturan browser atau gunakan kartu RFID.',
  NotFoundError: 'Kamera tidak tersedia. Hubungkan webcam terlebih dahulu.',
  NotReadableError: 'Kamera sedang digunakan aplikasi lain atau tidak dapat dibuka.',
  OverconstrainedError: 'Pengaturan kamera tidak didukung perangkat ini.',
}[error?.name] || 'Kamera atau model tidak dapat dimuat. Coba lagi atau gunakan kartu RFID.');
