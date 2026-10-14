import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Sun, Moon, ScanFace, Fingerprint, ShieldCheck, ThumbsUp, Zap } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/customSupabaseClient';
import { faceAttendanceRequest, facePilotEnabled } from '@/lib/faceAttendanceApi';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import { resolveSantriLevel } from '@/lib/santriLevel';
import { getSantriAttendanceSuccessMessage } from '@/lib/attendanceAdapters';
import { getSantriMonthlyAttendanceStats, getSantriLearningHighlights } from '@/lib/attendanceProfileData';
import FaceCameraCapture from '@/components/dashboard/shared/FaceCameraCapture';
import AttendanceProfileCard from '@/components/dashboard/shared/AttendanceProfileCard';
import '@/styles/admin-dashboard.css';
import '@/styles/face-attendance.css';

const rejectionMessages = {
  unknown: 'Wajah belum dikenali. Gunakan RFID atau minta admin memeriksa registrasi.',
  ambiguous: 'Hasil pengenalan meragukan. Tidak ada absensi yang dicatat. Gunakan RFID.',
  calibration_required: 'Kalibrasi pilot belum disahkan admin. Tidak ada absensi yang dicatat.',
};
const MODE_STORAGE_KEY = 'lpq-face-kiosk-mode';
const kioskModes = [
  { value:'gesture', label:'Jempol 👍', hint:'Banyak wajah, absen setelah acungkan jempol', Icon:ThumbsUp },
  { value:'passive', label:'Otomatis', hint:'Satu wajah, langsung tercatat', Icon:Zap },
];
// Per-device kiosk preference; storage may be unavailable (private mode), so fall back silently.
const readMode = () => { try { return localStorage.getItem(MODE_STORAGE_KEY) === 'passive' ? 'passive' : 'gesture'; } catch { return 'gesture'; } };

