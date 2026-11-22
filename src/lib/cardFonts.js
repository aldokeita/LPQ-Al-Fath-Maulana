// CSS font tertanam untuk ekspor kartu santri (html-to-image).
// html-to-image tidak bisa membaca stylesheet Google Fonts lintas-origin, sehingga di sebagian perangkat
// PNG memakai font cadangan yang lebih lebar dan teks kartu terbelah atau terpotong. Di sini file font
// diambil sendiri lalu ditanam sebagai data URL agar hasil ekspor selalu memakai Outfit, Cinzel, dan Amiri.

export const CARD_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;800&family=Cinzel:wght@700&family=Amiri:wght@400;700&display=swap';

const SUBSETS = new Set(['latin', 'arabic']);

// Ambil blok @font-face untuk subset yang dipakai kartu (komentar "/* latin */" mendahului tiap blok).
export const pickFontFaces = (css) => {
  const blocks = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*{[^}]*})/g;
  let m = re.exec(css);
  while (m) {
    if (SUBSETS.has(m[1])) blocks.push(m[2]);
    m = re.exec(css);
  }
  return blocks;
};

const toDataUrl = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

let cached = null;

// Mengembalikan CSS @font-face dengan src berupa data URL; null bila gagal (ekspor tetap jalan).
export const getCardFontEmbedCSS = () => {
  if (!cached) {
    cached = (async () => {
      const res = await fetch(CARD_FONTS_URL);
      if (!res.ok) throw new Error(`fonts css ${res.status}`);
      const faces = pickFontFaces(await res.text());
      const embedded = await Promise.all(faces.map(async (face) => {
        const url = face.match(/url\(([^)]+)\)/)?.[1]?.replace(/['"]/g, '');
        if (!url) return face;
        return face.replace(/url\([^)]+\)/, `url(${await toDataUrl(url)})`);
      }));
      return embedded.join('\n');
    })().catch(() => {
      cached = null;
      return null;
    });
  }
  return cached;
};
