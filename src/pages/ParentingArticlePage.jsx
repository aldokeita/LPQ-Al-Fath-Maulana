import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import {
  User,
  Clock,
  ChevronRight,
  ChevronLeft,
  Share2,
  BookOpen,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import '@/styles/public-parenting.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

/* ---------- Helpers ---------- */
const getEmbedUrl = (url) => {
  if (!url) return null;
  let videoId = null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    } else if (urlObj.hostname.includes('youtube.com')) {
      if (urlObj.pathname.includes('/embed/')) {
        videoId = urlObj.pathname.split('/embed/')[1].split('?')[0];
      } else {
        videoId = urlObj.searchParams.get('v');
      }
    }
  } catch (e) {
    const embedMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?([\w-]{11})/);
    if (embedMatch) videoId = embedMatch[1];
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

/* ---------- Reading Progress ---------- */
const useReadingProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setProgress(Math.min(100, Math.round((scrollTop / docHeight) * 100)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
};

/* ---------- Share Actions ---------- */
const ShareActions = ({ title, url }) => {
  const encodedUrl = encodeURIComponent(url || window.location.href);
  const encodedTitle = encodeURIComponent(title || '');

  return (
    <div className="par-detail__share">
      <span className="par-detail__share-label">Bagikan</span>
      <a
        href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="par-detail__share-btn"
        aria-label="Bagikan ke WhatsApp"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="par-detail__share-btn"
        aria-label="Bagikan ke Twitter/X"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <button
        className="par-detail__share-btn"
        aria-label="Salin tautan"
        onClick={() => {
          navigator.clipboard.writeText(window.location.href).catch(() => {});
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </button>
    </div>
  );
};

/* ---------- Loading State ---------- */
const DetailLoading = () => (
  <div className="par-page">
    <div className="par-loading" role="status" aria-label="Memuat artikel">
      <div className="par-loading__spinner" aria-hidden="true" />
      <span style={{ fontSize: '0.9rem', color: 'var(--par-muted)' }}>Memuat artikel...</span>
    </div>
  </div>
);

/* ---------- Error State ---------- */
const DetailError = ({ message }) => (
  <div className="par-page">
    <div className="par-error">
      <AlertCircle className="par-error__icon" />
      <h2 className="par-error__title">Artikel Tidak Ditemukan</h2>
      <p className="par-error__text">{message || 'Artikel yang Anda cari tidak tersedia.'}</p>
      <Link to="/parenting" className="par-retry-btn" style={{ textDecoration: 'none' }}>
        <ChevronLeft className="w-4 h-4" />
        Kembali ke Artikel
      </Link>
    </div>
  </div>
);

/* ---------- Main Component ---------- */
const ParentingArticlePage = () => {
  const { articleId } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const readingProgress = useReadingProgress();

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'parentingArticles')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        setError('Gagal memuat artikel. Silakan coba lagi.');
        console.error(fetchError);
      } else if (data) {
        const articles = data.content || [];
        const foundArticle = articles.find((a) => String(a.id) === articleId);
        if (foundArticle) {
          setArticle(foundArticle);
        } else {
          setError('Artikel tidak ditemukan.');
        }
      } else {
        setError('Artikel tidak ditemukan.');
      }
      setLoading(false);
    };
    fetchArticle();
  }, [articleId]);

  if (loading) return <DetailLoading />;
  if (error || !article) return <DetailError message={error} />;

  const embedUrl = getEmbedUrl(article.youtube_url);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      <Helmet>
        <title>{article.title} - Parenting LPQ Al-Fath Maulana</title>
        <meta name="description" content={article.summary || article.title} />
        <meta property="og:title" content={`${article.title} - Parenting LPQ`} />
        <meta property="og:description" content={article.summary || article.title} />
        {article.image_url && <meta property="og:image" content={article.image_url} />}
        <link rel="canonical" href={currentUrl} />
      </Helmet>

      <div className="par-page">
        {/* Reading Progress Bar */}
        {readingProgress > 0 && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: `${readingProgress}%`,
              height: '3px',
              background: 'linear-gradient(90deg, #b45309, #d97706)',
              zIndex: 100,
              transition: 'width 0.1s ease',
            }}
            role="progressbar"
            aria-valuenow={readingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Kemajuan membaca"
          />
        )}

        <div className="par-detail__hero">
          <motion.div
            className="par-detail__hero-inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            {/* Breadcrumb */}
            <nav className="par-breadcrumb" aria-label="Breadcrumb">
              <Link to="/parenting" className="par-breadcrumb__link">Parenting</Link>
              <ChevronRight className="w-3 h-3 par-breadcrumb__sep" aria-hidden="true" />
              <span className="par-breadcrumb__current" aria-current="page">{article.title}</span>
            </nav>

            {/* Meta */}
            <div className="par-detail__meta">
              <span className="par-detail__meta-item">
                <Clock className="w-4 h-4" />
                {formatDate(article.date)}
              </span>
            </div>

            {/* Title */}
            <h1 className="par-detail__title">{article.title}</h1>

            {/* Author Badge */}
            {article.author && (
              <div className="par-detail__author-badge">
                <User className="w-4 h-4" />
                {article.author}
              </div>
            )}
          </motion.div>
        </div>

        {/* Cover Image */}
        {article.image_url && (
          <motion.div
            className="par-detail__cover"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={article.image_url}
              alt={article.title}
              className="par-detail__cover-img"
              loading="eager"
            />
          </motion.div>
        )}

        {/* Content Area */}
        <motion.div
          className="par-detail__content-wrap"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* YouTube Embed */}
          {embedUrl && (
            <div className="par-detail__video">
              <iframe
                src={embedUrl}
                title={`Video: ${article.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Article Body */}
          <div className="par-detail__body">
            {article.content ? (
              article.content.split('\n').map((paragraph, i) => (
                paragraph.trim() ? <p key={i}>{paragraph}</p> : null
              ))
            ) : (
              <p>Artikel ini belum memiliki konten.</p>
            )}
          </div>

          {/* Share Actions */}
          <ShareActions title={article.title} url={currentUrl} />
        </motion.div>

        {/* CTA Footer */}
        <div className="par-detail__cta">
          <h2 className="par-detail__cta-title">Ingin Belajar Lebih Banyak?</h2>
          <p className="par-detail__cta-desc">
            Jelajahi artikel parenting Islami lainnya untuk mendukung peran Anda sebagai pendidik utama di rumah.
          </p>
          <Link to="/parenting" className="par-detail__cta-btn">
            <BookOpen className="w-4 h-4" />
            Lihat Semua Artikel
          </Link>
        </div>
      </div>
    </>
  );
};

export default ParentingArticlePage;