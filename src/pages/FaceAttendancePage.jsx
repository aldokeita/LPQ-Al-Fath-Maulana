import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
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
export default function FaceAttendancePage() {
  const { isDark, toggleTheme } = useTheme();
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
      return { success:true, message:result.created ? 'Absensi tersimpan. Silakan bergantian dengan santri berikutnya.' : 'Sudah absen. Record pertama tetap dipertahankan.' };
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
      <button type="button" className="attendance-header__icon-btn" onClick={toggleTheme} aria-label={isDark ? 'Mode terang' : 'Mode gelap'}>{isDark ? <Sun /> : <Moon />}</button>
    </header>
    <main className="face-page__main">
      <div className="face-page__intro"><h1>Absensi Wajah</h1><p>Satu wajah. Ikuti panduan kamera, lalu tunggu kehadiran dikonfirmasi.</p></div>
      {facePilotEnabled ? <FaceCameraCapture onCapture={capture} /> : <p role="status">Halaman ini memerlukan backend pilot terpisah. Kartu RFID tetap dapat digunakan.</p>}
      {notice && <p className="face-page__notice" role="status">{notice}</p>}
      <div className="face-page__result" aria-live="polite">{card ? <MotionConfig reducedMotion="user"><AttendanceProfileCard {...card} showSuccessBadge /></MotionConfig> : <p className="face-page__result-hint">Profile Card tampil setelah kehadiran tersimpan.</p>}</div>
    </main>
  </div>;
}
