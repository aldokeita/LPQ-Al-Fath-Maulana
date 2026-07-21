import { handleOptions } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { getUserRole, isGuruForSantri } from "../_shared/roles.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { logSafe, requestId } from "../_shared/safeLogger.ts";
import { extractSantriIdFromAvatarPath, validateUploadInput } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return methodNotAllowed(req);

  const rid = requestId();

  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (authError || !user) return fail(req, "UNAUTHORIZED", "Session tidak valid.", 401);

    const role = await getUserRole(user.id);
    if (!role) return fail(req, "FORBIDDEN", "Akses ditolak.", 403);

    const input = validateUploadInput(await req.json());
    let allowed = role === "admin";

    if (!allowed && input.bucket === "avatars") {
      if (input.path === `guru/${user.id}/profile.webp`) allowed = role === "guru" || role === "pentashih";
      if (input.path === `santri/${user.id}/profile.webp`) allowed = role === "santri";

      const santriId = extractSantriIdFromAvatarPath(input.path);
      if (!allowed && role === "guru" && santriId) {
        allowed = await isGuruForSantri(user.id, santriId);
      }
    }

    if (!allowed && input.bucket === "murojaah-recordings") {
      const ownerId = input.path.split("/")[0];
      allowed = ownerId === user.id;
    }

    if (!allowed) {
      logSafe("warn", "signed_upload_forbidden", { request_id: rid, bucket: input.bucket, purpose: input.purpose });
      return fail(req, "FORBIDDEN", "Akses upload ditolak.", 403);
    }

    const admin = getServiceRoleClient();
    const { data, error } = await admin.storage
      .from(input.bucket)
      .createSignedUploadUrl(input.path, { upsert: input.bucket === "avatars" });

    if (error || !data) {
      logSafe("error", "signed_upload_failed", { request_id: rid, bucket: input.bucket, purpose: input.purpose });
      return fail(req, "SIGNED_UPLOAD_FAILED", "Signed URL gagal dibuat.", 400);
    }

    logSafe("info", "signed_upload_created", { request_id: rid, bucket: input.bucket, purpose: input.purpose });
    return ok(req, {
      signed_url: data.signedUrl,
      path: data.path,
      expires_in: 7200,
    });
  } catch (error) {
    logSafe("error", "signed_upload_error", { request_id: rid, message: String(error) });
    return fail(req, "SIGNED_UPLOAD_FAILED", "Signed URL gagal dibuat.", 400);
  }
});
