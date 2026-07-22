import { handleOptions } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { requireRole } from "../_shared/roles.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { logSafe, requestId } from "../_shared/safeLogger.ts";
import { normalizeNomorInduk, normalizeOptionalNomorInduk, requireString, validateRole } from "../_shared/validation.ts";

function internalEmailFor(userId: string): string {
  return `santri+${userId}@auth.lpqalfathmaulana.local`;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function copyIfPresent(source: Record<string, unknown>, target: Record<string, unknown>, key: string): void {
  if (hasOwn(source, key)) target[key] = source[key] ?? null;
}

const OFFICIAL_ADMIN_EMAIL = "admin@lpqalfathmaulana.id";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function sanitizeGuruRoles(value: unknown, role: "guru" | "pentashih"): string[] {
  const roles = Array.isArray(value)
    ? value
      .map((item) => String(item).trim())
      .filter((item) => item && item.toLowerCase() !== "admin" && item.toLowerCase() !== "pentashih")
    : [];
  if (role === "pentashih") roles.push("Pentashih");
  return Array.from(new Set(roles));
}

function normalizeSantriCategory(value: unknown): "Anak" | "PTPT" | "Dewasa" {
  const normalized = String(value ?? "Anak").trim().toLowerCase();
  if (normalized === "anak" || normalized === "tpq") return "Anak";
  if (normalized === "ptpt") return "PTPT";
  if (normalized === "dewasa") return "Dewasa";
  throw new Error("INVALID_SANTRI_CATEGORY");
}

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
    const action = requireString(body.action, "Action");
    const role = validateRole(body.role);
    const profile = body.profile ?? {};
    const admin = getServiceRoleClient();

    if (!["create", "update", "deactivate", "archive", "restore"].includes(action)) {
      return fail(req, "VALIDATION_ERROR", "Action tidak valid.", 400);
    }

    if (action === "create") {
      const displayName = requireString(profile.nama_lengkap ?? profile.nama, "Nama");
      const initialPassword = requireString(body.initial_password, "Password awal");
      const santriCategory = role === "santri" ? normalizeSantriCategory(profile.kategori) : null;
      const isAdultSantri = role === "santri" && santriCategory === "Dewasa";
      const nomorInduk = role === "santri"
        ? (isAdultSantri
          ? normalizeOptionalNomorInduk(profile.nomor_induk_qiroati)
          : normalizeNomorInduk(profile.nomor_induk_qiroati))
        : null;

      if (nomorInduk) {
        const { data: existingAlias } = await admin
          .from("auth_login_aliases")
          .select("id")
          .eq("alias_type", "nomor_induk_qiroati")
          .eq("normalized_alias", nomorInduk)
          .maybeSingle();

        if (existingAlias) {
          return fail(req, "DUPLICATE_NOMOR_INDUK", "Nomor Induk Qiroati sudah digunakan.", 409);
        }
      }

      const authEmail = role === "santri"
        ? `pending+${crypto.randomUUID()}@auth.lpqalfathmaulana.local`
        : requireString(profile.email, "Email");

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: { role, display_name: displayName },
      });

      if (createError || !created.user) {
        logSafe("error", "manage_user_auth_create_failed", { request_id: rid, role });
        return fail(req, "CREATE_USER_FAILED", "Akun gagal dibuat.", 400);
      }

      const userId = created.user.id;
      const finalEmail = role === "santri" ? internalEmailFor(userId) : authEmail;

      if (role === "santri") {
        await admin.auth.admin.updateUserById(userId, { email: finalEmail });
      }

      const { error: profileError } = await admin.from("user_profiles").insert({
        id: userId,
        role,
        display_name: displayName,
        email: role === "santri" ? null : finalEmail,
        phone: profile.no_hp ?? profile.no_hp_ortu ?? null,
        status: "active",
        created_by: user.id,
        updated_by: user.id,
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return fail(req, "PROFILE_CREATE_FAILED", "Profil akun gagal dibuat.", 400);
      }

      if (role === "santri") {
        const { error: santriError } = await admin.from("santri").insert({
          id: userId,
          nomor_induk_qiroati: nomorInduk,
          nama_lengkap: displayName,
          nama_panggilan: profile.nama_panggilan ?? null,
          kategori: santriCategory,
          jenis_kelamin: profile.jenis_kelamin ?? null,
          tanggal_lahir: profile.tanggal_lahir ?? null,
          tempat_lahir: profile.tempat_lahir ?? null,
          tanggal_pendaftaran: profile.tanggal_pendaftaran ?? null,
          nama_ayah: profile.nama_ayah ?? null,
          nama_ibu: profile.nama_ibu ?? null,
          alamat: profile.alamat ?? null,
          no_hp_ortu: profile.no_hp_ortu ?? null,
          no_kk: profile.no_kk ?? null,
          no_nik: profile.no_nik ?? null,
          rfid_tag: profile.rfid_tag ?? null,
          sesi_mengaji: profile.sesi_mengaji ?? null,
          jilid: profile.jilid ?? null,
          foto_url: profile.foto_url ?? null,
          avatar_path: profile.avatar_path ?? null,
          berkas_foto: Boolean(profile.berkas_foto),
          berkas_akta: Boolean(profile.berkas_akta),
          berkas_kk: Boolean(profile.berkas_kk),
          berkas_form: Boolean(profile.berkas_form),
          link_qiroati: profile.link_qiroati ?? null,
          default_spp_amount: profile.default_spp_amount ?? null,
          points: profile.points ?? 0,
          current_class_id: profile.current_class_id ?? null,
          status: "Aktif",
          created_by: user.id,
          updated_by: user.id,
        });
        if (santriError) {
          await admin.auth.admin.deleteUser(userId);
          return fail(req, "SANTRI_CREATE_FAILED", "Data santri gagal dibuat.", 400);
        }

        if (nomorInduk) {
          const { error: aliasError } = await admin.from("auth_login_aliases").insert({
            auth_user_id: userId,
            alias_value: nomorInduk,
            normalized_alias: nomorInduk,
            internal_email: finalEmail,
            is_active: true,
          });
          if (aliasError) {
            await admin.auth.admin.deleteUser(userId);
            return fail(req, "ALIAS_CREATE_FAILED", "Alias login santri gagal dibuat.", 400);
          }
        }
      } else {
        const { error: guruError } = await admin.from("guru").insert({
          id: userId,
          nama: displayName,
          email: finalEmail,
          no_hp: profile.no_hp ?? null,
          alamat: profile.alamat ?? null,
          foto_url: profile.avatar_path ? null : (profile.foto_url ?? null),
          avatar_path: profile.avatar_path ?? null,
          jabatan: profile.jabatan ?? null,
          roles: sanitizeGuruRoles(profile.roles, role),
          status: "active",
          created_by: user.id,
          updated_by: user.id,
        });
        if (guruError) {
          await admin.auth.admin.deleteUser(userId);
          return fail(req, "GURU_CREATE_FAILED", "Data guru gagal dibuat.", 400);
        }
      }

      logSafe("info", "manage_user_created", { request_id: rid, target_user_id: userId, role });
      return ok(req, { user_id: userId, role }, 201);
    }

    const targetUserId = requireString(body.target_user_id, "Target user id");

    const { data: targetProfile, error: targetProfileError } = await admin
      .from("user_profiles")
      .select("email, role, display_name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfileError || !targetProfile) {
      return fail(req, "TARGET_NOT_FOUND", "Akun target tidak ditemukan.", 404);
    }

    if (normalizeEmail(targetProfile.email) === OFFICIAL_ADMIN_EMAIL) {
      return fail(req, "OFFICIAL_ADMIN_PROTECTED", "Akun admin resmi tidak dapat diubah melalui pengelolaan guru atau santri.", 403);
    }

    const isSantriArchive = role === "santri" && ["deactivate", "archive"].includes(action);
    const isSantriRestore = role === "santri" && action === "restore";

    if (isSantriArchive || isSantriRestore) {
      const archived = isSantriArchive;
      const authUpdate = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: archived ? "876000h" : "none",
      });

      if (authUpdate.error) {
        return fail(
          req,
          archived ? "AUTH_ARCHIVE_FAILED" : "AUTH_RESTORE_FAILED",
          archived ? "Akun santri gagal diarsipkan." : "Akun santri gagal dipulihkan.",
          400,
        );
      }

      const { data: archiveResult, error: archiveError } = await admin.rpc("set_santri_archive_state", {
        p_santri_id: targetUserId,
        p_archived: archived,
        p_actor_id: user.id,
        p_reason: body.reason ?? (archived ? "Diarsipkan oleh admin" : null),
      });

      if (archiveError) {
        await admin.auth.admin.updateUserById(targetUserId, {
          ban_duration: archived ? "none" : "876000h",
        });
        return fail(
          req,
          archived ? "SANTRI_ARCHIVE_FAILED" : "SANTRI_RESTORE_FAILED",
          archived ? "Data santri gagal dipindahkan ke arsip." : "Data santri gagal dipulihkan dari arsip.",
          400,
        );
      }

      return ok(req, {
        user_id: targetUserId,
        archived,
        current_class_id: archiveResult?.[0]?.current_class_id ?? null,
      });
    }

    if (["archive", "restore"].includes(action)) {
      return fail(req, "VALIDATION_ERROR", "Arsip dan pemulihan akun hanya tersedia untuk santri.", 400);
    }

    if (action === "deactivate") {
      await admin.from("user_profiles").update({ status: "inactive", updated_by: user.id }).eq("id", targetUserId);
      await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
      return ok(req, { user_id: targetUserId, deactivated: true });
    }

    if (role === "santri") {
      const santriUpdates: Record<string, unknown> = { updated_by: user.id };
      const santriFields = [
        "nama_lengkap",
        "nama_panggilan",
        "kategori",
        "jenis_kelamin",
        "tanggal_lahir",
        "tempat_lahir",
        "tanggal_pendaftaran",
        "nama_ayah",
        "nama_ibu",
        "alamat",
        "no_hp_ortu",
        "no_kk",
        "no_nik",
        "rfid_tag",
        "current_class_id",
        "sesi_mengaji",
        "jilid",
        "foto_url",
        "avatar_path",
        "berkas_foto",
        "berkas_akta",
        "berkas_kk",
        "berkas_form",
        "link_qiroati",
        "default_spp_amount",
        "status",
        "points",
        "order_in_class",
      ];

      for (const field of santriFields) copyIfPresent(profile, santriUpdates, field);
      if (hasOwn(profile, "kategori")) {
        santriUpdates.kategori = normalizeSantriCategory(profile.kategori);
      }

      if (hasOwn(profile, "nomor_induk_qiroati")) {
        let effectiveCategory = hasOwn(profile, "kategori")
          ? normalizeSantriCategory(profile.kategori)
          : null;
        if (!effectiveCategory) {
          const { data: currentSantri } = await admin
            .from("santri")
            .select("kategori")
            .eq("id", targetUserId)
            .maybeSingle();
          effectiveCategory = normalizeSantriCategory(currentSantri?.kategori);
        }
        const isAdultSantri = effectiveCategory === "Dewasa";
        const nomorInduk = isAdultSantri
          ? normalizeOptionalNomorInduk(profile.nomor_induk_qiroati)
          : normalizeNomorInduk(profile.nomor_induk_qiroati);

        if (!nomorInduk) {
          santriUpdates.nomor_induk_qiroati = null;
          const { error: aliasDeleteError } = await admin
            .from("auth_login_aliases")
            .delete()
            .eq("auth_user_id", targetUserId)
            .eq("alias_type", "nomor_induk_qiroati");

          if (aliasDeleteError) {
            return fail(req, "ALIAS_UPDATE_FAILED", "Alias login santri gagal diperbarui.", 400);
          }
        } else {
          const { data: duplicateAlias } = await admin
            .from("auth_login_aliases")
            .select("auth_user_id")
            .eq("alias_type", "nomor_induk_qiroati")
            .eq("normalized_alias", nomorInduk)
            .neq("auth_user_id", targetUserId)
            .maybeSingle();

          if (duplicateAlias) {
            return fail(req, "DUPLICATE_NOMOR_INDUK", "Nomor Induk Qiroati sudah digunakan.", 409);
          }

          const { error: passwordSyncError } = await admin.auth.admin.updateUserById(targetUserId, {
            password: nomorInduk,
          });

          if (passwordSyncError) {
            return fail(req, "AUTH_PASSWORD_SYNC_FAILED", "Password login santri gagal disinkronkan.", 400);
          }

          santriUpdates.nomor_induk_qiroati = nomorInduk;

          const { data: existingAlias } = await admin
            .from("auth_login_aliases")
            .select("id, internal_email")
            .eq("auth_user_id", targetUserId)
            .eq("alias_type", "nomor_induk_qiroati")
            .eq("is_active", true)
            .maybeSingle();

          const internalEmail = existingAlias?.internal_email ?? internalEmailFor(targetUserId);
          const aliasPayload = {
            auth_user_id: targetUserId,
            alias_type: "nomor_induk_qiroati",
            alias_value: nomorInduk,
            normalized_alias: nomorInduk,
            internal_email: internalEmail,
            is_active: true,
            updated_at: new Date().toISOString(),
          };

          const aliasResult = existingAlias
            ? await admin.from("auth_login_aliases").update(aliasPayload).eq("id", existingAlias.id)
            : await admin.from("auth_login_aliases").insert(aliasPayload);

          if (aliasResult.error) {
            return fail(req, "ALIAS_UPDATE_FAILED", "Alias login santri gagal diperbarui.", 400);
          }
        }
      }

      const { data: updatedSantri, error: santriUpdateError } = await admin
        .from("santri")
        .update(santriUpdates)
        .eq("id", targetUserId)
        .select("id")
        .maybeSingle();

      if (santriUpdateError || !updatedSantri) {
        return fail(req, "SANTRI_UPDATE_FAILED", "Data santri gagal diperbarui.", 400);
      }

      const profileUpdate: Record<string, unknown> = { updated_by: user.id };
      if (hasOwn(profile, "nama_lengkap")) profileUpdate.display_name = profile.nama_lengkap;
      if (hasOwn(profile, "no_hp_ortu")) profileUpdate.phone = profile.no_hp_ortu;
      if (hasOwn(profile, "status")) {
        profileUpdate.status = String(profile.status).toLowerCase() === "nonaktif" ? "inactive" : "active";
      }

      await admin.from("user_profiles").update(profileUpdate).eq("id", targetUserId);

      return ok(req, { user_id: targetUserId, updated: true });
    }

    const displayName = requireString(profile.nama ?? profile.display_name, "Nama");
    const nextRole = role === "pentashih" ? "pentashih" : "guru";
    const authUser = await admin.auth.admin.getUserById(targetUserId);
    if (authUser.error || !authUser.data.user) {
      return fail(req, "AUTH_USER_NOT_FOUND", "Akun Auth target tidak ditemukan.", 404);
    }

    const previousMetadata = authUser.data.user.user_metadata ?? {};
    const authUpdate = await admin.auth.admin.updateUserById(targetUserId, {
      user_metadata: { ...previousMetadata, role: nextRole, display_name: displayName },
    });
    if (authUpdate.error) {
      return fail(req, "AUTH_ROLE_UPDATE_FAILED", "Role akun Auth gagal diperbarui.", 400);
    }

    const { data: updatedProfile, error: profileUpdateError } = await admin
      .from("user_profiles")
      .update({
        role: nextRole,
        display_name: displayName,
        updated_by: user.id,
      })
      .eq("id", targetUserId)
      .select("id")
      .maybeSingle();

    if (profileUpdateError || !updatedProfile) {
      await admin.auth.admin.updateUserById(targetUserId, { user_metadata: previousMetadata });
      return fail(req, "PROFILE_ROLE_UPDATE_FAILED", "Role profil akun gagal diperbarui.", 400);
    }

    return ok(req, { user_id: targetUserId, role: nextRole, updated: true });
  } catch (error) {
    logSafe("error", "manage_user_error", { request_id: rid, message: String(error) });
    if (String(error).includes("FORBIDDEN")) return fail(req, "FORBIDDEN", "Akses ditolak.", 403);
    if (String(error).includes("INVALID_SANTRI_CATEGORY")) {
      return fail(req, "INVALID_SANTRI_CATEGORY", "Kategori santri harus TPQ, PTPT, atau Dewasa.", 400);
    }
    return fail(req, "MANAGE_USER_FAILED", "Operasi akun gagal.", 400);
  }
});
