import React, { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Box, Loader2 } from 'lucide-react';
import { TOUR_STAGES, scrollProgress, stageAt, validateTour } from './buildingTourMath';
import '@/styles/building-tour.css';

const TourCanvas = React.lazy(() => import('./BuildingTourCanvas'));

class TourBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { this.props.onFailure(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

const mediaMatches = (query) => typeof window !== 'undefined' && window.matchMedia(query).matches;

export default function BuildingTour({ children }) {
  const sectionRef = useRef(null);
  const progressRef = useRef(0);
  const invalidateRef = useRef(null);
  const [mobile, setMobile] = useState(() => !mediaMatches('(min-width: 768px)'));
  const [reduced, setReduced] = useState(() => mediaMatches('(prefers-reduced-motion: reduce)'));
  const [requested, setRequested] = useState(false);
  const [tour, setTour] = useState(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback((reason) => {
    console.warn('[BuildingTour] Gambar cadangan digunakan:', reason);
    setFailed(true); setReady(false);
  }, []);
  const playing = ready && !failed && !reduced;

  useEffect(() => {
    const width = window.matchMedia('(min-width: 768px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changeWidth = () => setMobile(!width.matches);
    const changeMotion = () => setReduced(motion.matches);
    width.addEventListener('change', changeWidth);
    motion.addEventListener('change', changeMotion);
    return () => {
      width.removeEventListener('change', changeWidth);
      motion.removeEventListener('change', changeMotion);
    };
  }, []);

  useEffect(() => {
    if (mobile || reduced || navigator.connection?.saveData) return undefined;
    const timer = window.setTimeout(() => setRequested(true), 400);
    return () => window.clearTimeout(timer);
  }, [mobile, reduced]);

  useEffect(() => {
    if (!requested || reduced) return undefined;
    const controller = new AbortController();
    setFailed(false);
    fetch('/models/lpq-building-tour.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Tur tidak dapat dimuat.');
        return response.json();
      })
      .then(validateTour)
      .then(setTour)
      .catch((error) => { if (error.name !== 'AbortError') onFailure(error); });
    return () => controller.abort();
  }, [requested, reduced, attempt, onFailure]);

  useEffect(() => {
    if (!playing || mobile) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = sectionRef.current.getBoundingClientRect();
      const value = scrollProgress(rect.top, rect.height, window.innerHeight);
      progressRef.current = value;
      setActive(stageAt(value));
      invalidateRef.current?.();
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [playing, mobile]);

  const selectStage = (index) => {
    setActive(index);
    if (playing && !mobile) {
      const rect = sectionRef.current.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top + TOUR_STAGES[index].progress * (rect.height - window.innerHeight), behavior: 'smooth' });
    } else {
      progressRef.current = TOUR_STAGES[index].progress;
      invalidateRef.current?.();
    }
  };

  const start = () => {
    setFailed(false);
    setRequested(true);
    setAttempt((value) => value + 1);
  };
  const loading = requested && !ready && !failed && !reduced;

  useEffect(() => {
    if (!loading) return undefined;
    const timeout = window.setTimeout(() => onFailure('Pemuatan melebihi 25 detik'), 25000);
    return () => window.clearTimeout(timeout);
  }, [loading, onFailure, attempt]);

  return (
    <section ref={sectionRef} className={`home-hero building-hero ${playing && !mobile ? 'building-hero--scroll' : ''}`} aria-labelledby="home-hero-title">
      <div className="building-hero__sticky">
        <div className="building-hero__copy">{children}</div>
        <div className="building-tour" aria-label="Jelajah konsep bangunan LPQ">
          <div className="building-tour__heading">
            <span>AL-FATH MAULANA <i aria-hidden="true">/</i> BATURAJA</span>
            <span className="building-tour__dimension">RUANG BELAJAR · 3D</span>
          </div>
          <div className="building-tour__viewport" data-tour-ready={playing ? 'true' : 'false'}>
            <img
              className={`building-tour__poster ${playing ? 'is-hidden' : ''}`}
              src={`/models/lpq-building-${TOUR_STAGES[active].id}.webp`}
              alt={`Visualisasi konseptual LPQ Al-Fath Maulana: ${TOUR_STAGES[active].label.toLowerCase()}.`}
              width="1500" height="950" loading="eager"
            />
            {requested && tour && !failed && !reduced && (
              <div className={`building-tour__canvas ${ready ? 'is-ready' : ''}`} aria-hidden="true">
                <TourBoundary key={attempt} onFailure={onFailure}>
                  <Suspense fallback={null}>
                    <TourCanvas tour={tour} progressRef={progressRef} invalidateRef={invalidateRef} onReady={onReady} onFailure={onFailure} attempt={attempt} mobile={mobile} />
                  </Suspense>
                </TourBoundary>
              </div>
            )}
            {!playing && !reduced && (
              <button type="button" className="building-tour__start" onClick={start} disabled={loading}>
                {loading ? <Loader2 size={17} className="building-tour__spinner" /> : <Box size={17} />}
                {loading ? 'Menyiapkan tur…' : failed ? 'Coba tur 3D lagi' : 'Jelajahi gedung 3D'}
                {!loading && <ArrowUpRight size={16} />}
              </button>
            )}
            {failed && <p className="building-tour__status" role="status">Tur belum dapat dibuka. Kamu tetap bisa melihat setiap ruang melalui gambar.</p>}
          </div>
          <div className="building-tour__caption">
            <div><span className="building-tour__number">0{active + 1}</span><h2>{TOUR_STAGES[active].label}</h2></div>
            <span className="building-tour__hint">{playing && !mobile ? <><ArrowDown size={15} /> Gulir untuk menjelajah</> : 'Pilih sudut pandang'}</span>
          </div>
          <div className="building-tour__steps" aria-label="Sudut pandang gedung">
            {TOUR_STAGES.map((stage, index) => (
              <button key={stage.id} type="button" aria-label={`Lihat ${stage.label.toLowerCase()}`} aria-pressed={active === index} onClick={() => selectStage(index)}>
                <span aria-hidden="true">0{index + 1}</span><span>{stage.label}</span>
              </button>
            ))}
          </div>
          <p className="building-tour__note">Visualisasi 3D konseptual. Ukuran dan interior merupakan perkiraan dari referensi.</p>
          {playing && !mobile && <button type="button" className="building-tour__skip" onClick={() => document.getElementById('home-stories')?.scrollIntoView({ behavior: 'instant' })}>Lewati tur <ArrowDown size={14} /></button>}
        </div>
      </div>
    </section>
  );
}
