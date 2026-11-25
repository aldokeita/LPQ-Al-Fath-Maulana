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
  instagram: 'lpq_alfathmaulana',
  instagramUrl: 'https://www.instagram.com/lpq_alfathmaulana/',
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

const KEGIATAN = '/institution/kegiatan';
const photo = (name) => `${KEGIATAN}/${name}.webp`;

export const OFFICIAL_FACILITIES = Object.freeze([
  {
    id: 'official-gedung',
    name: 'Gedung LPQ',
    description: 'Gedung biru LPQ Al-Fath Maulana di Baturaja dengan pagar, teras beratap, dan papan nama lembaga di bagian depan.',
    image_url: photo('2023-11-gedung-lpq'),
  },
  {
    id: 'official-classroom',
    name: 'Ruang Kelas',
    description: 'Ruang kelas yang bersih dan nyaman mendukung santri belajar Al-Qur’an dengan lebih fokus.',
    image_url: '/institution/classroom.webp',
  },
  {
    id: 'official-ruang-belajar',
    name: 'Ruang Belajar Berkarpet',
    description: 'Ruangan terang berjendela lebar dengan karpet tebal, jadi santri bisa duduk nyaman saat setoran bacaan.',
    image_url: photo('2023-11-ruang-kelas'),
  },
  {
    id: 'official-meja-belajar',
    name: 'Meja Belajar Santri',
    description: 'Meja lipat untuk membaca jilid Qiroati dan menulis, disusun rapi di dalam kelas.',
    image_url: photo('2023-11-meja-belajar'),
  },
  {
    id: 'official-media-belajar',
    name: 'Alat Peraga & Media Belajar',
    description: 'Mainan edukatif, kartu huruf, dan perlengkapan mewarnai untuk santri usia dini supaya belajar tetap seru.',
    image_url: photo('2024-05-alat-peraga'),
  },
  {
    id: 'official-teras',
    name: 'Teras Beratap',
    description: 'Teras luas beratap di depan kelas, dipakai untuk berkumpul, sholat berjamaah, dan kegiatan bersama.',
    image_url: photo('2024-03-teras-lpq'),
  },
  {
    id: 'official-halaman',
    name: 'Halaman Bermain',
    description: 'Halaman berpagar di samping gedung, tempat santri bermain dan bersantai sebelum atau sesudah belajar.',
    image_url: photo('2024-05-halaman-bermain'),
  },
  {
    id: 'official-tangga',
    name: 'Tangga Biru',
    description: 'Tangga biru khas LPQ yang jadi sudut favorit santri untuk duduk santai dan berfoto.',
    image_url: photo('2024-05-tangga-biru'),
  },
]);

const galleryItem = (name, title, description) => ({
  id: `official-gallery-${name}`,
  caption: title,
  description,
  url: photo(name),
});

