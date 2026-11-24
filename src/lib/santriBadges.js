// Badge apresiasi santri: tiap badge, tiap sesi, satu santri putra dan satu santri putri.
// Disimpan di website_content (key SANTRI_BADGES_KEY) hanya berupa id santri, tanpa nama.
import { getSessionName } from '../utils/sessionMapping.js';

export const SANTRI_BADGES_KEY = 'santriBadges';

export const SANTRI_BADGES = [
  { id: 'terdisiplin', title: 'Santri Terdisiplin', lines: ['Santri', 'Terdisiplin'], from: '#0f9f8f', to: '#22c55e' },
  { id: 'hafalan', title: 'Santri Hafalan Terbanyak', lines: ['Hafalan', 'Terbanyak'], from: '#22c3d6', to: '#4f7df0' },
  { id: 'drilling', title: 'Santri Drilling Terbaik', lines: ['Drilling', 'Terbaik'], from: '#7c5cf0', to: '#c04fd8' },
  { id: 'shalat', title: 'Shalat Terkhusyu', lines: ['Shalat', 'Terkhusyu'], from: '#e7a21a', to: '#e2621f' },
];

export const BADGE_GENDERS = [
  { id: 'putra', label: 'Santri Putra' },
  { id: 'putri', label: 'Santri Putri' },
];

const SESSION_ORDER = ['Pagi', 'Siang', 'Sore', 'Malam'];
const BADGE_IDS = new Set(SANTRI_BADGES.map((badge) => badge.id));

export const normalizeBadgeGender = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (['laki-laki', 'laki laki', 'l', 'putra', 'pria'].includes(text)) return 'putra';
  if (['perempuan', 'p', 'putri', 'wanita'].includes(text)) return 'putri';
  return null;
};

// Sesi bisa tersimpan sebagai kode angka ("0", "2") atau nama ("Pagi"); keduanya disatukan ke nama.
export const normalizeBadgeSession = (value) => String(getSessionName(String(value ?? '').trim()) || '').trim();

export const resolveSantriBadgeSession = (santri) => (
  normalizeBadgeSession(santri?.sesi_mengaji || santri?.class?.sesi || '')
);

export const listBadgeSessions = (santriList = []) => {
  const sessions = [...new Set(santriList.map(resolveSantriBadgeSession).filter(Boolean))];
  const rank = (sesi) => {
    const index = SESSION_ORDER.indexOf(sesi);
    return index === -1 ? SESSION_ORDER.length : index;
  };
  return sessions.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'id'));
};

// Only well-formed { badgeId: { sesi: { putra, putri } } } entries survive; anything else is dropped.
export const normalizeBadgeConfig = (raw) => {
  const awards = {};
  const source = raw && typeof raw === 'object' ? raw.awards : null;
  if (source && typeof source === 'object') {
    Object.entries(source).forEach(([badgeId, sessions]) => {
      if (!BADGE_IDS.has(badgeId) || !sessions || typeof sessions !== 'object') return;
      Object.entries(sessions).forEach(([sesi, winners]) => {
        const putra = typeof winners?.putra === 'string' && winners.putra ? winners.putra : null;
        const putri = typeof winners?.putri === 'string' && winners.putri ? winners.putri : null;
        if (!sesi || (!putra && !putri)) return;
        awards[badgeId] = { ...(awards[badgeId] || {}), [sesi]: { putra, putri } };
      });
    });
  }
  return { awards };
};

export const getBadgeWinner = (config, { badgeId, sesi, gender }) => (
  config?.awards?.[badgeId]?.[sesi]?.[gender] || null
);

export const setBadgeWinner = (config, { badgeId, sesi, gender, santriId }) => {
  const current = normalizeBadgeConfig(config);
  const slot = { putra: null, putri: null, ...(current.awards[badgeId]?.[sesi] || {}), [gender]: santriId || null };
  const sessions = { ...(current.awards[badgeId] || {}) };
  if (slot.putra || slot.putri) sessions[sesi] = slot;
  else delete sessions[sesi];
  const awards = { ...current.awards, [badgeId]: sessions };
  if (!Object.keys(sessions).length) delete awards[badgeId];
  return { awards };
};

// Badges held by one santri, in the fixed display order.
export const badgesForSantri = (config, santriId) => {
  if (!santriId) return [];
  const awards = normalizeBadgeConfig(config).awards;
  return SANTRI_BADGES.filter((badge) => Object.values(awards[badge.id] || {})
    .some((slot) => slot.putra === santriId || slot.putri === santriId));
};

export const getSantriBadgeById = (id) => SANTRI_BADGES.find((badge) => badge.id === id) || null;

// ===== Hak istimewa santri berprestasi (dapat diedit admin di tab Apresiasi) =====

export const SANTRI_BADGE_PRIVILEGES_KEY = 'santriBadgePrivileges';
export const PRIVILEGE_MAX_ITEMS = 12;
export const PRIVILEGE_MAX_LENGTH = 140;
export const PRIVILEGE_INTRO_MAX_LENGTH = 240;

export const DEFAULT_BADGE_PRIVILEGES = {
  intro: 'Santri peraih badge apresiasi mendapat hak istimewa berikut selama periode berlaku.',
  items: [
    'Masuk kelas lebih dulu setelah drilling.',
    'Maju mengaji lebih dulu saat di kelas.',
    'Pulang lebih dulu setelah membaca doa penutup.',
    'Memimpin doa pembuka atau penutup di kelas.',
    'Duduk di barisan terdepan saat kegiatan bersama.',
    'Namanya dipajang di papan Santri Berprestasi.',
  ],
};

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Konten tersimpan → { intro, items }; kosong/rusak memakai bawaan.
export const normalizeBadgePrivileges = (raw) => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return { ...DEFAULT_BADGE_PRIVILEGES, items: [...DEFAULT_BADGE_PRIVILEGES.items] };
  return {
    intro: clean(raw.intro, PRIVILEGE_INTRO_MAX_LENGTH),
    items: raw.items.map((item) => clean(item, PRIVILEGE_MAX_LENGTH)).filter(Boolean).slice(0, PRIVILEGE_MAX_ITEMS),
  };
};
