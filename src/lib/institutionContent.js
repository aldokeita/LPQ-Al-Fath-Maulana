export const INSTITUTION_NAME = 'LPQ Al-Fath Maulana';
export const OFFICIAL_WEBSITE = 'https://lpqalfathmaulana.id';

export const OFFICIAL_CONTACT = Object.freeze({
  address: 'Lrg. Kemang Kampung Baru Kanio Lama, Kel. Kemalaraja, Pasar Baru Baturaja, Sumatera Selatan',
  city: 'Baturaja',
  phone: '0857-8322-7144',
  phoneHref: 'tel:+6285783227144',
  whatsapp: 'https://wa.me/6285783227144',
  email: 'admin@lpqalfathmaulana.id',
  emailHref: 'mailto:admin@lpqalfathmaulana.id',
  mapUrl: 'https://maps.app.goo.gl/zh4REizJZx6LByMD9',
  website: OFFICIAL_WEBSITE,
});

export const OFFICIAL_PROFILE = Object.freeze({
  description: [
    "LPQ Al-Fath Maulana adalah lembaga pendidikan Al-Qur'an yang menerapkan metode Qiroati, sebuah sistem pembelajaran yang efektif dalam mengajarkan bacaan Al-Qur'an dengan tartil dan sesuai kaidah tajwid.",
    "Berlokasi di Baturaja, LPQ Al-Fath Maulana berkomitmen mencetak generasi Qur'ani yang mampu membaca Al-Qur'an dengan benar serta memahami dan mengamalkan nilai-nilai luhur di dalamnya.",
  ],
  secondaryDescription: 'Pembelajaran menekankan tahsin, tahqiq, pembinaan adab, pendampingan sesuai kemampuan, serta lingkungan belajar yang kondusif bagi santri dan keluarga.',
  vision: "Menjadi lembaga pendidikan Al-Qur'an terdepan yang mencetak generasi Qur'ani berakhlak mulia.",
  missions: [
    "Mengajarkan Al-Qur'an dengan metode Qiroati yang terstruktur dan efektif.",
    'Membina akhlak santri sesuai dengan nilai-nilai Islam.',
    'Menyediakan lingkungan belajar yang kondusif dan menyenangkan.',
    'Mengembangkan potensi santri secara optimal.',
  ],
});

export const OFFICIAL_SCHEDULES = Object.freeze([
  { id: 'pagi', title: 'Sesi Pagi', time: '08.00–09.15 WIB', type: 'TPQ' },
  { id: 'siang', title: 'Sesi Siang', time: '14.00–15.15 WIB', type: 'TPQ' },
  { id: 'sore', title: 'Sesi Sore', time: '16.00–17.15 WIB', type: 'TPQ' },
]);

export const OFFICIAL_QUOTAS = Object.freeze({
  pagi: 15,
  siang: 15,
  sore: 15,
  dewasaPagi: 9,
  dewasaSiang: 7,
  dewasaMalam: 8,
});

export const OFFICIAL_HERO_SLIDES = Object.freeze([
  {
    id: 'official-hero-learning',
    url: '/institution/hero-learning.webp',
    text: "Sebaik-baik kalian adalah orang yang mempelajari Al-Qur'an dan mengajarkannya",
    author: 'HR. Bukhari',
  },
  {
    id: 'official-hero-al-alaq',
    url: '/institution/hero-al-alaq.webp',
    text: 'Bacalah dengan menyebut nama Tuhanmu yang menciptakan',
    author: 'QS. Al-Alaq: 1',
  },
  {
    id: 'official-hero-qiroati',
    url: '/institution/hero-qiroati.webp',
    text: "Jangan wariskan bacaan Qur'an yang salah, karena yang benar itu mudah",
    author: 'KH. Dachlan Salim Zarkasyi',
  },
]);

export const OFFICIAL_FACILITIES = Object.freeze([
  {
    id: 'official-classroom',
    name: 'Ruang Kelas',
    description: 'Ruang kelas yang bersih dan nyaman mendukung santri belajar Al-Qur’an dengan lebih fokus.',
    image_url: '/institution/classroom.webp',
  },
]);

export const OFFICIAL_GALLERY = Object.freeze([
  {
    id: 'official-gallery-quiz',
    title: 'Quiz bersama santri',
    caption: 'Quiz tanya jawab bersama santri LPQ Al-Fath Maulana.',
    description: 'Kegiatan interaktif untuk menguatkan pemahaman dan kebersamaan santri.',
    url: '/institution/gallery-quiz.webp',
  },
]);

export const OFFICIAL_FAQS = Object.freeze([
  {
    id: 'fee',
    question: 'Berapa biaya pendaftaran TPQ?',
    answer: 'Total biaya pendaftaran TPQ adalah Rp450.000 dan dapat dicicil selama satu bulan.',
  },
  {
    id: 'adult',
    question: 'Apakah tersedia kelas untuk orang dewasa?',
    answer: 'Ya. Kelas dewasa tersedia untuk usia minimal 17 tahun dengan pilihan waktu pagi, siang, atau malam sesuai kesepakatan.',
  },
  {
    id: 'requirements',
    question: 'Apa saja syarat pendaftaran TPQ?',
    answer: 'Wali dan calon santri hadir saat pendaftaran, mengisi formulir, serta membawa fotokopi akta kelahiran, Kartu Keluarga, dua pasfoto 3×4, dan materai Rp10.000.',
  },
]);

export const INSTITUTION_PROOF_POINTS = Object.freeze([
  { id: 'qiroati', title: 'Metode Qiroati terstruktur', text: 'Pembelajaran bacaan berlangsung bertahap, tartil, dan sesuai kaidah tajwid.' },
  { id: 'small-class', title: 'Kelas maksimal 15 santri', text: 'Kelas kecil memberi ruang bagi guru untuk mendampingi perkembangan setiap santri.' },
  { id: 'progress', title: 'Progres tercatat', text: 'Buku prestasi membantu guru dan wali memantau bacaan serta tindak lanjut belajar.' },
]);

export const OFFICIAL_CTA_BACKGROUND = '/institution/cta-activity.webp';
export const ACADEMIC_YEAR = '2026–2027';
