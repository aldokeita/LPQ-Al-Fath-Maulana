import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Share2, Copy, Check,
  MessageCircle, Newspaper, RefreshCw,
} from 'lucide-react';
import { fetchNewsDetail, fetchPublishedNews, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import '@/styles/public-news.css';

/* ---------- Helpers ---------- */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const estimateReadTime = (text) => {
  if (!text) return null;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes;
};

const imageOf = (item) => {
  const url = item.image_url || item.cover_image_url;
  if (!url || url.trim() === '') return null;
  return url.trim();
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

const DetailSkeleton = () => (
  <div aria-hidden="true" className="public-news-page">
    <div className="news-detail-hero">
      <div className="news-container news-detail-hero__inner" style={{ paddingBottom: '3rem' }}>
        <div className="news-skeleton-line news-skeleton-line--short" style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
        <div className="news-skeleton-line" style={{ width: '40%', height: '0.7rem', marginBottom: '1rem', opacity: 0.15 }} />
        <div className="news-skeleton-line" style={{ width: '70%', height: '1.8rem', marginBottom: '0.6rem', opacity: 0.15 }} />
        <div className="news-skeleton-line" style={{ width: '55%', height: '1.8rem', opacity: 0.15 }} />
      </div>
    </div>
    <div className="news-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div className="news-container--narrow">
        <div className="news-skeleton-line news-skeleton-line--long" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="news-skeleton-line news-skeleton-line--long" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="news-skeleton-line news-skeleton-line--medium" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="news-skeleton-line news-skeleton-line--long" style={{ height: '0.95rem', marginBottom: '1.2rem', opacity: 0.12 }} />
        <div className="news-skeleton-line news-skeleton-line--short" style={{ height: '0.95rem', opacity: 0.12 }} />
      </div>
    </div>
  </div>
);

const DetailNotFound = () => (
  <div className="public-news-page">
    <div className="news-detail-hero">
      <div className="news-container news-detail-hero__inner" style={{ paddingBottom: '3rem' }}>
        <Link to="/berita" className="news-breadcrumb">
          <ArrowLeft className="h-3 w-3" />
          Berita
        </Link>
        <h1 className="news-detail-title">Berita tidak ditemukan</h1>
      </div>
    </div>
    <div className="news-container" style={{ padding: '3rem 0 5rem' }}>
      <div className="news-container--narrow" style={{ textAlign: 'center' }}>
        <Newspaper className="h-12 w-12 mx-auto" style={{ color: 'var(--news-emerald)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--news-muted)', marginBottom: '1.5rem' }}>
          Berita yang Anda cari mungkin sudah tidak tersedia atau belum diterbitkan.
        </p>
        <Link to="/berita" className="news-featured__cta" style={{ marginInline: 'auto' }}>
          <ArrowLeft className="h-4 w-4" />
          Lihat semua berita
        </Link>
      </div>
    </div>
  </div>
);

const DetailError = ({ message, onRetry }) => (
  <div className="public-news-page">
    <div className="news-detail-hero">
      <div className="news-container news-detail-hero__inner" style={{ paddingBottom: '3rem' }}>
        <Link to="/berita" className="news-breadcrumb">
          <ArrowLeft className="h-3 w-3" />
          Berita
        </Link>
        <h1 className="news-detail-title">Gagal memuat berita</h1>
      </div>
    </div>
    <div className="news-container" style={{ padding: '3rem 0 5rem' }}>
      <div className="news-container--narrow" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--news-muted)', marginBottom: '1rem' }}>{message}</p>
        {onRetry && (
          <button className="news-retry-btn" onClick={onRetry} type="button">
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
      // fallback
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
        // user cancelled or error — silent
      }
    }
  }, [title, url]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="news-share">
      <span className="news-share__label">Bagikan:</span>
      <button className="news-share__btn" onClick={handleCopy} type="button" aria-label="Salin tautan">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Tersalin' : 'Salin tautan'}
      </button>
      <button className="news-share__btn" onClick={handleWhatsApp} type="button" aria-label="Bagikan ke WhatsApp">
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </button>
      {typeof navigator !== 'undefined' && navigator.share && (
        <button className="news-share__btn" onClick={handleNativeShare} type="button" aria-label="Bagikan">
          <Share2 className="h-3.5 w-3.5" />
          Bagikan
        </button>
      )}
      {copied && <span className="news-share__copied" role="status">Tautan tersalin!</span>}
    </div>
  );
};

const RelatedCard = ({ item, index }) => {
  const href = `/berita/${item.slug || item.id}`;
  const hasImage = imageOf(item);

  return (
    <motion.div custom={index} variants={staggerItem} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}>
      <Link to={href} className="news-related-card" aria-label={`Baca: ${item.title}`}>
        <div className="news-related-card__image">
          {hasImage ? (
            <img src={hasImage} alt={item.title} loading="lazy" width="400" height="225" />
          ) : (
            <div className="news-related-card__image-fallback">
              <Newspaper className="h-7 w-7" />
            </div>
          )}
        </div>
        <div className="news-related-card__body">
          <span className="news-related-card__date">{formatDate(item.date)}</span>
          <h3 className="news-related-card__title">{item.title}</h3>
        </div>
      </Link>
    </motion.div>
  );
};

