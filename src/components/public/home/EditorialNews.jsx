import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Megaphone, Newspaper } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import EmptyState from './EmptyState';
import SectionKicker from './SectionKicker';
import { imageOf, safeArray, sectionReveal } from './homeUtils';

const EditorialNews = ({ news, announcements, loading, error }) => {
  const newsItems = safeArray(news);
  const featured = newsItems[0];
  const supporting = newsItems.slice(1, 4);
  const announcementItems = safeArray(announcements);

  return (
    <section className="home-editorial" aria-labelledby="home-editorial-title">
      <div className="home-container">
        <motion.div {...sectionReveal()} className="home-editorial__head">
          <div>
            <SectionKicker dark>Kabar lembaga</SectionKicker>
            <h2 id="home-editorial-title">Berita dan pengumuman yang mudah diikuti keluarga.</h2>
          </div>
          <div className="home-editorial__actions">
            <Button asChild variant="outline" className="home-dark-outline"><Link to="/berita">Berita</Link></Button>
            <Button asChild className="home-light-button"><Link to="/pengumuman">Pengumuman</Link></Button>
          </div>
        </motion.div>

        {loading ? (
          <div className="home-loading-panel"><Loader2 className="h-6 w-6 animate-spin" /> Memuat kabar terbaru...</div>
        ) : error ? (
          <div className="home-error-panel">{error}</div>
        ) : (
          <div className="home-editorial__grid">
            {featured ? (
              <motion.div {...sectionReveal(1)} className="home-feature-story-wrap">
                <Link to={`/berita/${featured.slug || featured.id}`} className="home-feature-story">
                  {imageOf(featured) ? (
                    <img src={imageOf(featured)} alt={featured.title} loading="lazy" />
                  ) : (
                    <div className="home-feature-story__fallback"><Newspaper className="h-14 w-14" /></div>
                  )}
                  <span>{featured.date || 'Berita'}</span>
                  <h3>{featured.title}</h3>
                  <p>{featured.summary || featured.excerpt || 'Baca kabar terbaru dari LPQ Al-Fath Maulana.'}</p>
                </Link>
              </motion.div>
            ) : (
              <EmptyState dark title="Belum ada berita published" description="Berita akan tampil setelah admin menerbitkan konten." />
            )}

            <motion.aside {...sectionReveal(2)} className="home-announcement-board" aria-label="Pengumuman terbaru">
              <div className="home-announcement-board__title">
                <Megaphone className="h-6 w-6" />
                <h3>Pengumuman</h3>
              </div>
              {announcementItems.length > 0 ? announcementItems.slice(0, 3).map((item) => (
                <Link key={item.id} to={`/pengumuman/${item.slug || item.id}`} className="home-announcement-row">
                  <span>{item.priority || 'normal'}</span>
                  <strong>{item.title}</strong>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )) : <p className="home-muted-dark">Belum ada pengumuman published.</p>}
              {supporting.map((item) => (
                <Link key={item.id} to={`/berita/${item.slug || item.id}`} className="home-news-mini">
                  <span>{item.date || 'Berita'}</span>
                  <strong>{item.title}</strong>
                </Link>
              ))}
            </motion.aside>
          </div>
        )}
      </div>
    </section>
  );
};

export default EditorialNews;
