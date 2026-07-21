import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';

const AVATAR_BUCKET = 'avatars';
const WEBSITE_ASSETS_BUCKET = 'website-assets';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_AVATAR_SOURCE_SIZE = 12 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 1600;
const MAX_WEBSITE_ASSET_SIZE = 20 * 1024 * 1024;
const AVATAR_URL_CACHE_TTL = 45 * 60 * 1000;
const avatarUrlCache = new Map();
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WEBSITE_ASSET_TYPES = new Set([...IMAGE_TYPES, 'application/pdf']);

const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const getStorageErrorMessage = (error) => {
  const message = error?.message || String(error || '');
  if (!message) return 'Operasi Storage gagal.';
  if (message.toLowerCase().includes('row-level security') || message.includes('403')) {
    return 'Akses Storage ditolak untuk akun ini.';
  }
  return message;
};

export const validateAvatarFile = (file) => {
  if (!file) throw new Error('File avatar belum dipilih.');
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Avatar harus berupa JPG, JPEG, PNG, atau WebP.');
  if (file.size > MAX_AVATAR_SOURCE_SIZE) throw new Error('Ukuran foto sumber maksimal 12 MB.');
};

const canvasToWebpBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Browser gagal mengonversi avatar ke WebP.'));
  }, 'image/webp', quality);
});

const loadAvatarImage = async (file) => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Foto avatar tidak dapat dibaca.'));
    };
    image.src = objectUrl;
  });
  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
};

export const compressAvatarToWebp = async (file) => {
  validateAvatarFile(file);

  if (file.type === 'image/webp' && file.size <= MAX_AVATAR_SIZE) {
    return new File([file], 'profile.webp', { type: 'image/webp', lastModified: file.lastModified });
  }

  if (typeof document === 'undefined') {
    throw new Error('Kompresi avatar hanya dapat dilakukan di browser.');
  }

  const decoded = await loadAvatarImage(file);
  try {
    const initialScale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(decoded.width, decoded.height));
    let width = Math.max(1, Math.round(decoded.width * initialScale));
    let height = Math.max(1, Math.round(decoded.height * initialScale));
    const qualitySteps = [0.86, 0.78, 0.7, 0.62];
    let outputBlob = null;

    for (let resizeAttempt = 0; resizeAttempt < 3; resizeAttempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Browser tidak mendukung kompresi avatar.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(decoded.image, 0, 0, width, height);

      for (const quality of qualitySteps) {
        outputBlob = await canvasToWebpBlob(canvas, quality);
        if (outputBlob.size <= MAX_AVATAR_SIZE) break;
      }
      if (outputBlob?.size <= MAX_AVATAR_SIZE) break;
      width = Math.max(1, Math.round(width * 0.78));
      height = Math.max(1, Math.round(height * 0.78));
    }

    if (!outputBlob || outputBlob.size > MAX_AVATAR_SIZE) {
      throw new Error('Foto masih lebih dari 2 MB setelah dikompres. Pilih foto dengan resolusi lebih kecil.');
    }

    return new File([outputBlob], 'profile.webp', { type: 'image/webp', lastModified: Date.now() });
  } finally {
    decoded.cleanup();
  }
};

export const validateWebsiteAssetFile = (file) => {
  if (!file) throw new Error('File aset belum dipilih.');
  if (!WEBSITE_ASSET_TYPES.has(file.type)) throw new Error('Aset website harus berupa JPG, JPEG, PNG, WebP, atau PDF.');
  if (file.size > MAX_WEBSITE_ASSET_SIZE) throw new Error('Ukuran aset website maksimal 20 MB.');
};

export const getAvatarPath = ({ ownerType, ownerId }) => {
  if (!ownerId) throw new Error('Akun harus tersimpan sebelum avatar dapat diunggah.');
  const folder = ownerType === 'santri' ? 'santri' : 'guru';
  return `${folder}/${ownerId}/profile.webp`;
};

const parseSafeResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
};

const formatRemoteError = (body, fallback) => {
  const error = body?.error || body;
  const parts = [
    error?.message,
    error?.details,
    error?.hint,
  ].filter(Boolean);
  return parts.join(' ') || fallback;
};

