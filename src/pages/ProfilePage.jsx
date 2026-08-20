import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Eye,
  Target,
  BookOpen,
  ShieldCheck,
  HeartHandshake,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Users,
  AlertCircle,
  Star,
  Sparkles,
  Calendar,
  Award,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchWebsiteContentMap } from '@/lib/publicContentAdapters';
import {
  OFFICIAL_CONTACT,
  OFFICIAL_FACILITIES,
  OFFICIAL_GALLERY,
  OFFICIAL_PROFILE,
} from '@/lib/institutionContent';
import '@/styles/public-profile.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const INSTITUTION_DESCRIPTION = OFFICIAL_PROFILE.description;
const INSTITUTION_DESCRIPTION_SECONDARY = OFFICIAL_PROFILE.secondaryDescription;
const VISION = OFFICIAL_PROFILE.vision;
const MISSIONS = OFFICIAL_PROFILE.missions;

const VALUES = [
  {
    icon: BookOpen,
    title: 'Bacaan yang Tartil',
    text: 'Santri dibimbing bertahap agar bacaan benar, jelas, dan konsisten sesuai kaidah tajwid.',
    accentClass: '',
  },
  {
    icon: ShieldCheck,
    title: 'Adab yang Dijaga',
    text: 'Kebiasaan baik dibentuk lewat rutinitas kelas yang hangat dan disiplin.',
    accentClass: 'prof-value-card__icon--gold',
  },
  {
    icon: HeartHandshake,
    title: 'Guru Mendampingi',
    text: 'Proses belajar terasa dekat karena guru mengenal perjalanan setiap santri.',
    accentClass: 'prof-value-card__icon--teal',
  },
  {
    icon: CheckCircle2,
    title: 'Perkembangan Terpantau',
    text: 'Informasi kelas, absensi, dan kegiatan tersusun agar wali lebih tenang.',
    accentClass: 'prof-value-card__icon--rose',
  },
];

const INSTITUTION_ADDRESS = OFFICIAL_CONTACT.address;

