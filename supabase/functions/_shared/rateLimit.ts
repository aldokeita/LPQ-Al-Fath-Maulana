import { getServiceRoleClient } from "./supabaseAdmin.ts";

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumePersistentRateLimit(
  purpose: string,
  ipIdentifier: string,
  aliasIdentifier: string,
  maxAttempts = 5,
  windowSeconds = 300,
  blockSeconds = 900,
) {
  const admin = getServiceRoleClient();
  const ipHash = await sha256(ipIdentifier);
  const aliasHash = await sha256(aliasIdentifier);
  const { data, error } = await admin.rpc("consume_auth_rate_limit", {
    p_purpose: purpose,
    p_ip_hash: ipHash,
    p_alias_hash: aliasHash,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });

  if (error) {
    return {
      allowed: false,
      blockedUntil: null,
      error: `Persistent rate limit is unavailable: ${error.code ?? "unknown"} ${error.message}`,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    blockedUntil: row?.blocked_until ?? null,
    error: null,
  };
}
