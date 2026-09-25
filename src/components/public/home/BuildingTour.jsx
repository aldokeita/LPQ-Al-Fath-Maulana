import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Film, Loader2 } from 'lucide-react';
import { BUILDING_ASSET_REVISION, TOUR_STAGES, scrollProgress, stageAt, videoTimeAt } from './buildingTourMath';
import '@/styles/building-tour.css';

const VIDEO_URL = '/models/lpq-building-tour-1080p.mp4?v=1';
const VIDEO_POSTER = '/models/lpq-building-video-poster.webp?v=1';
const mediaMatches = (query) => typeof window !== 'undefined' && window.matchMedia(query).matches;

export default function BuildingTour({ children }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const wantedProgress = useRef(0);
  const [mobile, setMobile] = useState(() => !mediaMatches('(min-width: 768px)'));
  const [reduced, setReduced] = useState(() => mediaMatches('(prefers-reduced-motion: reduce)'));
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  const syncVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || video.seeking) return;
    const time = videoTimeAt(wantedProgress.current, video.duration);
    if (Math.abs(video.currentTime - time) > 0.04) video.currentTime = time;
  }, []);

  const onMobileTime = () => {
    const video = videoRef.current;
    if (!mobile || !video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const progress = video.currentTime / video.duration;
    wantedProgress.current = progress;
    setActive((previous) => {
      const next = stageAt(progress);
      return previous === next ? previous : next;
    });
  };

  useEffect(() => {
    const width = window.matchMedia('(min-width: 768px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onWidth = () => setMobile(!width.matches);
    const onMotion = () => setReduced(motion.matches);
    width.addEventListener('change', onWidth);
    motion.addEventListener('change', onMotion);
    return () => {
      width.removeEventListener('change', onWidth);
      motion.removeEventListener('change', onMotion);
    };
  }, []);

  useEffect(() => {
    if (mobile || reduced || navigator.connection?.saveData) return undefined;
    const timer = window.setTimeout(() => setRequested(true), 400);
    return () => window.clearTimeout(timer);
  }, [mobile, reduced]);

  const scrollEnabled = !mobile && !reduced && !failed && !navigator.connection?.saveData;
  const playing = ready && !failed && !reduced;

  useEffect(() => {
    if (!playing || mobile) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = sectionRef.current.getBoundingClientRect();
      const progress = scrollProgress(rect.top, rect.height, window.innerHeight);
      wantedProgress.current = progress;
      setActive((previous) => {
        const next = stageAt(progress);
        return previous === next ? previous : next;
      });
      syncVideo();
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
  }, [playing, mobile, syncVideo]);

  useEffect(() => {
    if (!requested || ready || failed || reduced) return undefined;
    const timeout = window.setTimeout(() => setFailed(true), 25000);
    return () => window.clearTimeout(timeout);
  }, [requested, ready, failed, reduced]);

  const selectStage = (index) => {
    const progress = TOUR_STAGES[index].progress;
    setActive(index);
    wantedProgress.current = progress;
    if (playing && !mobile && scrollEnabled) {
      const rect = sectionRef.current.getBoundingClientRect();
      window.scrollTo({
        top: window.scrollY + rect.top + progress * (rect.height - window.innerHeight),
        behavior: 'smooth',
      });
    } else if (playing) {
      videoRef.current?.pause();
      videoRef.current.currentTime = videoTimeAt(progress, videoRef.current.duration);
    }
  };

  const start = () => {
    setFailed(false);
    setReady(false);
    setRequested(true);
  };
  const loading = requested && !ready && !failed && !reduced;
  const staticPoster = reduced || failed || (navigator.connection?.saveData && !requested);

  return (
    <section ref={sectionRef} className={'home-hero building-hero' + (scrollEnabled ? ' building-hero--scroll' : '')} aria-labelledby="home-hero-title">
      <div className="building-hero__sticky">
        <div className="building-tour__viewport" data-tour-ready={playing ? 'true' : 'false'}>
          <img
            className={'building-tour__poster' + (playing ? ' is-hidden' : '')}
            src={staticPoster ? '/models/lpq-building-' + TOUR_STAGES[active].id + '.webp?v=' + BUILDING_ASSET_REVISION : VIDEO_POSTER}
            alt={'Visualisasi konseptual LPQ Al-Fath Maulana: ' + TOUR_STAGES[active].label.toLowerCase() + '.'}
            width="1920" height="1080" loading="eager"
          />
          {requested && !reduced && !failed && (
            <video
              ref={videoRef}
              className={'building-tour__video' + (ready ? ' is-ready' : '')}
              src={VIDEO_URL}
              poster={VIDEO_POSTER}
              preload="metadata"
              muted
              playsInline
              controls={mobile}
              aria-hidden={!mobile}
              aria-label={mobile ? 'Video tur bangunan LPQ Al-Fath Maulana' : undefined}
              onLoadedData={() => { setReady(true); syncVideo(); }}
              onSeeked={mobile ? onMobileTime : syncVideo}
              onTimeUpdate={mobile ? onMobileTime : undefined}
              onError={() => { setFailed(true); setReady(false); }}
            />
          )}
          {!playing && !reduced && (
            <button type="button" className="building-tour__start" onClick={start} disabled={loading}>
              {loading ? <Loader2 size={17} className="building-tour__spinner" /> : <Film size={17} />}
              {loading ? 'Menyiapkan video…' : failed ? 'Coba putar video lagi' : 'Jelajahi lewat video'}
              {!loading && <ArrowUpRight size={16} />}
            </button>
          )}
          {failed && <p className="building-tour__status" role="status">Video belum dapat dibuka. Setiap sudut tetap tersedia sebagai gambar.</p>}
        </div>
        <div className="building-hero__copy">{children}</div>
        <div className="building-tour" aria-label="Jelajah konsep bangunan LPQ">
          <div className="building-tour__heading">
            <span>AL-FATH MAULANA <i aria-hidden="true">/</i> BATURAJA</span>
            <span className="building-tour__dimension">TUR BANGUNAN · VIDEO</span>
          </div>
          <div className="building-tour__caption">
            <div><span className="building-tour__number">0{active + 1}</span><h2>{TOUR_STAGES[active].label}</h2></div>
            <span className="building-tour__hint">{playing && !mobile ? <><ArrowDown size={15} /> Gulir untuk menjelajah</> : 'Pilih sudut pandang'}</span>
          </div>
          <div className="building-tour__steps" aria-label="Sudut pandang gedung">
            {TOUR_STAGES.map((stage, index) => (
              <button key={stage.id} type="button" aria-label={'Lihat ' + stage.label.toLowerCase()} aria-pressed={active === index} onClick={() => selectStage(index)}>
                <span aria-hidden="true">0{index + 1}</span><span>{stage.label}</span>
              </button>
            ))}
          </div>
          <p className="building-tour__note">Visualisasi 3D konseptual. Ukuran dan interior merupakan perkiraan dari referensi.</p>
          {scrollEnabled && <button type="button" className="building-tour__skip" onClick={() => document.getElementById('home-stories')?.scrollIntoView({ behavior: 'instant' })}>Lewati tur <ArrowDown size={14} /></button>}
        </div>
      </div>
    </section>
  );
}
