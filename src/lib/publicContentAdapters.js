import { supabase } from '@/lib/customSupabaseClient';

const toDateText = (value) => value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

export const slugify = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || `konten-${Date.now()}`;

export const getPublicContentErrorMessage = (error) => {
  if (!error) return 'Terjadi kesalahan tidak diketahui.';
  if (error.code === '23505') return 'Slug sudah digunakan. Ubah judul atau slug konten.';
  if (error.code === '42501') return 'Akses ditolak oleh kebijakan keamanan.';
  return error.message || String(error);
};

export const normalizeNewsRow = (row) => ({
  id: row.id,
  title: row.title || '',
  slug: row.slug || row.id,
  summary: row.excerpt || '',
  excerpt: row.excerpt || '',
  content: row.content?.body || row.content?.text || '',
  image_url: row.cover_image_url || '',
  cover_image_url: row.cover_image_url || '',
  status: row.status || 'draft',
  date: toDateText(row.published_at || row.created_at),
  published_at: row.published_at,
  created_at: row.created_at,
});

export const normalizeAnnouncementRow = (row) => ({
  id: row.id,
  title: row.title || '',
  slug: row.slug || row.id,
  summary: row.excerpt || '',
  excerpt: row.excerpt || '',
  content: row.content?.body || row.content?.text || '',
  image_url: row.cover_image_url || '',
  cover_image_url: row.cover_image_url || '',
  status: row.status || 'draft',
  priority: row.priority || 'normal',
  valid_until: row.valid_until || '',
  date: toDateText(row.published_at || row.created_at),
  published_at: row.published_at,
  created_at: row.created_at,
});

export const fetchWebsiteContentMap = async ({ keys, publicOnly = true } = {}) => {
  let query = supabase.from('website_content').select('key, content, is_public');
  if (Array.isArray(keys) && keys.length > 0) query = query.in('key', keys);
  if (publicOnly) query = query.eq('is_public', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).reduce((acc, item) => {
    acc[item.key] = item.content;
    return acc;
  }, {});
};

export const normalizeWebsiteContentValue = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value === 'string') return value.trim();
  return value;
};

export const assertNonEmptyWebsiteContentString = (key, value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${key} tidak boleh kosong.`);
  return normalized;
};

export const saveWebsiteContentItem = async ({ key, content, isPublic = true }) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) throw new Error('Key konten wajib diisi.');
  const normalizedContent = normalizeWebsiteContentValue(content);
  const payload = {
    key: normalizedKey,
    content: normalizedContent,
    is_public: isPublic,
  };
  const { data, error } = await supabase
    .from('website_content')
    .upsert(payload, { onConflict: 'key' })
    .select('key, content, is_public')
    .single();
  if (error) throw error;
  return data;
};

export const saveWebsiteContentItems = async (items) => {
  const payload = (items || [])
    .map((item) => ({
      key: String(item.key || '').trim(),
      content: normalizeWebsiteContentValue(item.content),
      is_public: item.is_public ?? item.isPublic ?? true,
    }))
    .filter((item) => item.key);
  if (payload.length === 0) return [];
  const { data, error } = await supabase
    .from('website_content')
    .upsert(payload, { onConflict: 'key' })
    .select('key, content, is_public');
  if (error) throw error;
  return data || [];
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Gagal membaca gambar logo.'));
  reader.readAsDataURL(blob);
});

export const getEmbeddableImageUrl = async (url, fallback = '/lpq-mark.svg') => {
  const target = typeof url === 'string' && url.trim() ? url.trim() : fallback;
  if (target.startsWith('data:') || target.startsWith('/')) return target;
  try {
    const response = await fetch(target, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Logo tidak dapat dimuat (${response.status}).`);
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return fallback;
  }
};

export const fetchReceiptLogoDataUrl = async (fallback = '/lpq-mark.svg') => {
  try {
    const contentMap = await fetchWebsiteContentMap({ keys: ['logoUrl'], publicOnly: true });
    return await getEmbeddableImageUrl(contentMap.logoUrl, fallback);
  } catch {
    return fallback;
  }
};

export const waitForImagesToLoad = async (rootElement) => {
  if (!rootElement) return;
  const images = Array.from(rootElement.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });
  }));
};