// Diurutkan dari yang terbaru supaya beranda menampilkan kegiatan paling baru lebih dulu.
export const OFFICIAL_GALLERY = Object.freeze([
  galleryItem('2026-10-foto-bersama-keluarga-lpq', 'Foto bersama keluarga besar LPQ', 'Santri, guru, dan keluarga LPQ berfoto bersama di teras, Oktober 2026.'),
  galleryItem('2026-10-tilawah-santri', 'Tilawah santri', 'Santri membaca Al-Qur’an secara bergantian, Oktober 2026.'),
  galleryItem('2026-10-santri-dan-guru', 'Santri bersama guru', 'Santri berpakaian putih bersama guru selepas kegiatan, Oktober 2026.'),
  galleryItem('2026-08-belajar-digital', 'Belajar pakai tablet', 'Santri antusias belajar dengan media digital, Agustus 2026.'),
  galleryItem('2026-08-santri-berbaris', 'Santri berbaris rapi', 'Santri berbaris di teras sebelum kegiatan dimulai, Agustus 2026.'),
  galleryItem('2026-06-barisan-santri', 'Barisan santri', 'Santri bersiap mengikuti kegiatan bersama guru, Juni 2026.'),
  galleryItem('2026-06-kelas-pagi', 'Kelas pagi', 'Suasana belajar santri kecil di kelas pagi, Juni 2026.'),
  galleryItem('2026-03-kebersamaan-santri-wali', 'Kebersamaan santri dan wali', 'Santri, wali, dan guru berkumpul di teras LPQ, Maret 2026.'),
  galleryItem('2026-01-santri-percaya-diri', 'Santri percaya diri', 'Santri tampil percaya diri di depan teman-temannya, Januari 2026.'),
  galleryItem('2025-04-foto-bersama-aula', 'Foto bersama di teras', 'Santri dan guru berfoto bersama di teras LPQ, April 2025.'),
  galleryItem('2025-04-kebersamaan-kelas', 'Kebersamaan kelas', 'Santri dan guru berkumpul bersama di dalam kelas, April 2025.'),
  galleryItem('2025-03-makan-bersama', 'Makan bersama', 'Santri, guru, dan keluarga makan bersama di LPQ, Maret 2025.'),
  galleryItem('2025-03-santri-bersama', 'Santri bersama', 'Santri putra berkumpul di teras LPQ, Maret 2025.'),
  galleryItem('2025-01-foto-bersama-depan-lpq', 'Foto bersama di depan LPQ', 'Santri dan guru berfoto di depan papan nama LPQ, Januari 2025.'),
  galleryItem('2024-11-shaff-barisan-pemuda-qurani', 'SHAFF: Barisan Pemuda Qur’ani', 'Sesi berbagi SHAFF di LPQ Al-Fath Maulana, 16 November 2024.'),
  galleryItem('2024-11-shaff-santriwati', 'Santriwati di acara SHAFF', 'Santriwati mengikuti acara SHAFF, 16 November 2024.'),
  galleryItem('2024-06-belajar-berdua', 'Belajar berdua', 'Dua santriwati membaca jilid bersama, Juni 2024.'),
  galleryItem('2024-05-sholat-berjamaah', 'Sholat berjamaah', 'Santri sholat berjamaah di teras LPQ, Mei 2024.'),
  galleryItem('2024-05-santriwati-di-tangga', 'Santai di tangga biru', 'Santriwati bersantai di tangga biru LPQ, Mei 2024.'),
  galleryItem('2024-05-santri-berpeci', 'Santri berpeci', 'Dua santri berpose di depan papan tulis, Mei 2024.'),
  galleryItem('2024-04-kelas-santri', 'Kelas santri kecil', 'Santri kecil belajar dengan meja warna-warni, April 2024.'),
  galleryItem('2024-04-membaca-jilid', 'Membaca jilid', 'Santri fokus membaca jilid Qiroati, April 2024.'),
  galleryItem('2024-03-kebersamaan-santri', 'Kebersamaan santri', 'Santri dan guru berkumpul di kelas, Maret 2024.'),
  galleryItem('2024-03-belajar-bersama', 'Belajar bersama', 'Suasana kelas saat santri belajar bersama, Maret 2024.'),
  galleryItem('2024-02-mewarnai', 'Mewarnai', 'Santri usia dini belajar sambil mewarnai, Februari 2024.'),
  galleryItem('2024-02-ceria-di-kelas', 'Ceria di kelas', 'Senyum santriwati saat belajar di kelas, Februari 2024.'),
  galleryItem('2024-02-kelas-kecil', 'Kelas kecil', 'Santri kecil siap belajar di kelas, Februari 2024.'),
  galleryItem('2024-01-kartu-huruf', 'Belajar dengan kartu huruf', 'Santriwati semangat mengenal huruf hijaiyah lewat kartu, Januari 2024.'),
  galleryItem('2024-01-semangat-belajar', 'Semangat belajar', 'Santriwati ceria saat membaca jilid, Januari 2024.'),
  galleryItem('2024-01-halaqah-santri', 'Halaqah santri', 'Santri duduk melingkar mengikuti pembelajaran, Januari 2024.'),
  galleryItem('2023-12-santriwati-membaca', 'Santriwati membaca', 'Santriwati membaca jilid dengan teliti, Desember 2023.'),
  galleryItem('2023-11-santri-membaca', 'Santri membaca', 'Santri membaca jilid Qiroati di kelas, November 2023.'),
  galleryItem('2023-11-belajar-qiroati', 'Awal belajar Qiroati', 'Santriwati belajar membaca jilid Qiroati, November 2023.'),
  {
    id: 'official-gallery-quiz',
    title: 'Quiz bersama santri',
    caption: 'Quiz tanya jawab bersama santri LPQ Al-Fath Maulana.',
    description: 'Kegiatan interaktif untuk menguatkan pemahaman dan kebersamaan santri.',
    url: '/institution/gallery-quiz.webp',
  },
]);

