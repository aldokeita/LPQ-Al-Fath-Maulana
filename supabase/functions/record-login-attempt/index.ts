import { handleOptions } from "../_shared/cors.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { logSafe, maskIdentifier, requestId } from "../_shared/safeLogger.ts";

const firstHeaderValue = (value: string | null) => value?.split(",")[0]?.trim() || null;

const decodeHeader = (value: string | null) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req);

  const rid = requestId();
  try {
    const body = await req.json();
    const username = String(body?.username_attempt || "").trim().slice(0, 160);
    const status = String(body?.status || "").trim();
    const device = ["Desktop", "Tablet", "Mobile"].includes(body?.device) ? body.device : "Unknown";
    if (!username) return fail(req, "INVALID_USERNAME", "Username wajib diisi.", 400);
    if (!["success", "failed"].includes(status)) return fail(req, "INVALID_STATUS", "Status login tidak valid.", 400);

    const ipAddress = firstHeaderValue(req.headers.get("x-forwarded-for"))
      || firstHeaderValue(req.headers.get("cf-connecting-ip"))
      || firstHeaderValue(req.headers.get("x-real-ip"))
      || "unknown";
    const city = decodeHeader(req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city"));
    const country = decodeHeader(req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country"));
    const userAgent = String(req.headers.get("user-agent") || "unknown").slice(0, 500);

    const admin = getServiceRoleClient();
    const [ipHash, aliasHash] = await Promise.all([sha256(ipAddress), sha256(username.toLowerCase())]);
    const { data: rateLimit, error: rateError } = await admin.rpc("consume_auth_rate_limit", {
      p_purpose: "login-log-edge",
      p_ip_hash: ipHash,
      p_alias_hash: aliasHash,
      p_max_attempts: 30,
      p_window_seconds: 300,
      p_block_seconds: 900,
    });
    if (rateError) throw rateError;
    if (!rateLimit?.[0]?.allowed) return ok(req, { recorded: false, rate_limited: true });

    let userId: string | null = null;
    let role: string | null = null;
    const authorization = req.headers.get("authorization");
    if (status === "success" && authorization) {
      const token = authorization.replace(/^Bearer\s+/i, "").trim();
      const { data: userData } = await admin.auth.getUser(token);
      userId = userData?.user?.id || null;
      if (userId) {
        const { data: profile } = await admin.from("user_profiles").select("role").eq("id", userId).maybeSingle();
        role = profile?.role || null;
      }
    }

    const { error } = await admin.from("login_logs").insert({
      user_id: userId,
      role,
      username_attempt: username,
      status,
      ip_address: ipAddress,
      city,
      country,
      device,
      user_agent: userAgent,
    });
    if (error) throw error;

    logSafe("info", "login_attempt_recorded", {
      request_id: rid,
      status,
      username: maskIdentifier(username),
      has_location: Boolean(city || country),
    });
    return ok(req, { recorded: true });
  } catch (error) {
    logSafe("error", "login_attempt_record_failed", { request_id: rid, message: String(error) });
    return fail(req, "LOGIN_LOG_FAILED", "Aktivitas login tidak dapat dicatat.", 400);
  }
});
