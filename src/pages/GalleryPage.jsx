import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Image as ImageIcon, AlertTriangle, RefreshCw, X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import '@/styles/public-gallery.css';

/* ── Size assignment (deterministic mosaic rhythm) ──────────────────── */
const SIZES = ['normal', 'normal', 'wide', 'tall', 'normal', 'large', 'normal', 'normal', 'wide', 'normal'];
const getSize = (index) => SIZES[index % SIZES.length];

/* ── Helpers ────────────────────────────────────────────────────────── */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
};

const fallbackCaption = (index) => `Kegiatan ${index + 1}`;

/* ── Image with error fallback ──────────────────────────────────────── */
const GalleryImage = ({ src, alt, className, style, onLoad, onError }) => {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="gallery-item__broken" role="img" aria-label={alt || 'Gambar tidak tersedia'}>
        <ImageIcon />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || 'Gambar galeri'}
      className={className}
      style={style}
      loading="lazy"
      onLoad={onLoad}
      onError={() => setErrored(true)}
      draggable={false}
    />
  );
};

/* ── Loading skeleton ───────────────────────────────────────────────── */
const LoadingSkeleton = () => (
  <div aria-label="Memuat galeri..." role="status">
    <Helmet>
      <title>Galeri Kegiatan - LPQ Al-Fath Maulana</title>
    </Helmet>

    {/* Hero skeleton — text lines */}
    <div className="gallery-skeleton-hero" aria-hidden="true">
      <div className="gallery-skeleton-hero__lines">
        <div className="gallery-skeleton-hero__line gallery-skeleton-hero__line--eyebrow" />
        <div className="gallery-skeleton-hero__line gallery-skeleton-hero__line--title" />
        <div className="gallery-skeleton-hero__line gallery-skeleton-hero__line--subtitle" />
        <div className="gallery-skeleton-hero__line gallery-skeleton-hero__line--subtitle" style={{ width: '70%' }} />
        <div className="gallery-skeleton-hero__line gallery-skeleton-hero__line--meta" />
      </div>
    </div>

    {/* Grid skeleton */}
    <div className="gallery-skeleton-grid" aria-hidden="true">
      {['normal', 'wide', 'tall', 'normal', 'large', 'normal', 'normal', 'wide'].map((size, i) => (
        <div key={i} className="gallery-skeleton-item" data-size={size} />
      ))}
    </div>
  </div>
);

/* ── Empty state ────────────────────────────────────────────────────── */
const EmptyState = () => (
  <>
    <Helmet>
      <title>Galeri Kegiatan - LPQ Al-Fath Maulana</title>
    </Helmet>
    <div className="gallery-page">
      <div className="gallery-empty">
        <ImageIcon className="gallery-empty__icon" />
        <p className="gallery-empty__title">Belum ada foto di galeri</p>
        <p className="gallery-empty__desc">
          Dokumentasi kegiatan santri akan muncul di sini setelah ditambahkan oleh admin.
        </p>
      </div>
    </div>
  </>
);

/* ── Error state ────────────────────────────────────────────────────── */
const ErrorState = ({ onRetry }) => (
  <>
    <Helmet>
      <title>Galeri Kegiatan - LPQ Al-Fath Maulana</title>
    </Helmet>
    <div className="gallery-page">
      <div className="gallery-error">
        <AlertTriangle className="gallery-error__icon" />
        <p className="gallery-error__title">Gagal memuat galeri</p>
        <p className="gallery-error__desc">
          Terjadi kesalahan saat mengambil data. Silakan coba lagi.
        </p>
        <button className="gallery-error__retry" onClick={onRetry} type="button">
          <RefreshCw className="w-4 h-4" />
          Muat ulang
        </button>
      </div>
    </div>
  </>
);