/*
 * Berita & pengumuman bawaan dari dokumentasi foto LPQ.
 * Tampil hanya bila Supabase belum punya konten yang terbit. Admin bisa memasukkannya ke
 * database lewat tombol "Impor konten bawaan" di Manajemen Konten, lalu mengeditnya dari sana.
 */
export const OFFICIAL_NEWS = Object.freeze([
  {
    id: 'official-news-hari-guru-2026',
    slug: 'selamat-hari-guru-2026',
    title: 'Selamat Hari Guru 2026: terima kasih, Kakak dan Teteh',
    excerpt: 'Sebuah perjalanan sejak 5 Oktober 2023. Terima kasih untuk sabar yang tak pernah habis dan semua dedikasinya.',
    content: [
      'Selamat Hari Guru, 25 November 2026.',
      'Sejak 5 Oktober 2023, LPQ Al-Fath Maulana Baturaja tumbuh dari ruang sederhana dengan santri seadanya. Tahun demi tahun kelas makin ramai, dan setiap pertemuan meninggalkan kenangan.',
      '"Sebaik-baik kalian adalah yang belajar Al-Qur\'an dan mengajarkannya." (HR. Bukhari)',
      'Terima kasih, para Kakak dan Teteh semua, atas sabar yang tak pernah habis dan semua dedikasinya. Semoga setiap huruf yang diajarkan menjadi amal jariyah. Jazakumullahu khairan.',
    ].join('\n\n'),
    cover_image_url: photo('2026-10-foto-bersama-keluarga-lpq'),
    published_at: '2026-11-25',
  },
  {
    id: 'official-news-tilawah-oktober-2026',
    slug: 'tilawah-santri-oktober-2026',
    title: 'Santri unjuk bacaan Al-Qur’an di hadapan guru dan teman',
    excerpt: 'Santri berpakaian putih membaca Al-Qur’an secara bergantian di teras LPQ, disimak guru dan santri lainnya.',
    content: [
      'Pada 30 Oktober 2026, santri LPQ Al-Fath Maulana membaca Al-Qur’an secara bergantian di teras LPQ. Satu per satu santri tampil membaca dengan pengeras suara, sementara guru dan teman-temannya menyimak.',
      'Momen seperti ini melatih keberanian santri sekaligus menunjukkan hasil belajar bacaan yang tartil dengan metode Qiroati.',
      'Selepas kegiatan, santri dan guru berfoto bersama di depan tangga biru LPQ.',
    ].join('\n\n'),
    cover_image_url: photo('2026-10-tilawah-santri'),
    published_at: '2026-10-30',
  },
  {
    id: 'official-news-ramadan-1446',
    slug: 'kebersamaan-ramadan-1446-h',
    title: 'Hangatnya kebersamaan di bulan Ramadan',
    excerpt: 'Santri, guru, dan keluarga LPQ berkumpul dan makan bersama di bulan Ramadan 1446 H.',
    content: [
      'Pada 21 Maret 2025, bertepatan dengan bulan Ramadan 1446 H, keluarga besar LPQ Al-Fath Maulana berkumpul di LPQ. Santri, guru, dan keluarga duduk bersama dan menikmati hidangan di atas alas daun pisang.',
      'Kebersamaan sederhana ini jadi pengingat bahwa LPQ bukan cuma tempat belajar membaca Al-Qur’an, tapi juga keluarga.',
    ].join('\n\n'),
    cover_image_url: photo('2025-03-makan-bersama'),
    published_at: '2025-03-21',
  },
  {
    id: 'official-news-shaff-2024',
    slug: 'shaff-barisan-pemuda-qurani-2024',
    title: 'SHAFF, Barisan Pemuda Qur’ani, hadir di LPQ',
    excerpt: 'Santri putra dan putri mengikuti sesi berbagi SHAFF (Barisan Pemuda Qur’ani) di LPQ Al-Fath Maulana.',
    content: [
      'Pada 16 November 2024, LPQ Al-Fath Maulana menjadi tempat kegiatan SHAFF, Barisan Pemuda Qur’ani.',
      'Santri putra dan putri duduk bersama di teras LPQ mengikuti sesi berbagi dari pemateri. Kegiatan ini jadi ruang bagi para pemuda untuk makin dekat dengan Al-Qur’an.',
    ].join('\n\n'),
    cover_image_url: photo('2024-11-shaff-barisan-pemuda-qurani'),
    published_at: '2024-11-16',
  },
  {
    id: 'official-news-awal-langkah-2023',
    slug: 'awal-langkah-lpq-al-fath-maulana',
    title: 'Awal langkah LPQ Al-Fath Maulana',
    excerpt: 'Sejak 5 Oktober 2023, LPQ Al-Fath Maulana mulai menemani anak-anak Baturaja belajar Al-Qur’an.',
    content: [
      'LPQ Al-Fath Maulana memulai perjalanannya pada 5 Oktober 2023 di Baturaja.',
      'Dari ruang sederhana, dengan santri seadanya, pembelajaran Al-Qur’an dengan metode Qiroati mulai berjalan. Gedung biru di Lrg. Kemang Kampung Baru Kanio Lama kini jadi rumah belajar bagi santri dan keluarga.',
    ].join('\n\n'),
    cover_image_url: photo('2023-11-gedung-lpq'),
    published_at: '2023-10-05',
  },
]);

