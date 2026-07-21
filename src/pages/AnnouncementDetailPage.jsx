import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Calendar, Share2, Copy, Check,
  MessageCircle, Megaphone, RefreshCw, AlertTriangle, Info, ChevronRight,
} from 'lucide-react';
import { fetchAnnouncementDetail, fetchPublishedAnnouncements, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import '@/styles/public-announcements.css';

/* ---------- Helpers ---------- */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const parseDateParts = (dateStr) => {
  if (!dateStr) return { day: '', month: '' };
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
    return { day: String(day), month };
  } catch {
    return { day: '', month: '' };
  }
};

const priorityConfig = (priority) => {
  switch (priority) {
    case 'urgent':
      return { label: 'Mendesak', className: 'ann-priority-badge--urgent', icon: AlertTriangle };
    case 'important':
      return { label: 'Penting', className: 'ann-priority-badge--important', icon: Info };
    case 'normal':
    default:
      return null;
  }
};

/* ---------- Reading Progress Hook ---------- */
const useReadingProgress = () => {
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return progress;
};

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ---------- Sub-components ---------- */

const PriorityBadge = ({ priority }) => {
  const config = priorityConfig(priority);
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`ann-priority-badge ${config.className}`} role="status">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
};

const DetailSkeleton = () => (
  <div aria-hidden="true" className="public-announcements-page">
    <div className="ann-detail-hero">
      <div className="ann-container ann-detail-hero__inner" style={{ paddingBottom: '3rem' }}>
        <div className="ann-skeleton-line ann-skeleton-line--short" style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
        <div className="ann-skeleton-line" style={{ width: '40%', height: '0.7rem', marginBottom: '1rem', opacity: 0.15 }} />
        <div className="ann-skeleton-line" style={{ width: '70%', height: '1.8rem', marginBottom: '0.6rem', opacity: 0.15 }} />
        <div className="ann-skeleton-line" style={{ width: '55%', height: '1.8rem', opacity: 0.15 }} />
      </div>
    </div>
    <div className="ann-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div className="ann-container--narrow">
        <div className="ann-skeleton-line ann-skeleton-line--long" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="ann-skeleton-line ann-skeleton-line--long" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="ann-skeleton-line ann-skeleton-line--medium" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="ann-skeleton-line ann-skeleton-line--long" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="ann-skeleton-line ann-skeleton-line--short" style={{ height: '0.95rem', opacity: 0.12 }} />
      </div>
    </div>
  </div>
);

const DetailNotFound = () => (
  <div className="public-announcements-page">
    <div className="ann-detail-hero">
      <div className="ann-container ann-detail-hero__inner" style={{ paddingBottom: '3rem' }}>
        <Link to="/pengumuman" className="ann-breadcrumb">
          <ArrowLeft className="h-3 w-3" />
          Pengumuman
        </Link>
        <h1 className="ann-detail-title">Pengumuman tidak ditemukan</h1>
      </div>
    </div>
    <div className="ann-container" style={{ padding: '3rem 0 5rem' }}>
      <div className="ann-container--narrow" style={{ textAlign: 'center' }}>
        <Megaphone className="h-12 w-12 mx-auto" style={{ color: 'var(--ann-emerald)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--ann-muted)', marginBottom: '1.5rem' }}>
          Pengumuman yang Anda cari mungkin sudah tidak tersedia atau belum diterbitkan.
        </p>
        <Link to="/pengumuman" className="ann-featured__cta" style={{ marginInline: 'auto' }}>
          <ArrowLeft className="h-4 w-4" />
          Lihat semua pengumuman
        </Link>
      </div>
    </div>
  </div>
);

const DetailError = ({ message, onRetry }) => (
  <div className="public-announcements-page">
    <div className="ann-detail-hero">
      <div className="ann-container ann-detail-hero__inner" style={{ paddingBottom: '3rem' }}>
        <Link to="/pengumuman" className="ann-breadcrumb">
          <ArrowLeft className="h-3 w-3" />
          Pengumuman
        </Link>
        <h1 className="ann-detail-title">Gagal memuat pengumuman</h1>
      </div>
    </div>
    <div className="ann-container" style={{ padding: '3rem 0 5rem' }}>
      <div className="ann-container--narrow" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--ann-muted)', marginBottom: '1rem' }}>{message}</p>
        {onRetry && (
          <button className="ann-retry-btn" onClick={onRetry} type="button">
            <RefreshCw className="inline h-4 w-4 mr-1" />
            Coba lagi
          </button>
        )}
      </div>
    </div>
  </div>
);

