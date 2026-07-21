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
    return response.ok && body?.ok !== false;
  } catch {
    return false;
  }
};
