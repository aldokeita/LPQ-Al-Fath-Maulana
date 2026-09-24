import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CountUp from '@/components/reactbits/CountUp/CountUp';
import BuildingTour from './BuildingTour';
import { imageOf, LOCAL_LOGO, safeArray } from './homeUtils';

const HeroSection = ({ content, currentSlide, setCurrentSlide, stats }) => {
  const slides = safeArray(content.heroSlides);
  const activeSlide = slides[currentSlide] || slides[0] || {};
  const heroText = activeSlide.text || 'Masuki ruang belajar Al-Qur’an yang hangat, tertata, dan dekat dengan keluarga.';
  const heroSubtext = activeSlide.author || 'Metode Qiroati, pembinaan adab, dan informasi lembaga yang mudah diikuti wali santri.';
  const logoUrl = content.logoUrl || LOCAL_LOGO;
  const sessionCount = safeArray(content.schedules).length;
  const heroCards = useMemo(() => {
    const items = [
      ...safeArray(content.heroSlides).map((slide, index) => ({
        id: slide.id || `hero-${index}`, title: slide.text || 'Kegiatan belajar LPQ',
        description: slide.author || '', image: imageOf(slide), slideIndex: index,
      })),
      ...[...safeArray(content.galleryPhotos), ...safeArray(content.facilities)].map((item, index) => ({
        id: item.id || `support-${index}`, title: item.title || item.name || 'Suasana belajar',
        description: item.description || '', image: imageOf(item), slideIndex: null,
      })),
    ];
    const used = new Set();
    return items.filter((item) => {
      if (!item.image || used.has(item.image)) return false;
      used.add(item.image);
      return true;
    }).slice(0, 4);
  }, [content.heroSlides, content.facilities, content.galleryPhotos]);

  return (
    <>
      <BuildingTour>
        <p className="building-hero__eyebrow"><span aria-hidden="true" /> Lembaga Pendidikan Al-Qur’an</p>
        <h1 id="home-hero-title" className="building-hero__title">Belajar Al-Qur’an<br /><span>terasa lebih hidup.</span></h1>
        <p className="building-hero__lead">{heroText}</p>
        <p className="building-hero__support">{heroSubtext}</p>
        <div className="home-hero__actions">
          <Button asChild size="lg" className="home-primary-cta"><Link to="/pendaftaran/informasi">Informasi Pendaftaran <ArrowRight className="ml-2 h-5 w-5" /></Link></Button>
          <Button asChild size="lg" variant="outline" className="home-secondary-cta"><Link to="/profil">Kenali LPQ</Link></Button>
        </div>
        <div className="home-hero__stats" aria-label="Ringkasan lembaga">
          <span className="home-hero-stat"><strong><CountUp from={0} to={Number(stats.santri || 0)} separator="." duration={2.6} /></strong>santri aktif</span>
          <span className="home-hero-stat"><strong><CountUp from={0} to={Number(stats.guru || 0)} separator="." duration={2.4} /></strong>guru aktif</span>
          <span className="home-hero-stat"><strong><CountUp from={0} to={sessionCount} separator="." duration={2.2} /></strong>sesi belajar</span>
        </div>
        {slides.length > 1 && <div className="building-hero__story-picker" aria-label="Pilih cerita utama">
          {slides.map((slide, index) => <button key={slide.id || index} type="button" aria-label={`Tampilkan cerita ${index + 1}`} aria-pressed={currentSlide === index} onClick={() => setCurrentSlide(index)}><span /></button>)}
        </div>}
      </BuildingTour>
      <section id="home-stories" className="home-stories" aria-label="Dokumentasi kegiatan LPQ">
        {heroCards.length > 0 && <>
          <div className="home-stories__intro"><span>DARI KESEHARIAN KAMI</span><h2>Ruang untuk tumbuh bersama.</h2><Link to="/profil/galeri">Lihat galeri <ArrowRight size={16} /></Link></div>
          <div className="home-stories__rail">{heroCards.map((card) => {
            const body = <><img src={card.image} alt={card.title} loading="lazy" width="400" height="260" onError={(event) => {
              if (event.currentTarget.dataset.fallback) return;
              event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = logoUrl;
            }} /><div><h3>{card.title}</h3>{card.description && <p>{card.description}</p>}</div></>;
            return typeof card.slideIndex === 'number'
              ? <button key={card.id} className="home-story" type="button" onClick={() => setCurrentSlide(card.slideIndex)} aria-label={`Pilih cerita: ${card.title}`}>{body}</button>
              : <article key={card.id} className="home-story">{body}</article>;
          })}</div>
        </>}
      </section>
    </>
  );
};

export default HeroSection;
