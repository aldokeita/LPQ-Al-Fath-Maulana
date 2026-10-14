import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

export const facePilotEnabled = import.meta.env.VITE_FACE_ATTENDANCE_PILOT === 'true';

async function invoke(body) {
  if (!facePilotEnabled) throw new Error('Hubungkan backend uji terpisah dan aktifkan mode pilot terlebih dahulu.');
  const { data:sessionData, error:sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Sesi login tidak tersedia. Silakan login kembali.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(),12000);
  try {
    const response = await fetch(supabaseUrl.replace(/\/$/,'') + '/functions/v1/face-attendance',{
      method:'POST', signal:controller.signal,
      headers:{'content-type':'application/json',apikey:supabaseAnonKey,Authorization:'Bearer ' + sessionData.session.access_token},
      body:JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Proses belum dikonfirmasi.');
    return data.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Waktu konfirmasi habis. Kehadiran belum dapat dipastikan; gunakan pemeriksaan ulang atau RFID.');
    if (['TypeError','SyntaxError'].includes(error.name)) throw new Error('Koneksi ke backend terputus atau respons tidak valid. Kehadiran belum dapat dikonfirmasi.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function faceAttendanceRequest(body) {
  try { return await invoke(body); }
  catch (error) {
    // A lost acknowledgement cannot issue a new identity or a second points award.
    if (body.action === 'recognize') {
      try { return await invoke({ action:'retry', receiptId:body.challengeId }); } catch { throw error; }
    }
    if (body.action === 'rfid') return invoke(body);
    throw error;
  }
}
