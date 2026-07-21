import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAnonKey, getServiceRoleClient, getSupabaseUrl } from "./supabaseAdmin.ts";
import { logSafe } from "./safeLogger.ts";

export async function getUserFromRequest(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization) {
    logSafe("warn", "edge_auth_missing_authorization", {});
    return { user: null, client: null, error: "Missing authorization header" };
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const admin = getServiceRoleClient();
  const { data, error } = await admin.auth.getUser(token);

  const client = createClient(getSupabaseUrl(), getAnonKey(), {
    global: { headers: { authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (error || !data.user) {
    logSafe("warn", "edge_auth_invalid_session", { message: error?.message ?? "Invalid session" });
    return { user: null, client, error: error?.message ?? "Invalid session" };
  }
  return { user: data.user, client, error: null };
}
