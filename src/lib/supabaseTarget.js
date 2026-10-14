// Picks the Supabase backend the app talks to. With the face pilot on, a build must either point at a
// separate test backend or opt in to the main backend explicitly, so a Preview branch never inherits
// the production backend by accident.
export function resolveSupabaseTarget(env = {}) {
  const facePilot = env.VITE_FACE_ATTENDANCE_PILOT === 'true';
  const normal = { url: env.VITE_SUPABASE_URL || '', anonKey: env.VITE_SUPABASE_ANON_KEY || '' };
  if (!facePilot) {
    return { ...normal, message: 'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local.' };
  }

  const pilotUrl = env.VITE_FACE_PILOT_SUPABASE_URL || '';
  const allowMain = env.VITE_FACE_PILOT_ALLOW_PRODUCTION === 'true';
  if (allowMain && pilotUrl) {
    return { url: '', anonKey: '', message: 'Konfigurasi pilot bertentangan: pilih VITE_FACE_PILOT_ALLOW_PRODUCTION atau VITE_FACE_PILOT_SUPABASE_URL, bukan keduanya.' };
  }
  if (allowMain) {
    return { ...normal, message: 'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.' };
  }

  const isolated = pilotUrl && (pilotUrl !== normal.url || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(pilotUrl));
  return {
    url: isolated ? pilotUrl : '',
    anonKey: isolated ? env.VITE_FACE_PILOT_SUPABASE_ANON_KEY || '' : '',
    message: 'Mode pilot membutuhkan Supabase uji terpisah (VITE_FACE_PILOT_SUPABASE_URL dan VITE_FACE_PILOT_SUPABASE_ANON_KEY) atau izin eksplisit VITE_FACE_PILOT_ALLOW_PRODUCTION=true.',
  };
}
