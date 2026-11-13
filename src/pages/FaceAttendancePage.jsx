import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Sun, Moon, ScanFace, Fingerprint, ThumbsUp, Zap } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/customSupabaseClient';
import { faceAttendanceRequest, facePilotEnabled } from '@/lib/faceAttendanceApi';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import { resolveSantriLevel } from '@/lib/santriLevel';
import { getSantriAttendanceSuccessMessage } from '@/lib/attendanceAdapters';
import { getSantriMonthlyAttendanceStats, getSantriLearningHighlights } from '@/lib/attendanceProfileData';
import { guruScanCardProps, runGuruAttendanceScan } from '@/lib/guruAttendanceScan';
import { useAttendanceSessionConfiguration } from '@/hooks/useAttendanceSessionConfiguration';
import { parseDetectorSize, saveBackendPreference } from '@/lib/faceCameraEngine';
import { createPerfMeter, noopPerf } from '@/lib/kioskPerf';
import FaceCameraCapture from '@/components/dashboard/shared/FaceCameraCapture';
import AttendanceProfileCard from '@/components/dashboard/shared/AttendanceProfileCard';
import KioskPerfPanel from '@/components/dashboard/shared/KioskPerfPanel';
import '@/styles/admin-dashboard.css';
import '@/styles/face-attendance.css';

const rejectionMessages = {
  unknown: 'Wajah belum dikenali. Gunakan RFID atau minta admin memeriksa registrasi.',
  ambiguous: 'Hasil pengenalan meragukan. Tidak ada absensi yang dicatat. Gunakan RFID.',
  calibration_required: 'Kalibrasi pilot belum disahkan admin. Tidak ada absensi yang dicatat.',
};
const MODE_STORAGE_KEY = 'lpq-face-kiosk-mode';
const kioskModes = [
  { value:'gesture', label:'Gesture', hint:'Banyak wajah, konfirmasi 👍', Icon:ThumbsUp },
  { value:'passive', label:'Otomatis', hint:'Satu wajah, langsung tercatat', Icon:Zap },
];
// Stacked check-ins: the newest card is full size, older ones shrink below it instead of vanishing.
const CARD_LIFETIME_MS = 12000;
const MAX_CARDS = 3;
const depthStyle = depth => ({ opacity: depth === 0 ? 1 : depth === 1 ? 0.9 : 0.75, y: 0, scale: 1 });
// ?debug-kinerja shows a timing panel; ?ukuran-deteksi=320 tries a smaller detector size on site.
// ?backend=wasm|webgl|auto is remembered on this device (the kiosk PC), before the camera loads the models.
const kioskParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
if (kioskParams.has('backend')) saveBackendPreference(kioskParams.get('backend'));
const perfMeter = kioskParams.has('debug-kinerja') ? createPerfMeter() : noopPerf;
const detectorSize = parseDetectorSize(kioskParams.get('ukuran-deteksi'));
const loadLevelConfig = () => supabase.from('website_content').select('content').eq('key','level_config').maybeSingle()
  .then(({ data, error }) => { if (error) throw error; return data?.content; });
// Per-device kiosk preference; storage may be unavailable (private mode), so fall back silently.
const readMode = () => { try { return localStorage.getItem(MODE_STORAGE_KEY) === 'passive' ? 'passive' : 'gesture'; } catch { return 'gesture'; } };