export const OFFICIAL_ANNOUNCEMENTS = Object.freeze([
  {
    id: 'official-announcement-pendaftaran',
    slug: 'info-pendaftaran-santri-baru',
    title: 'Info pendaftaran santri baru TPQ dan kelas dewasa',
    excerpt: 'Biaya pendaftaran TPQ Rp450.000 (bisa dicicil satu bulan). Tersedia juga kelas dewasa untuk usia minimal 17 tahun.',
    content: [
      'LPQ Al-Fath Maulana menerima pendaftaran santri baru untuk TPQ dan kelas dewasa.',
      'Biaya pendaftaran TPQ Rp450.000 dan dapat dicicil selama satu bulan. Setiap kelas TPQ maksimal 15 santri supaya guru bisa mendampingi bacaan setiap anak.',
      'Syarat: wali dan calon santri hadir saat pendaftaran, mengisi formulir, serta membawa fotokopi akta kelahiran, Kartu Keluarga, dua pasfoto 3×4, dan materai Rp10.000.',
      'Kelas dewasa tersedia untuk usia minimal 17 tahun dengan pilihan waktu pagi, siang, atau malam sesuai kesepakatan.',
      'Info lebih lanjut: WhatsApp 0857-8322-7144.',
    ].join('\n\n'),
    cover_image_url: photo('2025-01-foto-bersama-depan-lpq'),
    priority: 'high',
    published_at: '2026-11-25',
  },
  {
    id: 'official-announcement-jadwal',
    slug: 'jadwal-sesi-belajar-tpq',
    title: 'Jadwal sesi belajar TPQ',
    excerpt: 'Sesi Pagi 08.00–09.15, Sesi Siang 14.00–15.15, dan Sesi Sore 16.00–17.15 WIB.',
    content: [
      'Pembelajaran TPQ di LPQ Al-Fath Maulana dibagi menjadi tiga sesi:',
      '• Sesi Pagi: 08.00–09.15 WIB\n• Sesi Siang: 14.00–15.15 WIB\n• Sesi Sore: 16.00–17.15 WIB',
      'Mohon santri hadir tepat waktu supaya bisa mengikuti pembelajaran dari awal.',
    ].join('\n\n'),
    cover_image_url: photo('2026-06-kelas-pagi'),
    priority: 'normal',
    published_at: '2026-11-25',
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

const mediaUrlOf = (item) => item?.image_url || item?.url || item?.cover_image_url || '';

/** Daftar dari Supabase bila ada isinya; kalau kosong pakai konten bawaan LPQ. */
export const withOfficialFallback = (items, officialItems) => (
  Array.isArray(items) && items.length > 0 ? items : [...officialItems]
);

/**
 * Gabungkan item dari Supabase dengan konten bawaan LPQ (dipakai saat impor ke database).
 * Item Supabase tetap di depan; item bawaan yang URL gambarnya sudah ada tidak diulang.
 */
export const withOfficialItems = (items, officialItems) => {
  const list = Array.isArray(items) ? items : [];
  const seen = new Set(list.map(mediaUrlOf).filter(Boolean));
  return [...list, ...officialItems.filter((item) => !seen.has(mediaUrlOf(item)))];
};
