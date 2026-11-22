const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ');

// Indonesian function words stay lowercase inside a title (PUEBI), except as the first word.
const LOWERCASE_WORDS = new Set([
  'dan', 'atau', 'serta', 'di', 'ke', 'dari', 'yang', 'untuk', 'dengan',
  'bagi', 'pada', 'dalam', 'kepada', 'oleh', 'agar',
]);
const ACRONYMS = new Set(['WC', 'TPQ', 'PTPT', 'SAW', 'SWT']);
const TITLE_CASE_CATEGORIES = new Set(['Doa', 'Sholat']);

const capitalizeSegment = (segment) => {
  if (ACRONYMS.has(segment.toUpperCase()) && segment === segment.toUpperCase()) return segment;
  const lower = segment.toLocaleLowerCase('id-ID');
  // Capitalize the first letter only, so apostrophes stay lowercase after them (Ma’un, I‘tidal).
  return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('id-ID'));
};

export const toHafalanTitleCase = (value) => {
  let isFirstWord = true;
  return normalize(value)
    .split(' ')
    .map((word) => {
      const bare = word.replace(/[^\p{L}]/gu, '').toLocaleLowerCase('id-ID');
      if (!bare) return word;
      const keepLower = !isFirstWord && LOWERCASE_WORDS.has(bare) && word.toLocaleLowerCase('id-ID') === bare;
      isFirstWord = false;
      if (keepLower) return bare;
      return word.split('-').map(capitalizeSegment).join('-');
    })
    .join(' ')
    .replace(/(^|[^\p{L}])do['’‘]?a(?=$|[^\p{L}])/giu, "$1Do'a");
};

// TPQ Doa and Sholat names use Title Case with "Do'a"; other boards keep the admin's casing.
export const usesHafalanTitleCase = ({ category, programScope = 'TPQ' } = {}) => (
  programScope === 'TPQ' && TITLE_CASE_CATEGORIES.has(category)
);

export const formatHafalanItemName = (value, scope = {}) => (
  usesHafalanTitleCase(scope) ? toHafalanTitleCase(value) : normalize(value)
);

// Returns { name } when the rename is valid, or { error } with a message for the admin.
export const validateHafalanItemRename = ({ item, nextName, items = [], format = normalize }) => {
  const name = format(nextName);
  if (!name) return { error: 'Nama hafalan tidak boleh kosong.' };
  if (name === item?.item_name) return { name, unchanged: true };

  const duplicate = items.some((other) =>
    other?.id !== item?.id && normalize(other?.item_name).toLowerCase() === name.toLowerCase()
  );
  if (duplicate) return { error: `"${name}" sudah ada di kategori ini.` };

  return { name };
};
