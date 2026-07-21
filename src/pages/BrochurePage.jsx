import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Download, Eye, FileText, Image as ImageIcon, X, Loader2, RefreshCw, BookOpen } from 'lucide-react';
import '@/styles/public-brochure.css';

/* ---------- Helpers ---------- */
const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif|svg|bmp|avif)(\?.*)?$/i;

const isImageUrl = (url) => {
  if (!url) return false;
  return IMAGE_EXTS.test(url.trim());
};

const getFileType = (url) => (isImageUrl(url) ? 'image' : 'pdf');

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

/* ---------- Animation Variants ---------- */
const heroVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ---------- Sub-components ---------- */

const HeroSkeleton = () => (
  <div className="bros-featured-skeleton" aria-hidden="true">
    <div className="bros-featured-skeleton__image" />
    <div className="bros-featured-skeleton__body">
      <div className="bros-skeleton-line bros-skeleton-line--short" />
      <div className="bros-skeleton-line bros-skeleton-line--long" />
      <div className="bros-skeleton-line bros-skeleton-line--medium" />
      <div className="bros-skeleton-line bros-skeleton-line--short" />
    </div>
  </div>
);

const GridSkeleton = () => (
  <div className="bros-skeleton-grid" aria-hidden="true">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="bros-skeleton-card">
        <div className="bros-skeleton-card__image" />
        <div className="bros-skeleton-card__body">
          <div className="bros-skeleton-line bros-skeleton-line--short" />
          <div className="bros-skeleton-line bros-skeleton-line--long" />
          <div className="bros-skeleton-line bros-skeleton-line--medium" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ icon: Icon = BookOpen, title = 'Belum ada publikasi', desc = 'Materi brosur dan pustaka digital akan tampil di sini setelah tersedia.' }) => (
  <div className="bros-empty">
    <Icon className="h-12 w-12" />
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="bros-error">
    <FileText className="h-12 w-12" />
    <h3>Gagal memuat publikasi</h3>
    <p>{message}</p>
    {onRetry && (
      <button className="bros-retry-btn" onClick={onRetry} type="button">
        <RefreshCw className="inline h-4 w-4 mr-1" />
        Coba lagi
      </button>
    )}
  </div>
);