/* ---------- Main Component ---------- */
const ProfilePage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guruList, setGuruList] = useState([]);
  const [galleryPhotos, setGalleryPhotos] = useState(OFFICIAL_GALLERY);
  const [facilityImages, setFacilityImages] = useState(OFFICIAL_FACILITIES);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const fetchActiveGuru = async () => {
          const result = await supabase
            .from('guru')
            .select('id, nama, jabatan, foto_url, roles, jenis_kelamin, status')
            .eq('status', 'active')
            .order('nama');

          return result.error ? { data: null, error: result.error } : result;
        };

        const [contentMap, guruResult] = await Promise.all([
          fetchWebsiteContentMap({ publicOnly: true }).catch(() => ({})),
          fetchActiveGuru(),
        ]);

        if (!mounted) return;

        // Parse gallery photos
        const rawGallery = contentMap.galleryPhotos;
        if (Array.isArray(rawGallery) && rawGallery.length > 0) {
          setGalleryPhotos(rawGallery.slice(0, 6));
        }

        // Parse facility images
        const rawFacilities = contentMap.facilities;
        if (Array.isArray(rawFacilities) && rawFacilities.length > 0) {
          setFacilityImages(rawFacilities.slice(0, 3));
        }

        // Set guru list
        if (guruResult?.data) {
          setGuruList(guruResult.data);
        }
      } catch (err) {
        if (mounted) {
          console.error('[ProfilePage] Fetch error:', err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, []);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  /* ---------- Loading State ---------- */
  if (loading) {
    return (
      <>
        <Helmet>
          <title>Profil Lembaga - LPQ Al-Fath Maulana</title>
          <meta name="description" content="Profil LPQ Al-Fath Maulana." />
        </Helmet>
        <div className="prof-page">
          <div className="prof-loading" role="status" aria-label="Memuat profil lembaga">
            <div className="prof-loading__spinner" />
            <p className="prof-loading__text">Memuat profil lembaga...</p>
          </div>
        </div>
      </>
    );
  }

  /* ---------- Error State ---------- */
  if (error) {
    return (
      <>
        <Helmet>
          <title>Profil Lembaga - LPQ Al-Fath Maulana</title>
          <meta name="description" content="Profil LPQ Al-Fath Maulana." />
        </Helmet>
        <div className="prof-page">
          <div className="prof-error" role="alert">
            <AlertCircle className="prof-error__icon" />
            <h3>Gagal Memuat Profil</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="prof-cta__btn prof-cta__btn--primary" style={{ color: 'var(--prof-emerald-deep)' }}>
              Coba Lagi
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Profil Lembaga - LPQ Al-Fath Maulana</title>
        <meta name="description" content="Profil, visi, misi, nilai, dan tim pengajar LPQ Al-Fath Maulana." />
        <link rel="canonical" href={`${OFFICIAL_CONTACT.website}/profil`} />
        <meta property="og:title" content="Profil Lembaga - LPQ Al-Fath Maulana" />
        <meta property="og:description" content="Kenali profil LPQ Al-Fath Maulana." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${OFFICIAL_CONTACT.website}/profil`} />
      </Helmet>

      <div className="prof-page">
        {/* ---- Breadcrumb ---- */}
        <div className="prof-container">
          <motion.nav className="prof-breadcrumb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} aria-label="Breadcrumb">
            <Link to="/">Beranda</Link>
            <ChevronRight className="prof-breadcrumb__sep w-3 h-3" aria-hidden="true" />
            <span className="prof-breadcrumb__current" aria-current="page">Profil Lembaga</span>
          </motion.nav>
        </div>

        {/* ---- Hero Section ---- */}
        <section className="prof-hero" aria-labelledby="prof-hero-title">
          <div className="prof-container">
            <motion.div className="prof-hero__inner" initial="hidden" animate="visible" variants={fadeUp}>
              <span className="prof-hero__eyebrow">
                <Sparkles className="w-3 h-3" />
                Tentang Kami
              </span>
              <h1 id="prof-hero-title" className="prof-hero__title">
                Mengenal lebih dekat <em>LPQ Al-Fath Maulana</em>
              </h1>
              <p className="prof-hero__desc">
                Lembaga pendidikan Al-Qur'an di Baturaja dengan metode Qiroati, pembinaan adab, dan pendampingan belajar yang terstruktur.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ---- Intro Section (Asymmetric Editorial) ---- */}
        <section className="prof-intro" aria-labelledby="prof-intro-title">
          <div className="prof-container">
            <div className="prof-intro__grid">
              <motion.div
                className="prof-intro__text"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
              >
                <span className="prof-section-label">
                  <Users className="w-3.5 h-3.5" />
                  Pengenalan
                </span>
                <h2 id="prof-intro-title" className="prof-section-title" style={{ marginBottom: '1.25rem' }}>
                  Berdiri untuk pendidikan Al-Qur'an yang autentik
                </h2>
                {INSTITUTION_DESCRIPTION.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
                <p style={{ marginTop: '0.5rem' }}>{INSTITUTION_DESCRIPTION_SECONDARY}</p>
              </motion.div>

              <motion.div
                className="prof-intro__image"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              >
                {facilityImages.length > 0 ? (
                  <img src={facilityImages[0]?.url || facilityImages[0]?.image_url} alt="Suasana kegiatan LPQ Al-Fath Maulana" loading="lazy" />
                ) : galleryPhotos.length > 0 ? (
                  <img src={galleryPhotos[0]?.url || galleryPhotos[0]?.image_url} alt="Suasana kegiatan LPQ Al-Fath Maulana" loading="lazy" />
                ) : (
                  <div className="prof-intro__image-placeholder">
                    Foto kegiatan akan tampil saat tersedia
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ---- Vision & Mission (Dark Premium Section) ---- */}
        <section className="prof-vm" aria-labelledby="prof-vm-title">
          <div className="prof-container prof-vm__inner">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <span className="prof-section-label">
                <Eye className="w-3.5 h-3.5" />
                Visi & Misi
              </span>
              <h2 id="prof-vm-title" className="prof-section-title">
                Arah dan tujuan lembaga
              </h2>
              <p className="prof-section-subtitle">
                Setiap langkah kami diarahkan oleh visi yang jelas dan misi yang terukur.
              </p>
            </motion.div>

            <div className="prof-vm__grid">
              <motion.div
                className="prof-vm__card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={staggerItem}
              >
                <div className="prof-vm__card-icon">
                  <Eye className="w-5 h-5" />
                </div>
                <h3>Visi</h3>
                <p>{VISION}</p>
              </motion.div>

              <motion.div
                className="prof-vm__card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={staggerItem}
              >
                <div className="prof-vm__card-icon">
                  <Target className="w-5 h-5" />
                </div>
                <h3>Misi</h3>
                <ul>
                  {MISSIONS.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ---- Values Section ---- */}
        <section className="prof-values" aria-labelledby="prof-values-title">
          <div className="prof-container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <span className="prof-section-label">
                <Award className="w-3.5 h-3.5" />
                Nilai-nilai
              </span>
              <h2 id="prof-values-title" className="prof-section-title">
                Prinsip yang membimbing kami
              </h2>
              <p className="prof-section-subtitle">
                Empat pilar utama yang menjadi fondasi setiap kegiatan di LPQ Al-Fath Maulana.
              </p>
            </motion.div>

            <motion.div
              className="prof-values__grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {VALUES.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div key={item.title} variants={staggerItem}>
                    <div className="prof-value-card" role="article">
                      <div className={`prof-value-card__icon ${item.accentClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ---- Team / Guru Section ---- */}
        <section className="prof-team" aria-labelledby="prof-team-title">
          <div className="prof-container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <span className="prof-section-label">
                <GraduationCap className="w-3.5 h-3.5" />
                Tim Pengajar
              </span>
              <h2 id="prof-team-title" className="prof-section-title">
                Guru yang mendampingi santri
              </h2>
              <p className="prof-section-subtitle">
                Tenaga pengajar bersertifikat dan berpengalaman yang berkomitmen pada kualitas pembelajaran.
              </p>
            </motion.div>

            <motion.div
              className="prof-team__grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {guruList.length > 0 ? (
                guruList.map((guru) => (
                  <motion.div key={guru.id} variants={staggerItem}>
                    <div className="prof-team-card" role="article">
                      <div className="prof-team-card__photo">
                        {guru.foto_url ? (
                          <img src={guru.foto_url} alt={`Foto ${guru.nama}`} loading="lazy" />
                        ) : (
                          <div className="prof-team-card__avatar" aria-hidden="true">
                            {getInitials(guru.nama)}
                          </div>
                        )}
                      </div>
                      <div className="prof-team-card__info">
                        <h3 className="prof-team-card__name">{guru.nama}</h3>
                        <p className="prof-team-card__role">
                          {guru.jabatan || (guru.roles && guru.roles.length > 0 ? guru.roles[0] : 'Pengajar')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="prof-team-empty">
                  <Users className="w-10 h-10" style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                  <p>Informasi tim pengajar akan segera tersedia.</p>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ---- Institution Info ---- */}
        <section className="prof-info" aria-labelledby="prof-info-title">
          <div className="prof-container">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <span className="prof-section-label">
                <MapPin className="w-3.5 h-3.5" />
                Informasi Lembaga
              </span>
              <h2 id="prof-info-title" className="prof-section-title">
                Data dan kontak lembaga
              </h2>
              <p className="prof-section-subtitle">
                Informasi resmi LPQ Al-Fath Maulana untuk keperluan komunikasi dan koordinasi.
              </p>
            </motion.div>

            <motion.div
              className="prof-info__grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              <motion.div variants={staggerItem}>
                <div className="prof-info-card">
                  <div className="prof-info-card__icon">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="prof-info-card__text">
                    <h3>Alamat</h3>
                    <p>{INSTITUTION_ADDRESS}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={staggerItem}>
                <div className="prof-info-card">
                  <div className="prof-info-card__icon prof-info-card__icon--gold">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="prof-info-card__text">
                    <h3>Jadwal Belajar</h3>
                    <p>Senin–Jumat · 08.00–09.15, 14.00–15.15, dan 16.00–17.15 WIB</p>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={staggerItem}>
                <div className="prof-info-card">
                  <div className="prof-info-card__icon">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="prof-info-card__text">
                    <h3>Metode Pembelajaran</h3>
                    <p>Qiroati — metode terstruktur untuk bacaan Al-Qur'an yang tartil</p>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={staggerItem}>
                <div className="prof-info-card">
                  <div className="prof-info-card__icon prof-info-card__icon--gold">
                    <Star className="w-5 h-5" />
                  </div>
                  <div className="prof-info-card__text">
                    <h3>Fasilitas</h3>
                    <p>Ruang kelas nyaman, peraga belajar, dan lingkungan kondusif</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ---- CTA Section ---- */}
        <section className="prof-cta" aria-labelledby="prof-cta-title">
          <div className="prof-container">
            <motion.div
              className="prof-cta__inner"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <h2 id="prof-cta-title" className="prof-cta__title">
                Siap memberikan pendidikan Al-Qur'an terbaik untuk buah hati?
              </h2>
              <p className="prof-cta__desc">
                Bergabunglah dengan LPQ Al-Fath Maulana dan mulai perjalanan belajar Al-Qur'an yang bermakna.
              </p>
              <div className="prof-cta__actions">
                <Link to="/pendaftaran/informasi" className="prof-cta__btn prof-cta__btn--primary">
                  Daftar Sekarang
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/kontak" className="prof-cta__btn prof-cta__btn--outline">
                  Hubungi Kami
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default ProfilePage;
