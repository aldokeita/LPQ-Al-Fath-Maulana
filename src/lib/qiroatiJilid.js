export const QIROATI_JILID_OPTIONS = Object.freeze([
  'Pra TK A', 'Pra TK B', 'Pra TK C',
  'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
  'Jilid 2A', 'Jilid 2B',
  'Jilid 3A', 'Jilid 3B',
  'Jilid 4A', 'Jilid 4B',
  'Jilid 5A', 'Jilid 5B',
  'Jilid Juz 27',
  'Jilid 6A', 'Jilid 6B',
  "Al-Qur'an", 'Ghorib Tajwid', 'Finishing',
]);

const QIROATI_JILID_ALIASES = Object.freeze({
  'Juz 27': 'Jilid Juz 27',
});

export const normalizeQiroatiJilid = (jilid) => {
  const value = String(jilid || '').trim();
  return QIROATI_JILID_ALIASES[value] || value;
};

export const getAdjacentQiroatiJilid = (currentJilid, direction) => {
  const currentIndex = QIROATI_JILID_OPTIONS.indexOf(normalizeQiroatiJilid(currentJilid));
  if (currentIndex < 0) return null;

  const offset = direction === 'down' ? -1 : 1;
  return QIROATI_JILID_OPTIONS[currentIndex + offset] || null;
};
