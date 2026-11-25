import {
  INSTITUTION_PROOF_POINTS,
  OFFICIAL_CTA_BACKGROUND,
  OFFICIAL_FACILITIES,
  OFFICIAL_FAQS,
  OFFICIAL_GALLERY,
  OFFICIAL_HERO_SLIDES,
  OFFICIAL_QUOTAS,
  OFFICIAL_SCHEDULES,
} from '@/lib/institutionContent';

export const BRAND_NAME = 'LPQ Al-Fath Maulana';
export const LOCAL_LOGO = '/logo-lpq-al-fath-maulana.webp';

export const defaultContent = {
  logoUrl: LOCAL_LOGO,
  heroSlides: OFFICIAL_HERO_SLIDES,
  slideshowTimer: 7000,
  heroOverlayOpacity: 0.55,
  quotas: OFFICIAL_QUOTAS,
  facilities: OFFICIAL_FACILITIES,
  galleryPhotos: OFFICIAL_GALLERY,
  proofPoints: INSTITUTION_PROOF_POINTS,
  schedules: OFFICIAL_SCHEDULES,
  faqs: OFFICIAL_FAQS,
  ctaBackgroundUrl: OFFICIAL_CTA_BACKGROUND,
  ctaBackgroundOverlayOpacity: 0.62,
};

export const safeArray = (value) => (Array.isArray(value) ? value : []);
export const imageOf = (item) => item?.image_url || item?.cover_image_url || item?.url || item?.photo_url || '';
export const compactNumber = (value) => new Intl.NumberFormat('id-ID').format(Number(value || 0));

export const mergeHomepageContent = (contentMap = {}) => {
  const merged = { ...defaultContent, ...contentMap };
  ['heroSlides', 'facilities', 'galleryPhotos', 'schedules', 'faqs', 'proofPoints'].forEach((key) => {
    if (!Array.isArray(merged[key]) || merged[key].length === 0) merged[key] = defaultContent[key];
  });

  const quotaTotal = Object.values(merged.quotas || {}).reduce((total, value) => total + Number(value || 0), 0);
  if (quotaTotal <= 0) merged.quotas = defaultContent.quotas;
  if (!String(merged.ctaBackgroundUrl || '').trim()) merged.ctaBackgroundUrl = defaultContent.ctaBackgroundUrl;

  return merged;
};

export const sectionReveal = (index = 0, axis = 'y') => ({
  initial: {
    opacity: 0,
    y: axis === 'y' ? 30 : 0,
    x: axis === 'x' ? -24 : 0,
    filter: 'blur(10px)',
  },
  whileInView: {
    opacity: 1,
    y: 0,
    x: 0,
    filter: 'blur(0px)',
  },
  viewport: { once: true, amount: 0.22, margin: '-80px' },
  transition: {
    duration: 0.72,
    delay: Math.min(index * 0.07, 0.22),
    ease: [0.22, 1, 0.36, 1],
  },
});

export const getHomepagePrograms = ({ schedules = [], quotas = {} }) => {
  const scheduleItems = safeArray(schedules).slice(0, 3);
  const quotaTotal = Object.values(quotas || {}).reduce((sum, value) => sum + Number(value || 0), 0);

  return [
    {
      id: 'qiroati',
      eyebrow: 'Metode inti',
      title: 'Metode Qiroati',
      description: 'Pembinaan bacaan dilakukan bertahap agar santri terbiasa membaca dengan benar, tartil, dan terpantau.',
      route: '/metode-qiroati',
      featured: true,
    },
    {
      id: 'jadwal',
      eyebrow: 'Jadwal belajar',
      title: scheduleItems[0]?.title || 'Jadwal kelas',
      description: scheduleItems.length
        ? scheduleItems.map((item) => `${item.title || 'Sesi'} ${item.time || ''}`.trim()).join(' · ')
        : 'Jadwal akan tampil setelah admin mengisi konten website.',
      route: '/pendaftaran/informasi',
    },
    {
      id: 'kuota',
      eyebrow: 'Ketersediaan',
      title: quotaTotal > 0 ? `${compactNumber(quotaTotal)} kuota tercatat` : 'Kuota sesi',
      description: quotaTotal > 0 ? 'Kuota dibaca dari konfigurasi admin untuk membantu wali memilih sesi yang tepat.' : 'Kuota akan tampil dari Content Management.',
      route: '/pendaftaran/informasi',
    },
    {
      id: 'adab',
      eyebrow: 'Pembinaan',
      title: 'Adab sebelum capaian',
      description: 'Rutinitas kelas disusun agar santri tumbuh dalam disiplin, sopan santun, dan kecintaan pada Al-Qur’an.',
      route: '/profil',
    },
    {
      id: 'wali',
      eyebrow: 'Keluarga',
      title: 'Pendampingan wali',
      description: 'Informasi lembaga, pengumuman, dan perkembangan belajar mudah diikuti oleh keluarga.',
      route: '/parenting',
    },
    {
      id: 'digital',
      eyebrow: 'Operasional',
      title: 'Absensi digital',
      description: 'RFID membantu pencatatan kehadiran lebih rapi tanpa mengganggu suasana belajar.',
      route: '/login',
    },
  ];
};
