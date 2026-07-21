import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Building,
  ArrowRight,
  Maximize2,
  AlertTriangle,
  RefreshCw,
  Leaf,
  Sun,
  ShieldCheck,
  Heart,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import '@/styles/public-facilities.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ---------- Ambient Highlights (static copy, not fake data) ---------- */
const ambientHighlights = [
  {
    icon: <Leaf className="w-5 h-5" />,
    accent: 'emerald',
    title: 'Lingkungan Asri',
    text: 'Area belajar yang bersih, rindang, dan nyaman untuk mendukung konsentrasi santri.',
  },
  {
    icon: <Sun className="w-5 h-5" />,
    accent: 'amber',
    title: 'Pencahayaan Optimal',
    text: 'Ruang kelas dirancang dengan pencahayaan yang baik demi kenyamanan membaca.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    accent: 'cyan',
    title: 'Keamanan Terjaga',
    text: 'Area belajar yang aman dan terawat, memberikan ketenangan bagi wali santri.',
  },
  {
    icon: <Heart className="w-5 h-5" />,
    accent: 'violet',
    title: 'Suasana Kekeluargaan',
    text: 'Lingkungan yang hangat dan penuh kebersamaan antara guru, santri, dan wali.',
  },
];

/* ---------- Image with Error Fallback ---------- */
const FacilityImage = ({ src, alt, className, style }) => {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="fp-image-broken" role="img" aria-label={alt || 'Gambar tidak tersedia'}>
        <Building className="w-8 h-8" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || 'Fasilitas LPQ Al-Fath Maulana'}
      className={className}
      style={style}
      loading="lazy"
      onError={() => setErrored(true)}
      draggable={false}
    />
  );
};

/* ---------- Loading Skeleton ---------- */
const LoadingSkeleton = () => (
  <div className="fp-page" role="status" aria-label="Memuat fasilitas...">
    <Helmet>
      <title>Fasilitas - LPQ Al-Fath Maulana</title>
    </Helmet>
    <div className="fp-skeleton-hero" aria-hidden="true">
      <div className="fp-skeleton-hero__inner">
        <div className="fp-skeleton-line fp-skeleton-line--badge" />
        <div className="fp-skeleton-line fp-skeleton-line--title" />
        <div className="fp-skeleton-line fp-skeleton-line--desc" />
        <div className="fp-skeleton-line fp-skeleton-line--desc2" />
      </div>
    </div>
    <div className="fp-skeleton-grid" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="fp-skeleton-card" />
      ))}
    </div>
  </div>
);

/* ---------- Empty State ---------- */
const EmptyState = () => (
  <div className="fp-page">
    <Helmet>
      <title>Fasilitas - LPQ Al-Fath Maulana</title>
    </Helmet>
    <div className="fp-empty">
      <Building className="fp-empty__icon" />
      <p className="fp-empty__title">Fasilitas belum tersedia</p>
      <p className="fp-empty__desc">
        Informasi fasilitas LPQ Al-Fath Maulana akan muncul di sini setelah ditambahkan oleh admin.
      </p>
    </div>
  </div>
);

/* ---------- Error State ---------- */
const ErrorState = ({ onRetry }) => (
  <div className="fp-page">
    <Helmet>
      <title>Fasilitas - LPQ Al-Fath Maulana</title>
    </Helmet>
    <div className="fp-error">
      <AlertTriangle className="fp-error__icon" />
      <p className="fp-error__title">Gagal memuat fasilitas</p>
      <p className="fp-error__desc">
        Terjadi kesalahan saat mengambil data. Silakan coba lagi.
      </p>
      <button className="fp-error__retry" onClick={onRetry} type="button">
        <RefreshCw className="w-4 h-4" />
        Muat ulang
      </button>
    </div>
  </div>
);

/* ======================================== */
/*            MAIN COMPONENT                */
/* ======================================== */

/* ---------- Default Facilities (fallback when Supabase has no data) ---------- */
const defaultFacilities = [
  {
    name: 'Data fasilitas belum diisi',
    description: 'Admin dapat menambahkan fasilitas resmi beserta foto melalui Content Management.',
    image_url: '',
  },
];

