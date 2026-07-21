export function normalizeNomorInduk(value: unknown): string {
  if (typeof value !== "string") throw new Error("Nomor Induk Qiroati wajib diisi.");
  const normalized = value.trim();
  if (!normalized) throw new Error("Nomor Induk Qiroati wajib diisi.");
  if (/\s/.test(normalized)) throw new Error("Nomor Induk Qiroati tidak boleh mengandung spasi.");
  return normalized;
}

export function normalizeOptionalNomorInduk(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Nomor Induk Qiroati tidak valid.");
  if (!value.trim()) return null;
  return normalizeNomorInduk(value);
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} wajib diisi.`);
  return value.trim();
}

export function validateRole(value: unknown): "guru" | "santri" | "pentashih" {
  if (value === "guru" || value === "santri" || value === "pentashih") return value;
  throw new Error("Role target tidak valid.");
}

export function validateUploadInput(input: any) {
  const bucket = requireString(input.bucket, "Bucket");
  const path = requireString(input.path, "Path");
  const contentType = requireString(input.content_type, "Content type");
  const purpose = requireString(input.purpose, "Purpose");
  const size = Number(input.size);
  if (!Number.isFinite(size) || size <= 0) throw new Error("Ukuran file tidak valid.");

  const imageTypes = ["image/jpeg", "image/png", "image/webp"];
  const audioTypes = ["audio/mpeg", "audio/mp4", "audio/webm", "audio/wav"];

  if (bucket === "avatars") {
    if (!imageTypes.includes(contentType)) throw new Error("Tipe file avatar tidak diizinkan.");
    if (size > 2 * 1024 * 1024) throw new Error("Ukuran avatar maksimal 2 MB.");
    if (!path.endsWith("/profile.webp")) throw new Error("Path avatar harus memakai profile.webp.");
  } else if (bucket === "website-assets") {
    if (![...imageTypes, "application/pdf"].includes(contentType)) throw new Error("Tipe asset website tidak diizinkan.");
    if (size > 20 * 1024 * 1024) throw new Error("Ukuran asset terlalu besar.");
  } else if (bucket === "murojaah-recordings") {
    if (!audioTypes.includes(contentType)) throw new Error("Tipe rekaman tidak diizinkan.");
    if (size > 25 * 1024 * 1024) throw new Error("Ukuran rekaman terlalu besar.");
  } else {
    throw new Error("Bucket tidak diizinkan.");
  }

  return { bucket, path, contentType, purpose, size };
}

export function extractSantriIdFromAvatarPath(path: string): string | null {
  const match = path.match(/^santri\/([0-9a-fA-F-]{36})\/profile\.webp$/);
  return match?.[1] ?? null;
}
