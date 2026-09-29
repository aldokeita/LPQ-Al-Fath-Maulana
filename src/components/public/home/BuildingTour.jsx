import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Film, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { BUILDING_ASSET_REVISION, TOUR_STAGES, scrollProgress, stageAt, videoTimeAt } from './buildingTourMath';
import '@/styles/building-tour.css';

const MORNING_ASSET_REVISION = 2;
const TOUR_MEDIA = {
  morning: {
    video: `/models/lpq-building-tour-pagi-1080p.mp4?v=${MORNING_ASSET_REVISION}`,
    mobileVideo: `/models/lpq-building-tour-pagi-720p.mp4?v=${MORNING_ASSET_REVISION}`,
    poster: `/models/lpq-building-pagi-exterior.webp?v=${MORNING_ASSET_REVISION}`,
    stagePoster: (id) => `/models/lpq-building-pagi-${id}.webp?v=${MORNING_ASSET_REVISION}`,
    label: 'pagi',
  },
  night: {
    video: '/models/lpq-building-tour-1080p.mp4?v=1',
    poster: '/models/lpq-building-video-poster.webp?v=1',
    stagePoster: (id) => `/models/lpq-building-${id}.webp?v=${BUILDING_ASSET_REVISION}`,
    label: 'malam',
  },
};
const mediaMatches = (query) => typeof window !== 'undefined' && window.matchMedia(query).matches;

export default function BuildingTour({ children }) {
  const { isDark } = useTheme();
  const variant = isDark ? 'night' : 'morning';
  const media = TOUR_MEDIA[variant];
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const wantedProgress = useRef(0);
  const [mobile, setMobile] = useState(() => !mediaMatches('(min-width: 768px)'));
  const videoSource = mobile && media.mobileVideo ? media.mobileVideo : media.video;
  const [reduced, setReduced] = useState(() => mediaMatches('(prefers-reduced-motion: reduce)'));
  const [requested, setRequested] = useState(false);
  const [readyFor, setReadyFor] = useState(null);
  const [failedFor, setFailedFor] = useState(null);
  const [active, setActive] = useState(0);
  const ready = readyFor === videoSource;
  const failed = failedFor === videoSource;

  useLayoutEffect(() => {
    setReadyFor(null);
    setFailedFor(null);
  }, [videoSource]);

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
    const timeout = window.setTimeout(() => setFailedFor(videoSource), 25000);
    return () => window.clearTimeout(timeout);
  }, [requested, ready, failed, reduced, videoSource]);

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
    setFailedFor(null);
    setReadyFor(null);
    setRequested(true);
  };
  const loading = requested && !ready && !failed && !reduced;
  const staticPoster = reduced || failed || (!playing && active !== 0) || (navigator.connection?.saveData && !requested);

  return (
    <section ref={sectionRef} className={'home-hero building-hero building-hero--' + variant + (scrollEnabled ? ' building-hero--scroll' : '')} aria-labelledby="home-hero-title">
      <div className="building-hero__sticky">
        <div className="building-tour__viewport" data-tour-ready={playing ? 'true' : 'false'}>
          <img
            className={'building-tour__poster' + (playing ? ' is-hidden' : '')}
            src={staticPoster ? media.stagePoster(TOUR_STAGES[active].id) : media.poster}
            alt={'Visualisasi konseptual LPQ Al-Fath Maulana saat ' + media.label + ': ' + TOUR_STAGES[active].label.toLowerCase() + '.'}
            width="1920" height="1080" loading="eager"
          />
          {requested && !reduced && !failed && (
            <video
              key={videoSource}
              ref={videoRef}
              className={'building-tour__video' + (ready ? ' is-ready' : '')}
              src={videoSource}
              poster={media.poster}
              preload="metadata"
              muted
              playsInline
              controls={mobile}
              aria-hidden={!mobile}
              aria-label={mobile ? `Video tur bangunan LPQ Al-Fath Maulana saat ${media.label}` : undefined}
              onLoadedData={() => { setReadyFor(videoSource); syncVideo(); }}
              onSeeked={mobile ? onMobileTime : syncVideo}
              onTimeUpdate={mobile ? onMobileTime : undefined}
              onError={() => { setFailedFor(videoSource); setReadyFor(null); }}
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
            <span className="building-tour__dimension">TUR BANGUNAN · {isDark ? 'MALAM' : 'PAGI'}</span>
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
