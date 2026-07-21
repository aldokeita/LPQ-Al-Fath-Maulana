import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, Megaphone, RefreshCw, Loader2, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { fetchPublishedAnnouncements, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import '@/styles/public-announcements.css';

/* ---------- Helpers ---------- */
const ITEMS_PER_PAGE = 8;

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

const imageOf = (item) => {
  const url = item.image_url || item.cover_image_url;
  if (!url || url.trim() === '') return null;
  return url.trim();
};

const priorityConfig = (priority) => {
  switch (priority) {
    case 'urgent':
      return { label: 'Mendesak', className: 'ann-priority-badge--urgent', icon: AlertTriangle };
    case 'important':
      return { label: 'Penting', className: 'ann-priority-badge--important', icon: Info };
    case 'normal':
    default:
      return null; // Don't show badge for normal priority
  }
};

/* ---------- Animation Variants ---------- */
const heroVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] },
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

const HeroSkeleton = () => (
  <div className="ann-featured-skeleton" aria-hidden="true">
    <div className="ann-featured-skeleton__grid">
      <div className="ann-featured-skeleton__image" />
      <div className="ann-featured-skeleton__body">
        <div className="ann-skeleton-line ann-skeleton-line--short" />
        <div className="ann-skeleton-line ann-skeleton-line--long" />
        <div className="ann-skeleton-line ann-skeleton-line--medium" />
        <div className="ann-skeleton-line ann-skeleton-line--short" />
      </div>
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="ann-list-skeleton" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="ann-skeleton-row">
        <div className="ann-skeleton-date">
          <div className="ann-skeleton-line" style={{ width: '2rem', height: '1.4rem' }} />
          <div className="ann-skeleton-line" style={{ width: '2rem', height: '0.6rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="ann-skeleton-line ann-skeleton-line--medium" style={{ height: '1rem' }} />
          <div className="ann-skeleton-line ann-skeleton-line--long" style={{ height: '0.7rem' }} />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <div className="ann-empty">
    <Megaphone className="h-12 w-12" />
    <h3>Belum ada pengumuman</h3>
    <p>Pengumuman resmi dari LPQ Al-Fath Maulana akan tampil di sini setelah diterbitkan.</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="ann-error">
    <Megaphone className="h-12 w-12" />
    <h3>Gagal memuat pengumuman</h3>
    <p>{message}</p>
    {onRetry && (
      <button className="ann-retry-btn" onClick={onRetry} type="button">
        <RefreshCw className="inline h-4 w-4 mr-1" />
        Coba lagi
      </button>
    )}
  </div>
);

const SearchResultEmpty = ({ query }) => (
  <div className="ann-empty">
    <Search className="h-10 w-10" />
    <h3>Tidak ada hasil</h3>
    <p>Tidak ditemukan pengumuman yang cocok dengan pencarian "{query}".</p>
  </div>
);

const FeaturedAnnouncement = ({ item }) => {
  const href = `/pengumuman/${item.slug || item.id}`;
  const hasImage = imageOf(item);
  const dateParts = parseDateParts(item.date);

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="ann-featured">
      <Link to={href} className="ann-featured__card" aria-label={`Baca: ${item.title}`}>
        <div className="ann-featured__image-wrap">
          {hasImage ? (
            <img src={hasImage} alt={item.title} loading="eager" width="800" height="500" />
          ) : (
            <div className="ann-featured__image-fallback">
              <Megaphone className="h-14 w-14" />
            </div>
          )}
        </div>
        <div className="ann-featured__body">
          <span className="ann-featured__kicker">
            <Megaphone className="h-3 w-3" />
            Pengumuman Terbaru
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="ann-featured__date">{formatDate(item.date)}</span>
            <PriorityBadge priority={item.priority} />
          </div>
          <h2 className="ann-featured__title">{item.title}</h2>
          {item.excerpt && (
            <p className="ann-featured__excerpt">{item.excerpt}</p>
          )}
          <span className="ann-featured__cta">
            Baca Pengumuman
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

const AnnouncementListItem = ({ item, index }) => {
  const href = `/pengumuman/${item.slug || item.id}`;
  const dateParts = parseDateParts(item.date);

  return (
    <motion.div
      custom={index}
      variants={staggerItem}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-30px' }}
    >
      <Link to={href} className="ann-list-item" aria-label={`Baca: ${item.title}`}>
        <div className="ann-list-item__date-col" aria-hidden="true">
          <span className="ann-list-item__day">{dateParts.day}</span>
          <span className="ann-list-item__month">{dateParts.month}</span>
        </div>
        <div className="ann-list-item__body">
          <span className="ann-list-item__title-mobile-date">{formatDate(item.date)}</span>
          <div className="ann-list-item__top-row">
            <h3 className="ann-list-item__title">{item.title}</h3>
            <PriorityBadge priority={item.priority} />
          </div>
          {item.excerpt && (
            <p className="ann-list-item__excerpt">{item.excerpt}</p>
          )}
        </div>
        <span className="ann-list-item__arrow" aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
    </motion.div>
  );
};

/* ---------- Main Page ---------- */

const AnnouncementPage = () => {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPublishedAnnouncements();
      setAllItems(items);
    } catch (err) {
      setError(getPublicContentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(
      (item) =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.excerpt || '').toLowerCase().includes(q) ||
        (item.content || '').toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  const featured = !searchQuery.trim() && allItems.length > 0 ? allItems[0] : null;
  const listItems = featured ? filteredItems.slice(1) : filteredItems;
  const visibleItems = listItems.slice(0, visibleCount);
  const hasMore = visibleCount < listItems.length;

  return (
    <div className="public-announcements-page">
      <Helmet>
        <title>Pengumuman — LPQ Al-Fath Maulana</title>
        <meta name="description" content="Pengumuman resmi terbaru dari LPQ Al-Fath Maulana untuk wali santri dan masyarakat." />
      </Helmet>

      {/* ---- Hero ---- */}
      <section className="ann-hero" aria-labelledby="ann-hero-title">
        <div className="ann-container ann-hero__inner">
          <motion.div variants={heroVariants} initial="hidden" animate="visible">
            <span className="ann-hero__eyebrow">
              <Megaphone className="h-3.5 w-3.5" />
              Informasi Resmi
            </span>
            <h1 id="ann-hero-title" className="ann-hero__title">
              Pengumuman <em>LPQ</em>
            </h1>
            <p className="ann-hero__lead">
              Informasi penting untuk seluruh wali santri dan masyarakat LPQ Al-Fath Maulana.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.15 }}
          >
            <div className="ann-search" role="search" aria-label="Cari pengumuman">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                type="search"
                placeholder="Cari judul atau ringkasan pengumuman…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(ITEMS_PER_PAGE);
                }}
                aria-label="Ketik untuk mencari pengumuman"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---- Content ---- */}
      <section className="ann-container" style={{ paddingTop: 'clamp(2rem, 4vw, 3.5rem)', paddingBottom: 'clamp(3rem, 6vw, 5rem)' }} aria-label="Daftar pengumuman">
        {loading ? (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <HeroSkeleton />
            </div>
            <ListSkeleton />
            <div className="ann-loading" aria-live="polite">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Memuat pengumuman terbaru…</p>
            </div>
          </>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchAnnouncements} />
        ) : allItems.length === 0 ? (
          <EmptyState />
        ) : searchQuery.trim() && filteredItems.length === 0 ? (
          <SearchResultEmpty query={searchQuery} />
        ) : (
          <>
            {/* Featured */}
            {featured && <FeaturedAnnouncement item={featured} />}

            {/* List header */}
            {listItems.length > 0 && (
              <div className="ann-section-header" style={{ marginTop: featured ? 'clamp(2.5rem, 4vw, 3.5rem)' : 0 }}>
                <h2>{searchQuery.trim() ? 'Hasil Pencarian' : 'Pengumuman Lainnya'}</h2>
                {!searchQuery.trim() && (
                  <span>{listItems.length} pengumuman</span>
                )}
              </div>
            )}

            {/* List */}
            <div className="ann-list">
              {visibleItems.map((item, i) => (
                <AnnouncementListItem key={item.id || item.slug || i} item={item} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="ann-load-more">
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

export default AnnouncementPage;