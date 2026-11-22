// Masukan suara lewat Web Speech API bawaan browser, dikunci ke Bahasa Indonesia.
export const SPEECH_LANG = 'id-ID';

export const getSpeechRecognition = (win = typeof window !== 'undefined' ? window : undefined) => {
  if (!win || win.isSecureContext === false) return null;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
};

const SENTENCE_END = /([.!?]\s*|\n\s*)$/;

// Gabungkan hasil dikte ke teks yang sudah ada: spasi seperlunya, huruf kapital di awal kalimat.
export const appendTranscript = (base, addition) => {
  const add = String(addition || '').replace(/\s+/g, ' ').trim();
  const text = String(base || '');
  if (!add) return text;
  const startSentence = !text.trim() || SENTENCE_END.test(text);
  const piece = startSentence ? add.charAt(0).toLocaleUpperCase('id-ID') + add.slice(1) : add;
  if (!text) return piece;
  return /\s$/.test(text) ? text + piece : `${text} ${piece}`;
};

export const SPEECH_ERRORS = {
  'not-allowed': 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser.',
  'service-not-allowed': 'Pengenalan suara tidak diizinkan di browser ini. Gunakan mic pada keyboard.',
  'no-speech': 'Tidak ada suara yang terdengar. Coba lagi lebih dekat ke mikrofon.',
  'audio-capture': 'Mikrofon tidak ditemukan.',
  network: 'Pengenalan suara butuh koneksi internet. Periksa koneksi lalu coba lagi.',
  'language-not-supported': 'Browser ini belum mendukung pengenalan suara Bahasa Indonesia. Gunakan mic pada keyboard.',
};
