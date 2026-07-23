export const ATTENDANCE_REQUEST_TIMEOUT_CODE = 'ATTENDANCE_REQUEST_TIMEOUT';
export const ATTENDANCE_STATUS_UNCERTAIN_CODE = 'ATTENDANCE_STATUS_UNCERTAIN';

export const withAttendanceRequestTimeout = async (
  request,
  { timeoutMs = 10000, operation = 'Permintaan absensi' } = {},
) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${operation} melewati batas waktu.`);
      error.code = ATTENDANCE_REQUEST_TIMEOUT_CODE;
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const isAttendanceRequestTimeout = (error) => (
  error?.code === ATTENDANCE_REQUEST_TIMEOUT_CODE
);

export const getAttendanceRequestErrorMessage = (error) => {
  if (error?.code === ATTENDANCE_STATUS_UNCERTAIN_CODE) {
    return 'Koneksi terputus saat menyimpan. Jangan scan ulang dahulu; minta admin memeriksa rekap absensi.';
  }

  if (isAttendanceRequestTimeout(error)) {
    return 'Koneksi ke server terlalu lama. Status absensi akan diperiksa ulang sebelum Anda mencoba lagi.';
  }

  return error?.message || 'Proses absensi gagal diselesaikan.';
};

const shouldVerifyMutation = (error) => (
  isAttendanceRequestTimeout(error) || error?.code === '23505'
);

export const executeVerifiedAttendanceMutation = async ({
  mutation,
  verify,
  operation = 'Penyimpanan absensi',
  timeoutMs = 10000,
  verificationTimeoutMs = 5000,
}) => {
  let mutationError;

  try {
    const result = await withAttendanceRequestTimeout(mutation, { timeoutMs, operation });
    if (!result?.error) return { recovered: false, recoveryReason: null, data: result?.data };
    mutationError = result.error;
  } catch (error) {
    mutationError = error;
  }

  if (!shouldVerifyMutation(mutationError) || typeof verify !== 'function') {
    throw mutationError;
  }

  try {
    const verification = await withAttendanceRequestTimeout(
      Promise.resolve().then(() => verify(mutationError)),
      { timeoutMs: verificationTimeoutMs, operation: 'Verifikasi absensi' },
    );
    if (!verification?.error && verification?.data) {
      return {
        recovered: true,
        recoveryReason: isAttendanceRequestTimeout(mutationError) ? 'timeout' : 'duplicate',
        data: verification.data,
      };
    }
  } catch {
    // Fall through to a status-uncertain error below.
  }

  if (isAttendanceRequestTimeout(mutationError)) {
    const uncertainError = new Error('Status penyimpanan absensi belum dapat dipastikan.');
    uncertainError.code = ATTENDANCE_STATUS_UNCERTAIN_CODE;
    throw uncertainError;
  }

  throw mutationError;
};