const FacilitiesPage = () => {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxFacility, setLightboxFacility] = useState(null);

  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: fetchErr } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'facilities')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (data?.content && Array.isArray(data.content) && data.content.length > 0) {
        setFacilities(data.content);
      } else {
        setFacilities(defaultFacilities);
      }
    } catch {
      setFacilities(defaultFacilities);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  /* Lightbox handlers */
  const closeLightbox = useCallback(() => setLightboxFacility(null), []);

  /* Keyboard handling for lightbox */
  useEffect(() => {
    if (!lightboxFacility) return;
    const handler = (e) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxFacility, closeLightbox]);

  /* States */
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState onRetry={fetchFacilities} />;
  if (facilities.length === 0) return <EmptyState />;

  /* Split: first facility is featured, rest go to showcase */
  const featured = facilities[0];
  const showcase = facilities.slice(1);

  const getImageSrc = (f) =>
    f?.image_url || f?.url || 'https://images.unsplash.com/photo-1672432508137-49e907939dee?w=800';

  return (
    <>
      <Helmet>
        <title>Fasilitas - LPQ Al-Fath Maulana</title>
        <meta
          name="description"
          content="Lingkungan belajar yang nyaman, aman, dan mendukung — lihat fasilitas lengkap LPQ Al-Fath Maulana."
        />
        <link rel="canonical" href="https://domain-belum-diisi.invalid/fasilitas" />
      </Helmet>

      <div className="fp-page">
        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="fp-hero" aria-labelledby="fp-hero-title">
          <motion.div
            className="fp-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="fp-hero__badge">
              <Building className="w-3.5 h-3.5" />
              Fasilitas Kami
            </span>
            <h1 id="fp-hero-title" className="fp-hero__title">
              Lingkungan Belajar yang{' '}
              <span className="fp-hero__title-accent">Nyaman & Mendukung</span>
            </h1>
            <p className="fp-hero__desc">
              Setiap ruang dan fasilitas di LPQ Al-Fath Maulana dirancang untuk menciptakan suasana
              belajar yang kondusif — agar santri dapat fokus menuntut ilmu Al-Qur'an dengan tenang.
            </p>
          </motion.div>
        </section>

        <div className="fp-container">
          {/* ── FEATURED FACILITY ──────────────────────────── */}
          {featured && (
            <section className="fp-featured" aria-label={`Fasilitas utama: ${featured.name}`}>
              <motion.div
                className="fp-featured__card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
              >
                <div className="fp-featured__image-wrap">
                  <FacilityImage
                    src={getImageSrc(featured)}
                    alt={featured.name}
                  />
                  <span className="fp-featured__image-badge" aria-hidden="true">
                    Utama
                  </span>
                </div>
                <div className="fp-featured__content">
                  <h2 className="fp-featured__name">{featured.name}</h2>
                  <p className="fp-featured__desc">{featured.description}</p>
                  {featured.image_url && (
                    <button
                      className="fp-featured__expand-btn"
                      type="button"
                      onClick={() => setLightboxFacility(featured)}
                      aria-label={`Lihat foto ${featured.name}`}
                    >
                      <Maximize2 className="w-4 h-4" />
                      Lihat Foto
                    </button>
                  )}
                </div>
              </motion.div>
            </section>
          )}

          {/* ── SHOWCASE (Alternating) ─────────────────────── */}
          {showcase.length > 0 && (
            <section className="fp-showcase" aria-labelledby="fp-showcase-title">
              <motion.div
                className="fp-section-header"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
              >
                <p className="fp-section-header__kicker">
                  Fasilitas Lainnya
                </p>
                <h2 id="fp-showcase-title" className="fp-section-header__title">
                  Setiap Ruang Punya Cerita
                </h2>
                <p className="fp-section-header__desc">
                  Fasilitas pendukung yang melengkapi pengalaman belajar santri sehari-hari.
                </p>
              </motion.div>

              <div className="fp-showcase__list">
                {showcase.map((facility, index) => {
                  const isReverse = index % 2 === 1;
                  const displayIndex = index + 2; // +2 because featured is #1
                  return (
                    <motion.div
                      key={facility.name || index}
                      className={`fp-showcase__item ${isReverse ? 'fp-showcase__item--reverse' : ''}`}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: '-40px' }}
                      variants={staggerItem}
                    >
                      <div className="fp-showcase__image-col">
                        <div
                          className="fp-showcase__number"
                          aria-hidden="true"
                        >
                          {String(displayIndex).padStart(2, '0')}
                        </div>
                        <button
                          className="fp-showcase__image-wrap"
                          type="button"
                          onClick={() => setLightboxFacility(facility)}
                          aria-label={`Lihat foto ${facility.name}`}
                        >
                          <FacilityImage
                            src={getImageSrc(facility)}
                            alt={facility.name}
                          />
                        </button>
                      </div>
                      <div className="fp-showcase__content-col">
                        <p className="fp-showcase__index">
                          Fasilitas {String(displayIndex).padStart(2, '0')}
                        </p>
                        <h3 className="fp-showcase__name">{facility.name}</h3>
                        <p className="fp-showcase__desc">{facility.description}</p>
                        {facility.image_url && (
                          <button
                            className="fp-showcase__view-btn"
                            type="button"
                            onClick={() => setLightboxFacility(facility)}
                            aria-label={`Lihat foto ${facility.name}`}
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Lihat Foto
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          <hr className="fp-divider" />

          {/* ── AMBIENT STRIP ──────────────────────────────── */}
          <section className="fp-ambient" aria-labelledby="fp-ambient-title">
            <motion.div
              className="fp-section-header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="fp-section-header__kicker">
                Lingkungan Belajar
              </p>
              <h2 id="fp-ambient-title" className="fp-section-header__title">
                Suasana yang Mendukung
              </h2>
              <p className="fp-section-header__desc">
                Lebih dari sekadar bangunan — LPQ Al-Fath Maulana menghadirkan lingkungan yang
                membuat santri nyaman dan wali santri tenang.
              </p>
            </motion.div>

            <motion.div
              className="fp-ambient__grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {ambientHighlights.map((item) => (
                <motion.div
                  key={item.title}
                  className="fp-ambient__card"
                  variants={staggerItem}
                >
                  <div
                    className={`fp-ambient__card-icon fp-ambient__card-icon--${item.accent}`}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </div>
                  <h3 className="fp-ambient__card-title">{item.title}</h3>
                  <p className="fp-ambient__card-text">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ── CTA ─────────────────────────────────────────── */}
          <section className="fp-cta" aria-labelledby="fp-cta-title">
            <motion.div
              className="fp-cta__card"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <h2 id="fp-cta-title" className="fp-cta__title">
                Ingin Melihat Fasilitas Kami Secara Langsung?
              </h2>
              <p className="fp-cta__desc">
                Kunjungi LPQ Al-Fath Maulana dan rasakan langsung lingkungan belajar yang nyaman
                untuk putra-putri Anda.
              </p>
              <div className="fp-cta__actions">
                <Link to="/pendaftaran/informasi" className="fp-cta__btn fp-cta__btn--primary">
                  Informasi Pendaftaran
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/kontak" className="fp-cta__btn fp-cta__btn--secondary">
                  Hubungi Kami
                </Link>
              </div>
            </motion.div>
          </section>
        </div>
      </div>

      {/* ── Lightbox ────────────────────────────────────────── */}
      {lightboxFacility && (
        <Dialog open onOpenChange={closeLightbox}>
          <DialogContent className="fp-lightbox-content">
            <div className="fp-lightbox__image-wrap">
              <img
                src={getImageSrc(lightboxFacility)}
                alt={lightboxFacility.name}
                draggable={false}
              />
            </div>
            <div className="fp-lightbox__info">
              <h3 className="fp-lightbox__name">{lightboxFacility.name}</h3>
              {lightboxFacility.description && (
                <p className="fp-lightbox__desc">{lightboxFacility.description}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default FacilitiesPage;
