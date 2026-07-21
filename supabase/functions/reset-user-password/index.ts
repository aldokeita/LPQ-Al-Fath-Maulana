import { handleOptions } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { requireRole } from "../_shared/roles.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { logSafe, requestId } from "../_shared/safeLogger.ts";
import { requireString } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req);

  const rid = requestId();

  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) return fail(req, "UNAUTHORIZED", "Session tidak valid.", 401);
    await requireRole(user.id, ["admin"]);

    const body = await req.json();
    const targetUserId = requireString(body.target_user_id, "Target user id");
    const newPassword = requireString(body.new_password, "Password baru");

    if (newPassword.length < 8) {
      return fail(req, "WEAK_PASSWORD", "Password baru minimal 8 karakter.", 400);
    }

    const admin = getServiceRoleClient();
    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (error) {
      logSafe("error", "reset_password_failed", { request_id: rid, target_user_id: targetUserId });
      return fail(req, "RESET_PASSWORD_FAILED", "Password gagal direset.", 400);
    }

    logSafe("info", "reset_password_success", { request_id: rid, target_user_id: targetUserId });
    return ok(req, { target_user_id: targetUserId, password_updated: true });
  } catch (error) {
    logSafe("error", "reset_password_error", { request_id: rid, message: String(error) });
    if (String(error).includes("FORBIDDEN")) return fail(req, "FORBIDDEN", "Akses ditolak.", 403);
    return fail(req, "RESET_PASSWORD_FAILED", "Password gagal direset.", 400);
  }
});
