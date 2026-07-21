import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getSupabaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is not configured");
  return url;
}

export function getAnonKey(): string {
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!key) throw new Error("SUPABASE_ANON_KEY is not configured");
  return key;
}

export function getServiceRoleClient() {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getAnonClient() {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