/* ---------- Preview Modal ---------- */
const PreviewModal = ({ file, onClose }) => {
  const closeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const fileType = file ? getFileType(file.url) : null;

  useEffect(() => {
    if (file) {
      previousFocusRef.current = document.activeElement;
      // Focus the close button after mount
      requestAnimationFrame(() => closeRef.current?.focus());
    }
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [file]);

  // Escape key handler
  useEffect(() => {
    if (!file) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [file, onClose]);

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          className="bros-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau: ${file.name}`}
        >
          <motion.div
            className="bros-modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bros-modal__header">
              <h3 className="bros-modal__title">{file.name}</h3>
              <button
                ref={closeRef}
                className="bros-modal__close"
                onClick={onClose}
                type="button"
                aria-label="Tutup pratinjau"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bros-modal__body">
              {fileType === 'image' ? (
                <img src={file.url} alt={file.name} loading="lazy" />
              ) : (
                <iframe src={file.url} title={file.name} />
              )}
            </div>
            <div className="bros-modal__footer">
              <a
                href={file.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="bros-modal__download-btn"
              >
                <Download className="h-4 w-4" />
                Unduh
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ---------- Featured Publication ---------- */
const FeaturedPublication = ({ file, onPreview }) => {
  const fileType = getFileType(file.url);

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0} className="bros-featured">
      <div className="bros-featured__grid">
        <button
          type="button"
          className="bros-featured__image-wrap"
          onClick={() => onPreview(file)}
          aria-label={`Pratinjau: ${file.name}`}
        >
          {fileType === 'image' ? (
            <img src={file.url} alt={file.name} loading="eager" width="800" height="600" />
          ) : (
            <div className="bros-featured__image-fallback">
              <FileText className="h-14 w-14" />
            </div>
          )}
          <span className="bros-featured__image-badge">
            <Eye className="h-3 w-3" />
            Pratinjau
          </span>
        </button>

        <div className="bros-featured__content">
          <span className="bros-featured__kicker">
            <FileText className="h-3 w-3" />
            Publikasi Unggulan
          </span>
          <h2 className="bros-featured__title">{file.name}</h2>
          <p className="bros-featured__desc">
            Klik gambar untuk pratinjau langsung atau unduh file untuk disimpan.
          </p>
          <div className="bros-featured__actions">
            <button
              type="button"
              className="bros-featured__btn bros-featured__btn--primary"
              onClick={() => onPreview(file)}
            >
              <Eye className="h-4 w-4" />
              Pratinjau
            </button>
            <a
              href={file.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="bros-featured__btn bros-featured__btn--secondary"
            >
              <Download className="h-4 w-4" />
              Unduh File
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ---------- Publication Card ---------- */
const BrochureCard = ({ file, index, onPreview }) => {
  const fileType = getFileType(file.url);

  return (
    <motion.div
      custom={index + 1}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      <div className="bros-card">
        <button
          type="button"
          className="bros-card__image"
          onClick={() => onPreview(file)}
          aria-label={`Pratinjau: ${file.name}`}
        >
          {fileType === 'image' ? (
            <img src={file.url} alt={file.name} loading="lazy" width="480" height="360" />
          ) : (
            <div className="bros-card__image-fallback">
              <FileText className="h-8 w-8" />
            </div>
          )}
          <span className="bros-card__image-type">
            {fileType === 'image' ? (
              <><ImageIcon className="h-3 w-3" /> Gambar</>
            ) : (
              <><FileText className="h-3 w-3" /> PDF</>
            )}
          </span>
          <div className="bros-card__image-preview-overlay">
            <Eye className="h-8 w-8" style={{ color: 'white' }} />
          </div>
        </button>

        <div className="bros-card__body">
          <h3 className="bros-card__name">{file.name}</h3>
          <span className="bros-card__meta">
            {fileType === 'image' ? 'Gambar' : 'Dokumen PDF'}
          </span>
          <div className="bros-card__actions">
            <button
              type="button"
              className="bros-card__action-btn bros-card__action-btn--preview"
              onClick={() => onPreview(file)}
            >
              <Eye className="h-3.5 w-3.5" />
              Pratinjau
            </button>
            <a
              href={file.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="bros-card__action-btn"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ---------- Main Page ---------- */
const BrochurePage = () => {
  const [brochures, setBrochures] = useState([]);
  const [pustaka, setPustaka] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('website_content')
        .select('key, content')
        .in('key', ['brochures', 'pustaka']);

      if (fetchError) {
        throw new Error(fetchError.message || 'Gagal memuat data brosur');
      }

      const brochureData = data?.find((d) => d.key === 'brochures')?.content || [];
      const pustakaData = data?.find((d) => d.key === 'pustaka')?.content || [];

      setBrochures(Array.isArray(brochureData) ? brochureData : []);
      setPustaka(Array.isArray(pustakaData) ? pustakaData : []);
    } catch (err) {
      console.error('Error fetching brochure files:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Featured: first brochure that has an image URL
  const featured = brochures.find((f) => isImageUrl(f.url));
  const remainingBrochures = featured ? brochures.filter((f) => f.id !== featured.id) : brochures;
  const totalFiles = brochures.length + pustaka.length;

  const handlePreview = useCallback((file) => {
    setPreviewFile(file);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
  }, []);

  return (
    <div className="public-brochure-page">
      <Helmet>
        <title>Brosur & Pustaka — LPQ Al-Fath Maulana</title>
        <meta name="description" content="Unduh brosur pendaftaran resmi dan materi pustaka dari LPQ Al-Fath Maulana. Galeri publikasi dan informasi lembaga." />
      </Helmet>

      {/* ---- Hero ---- */}
      <section className="bros-hero" aria-labelledby="bros-hero-title">
        <div className="bros-container bros-hero__inner">
          <motion.div variants={heroVariants} initial="hidden" animate="visible">
            <span className="bros-hero__eyebrow">
              <FileText className="h-3.5 w-3.5" />
              Galeri Publikasi
            </span>
            <h1 id="bros-hero-title" className="bros-hero__title">
              Brosur & <em>Pustaka</em>
            </h1>
            <p className="bros-hero__lead">
              Jelajahi materi pendaftaran, panduan program, dan pustaka digital dari LPQ Al-Fath Maulana. Unduh dan bagikan kepada wali santri.
            </p>
          </motion.div>

          {!loading && totalFiles > 0 && (
            <motion.div
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.15 }}
            >
              <div className="bros-hero__stats">
                <div className="bros-hero__stat">
                  <span className="bros-hero__stat-value">{brochures.length}</span>
                  <span className="bros-hero__stat-label">Brosur</span>
                </div>
                <div className="bros-hero__stat">
                  <span className="bros-hero__stat-value">{pustaka.length}</span>
                  <span className="bros-hero__stat-label">Pustaka</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Decorative publication shapes */}
        <div className="bros-hero__shapes" aria-hidden="true">
          <div className="bros-hero__shape" />
          <div className="bros-hero__shape" />
          <div className="bros-hero__shape" />
        </div>
      </section>

      {/* ---- Content ---- */}
      <section
        className="bros-container"
        style={{ paddingTop: 'clamp(2rem, 4vw, 3.5rem)', paddingBottom: 'clamp(3rem, 6vw, 5rem)' }}
        aria-label="Daftar publikasi"
      >
        {loading ? (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <HeroSkeleton />
            </div>
            <GridSkeleton />
            <div className="bros-loading" aria-live="polite">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Memuat publikasi terbaru…</p>
            </div>
          </>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchFiles} />
        ) : totalFiles === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Featured Publication */}
            {featured && <FeaturedPublication file={featured} onPreview={handlePreview} />}

            {/* Brosur Pendaftaran Grid */}
            {remainingBrochures.length > 0 && (
              <>
                <div className="bros-section-header" style={{ marginTop: featured ? 'clamp(2.5rem, 4vw, 3.5rem)' : 0 }}>
                  <h2>Brosur Pendaftaran</h2>
                  <span>{remainingBrochures.length} dokumen</span>
                </div>
                <div className="bros-grid">
                  {remainingBrochures.map((file, i) => (
                    <BrochureCard key={file.id} file={file} index={i} onPreview={handlePreview} />
                  ))}
                </div>
              </>
            )}

            {/* Pustaka Digital Grid */}
            {pustaka.length > 0 && (
              <>
                <div className="bros-section-header" style={{ marginTop: 'clamp(2.5rem, 4vw, 3.5rem)' }}>
                  <h2>Pustaka Digital</h2>
                  <span>{pustaka.length} materi</span>
                </div>
                <div className="bros-grid">
                  {pustaka.map((file, i) => (
                    <BrochureCard key={file.id} file={file} index={i} onPreview={handlePreview} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ---- Preview Modal ---- */}
      <PreviewModal file={previewFile} onClose={handleClosePreview} />
    </div>
  );
};

export default BrochurePage;