export default function FaceAttendancePage() {
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState(readMode);
  const chooseMode = value => { setMode(value); try { localStorage.setItem(MODE_STORAGE_KEY, value); } catch { /* preference only */ } };
  const [card, setCard] = useState(null); const [notice, setNotice] = useState('');
  const timer = useRef(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); }; }, []);
  async function capture(payload) {
    clearTimeout(timer.current); setCard(null); setNotice('');
    const result = await faceAttendanceRequest({ action: 'recognize', ...payload });
    if (!['saved','already_recorded'].includes(result.state)) return { success: false, message: rejectionMessages[result.state] || result.message || 'Absensi belum dicatat.' };
    try {
      const { data: student, error } = await supabase.from('santri')
        .select('id,nama_lengkap,jilid,jenis_kelamin,kategori,avatar_path,foto_url,class:current_class_id(nama_kelas)').eq('id',result.santriId).single();
      if (error) throw error;
      const [photo, monthlyStats, highlights, config] = await Promise.all([
        student.avatar_path || student.foto_url
          ? resolveAvatarUrl({ ownerType:'santri', ownerId:student.id, avatarPath:student.avatar_path, fallbackUrl:student.foto_url })
          : Promise.resolve(''),
        getSantriMonthlyAttendanceStats(student.id), getSantriLearningHighlights(student.id),
        supabase.from('website_content').select('content').eq('key','level_config').maybeSingle(),
      ]);
      const level = resolveSantriLevel({ points:result.points, gender:student.jenis_kelamin, config:config.data?.content });
      if (alive.current) {
        setCard({ name:student.nama_lengkap, photo, jilid:student.jilid, points:result.points, pointsAward:result.pointsAward,
          kelas:student.class?.nama_kelas, sesi:result.attendance.sesi, time:result.attendance.check_in_time, status:result.attendance.status,
          levelInfo:{ ...level, label:level.name, color:level.accentColor || level.color }, monthlyStats, ...highlights,
          message:result.created ? getSantriAttendanceSuccessMessage({ assignedSession:result.attendance.sesi, attendedSession:result.attendance.attended_session }) : 'Absensi sudah tercatat.' });
        timer.current = setTimeout(() => { if (alive.current) setCard(null); },5000);
      }
      return { success:true, name:student.nama_lengkap,
        message:result.created ? `Absensi ${student.nama_lengkap} tersimpan. Silakan bergantian dengan santri berikutnya.` : `${student.nama_lengkap} sudah absen. Record pertama tetap dipertahankan.` };
    } catch {
      if (alive.current) setNotice('Absensi telah tersimpan, tetapi Profile Card belum dapat dimuat. Jangan mengulang untuk menambah poin.');
      return { success:true, message:'Kehadiran sudah tersimpan; informasi profil belum dapat dimuat.' };
    }
  }
  return <div className="attendance-page face-page">
    <Helmet><title>Absensi Wajah - LPQ Al-Fath Maulana</title></Helmet>
    <div className="attendance-page__bg" aria-hidden="true" />
    <header className="face-page__header">
      <Link className="attendance-header__back" to="/absensi-digital"><ArrowLeft aria-hidden="true" /> Absensi Digital</Link>
      <button type="button" className="attendance-header__icon-btn face-page__theme" onClick={toggleTheme} aria-label={isDark ? 'Mode terang' : 'Mode gelap'}>{isDark ? <Sun /> : <Moon />}</button>
    </header>
    <main className="face-page__main">
      <div className="face-page__intro">
        <p className="face-page__eyebrow"><ShieldCheck aria-hidden="true" /> Pilot terawasi</p>
        <h1>Absensi Wajah</h1>
        <p>{mode === 'gesture' ? 'Hadapkan wajah ke kamera lalu acungkan jempol 👍. Beberapa santri bisa terdeteksi bersamaan.'
          : 'Hadapkan wajah ke kamera. Kehadiran dikenali dan dicatat otomatis, satu santri setiap kali.'}</p>
      </div>
      <div className="face-page__stage">
        {facePilotEnabled ? <div className="face-page__camera-column">
          <div className="face-page__modes" role="radiogroup" aria-label="Mode absensi wajah">
            {kioskModes.map(({ value, label, hint, Icon }) => <button key={value} type="button" role="radio" aria-checked={mode === value}
              className={`face-page__mode ${mode === value ? 'is-active' : ''}`} onClick={() => chooseMode(value)}>
              <Icon aria-hidden="true" /><span><strong>{label}</strong><small>{hint}</small></span>
            </button>)}
          </div>
          {/* Remounting on mode change stops the running camera loop cleanly. */}
          <FaceCameraCapture key={mode} mode={mode} onCapture={capture} />
        </div> : <section className="face-page__panel face-page__disabled" aria-labelledby="face-disabled-title">
          <Fingerprint aria-hidden="true" />
          <h2 id="face-disabled-title">Mode pilot belum aktif</h2>
          <p role="status">Halaman ini memerlukan backend pilot terpisah. Kartu RFID tetap dapat digunakan.</p>
          <Link className="face-page__link" to="/absensi-digital">Kembali ke absensi RFID</Link>
        </section>}
        <aside className="face-page__aside" aria-label="Hasil absensi">
          {notice && <p className="face-page__notice" role="status">{notice}</p>}
          <div className="face-page__result" aria-live="polite">{card ? <MotionConfig reducedMotion="user"><AttendanceProfileCard {...card} showSuccessBadge /></MotionConfig>
            : <div className="face-page__panel face-page__empty">
              <span className="face-page__empty-icon" aria-hidden="true"><ScanFace /></span>
              <p className="face-page__result-hint">Profile Card tampil setelah kehadiran tersimpan.</p>
              <ol className="face-page__steps">
                <li><span>Petugas menekan <strong>Mulai kamera</strong> sekali, lalu kamera tetap aktif.</span></li>
                <li><span>{mode === 'gesture' ? 'Santri menghadap kamera lalu mengacungkan jempol 👍 sampai label berubah.' : 'Santri menghadap lurus ke kamera sekitar satu detik.'}</span></li>
                <li><span>Setelah Profile Card tampil, santri bergeser untuk santri berikutnya.</span></li>
              </ol>
            </div>}
          </div>
        </aside>
      </div>
    </main>
  </div>;
}