/* ---------- Main Page ---------- */

const NewsDetailPage = () => {
  const { id } = useParams();
  const [newsItem, setNewsItem] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const readingProgress = useReadingProgress();

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRelated([]);
    try {
      const item = await fetchNewsDetail(id);
      setNewsItem(item);

      // Fetch related news (exclude current item)
      if (item) {
        try {
          const allNews = await fetchPublishedNews({ limit: 10 });
          const filtered = allNews
            .filter((n) => n.id !== item.id)
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
  if (error) return <DetailNotFound />;
  if (!newsItem) return <DetailNotFound />;

  const readTime = estimateReadTime(newsItem.content);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="public-news-page">
      {/* Reading Progress Bar */}
      <div className="news-reading-progress" aria-hidden="true">
        <div
          className="news-reading-progress__bar"
          style={{ transform: `scaleX(${readingProgress})` }}
        />
      </div>

      <Helmet>
        <title>{newsItem.title} — LPQ Al-Fath Maulana</title>
        <meta name="description" content={(newsItem.excerpt || newsItem.content || '').substring(0, 160)} />
        {newsItem.image_url && <meta property="og:image" content={newsItem.image_url} />}
        <meta property="og:title" content={newsItem.title} />
        <meta property="og:description" content={(newsItem.excerpt || newsItem.content || '').substring(0, 160)} />
        <meta property="og:type" content="article" />
      </Helmet>

      {/* ---- Hero Header ---- */}
      <section className="news-detail-hero" aria-labelledby="news-detail-title">
        <div className="news-container news-detail-hero__inner">
          <motion.nav className="news-breadcrumb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} aria-label="Breadcrumb">
            <Link to="/">Beranda</Link>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            <Link to="/berita">Berita</Link>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            <span aria-current="page" style={{ color: 'rgba(255,255,255,0.7)' }}>{newsItem.title}</span>
          </motion.nav>

          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <h1 id="news-detail-title" className="news-detail-title">{newsItem.title}</h1>

            <div className="news-detail-meta">
              <span className="news-detail-meta__item">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {formatDate(newsItem.date)}
              </span>
              {readTime && (
                <>
                  <span className="news-detail-meta__dot" aria-hidden="true" />
                  <span className="news-detail-meta__item">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {readTime} menit baca
                  </span>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Featured image */}
        {imageOf(newsItem) && (
          <motion.div
            className="news-detail-image"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="news-container" style={{ maxWidth: '52rem', marginInline: 'auto' }}>
              <img
                src={newsItem.image_url}
                alt={newsItem.title}
                width="1200"
                height="514"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1.4rem 1.4rem 0 0' }}
              />
            </div>
          </motion.div>
        )}
      </section>

      {/* ---- Article Body ---- */}
      <article className="news-article">
        <div className="news-container">
          <div className="news-article__content">
            <motion.div
              className="news-article__body"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.25 }}
            >
              {newsItem.content || ''}
            </motion.div>

            {/* Share */}
            <ShareActions title={newsItem.title} url={currentUrl} />

            {/* Related */}
            {related.length > 0 && (
              <aside className="news-related" aria-label="Berita terkait">
                <h2 className="news-related__title">Berita lainnya</h2>
                <div className="news-related__grid">
                  {related.map((item, i) => (
                    <RelatedCard key={item.id || item.slug || i} item={item} index={i} />
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      </article>

      {/* ---- CTA ---- */}
      <section className="news-cta" aria-labelledby="news-cta-title">
        <div className="news-container news-cta__inner">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 id="news-cta-title" className="news-cta__title">Ikuti perkembangan terbaru LPQ Al-Fath Maulana</h2>
            <p className="news-cta__subtitle">Temukan berita, pengumuman, dan informasi pendaftaran untuk keluarga Anda.</p>
            <div className="news-cta__actions">
              <Link to="/berita" className="news-cta__btn news-cta__btn--primary">
                <Newspaper className="h-4 w-4" />
                Semua Berita
              </Link>
              <Link to="/pengumuman" className="news-cta__btn news-cta__btn--outline">
                <MessageCircle className="h-4 w-4" />
                Pengumuman
              </Link>
              <Link to="/pendaftaran/informasi" className="news-cta__btn news-cta__btn--outline">
                <ArrowRight className="h-4 w-4" />
                Informasi Pendaftaran
              </Link>
              <Link to="/kontak" className="news-cta__btn news-cta__btn--outline">
                Hubungi LPQ
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default NewsDetailPage;