const ShareActions = ({ title, url }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [url]);

  const handleWhatsApp = useCallback(() => {
    const text = encodeURIComponent(`${title}\n\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }, [title, url]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled or error
      }
    }
  }, [title, url]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="ann-share">
      <span className="ann-share__label">Bagikan:</span>
      <button className="ann-share__btn" onClick={handleCopy} type="button" aria-label="Salin tautan">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Tersalin' : 'Salin tautan'}
      </button>
      <button className="ann-share__btn" onClick={handleWhatsApp} type="button" aria-label="Bagikan ke WhatsApp">
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </button>
      {typeof navigator !== 'undefined' && navigator.share && (
        <button className="ann-share__btn" onClick={handleNativeShare} type="button" aria-label="Bagikan">
          <Share2 className="h-3.5 w-3.5" />
          Bagikan
        </button>
      )}
      {copied && <span className="ann-share__copied" role="status">Tautan tersalin!</span>}
    </div>
  );
};

const RelatedItem = ({ item, index }) => {
  const href = `/pengumuman/${item.slug || item.id}`;
  const dateParts = parseDateParts(item.date);

  return (
    <motion.div custom={index} variants={staggerItem} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}>
      <Link to={href} className="ann-related-item" aria-label={`Baca: ${item.title}`}>
        <div className="ann-related-item__date" aria-hidden="true">
          <span className="ann-related-item__day">{dateParts.day}</span>
          <span className="ann-related-item__month">{dateParts.month}</span>
        </div>
        <h3 className="ann-related-item__title">{item.title}</h3>
        <span className="ann-related-item__arrow">
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
    </motion.div>
  );
};

/* ---------- Main Page ---------- */

const AnnouncementDetailPage = () => {
  const { id } = useParams();
  const [announcement, setAnnouncement] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const readingProgress = useReadingProgress();

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRelated([]);
    try {
      const item = await fetchAnnouncementDetail(id);
      setAnnouncement(item);

      // Fetch related announcements (exclude current)
      if (item) {
        try {
          const allAnn = await fetchPublishedAnnouncements({ limit: 10 });
          const filtered = allAnn
            .filter((a) => a.id !== item.id)
            .slice(0, 3);
          setRelated(filtered);
        } catch {
          // non-critical
        }
      }
    } catch (err) {
      setError(getPublicContentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    window.scrollTo(0, 0);
  }, [fetchDetail]);

  if (loading) return <DetailSkeleton />;
  if (error) return <DetailError message={error} onRetry={fetchDetail} />;
  if (!announcement) return <DetailNotFound />;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="public-announcements-page">
      {/* Reading Progress Bar */}
      <div className="ann-reading-progress" aria-hidden="true">
        <div
          className="ann-reading-progress__bar"
          style={{ transform: `scaleX(${readingProgress})` }}
        />
      </div>

      <Helmet>
        <title>{announcement.title} — LPQ Al-Fath Maulana</title>
        <meta name="description" content={(announcement.excerpt || announcement.content || '').substring(0, 160)} />
        {announcement.image_url && <meta property="og:image" content={announcement.image_url} />}
        <meta property="og:title" content={announcement.title} />
        <meta property="og:description" content={(announcement.excerpt || announcement.content || '').substring(0, 160)} />
        <meta property="og:type" content="article" />
      </Helmet>

      {/* ---- Hero Header ---- */}
      <section className="ann-detail-hero" aria-labelledby="ann-detail-title">
        <div className="ann-container ann-detail-hero__inner">
          <motion.nav className="ann-breadcrumb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} aria-label="Breadcrumb">
            <Link to="/">Beranda</Link>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            <Link to="/pengumuman">Pengumuman</Link>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            <span aria-current="page" style={{ color: 'rgba(255,255,255,0.7)' }}>{announcement.title}</span>
          </motion.nav>

          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <div className="ann-detail-badge">
              <PriorityBadge priority={announcement.priority} />
            </div>
            <h1 id="ann-detail-title" className="ann-detail-title">{announcement.title}</h1>

            <div className="ann-detail-meta">
              <span className="ann-detail-meta__item">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {formatDate(announcement.date)}
              </span>
              {announcement.valid_until && (
                <>
                  <span className="ann-detail-meta__dot" aria-hidden="true" />
                  <span className="ann-detail-meta__item">
                    Berlaku hingga {formatDate(announcement.valid_until)}
                  </span>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Featured image */}
        {announcement.image_url && (
          <motion.div
            className="ann-detail-image"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ann-container" style={{ maxWidth: '52rem', marginInline: 'auto' }}>
              <img
                src={announcement.image_url}
                alt={announcement.title}
                width="1200"
                height="514"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1.4rem 1.4rem 0 0' }}
              />
            </div>
          </motion.div>
        )}
      </section>

      {/* ---- Article Body ---- */}
      <article className="ann-article">
        <div className="ann-container">
          <div className="ann-article__content">
            <motion.div
              className="ann-article__body"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.25 }}
            >
              {announcement.content || ''}
            </motion.div>

            {/* Share */}
            <ShareActions title={announcement.title} url={currentUrl} />

            {/* Related */}
            {related.length > 0 && (
              <aside className="ann-related" aria-label="Pengumuman terkait">
                <h2 className="ann-related__title">Pengumuman lainnya</h2>
                <div className="ann-related__list">
                  {related.map((item, i) => (
                    <RelatedItem key={item.id || item.slug || i} item={item} index={i} />
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      </article>

      {/* ---- CTA ---- */}
      <section className="ann-cta" aria-labelledby="ann-cta-title">
        <div className="ann-container ann-cta__inner">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 id="ann-cta-title" className="ann-cta__title">Ikuti perkembangan terbaru LPQ Al-Fath Maulana</h2>
            <p className="ann-cta__subtitle">Temukan pengumuman, berita, dan informasi pendaftaran untuk keluarga Anda.</p>
            <div className="ann-cta__actions">
              <Link to="/pengumuman" className="ann-cta__btn ann-cta__btn--primary">
                <Megaphone className="h-4 w-4" />
                Semua Pengumuman
              </Link>
              <Link to="/berita" className="ann-cta__btn ann-cta__btn--outline">
                <MessageCircle className="h-4 w-4" />
                Berita
              </Link>
              <Link to="/pendaftaran/informasi" className="ann-cta__btn ann-cta__btn--outline">
                <ArrowRight className="h-4 w-4" />
                Informasi Pendaftaran
              </Link>
              <Link to="/kontak" className="ann-cta__btn ann-cta__btn--outline">
                Hubungi LPQ
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AnnouncementDetailPage;