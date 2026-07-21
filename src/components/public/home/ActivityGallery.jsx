import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import EmptyState from './EmptyState';
import SectionKicker from './SectionKicker';
import { imageOf, safeArray, sectionReveal } from './homeUtils';

const ActivityGallery = ({ facilities }) => {
  const trackRef = useRef(null);
  const images = safeArray(facilities).filter((item) => imageOf(item)).slice(0, 8);
  const scrollBy = (direction) => {
    trackRef.current?.scrollBy({ left: direction * Math.min(460, window.innerWidth * 0.82), behavior: 'smooth' });
  };

  return (
    <section className="home-gallery" aria-labelledby="home-gallery-title">
      <div className="home-container">
        <motion.div {...sectionReveal()} className="home-gallery__head">
          <div>
            <SectionKicker>Galeri kegiatan</SectionKicker>
            <h2 id="home-gallery-title">Aktivitas nyata menjadi bukti paling hangat.</h2>
          </div>
          <div className="home-gallery__controls">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Geser galeri ke kiri"><ChevronLeft /></button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Geser galeri ke kanan"><ChevronRight /></button>
            <Button asChild variant="outline" className="home-outline-button">
              <Link to="/profil/galeri">Lihat semua <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </motion.div>
        {images.length > 0 ? (
          <motion.div {...sectionReveal(1)} className="home-gallery__wrap">
            <div ref={trackRef} className="home-gallery__track" tabIndex={0} aria-label="Galeri horizontal kegiatan LPQ">
              {images.map((item, index) => (
                <Link key={item.id || index} to="/profil/galeri" className="home-gallery__card">
                  <img src={imageOf(item)} alt={item.name || 'Aktivitas LPQ Al-Fath Maulana'} width="420" height="540" loading="lazy" />
                  <span>{item.name || 'Kegiatan LPQ'}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        ) : (
          <EmptyState title="Galeri kegiatan belum tersedia" description="Foto fasilitas dan kegiatan akan tampil dari Content Management." />
        )}
      </div>
    </section>
  );
};

export default ActivityGallery;
