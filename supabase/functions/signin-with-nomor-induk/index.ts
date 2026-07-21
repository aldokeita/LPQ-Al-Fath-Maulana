import { handleOptions } from "../_shared/cors.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { consumePersistentRateLimit } from "../_shared/rateLimit.ts";
import { getAnonClient, getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { logSafe, maskIdentifier, requestId } from "../_shared/safeLogger.ts";
import { normalizeNomorInduk, requireString } from "../_shared/validation.ts";

type LoginAlias = {
  auth_user_id: string;
  internal_email: string;
  is_active: boolean;
};

type UserProfile = {
  role: string;
  status: string;
};

type SantriLoginProfile = {
  id: string;
  nomor_induk_qiroati: string | null;
};

function normalizeIdentifier(value: string): string {
  return value.trim();
}

function canBeNomorInduk(value: string): boolean {
  return Boolean(value) && !/\s/.test(value);
}

function normalizePasswordAsNomorInduk(value: string): string | null {
  try {
    return normalizeNomorInduk(value);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req);

  const rid = requestId();

  try {
    const body = await req.json();
    const loginIdentifier = normalizeIdentifier(requireString(body.nomor_induk_qiroati ?? body.username, "Username"));
    const normalizedNomorInduk = canBeNomorInduk(loginIdentifier) ? normalizeNomorInduk(loginIdentifier) : null;
    const nicknameIdentifier = loginIdentifier;
    const password = requireString(body.password, "Password");
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rateLimitIdentifier = normalizedNomorInduk ?? nicknameIdentifier.toLowerCase();

    const rateLimit = await consumePersistentRateLimit(
      "signin-with-nomor-induk",
      ip,
      rateLimitIdentifier,
    );

    if (rateLimit.error) {
      logSafe("error", "login_rate_limit_unavailable", { request_id: rid, message: rateLimit.error });
      return fail(req, "RATE_LIMIT_UNAVAILABLE", "Login santri belum siap untuk production.", 503);
    }

    if (!rateLimit.allowed) {
      logSafe("warn", "login_rate_limited", {
        request_id: rid,
        identifier: maskIdentifier(rateLimitIdentifier),
      });
      return fail(req, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.", 429);
    }

    const admin = getServiceRoleClient();

    const directAliasResult = normalizedNomorInduk
      ? await admin
          .from("auth_login_aliases")
          .select("auth_user_id,internal_email,is_active")
          .eq("alias_type", "nomor_induk_qiroati")
          .eq("normalized_alias", normalizedNomorInduk)
          .eq("is_active", true)
          .maybeSingle<LoginAlias>()
      : { data: null, error: null };

    let candidateAliases: LoginAlias[] = directAliasResult.data ? [directAliasResult.data] : [];

    if (candidateAliases.length === 0 && !directAliasResult.error && nicknameIdentifier) {
      const { data: santriMatches, error: santriLookupError } = await admin
        .from("santri")
        .select("id,status")
        .ilike("nama_panggilan", nicknameIdentifier)
        .limit(25);

      if (!santriLookupError && santriMatches?.length) {
        const activeSantriIds = santriMatches
          .filter((santri) => {
            const activeStatus = String(santri.status ?? "").toLowerCase();
            return activeStatus === "aktif" || activeStatus === "active";
          })
          .map((santri) => santri.id);

        if (activeSantriIds.length > 0) {
          const { data: aliasesByUser } = await admin
            .from("auth_login_aliases")
            .select("auth_user_id,internal_email,is_active")
            .eq("alias_type", "nomor_induk_qiroati")
            .eq("is_active", true)
            .in("auth_user_id", activeSantriIds)
            .returns<LoginAlias[]>();
          candidateAliases = aliasesByUser ?? [];
        }
      }
    }

    if (directAliasResult.error || candidateAliases.length === 0) {
      logSafe("warn", "login_alias_not_found", {
        request_id: rid,
        identifier: maskIdentifier(rateLimitIdentifier),
      });
      return fail(req, "INVALID_LOGIN", "Username santri atau password salah.", 401);
    }

    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id,role,status")
      .in("id", candidateAliases.map((candidate) => candidate.auth_user_id))
      .returns<Array<UserProfile & { id: string }>>();
    const profileByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const { data: santriProfiles } = await admin
      .from("santri")
      .select("id,nomor_induk_qiroati")
      .in("id", candidateAliases.map((candidate) => candidate.auth_user_id))
      .returns<SantriLoginProfile[]>();
    const santriByUserId = new Map((santriProfiles ?? []).map((santri) => [santri.id, santri]));
    const passwordAsNomorInduk = normalizePasswordAsNomorInduk(password);

    const anon = getAnonClient();
    let matchedSession: Awaited<ReturnType<typeof anon.auth.signInWithPassword>>["data"]["session"] = null;
    let matchedUser: Awaited<ReturnType<typeof anon.auth.signInWithPassword>>["data"]["user"] = null;

    for (const candidate of candidateAliases) {
      const profile = profileByUserId.get(candidate.auth_user_id);
      if (!profile || profile.role !== "santri" || profile.status !== "active") continue;

      let { data, error } = await anon.auth.signInWithPassword({
        email: candidate.internal_email,
        password,
      });

      const santriProfile = santriByUserId.get(candidate.auth_user_id);
      const storedNomorInduk = santriProfile?.nomor_induk_qiroati
        ? normalizeNomorInduk(santriProfile.nomor_induk_qiroati)
        : null;

      if (error && passwordAsNomorInduk && storedNomorInduk === passwordAsNomorInduk) {
        const passwordSync = await admin.auth.admin.updateUserById(candidate.auth_user_id, { password });
        if (!passwordSync.error) {
          ({ data, error } = await anon.auth.signInWithPassword({
            email: candidate.internal_email,
            password,
          }));
        }
      }

      if (!error && data.session && data.user) {
        matchedSession = data.session;
        matchedUser = data.user;
        break;
      }
    }

    if (!matchedSession || !matchedUser) {
      logSafe("warn", "login_auth_failed", {
        request_id: rid,
        identifier: maskIdentifier(rateLimitIdentifier),
      });
      return fail(req, "INVALID_LOGIN", "Username santri atau password salah.", 401);
    }

    logSafe("info", "login_success", { request_id: rid, user_id: matchedUser.id });
    return ok(req, {
      session: {
        access_token: matchedSession.access_token,
        refresh_token: matchedSession.refresh_token,
        expires_at: matchedSession.expires_at,
        expires_in: matchedSession.expires_in,
        token_type: matchedSession.token_type,
      },
      user: {
        id: matchedUser.id,
        role: "santri",
      },
    });
  } catch (error) {
    logSafe("error", "login_unhandled_error", { request_id: rid, message: String(error) });
    return fail(req, "INVALID_LOGIN", "Username santri atau password salah.", 401);
  }
});
