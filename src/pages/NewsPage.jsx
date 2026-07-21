import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, Newspaper, RefreshCw, Loader2 } from 'lucide-react';
import { fetchPublishedNews, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import '@/styles/public-news.css';

/* ---------- Helpers ---------- */
const ITEMS_PER_PAGE = 6;

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const imageOf = (item) => {
  const url = item.image_url || item.cover_image_url;
  if (!url || url.trim() === '') return null;
  return url.trim();
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
  <div className="news-featured-skeleton" aria-hidden="true">
    <div className="news-featured-skeleton__image" />
    <div className="news-featured-skeleton__body">
      <div className="news-skeleton-line news-skeleton-line--short" />
      <div className="news-skeleton-line news-skeleton-line--long" />
      <div className="news-skeleton-line news-skeleton-line--medium" />
      <div className="news-skeleton-line news-skeleton-line--short" />
    </div>
  </div>
);

const GridSkeleton = () => (
  <div className="news-skeleton-grid" aria-hidden="true">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="news-skeleton-card">
        <div className="news-skeleton-card__image" />
        <div className="news-skeleton-card__body">
          <div className="news-skeleton-line news-skeleton-line--short" />
          <div className="news-skeleton-line news-skeleton-line--long" />
          <div className="news-skeleton-line news-skeleton-line--medium" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <div className="news-empty">
    <Newspaper className="h-12 w-12" />
    <h3>Belum ada berita</h3>
    <p>Berita dan cerita dari LPQ Al-Fath Maulana akan tampil di sini setelah diterbitkan.</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="news-error">
    <Newspaper className="h-12 w-12" />
    <h3>Gagal memuat berita</h3>
    <p>{message}</p>
    {onRetry && (
      <button className="news-retry-btn" onClick={onRetry} type="button">
        <RefreshCw className="inline h-4 w-4 mr-1" />
        Coba lagi
      </button>
    )}
  </div>
);

const SearchResultEmpty = ({ query }) => (
  <div className="news-empty">
    <Search className="h-10 w-10" />
    <h3>Tidak ada hasil</h3>
    <p>Tidak ditemukan berita yang cocok dengan pencarian "{query}".</p>
  </div>
);

const FeaturedStory = ({ item }) => {
  const href = `/berita/${item.slug || item.id}`;
  const hasImage = imageOf(item);

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0} className="news-featured">
      <Link to={href} className="news-featured__grid" aria-label={`Baca: ${item.title}`}>
        <div className="news-featured__image-wrap">
          {hasImage ? (
            <img src={hasImage} alt={item.title} loading="eager" width="800" height="500" />
          ) : (
            <div className="news-featured__image-fallback">
              <Newspaper className="h-14 w-14" />
            </div>
          )}
        </div>
        <div className="news-featured__content">
          <span className="news-featured__kicker">
            <Newspaper className="h-3 w-3" />
            Sorotan Utama
          </span>
          <span className="news-featured__date">{formatDate(item.date)}</span>
          <h2 className="news-featured__title">{item.title}</h2>
          {item.excerpt && (
            <p className="news-featured__excerpt">{item.excerpt}</p>
          )}
          <span className="news-featured__cta">
            Baca selengkapnya
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

const NewsCard = ({ item, index }) => {
  const href = `/berita/${item.slug || item.id}`;
  const hasImage = imageOf(item);

  return (
    <motion.div
      custom={index + 1}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      <Link to={href} className="news-card" aria-label={`Baca: ${item.title}`}>
        <div className="news-card__image">
          {hasImage ? (
            <img src={hasImage} alt={item.title} loading="lazy" width="480" height="300" />
          ) : (
            <div className="news-card__image-fallback">
              <Newspaper className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="news-card__body">
          <span className="news-card__date">{formatDate(item.date)}</span>
          <h3 className="news-card__title">{item.title}</h3>
          {item.excerpt && (
            <p className="news-card__excerpt">{item.excerpt}</p>
          )}
          <span className="news-card__link">
            Baca
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

/* ---------- Main Page ---------- */

const NewsPage = () => {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPublishedNews();
      setAllItems(items);
    } catch (err) {
      setError(getPublicContentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(
      (item) =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.excerpt || '').toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  const featured = !searchQuery.trim() && allItems.length > 0 ? allItems[0] : null;
  const gridItems = featured ? filteredItems.slice(1) : filteredItems;
  const visibleItems = gridItems.slice(0, visibleCount);
  const hasMore = visibleCount < gridItems.length;

  return (
    <div className="public-news-page">
      <Helmet>
        <title>Berita & Cerita — LPQ Al-Fath Maulana</title>
        <meta name="description" content="Kabar terkini, kegiatan, dan cerita inspiratif dari LPQ Al-Fath Maulana." />
      </Helmet>

      {/* ---- Hero ---- */}
      <section className="news-hero" aria-labelledby="news-hero-title">
        <div className="news-container news-hero__inner">
          <motion.div variants={heroVariants} initial="hidden" animate="visible">
            <span className="news-hero__eyebrow">
              <Newspaper className="h-3.5 w-3.5" />
              Kabar LPQ
            </span>
            <h1 id="news-hero-title" className="news-hero__title">
              Berita & Cerita <em>dari LPQ</em>
            </h1>
            <p className="news-hero__lead">
              Ikuti kabar terkini, kegiatan belajar, dan momen berharga dari LPQ Al-Fath Maulana untuk wali santri dan masyarakat.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.15 }}
          >
            <div className="news-search" role="search" aria-label="Cari berita">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                type="search"
                placeholder="Cari judul atau ringkasan berita…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(ITEMS_PER_PAGE);
                }}
                aria-label="Ketik untuk mencari berita"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---- Content ---- */}
      <section className="news-container" style={{ paddingTop: 'clamp(2rem, 4vw, 3.5rem)', paddingBottom: 'clamp(3rem, 6vw, 5rem)' }} aria-label="Daftar berita">
        {loading ? (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <HeroSkeleton />
            </div>
            <GridSkeleton />
            <div className="news-loading" aria-live="polite">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Memuat berita terbaru…</p>
            </div>
          </>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchNews} />
        ) : allItems.length === 0 ? (
          <EmptyState />
        ) : searchQuery.trim() && filteredItems.length === 0 ? (
          <SearchResultEmpty query={searchQuery} />
        ) : (
          <>
            {/* Featured */}
            {featured && <FeaturedStory item={featured} />}

            {/* Grid header */}
            {gridItems.length > 0 && (
              <div className="news-section-header" style={{ marginTop: featured ? 'clamp(2.5rem, 4vw, 3.5rem)' : 0 }}>
                <h2>{searchQuery.trim() ? 'Hasil Pencarian' : 'Kabar Terbaru'}</h2>
                {!searchQuery.trim() && (
                  <span>{gridItems.length} berita</span>
                )}
              </div>
            )}

            {/* Grid */}
            <div className="news-grid">
              {visibleItems.map((item, i) => (
                <NewsCard key={item.id || item.slug || i} item={item} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="news-load-more">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                >
                  Muat lebih banyak
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default NewsPage;