export const fetchPublishedNews = async ({ limit } = {}) => {
  let query = supabase
    .from('news')
    .select('id,title,slug,excerpt,content,cover_image_url,status,published_at,created_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeNewsRow);
};

export const fetchNewsDetail = async (slugOrId) => {
  const uuidLike = /^[0-9a-fA-F-]{36}$/.test(String(slugOrId || ''));
  let query = supabase
    .from('news')
    .select('id,title,slug,excerpt,content,cover_image_url,status,published_at,created_at')
    .eq('status', 'published');
  query = uuidLike ? query.or(`slug.eq.${slugOrId},id.eq.${slugOrId}`) : query.eq('slug', slugOrId);
  query = query.maybeSingle();
  const { data, error } = await query;
  if (error) throw error;
  return data ? normalizeNewsRow(data) : null;
};

export const fetchPublishedAnnouncements = async ({ limit } = {}) => {
  let query = supabase
    .from('announcements')
    .select('id,title,slug,excerpt,content,cover_image_url,status,priority,valid_until,published_at,created_at')
    .eq('status', 'published')
    .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().slice(0, 10)}`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeAnnouncementRow);
};

export const fetchAnnouncementDetail = async (slugOrId) => {
  const uuidLike = /^[0-9a-fA-F-]{36}$/.test(String(slugOrId || ''));
  let query = supabase
    .from('announcements')
    .select('id,title,slug,excerpt,content,cover_image_url,status,priority,valid_until,published_at,created_at')
    .eq('status', 'published');
  query = uuidLike ? query.or(`slug.eq.${slugOrId},id.eq.${slugOrId}`) : query.eq('slug', slugOrId);
  query = query.maybeSingle();
  const { data, error } = await query;
  if (error) throw error;
  if (data?.valid_until && data.valid_until < new Date().toISOString().slice(0, 10)) return null;
  return data ? normalizeAnnouncementRow(data) : null;
};

export const fetchAdminNews = async () => {
  const { data, error } = await supabase
    .from('news')
    .select('id,title,slug,excerpt,content,cover_image_url,status,published_at,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeNewsRow);
};

export const fetchAdminAnnouncements = async () => {
  const { data, error } = await supabase
    .from('announcements')
    .select('id,title,slug,excerpt,content,cover_image_url,status,priority,valid_until,published_at,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeAnnouncementRow);
};

const publicationTimestamp = (status, existingPublishedAt) => {
  if (status !== 'published') return existingPublishedAt || null;
  return existingPublishedAt || new Date().toISOString();
};

export const saveNews = async (item) => {
  const status = item.status || 'draft';
  const payload = {
    title: String(item.title || '').trim(),
    slug: String(item.slug || slugify(item.title)).trim(),
    excerpt: String(item.summary || item.excerpt || '').trim() || null,
    content: { body: String(item.content || '').trim() },
    cover_image_url: String(item.image_url || item.cover_image_url || '').trim() || null,
    status,
    published_at: publicationTimestamp(status, item.published_at),
  };
  if (!payload.title) throw new Error('Judul berita wajib diisi.');
  if (item.id) payload.id = item.id;
  const { data, error } = await supabase.from('news').upsert(payload).select().single();
  if (error) throw error;
  return normalizeNewsRow(data);
};

export const saveAnnouncement = async (item) => {
  const status = item.status || 'draft';
  const payload = {
    title: String(item.title || '').trim(),
    slug: String(item.slug || slugify(item.title)).trim(),
    excerpt: String(item.summary || item.excerpt || '').trim() || null,
    content: { body: String(item.content || '').trim() },
    cover_image_url: String(item.image_url || item.cover_image_url || '').trim() || null,
    status,
    priority: item.priority || 'normal',
    valid_until: item.valid_until || null,
    published_at: publicationTimestamp(status, item.published_at),
  };
  if (!payload.title) throw new Error('Judul pengumuman wajib diisi.');
  if (item.id) payload.id = item.id;
  const { data, error } = await supabase.from('announcements').upsert(payload).select().single();
  if (error) throw error;
  return normalizeAnnouncementRow(data);
};

export const archiveNews = async (id) => {
  const { error } = await supabase.from('news').update({ status: 'archived' }).eq('id', id);
  if (error) throw error;
};

export const archiveAnnouncement = async (id) => {
  const { error } = await supabase.from('announcements').update({ status: 'archived' }).eq('id', id);
  if (error) throw error;
};

export const submitPublicFeedback = async ({ nama, name, email, phone, no_hp, message, pesan }) => {
  const payload = {
    nama: String(nama || name || '').trim() || null,
    email: String(email || '').trim() || null,
    phone: String(phone || no_hp || '').trim() || null,
    message: String(message || pesan || '').trim(),
  };
  if (!payload.message) throw new Error('Pesan wajib diisi.');
  const { error } = await supabase.from('feedbacks').insert(payload);
  if (error) throw error;
};

export const fetchAdminFeedbacks = async () => {
  const { data, error } = await supabase
    .from('feedbacks')
    .select('id,nama,email,phone,message,status,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const deleteFeedback = async (id) => {
  const { error } = await supabase.from('feedbacks').delete().eq('id', id);
  if (error) throw error;
};
