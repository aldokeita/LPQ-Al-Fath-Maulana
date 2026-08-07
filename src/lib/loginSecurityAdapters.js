import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';

export const LOGIN_SECURITY_CONSENT_KEY = 'lpq_login_security_notice_v1';

const parseSafeResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
};
export const recordLoginAttempt = async ({ username, status, device }) => {
  if (!supabaseUrl || !supabaseAnonKey || !username) return false;

  const headers = {
    apikey: supabaseAnonKey,
    'Content-Type': 'application/json',
  };
  if (status === 'success') {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/record-login-attempt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username_attempt: String(username).trim().slice(0, 160),
        status,
        device,
      }),
    });
    const body = await parseSafeResponse(response);
    if (!response.ok) {
      // Do not swallow the failure silently: a dead recorder means failed login
      // attempts go unlogged. Surfacing it in the console keeps this diagnosable.
      console.warn('[record-login-attempt] Ditolak server:', response.status, body);
      return false;
    }
    return body?.ok !== false;
  } catch (error) {
    console.warn('[record-login-attempt] Gagal mencatat percobaan login:', error?.message || error);
    return false;
  }
};