const invokeSignedUploadFunction = async (body) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase belum dikonfigurasi untuk upload Storage.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Gagal membaca sesi login untuk upload avatar.');

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('Sesi login tidak tersedia. Silakan login ulang sebelum upload avatar.');
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-signed-upload-url`;
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
  } catch (error) {
    throw new Error(`Gagal menghubungi Edge Function upload: ${error?.message || 'network error'}`);
  }

  const responseBody = await parseSafeResponseBody(response);
  if (!response.ok) {
    throw new Error(`Edge Function generate-signed-upload-url gagal (${response.status}): ${formatRemoteError(responseBody, 'request ditolak')}`);
  }

  return responseBody?.data || responseBody;
};

const uploadViaSignedUrl = async ({ bucket, path, file, purpose }) => {
  if (!enableEdgeFunctions) throw new Error(edgeFunctionDisabledMessage);

  const signedUpload = await invokeSignedUploadFunction({
    bucket,
    path,
    content_type: file.type,
    size: file.size,
    purpose,
  });

  const signedUrl = signedUpload?.signed_url || signedUpload?.signedUrl;
  if (!signedUrl) throw new Error('Signed URL upload tidak tersedia dari Edge Function.');

  const response = await fetch(normalizeLocalSignedUrl(signedUrl), {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) {
    const responseBody = await parseSafeResponseBody(response);
    throw new Error(`Upload file ke Storage gagal (${response.status}): ${formatRemoteError(responseBody, 'request ditolak')}`);
  }
  return signedUpload.path || path;
};

const uploadDirectlyToStorage = async ({ bucket, path, file }) => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
  if (error) throw error;
  return path;
};

const normalizeLocalSignedUrl = (signedUrl) => {
  try {
    const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
    const targetUrl = new URL(signedUrl);
    if (configuredUrl && targetUrl.hostname === 'kong') {
      const publicBaseUrl = new URL(configuredUrl);
      targetUrl.protocol = publicBaseUrl.protocol;
      targetUrl.hostname = publicBaseUrl.hostname;
      targetUrl.port = publicBaseUrl.port;
    }
    return targetUrl.toString();
  } catch {
    return signedUrl;
  }
};

export const createSignedAvatarUrl = async (path, expiresIn = 3600) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl || null;
};

export const uploadAvatar = async ({ ownerType, ownerId, file }) => {
  const webpFile = await compressAvatarToWebp(file);
  const path = getAvatarPath({ ownerType, ownerId });
  let storedPath;
  try {
    storedPath = await uploadDirectlyToStorage({ bucket: AVATAR_BUCKET, path, file: webpFile });
  } catch (directError) {
    if (!enableEdgeFunctions) throw directError;
    try {
      storedPath = await uploadViaSignedUrl({
        bucket: AVATAR_BUCKET,
        path,
        file: webpFile,
        purpose: `${ownerType}-avatar`,
      });
    } catch (edgeError) {
      throw new Error(`${getStorageErrorMessage(directError)} Edge Function upload juga gagal: ${getStorageErrorMessage(edgeError)}`);
    }
  }
  const signedUrl = await createSignedAvatarUrl(storedPath);
  return { path: storedPath, signedUrl };
};

export const deleteAvatar = async ({ ownerType, ownerId }) => {
  const path = getAvatarPath({ ownerType, ownerId });
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
  return { path };
};

export const preloadAvatarUrl = (url) => {
  if (!url || typeof Image === 'undefined') return url || '';
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'high';
  image.src = url;
  return url;
};

export const resolveAvatarUrl = async ({ ownerType, ownerId, avatarPath, fallbackUrl }) => {
  const path = avatarPath || (ownerId ? getAvatarPath({ ownerType, ownerId }) : null);
  const cacheKey = path ? `${AVATAR_BUCKET}:${path}` : null;
  const cached = cacheKey ? avatarUrlCache.get(cacheKey) : null;

  if (cached && cached.expiresAt > Date.now()) {
    return preloadAvatarUrl(cached.url);
  }

  const signedUrl = await createSignedAvatarUrl(path);
  const resolvedUrl = signedUrl || fallbackUrl || '';

  if (cacheKey && signedUrl) {
    avatarUrlCache.set(cacheKey, {
      url: signedUrl,
      expiresAt: Date.now() + AVATAR_URL_CACHE_TTL,
    });
  }

  return preloadAvatarUrl(resolvedUrl);
};

export const resolveAvatarRecord = async (
  record,
  {
    ownerType,
    ownerIdKey = 'id',
    avatarPathKey = 'avatar_path',
    fallbackUrlKey = 'foto_url',
    outputKey = 'foto_url',
  } = {},
) => {
  if (!record) return record;

  const resolvedUrl = await resolveAvatarUrl({
    ownerType,
    ownerId: record[ownerIdKey],
    avatarPath: record[avatarPathKey],
    fallbackUrl: record[fallbackUrlKey],
  });

  return { ...record, [outputKey]: resolvedUrl };
};

export const resolveAvatarRecords = async (records, options) => Promise.all(
  (records || []).map((record) => resolveAvatarRecord(record, options)),
);

const fileExtensionFor = (file) => EXTENSION_BY_TYPE[file.type] || 'bin';

export const getWebsiteAssetPath = ({ folder = 'general', key, file }) => {
  const safeFolder = String(folder || 'general').replace(/[^a-zA-Z0-9/_-]/g, '-');
  const ext = fileExtensionFor(file);
  if (key) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '-');
    return `${safeFolder}/${safeKey}.${ext}`;
  }
  const randomPart = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${safeFolder}/${randomPart}.${ext}`;
};

export const uploadWebsiteAsset = async ({ folder, key, file }) => {
  validateWebsiteAssetFile(file);
  const path = getWebsiteAssetPath({ folder, key, file });
  const { error } = await supabase.storage
    .from(WEBSITE_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: Boolean(key),
      contentType: file.type,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(WEBSITE_ASSETS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
};