export default function FaceAttendancePage() {
  const { isDark, toggleTheme } = useTheme();
  const { sessionTimes } = useAttendanceSessionConfiguration();
  const [mode, setMode] = useState(readMode);
  const chooseMode = value => { setMode(value); try { localStorage.setItem(MODE_STORAGE_KEY, value); } catch { /* preference only */ } };
  const [cards, setCards] = useState([]); const [notice, setNotice] = useState('');
  const alive = useRef(true); const nextCard = useRef(1); const guruBusy = useRef(new Set());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Level thresholds rarely change, so they load once per page instead of once per check-in.
  const levelConfig = useRef(null);
  const getLevelConfig = () => {
    if (!levelConfig.current) levelConfig.current = loadLevelConfig().catch(() => { levelConfig.current = null; return undefined; });
    return levelConfig.current;
  };
  useEffect(() => { getLevelConfig(); }, []);
  // Expire cards one by one; a new check-in never clears the others.
  useEffect(() => {
    if (!cards.length) return undefined;
    const soonest = Math.min(...cards.map(entry => entry.expiresAt));
    const timer = setTimeout(() => setCards(current => current.filter(entry => entry.expiresAt > Date.now())), Math.max(0, soonest - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [cards]);
  const pushCard = (santriId, props) => setCards(current => [
    { id:nextCard.current++, santriId, props, expiresAt:Date.now() + CARD_LIFETIME_MS },
    ...current.filter(entry => entry.santriId !== santriId),
  ].slice(0, MAX_CARDS));
  // A recognised guru runs the same flow as an RFID tap (session, MMQ, info card, Pentashih).
  async function captureGuru(guruId, began) {
    // The same face appears on many frames; keep one check-in per guru in flight.
    if (guruBusy.current.has(guruId)) return { success:true, message:'Absensi guru ini sedang diproses.' };
    guruBusy.current.add(guruId);
    try {
      const { data: guruData, error } = await supabase.from('guru').select('*').eq('id', guruId).maybeSingle();
      if (error || !guruData) return { success:false, message:'Data guru belum dapat dimuat. Gunakan kartu RFID.' };
      const scan = await runGuruAttendanceScan({ guruData, tag:guruData.rfid_tag, sessionTimes, source:'face' });
      const card = guruScanCardProps(scan);
      if (card && alive.current) { pushCard(`guru:${guruId}`, card); perfMeter.record('kartu pertama', performance.now() - began); }
      if (scan.type === 'confirmation') return { success:true, name:scan.name, message:`${scan.name} sudah tercatat hadir MMQ hari ini.` };
      if (!card) return { success:false, name:scan.name, message:scan.message || 'Absensi guru belum dapat dicatat.' };
      return { success:true, name:scan.name, message:scan.message || `Selamat datang, ${scan.name}.` };
    } finally { guruBusy.current.delete(guruId); }
  }
  const updateCard = (santriId, patch) => setCards(current => current.map(entry => (entry.santriId === santriId ? { ...entry, props:{ ...entry.props, ...patch } } : entry)));
  // Photo, monthly stats and hafalan arrive after the card is already on screen.
  async function completeCard(student, began) {
    try {
      const [photo, monthlyStats, highlights] = await Promise.all([
        student.avatar_path || student.foto_url
          ? resolveAvatarUrl({ ownerType:'santri', ownerId:student.id, avatarPath:student.avatar_path, fallbackUrl:student.foto_url })
          : Promise.resolve(''),
        getSantriMonthlyAttendanceStats(student.id), getSantriLearningHighlights(student.id),
      ]);
      if (!alive.current) return;
      updateCard(student.id, { photo, monthlyStats, ...highlights });
      perfMeter.record('kartu lengkap', performance.now() - began);
    } catch (error) { console.warn('[face-kiosk] profile details unavailable:', error); }
  }
  async function capture(payload) {
    setNotice('');
    const began = performance.now();
    const result = await faceAttendanceRequest({ action: 'recognize', ...payload });
    perfMeter.record('recognize', performance.now() - began);
    if (result.state === 'guru_matched') return captureGuru(result.guruId, began);
    if (!['saved','already_recorded'].includes(result.state)) return { success: false, message: rejectionMessages[result.state] || result.message || 'Absensi belum dicatat.' };
    try {
      const [{ data: student, error }, config] = await Promise.all([
        supabase.from('santri').select('id,nama_lengkap,jilid,jenis_kelamin,kategori,avatar_path,foto_url,class:current_class_id(nama_kelas)').eq('id',result.santriId).single(),
        getLevelConfig(),
      ]);
      if (error) throw error;
      const level = resolveSantriLevel({ points:result.points, gender:student.jenis_kelamin, config });
      if (alive.current) {
        pushCard(student.id, { name:student.nama_lengkap, photo:'', jilid:student.jilid, points:result.points, pointsAward:result.pointsAward,
          kelas:student.class?.nama_kelas, sesi:result.attendance.sesi, time:result.attendance.check_in_time, status:result.attendance.status,
          levelInfo:{ ...level, label:level.name, color:level.accentColor || level.color },
          message:result.created ? getSantriAttendanceSuccessMessage({ assignedSession:result.attendance.sesi, attendedSession:result.attendance.attended_session }) : 'Absensi sudah tercatat.' });
        perfMeter.record('kartu pertama', performance.now() - began);
        completeCard(student, began);
      }
      return { success:true, name:student.nama_lengkap,
        message:result.created ? `Absensi ${student.nama_lengkap} tersimpan. Silakan bergantian dengan santri berikutnya.` : `${student.nama_lengkap} sudah absen. Record pertama tetap dipertahankan.` };
    } catch {
      if (alive.current) setNotice('Absensi telah tersimpan, tetapi Profile Card belum dapat dimuat. Jangan mengulang untuk menambah poin.');
      return { success:true, message:'Kehadiran sudah tersimpan; informasi profil belum dapat dimuat.' };
    }
  }
  const latest = cards[0];
  return <div className="attendance-page face-page">
    <Helmet><title>Absensi Wajah - LPQ Al-Fath Maulana</title></Helmet>
    <div className="attendance-page__bg" aria-hidden="true" />
    <header className="face-page__header">
      <Link className="attendance-header__back face-page__back" to="/absensi-digital" aria-label="Kembali ke Absensi Digital"><ArrowLeft aria-hidden="true" /><span>Absensi Digital</span></Link>
      <h1 className="face-page__title">Absensi Wajah</h1>
      {facePilotEnabled && <div className="face-page__modes" role="radiogroup" aria-label="Mode absensi wajah">
        {kioskModes.map(({ value, label, hint, Icon }) => <button key={value} type="button" role="radio" aria-checked={mode === value}
          title={hint} className={`face-page__mode ${mode === value ? 'is-active' : ''}`} onClick={() => chooseMode(value)}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </button>)}
      </div>}
      <button type="button" className="attendance-header__icon-btn face-page__theme" onClick={toggleTheme} aria-label={isDark ? 'Mode terang' : 'Mode gelap'}>{isDark ? <Sun /> : <Moon />}</button>
    </header>
    <main className="face-page__main">
      <div className="face-page__stage">
        {facePilotEnabled
          // Remounting on mode change stops the running camera loop cleanly.
          ? <FaceCameraCapture key={mode} mode={mode} alwaysOn detectorSize={detectorSize} perf={perfMeter} onCapture={capture} />
          : <section className="face-page__panel face-page__disabled" aria-labelledby="face-disabled-title">
            <Fingerprint aria-hidden="true" />
            <h2 id="face-disabled-title">Mode pilot belum aktif</h2>
            <p role="status">Halaman ini memerlukan backend pilot terpisah. Kartu RFID tetap dapat digunakan.</p>
            <Link className="face-page__link" to="/absensi-digital">Kembali ke absensi RFID</Link>
          </section>}
        <section className="face-page__results" aria-label="Hasil absensi">
          {perfMeter.enabled && facePilotEnabled && <KioskPerfPanel meter={perfMeter} />}
          {notice &&<p className="face-page__notice" role="status">{notice}</p>}
          <p className="sr-only" aria-live="polite">{latest ? `${latest.props.name}${latest.props.status ? ' hadir.' : '.'} ${latest.props.message || ''}` : ''}</p>
          {cards.length ? <MotionConfig reducedMotion="user"><div className="face-page__stack">
            <AnimatePresence initial={false}>
              {cards.map((entry, depth) => <motion.div key={entry.id} layout className={`face-page__stack-item is-depth-${depth}`}
                initial={{ opacity:0, y:-28, scale:0.96 }} animate={depthStyle(depth)} exit={{ opacity:0, scale:0.9, transition:{ duration:0.25 } }}
                transition={{ type:'spring', stiffness:260, damping:30 }}>
                <AttendanceProfileCard {...entry.props} showSuccessBadge={depth === 0 && entry.props.showSuccessBadge !== false} />
              </motion.div>)}
            </AnimatePresence>
          </div></MotionConfig>
            : <div className="face-page__empty" role="status">
              <span className="face-page__empty-icon" aria-hidden="true"><ScanFace /></span>
              <p>Profile Card tampil di sini setelah absen.</p>
            </div>}
        </section>
      </div>
    </main>
  </div>;
}
