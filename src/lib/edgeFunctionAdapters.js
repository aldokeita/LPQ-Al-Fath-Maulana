import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';

const parseSafeResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
};

const getRemoteMessage = (body, fallback) => {
  const error = body?.error || body;
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ') || fallback;
};

export const invokeAuthenticatedEdgeFunction = async (functionName, body) => {
  if (!/^[a-z0-9-]+$/.test(functionName)) throw new Error('Nama Edge Function tidak valid.');
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase belum dikonfigurasi.');

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Gagal membaca sesi login aktif.');
  const accessToken = data?.session?.access_token;
  if (!accessToken) throw new Error('Sesi login tidak tersedia. Silakan login ulang.');

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (requestError) {
    throw new Error(`Gagal menghubungi Edge Function. Periksa koneksi atau izin domain (${requestError?.message || 'network error'}).`);
  }

  const responseBody = await parseSafeResponse(response);
  if (!response.ok || responseBody?.ok === false) {
    throw new Error(getRemoteMessage(responseBody, `Edge Function gagal dengan status HTTP ${response.status}.`));
  }
  return responseBody;
};