/* ── Lightbox ───────────────────────────────────────────────────────── */
const Lightbox = ({ photos, index, onClose, onPrev, onNext, originRef }) => {
  const closeRef = useRef(null);
  const prevFocusRef = useRef(null);
  const photo = photos[index];

  // Store original focus element on mount
  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    // Focus the close button after a tick
    requestAnimationFrame(() => closeRef.current?.focus());
  }, []);

  // Restore focus on unmount
  useEffect(() => {
    return () => {
      prevFocusRef.current?.focus();
    };
  }, []);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard handling
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  // Touch swipe
  const touchRef = useRef({ startX: 0, startY: 0, active: false });

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, active: true };
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!touchRef.current.active) return;
    touchRef.current.active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = t.clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0) onPrev();
      else onNext();
    } else if (dy > 80) {
      onClose();
    }
  }, [onClose, onPrev, onNext]);

  if (!photo) return null;

  const caption = photo.caption || null;

  return (
    <div
      className="gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Preview gambar galeri"
      data-animate="enter"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="gallery-lightbox__backdrop" onClick={onClose} />

      <button
        ref={closeRef}
        className="gallery-lightbox__close"
        onClick={onClose}
        aria-label="Tutup preview"
        type="button"
      >
        <X className="w-5 h-5" />
      </button>

      {index > 0 && (
        <button
          className="gallery-lightbox__nav gallery-lightbox__nav--prev"
          onClick={onPrev}
          aria-label="Gambar sebelumnya"
          type="button"
        >
          <ChevronLeft />
        </button>
      )}

      {index < photos.length - 1 && (
        <button
          className="gallery-lightbox__nav gallery-lightbox__nav--next"
          onClick={onNext}
          aria-label="Gambar berikutnya"
          type="button"
        >
          <ChevronRight />
        </button>
      )}

      <div className="gallery-lightbox__content">
        <div className="gallery-lightbox__image-wrap">
          <img
            className="gallery-lightbox__img"
            src={photo.url}
            alt={caption || 'Gambar galeri'}
            draggable={false}
          />
        </div>
        <div className="gallery-lightbox__panel">
          {caption && <p className="gallery-lightbox__caption">{caption}</p>}
          <p className="gallery-lightbox__counter">
            {index + 1} dari {photos.length}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ── Main Gallery Page ──────────────────────────────────────────────── */
const GalleryPage = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const itemRefs = useRef([]);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: fetchErr } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'galleryPhotos')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (data?.content && Array.isArray(data.content)) {
        setPhotos(data.content);
      } else {
        setPhotos([]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  /* Lightbox navigation */
  const closeLightbox = useCallback(() => setSelectedIndex(null), []);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : prev));
  }, [photos.length]);

  /* States */
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState onRetry={fetchGallery} />;
  if (photos.length === 0) return <EmptyState />;

  return (
    <>
      <Helmet>
        <title>Galeri Kegiatan - LPQ Al-Fath Maulana</title>
        <meta
          name="description"
          content="Dokumentasi visual kegiatan dan momen berharga santri LPQ Al-Fath Maulana."
        />
      </Helmet>

      <div className="gallery-page">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="gallery-hero">
          <div className="gallery-hero__inner">
            <div className="gallery-hero__text">
              <p className="gallery-hero__eyebrow">A Living Archive</p>
              <h1 className="gallery-hero__label">
                Galeri Kegiatan
              </h1>
              <p className="gallery-hero__subtitle">
                Momen-momen berharga yang terekam dari kegiatan sehari-hari santri dalam menuntut ilmu —
                mulai dari pembelajaran di kelas, latihan tahfidz, hingga perayaan bersama.
                Setiap foto adalah satu cerita dari perjalanan spiritual dan intelektual mereka.
              </p>
              <div className="gallery-hero__meta">
                <span className="gallery-hero__count" aria-label={`${photos.length} foto`}>
                  {photos.length} Foto
                </span>
                <span className="gallery-hero__divider" aria-hidden="true" />
                <span className="gallery-hero__tagline">LPQ Al-Fath Maulana · Metode Qiroati</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Mosaic grid ────────────────────────────────────────── */}
        <section className="gallery-grid-wrap">
          <h2 className="sr-only">Galeri Kegiatan</h2>
          <div className="gallery-mosaic" role="list">
            {photos.map((photo, index) => {
              const size = getSize(index);
              const caption = photo.caption || fallbackCaption(index);
              return (
                <button
                  key={photo.id || index}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  className="gallery-item"
                  data-size={size}
                  role="listitem"
                  type="button"
                  aria-label={`${caption}. Tekan untuk melihat ukuran penuh.`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <div className="gallery-item__img-wrap">
                    <GalleryImage
                      src={photo.url}
                      alt={caption}
                      className="gallery-item__img"
                    />

                    {/* Overlay with caption — always on mobile via CSS */}
                    <div className="gallery-item__overlay" aria-hidden="true">
                      <p className="gallery-item__caption">{caption}</p>
                    </div>

                    {/* Expand icon — visible on hover */}
                    <div className="gallery-item__icon" aria-hidden="true">
                      <Maximize2 />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Lightbox ───────────────────────────────────────────── */}
        {selectedIndex !== null && (
          <Lightbox
            photos={photos}
            index={selectedIndex}
            onClose={closeLightbox}
            onPrev={goPrev}
            onNext={goNext}
            originRef={itemRefs.current[selectedIndex]}
          />
        )}
      </div>
    </>
  );
};

export default GalleryPage;