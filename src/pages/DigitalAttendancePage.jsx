import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Fingerprint,
  Camera,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Activity,
  Sun,
  Moon,
  Tv,
  Gamepad2,
  Crown,
  Globe2,
  Book,
  Users,
  Briefcase,
  Star,
  ArrowRight,
  Dices,
  Trophy,
  Library,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import MediaPlayerWidget from '@/components/MediaPlayerWidget';
import {
  getJakartaTimeString,
  resolveSantriAttendanceSession,
} from '@/utils/AttendanceStatusLogic';
import { enableGameFeatures } from '@/lib/featureFlags';
import {
  buildSantriAttendancePayload,
  getAttendanceErrorMessage,
  getLocalDateString,
  getSantriAttendanceSuccessMessage,
  getSantriSession,
  isActiveSantri,
  isExplicitAbsentAttendance,
  normalizeRfidTag,
} from '@/lib/attendanceAdapters';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import AttendanceProfileCard from '@/components/dashboard/shared/AttendanceProfileCard';
import { useAttendanceSessionConfiguration } from '@/hooks/useAttendanceSessionConfiguration';
import { resolveSantriLevel } from '@/lib/santriLevel';
import { computeAttendancePointAward } from '@/lib/attendancePointRules';
import { facePilotEnabled, faceAttendanceRequest } from '@/lib/faceAttendanceApi';
import { adultQuotes, guruScanCardProps, runGuruAttendanceScan } from '@/lib/guruAttendanceScan';
import '@/styles/admin-dashboard.css';

// --- Data (unchanged) ---
const motivationalMessages = [
    "Semangat belajar mengajinya ya!",
    "Jadilah anak yang taat bagi kedua orang tua!",
    "Menuntut ilmu itu wajib bagi setiap muslim.",
    "Barang siapa menempuh jalan mencari ilmu, Allah mudahkan jalan ke surga.",
    "Hafalanmu adalah cahayamu.",
    "Teruslah berbuat baik kepada orang tua.",
    "Jangan lupa sholat 5 waktu ya!",
    "Ilmu adalah harta yang tidak akan habis.",
    "Hafalanmu hari ini adalah tabungan untuk surgamu nanti. Semangat!",
    "Jangan takut salah baca ya, Allah tetap akan catat usahamu kok.",
    "Lelahmu dalam belajar itu bernilai jihad lho. Keren!",
    "Anak sholeh/sholehah adalah harta terindah Ayah Bunda.",
    "Jadilah alasan Ayah dan Bunda tersenyum hari ini.",
    "Bersih itu ciri orang beriman. Sampahnya dibuang di tempatnya ya.",
    "Jujur itu hebat! Santri LPQ Al-Fath Maulana pantang berbohong.",
    "Siapa yang bersungguh-sungguh, pasti akan berhasil. Man Jadda Wajada!",
    "Hari ini pembelajar, besok jadi pemimpin. Aamiin!",
    "Absen diterima! Silakan masuk, pintu ilmu sudah terbuka.",
    "Terima kasih sudah hadir. Kehadiranmu sangat berarti buat kakak."
];

import { getSantriMonthlyAttendanceStats, getSantriLearningHighlights } from '@/lib/attendanceProfileData';

// --- Digital Clock Component ---
const DigitalClock = ({ showSeconds = true }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="attendance-clock">
      <div className="attendance-clock__time">
        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: showSeconds ? '2-digit' : undefined })}
      </div>
      <div className="attendance-clock__date">
        {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
};

// --- Main Component ---
const DigitalAttendancePage = () => {
  const { sessionTimes } = useAttendanceSessionConfiguration();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [rfidTag, setRfidTag] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [levelConfig, setLevelConfig] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
      const fetchConfig = async () => {
          const { data } = await supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle();
          if (data?.content) setLevelConfig(data.content);
      };
      fetchConfig();

      const levelConfigChannel = supabase
        .channel('digital-attendance-level-config')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'website_content', filter: 'key=eq.level_config' },
          (payload) => {
            if (payload.new?.content) setLevelConfig(payload.new.content);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(levelConfigChannel);
      };
  }, []);

  const getLevelInfo = (points = 0, gender) => {
      const defaultInfo = {
          label: 'Bronze I',
          color: '#b7793f',
          badgeIcon: <Book className="w-8 h-8 text-[#b7793f]" />,
          enableGradient: true,
          cardBgColor: '#ffffff',
          textColor: '#3b82f6',
          cardBorderThickness: 8,
          avatarBorderThickness: 4,
          textGradient: true,
          min: 0,
          max: 30,
      };

      const resolvedLevel = resolveSantriLevel({ points, gender, config: levelConfig });
      const accentColor = resolvedLevel.accentColor || defaultInfo.color;
      let icon = <Book className="w-8 h-8" style={{ color: accentColor }} />;
      const levelName = String(resolvedLevel.name || '').toLowerCase();
      if (levelName.includes('diamond') || levelName.includes('mythic') || levelName.includes('mahir') || levelName.includes('legend')) {
          icon = <Crown className="w-10 h-10" style={{ color: accentColor }} />;
      } else if (levelName.includes('gold') || levelName.includes('platinum') || levelName.includes('menengah') || levelName.includes('super')) {
          icon = <Globe2 className="w-10 h-10" style={{ color: accentColor }} />;
      }

      return {
          label: resolvedLevel.name || defaultInfo.label,
          color: accentColor,
          badgeIcon: icon,
          enableGradient: resolvedLevel.enableGradient,
          cardBgColor: resolvedLevel.cardBgColor,
          textColor: resolvedLevel.textColor,
          cardBorderThickness: resolvedLevel.cardBorderThickness,
          avatarBorderThickness: resolvedLevel.avatarBorderThickness,
          textGradient: resolvedLevel.textGradient,
          min: resolvedLevel.min,
          max: resolvedLevel.max,
      };
  };

  const forceFocus = () => { if (inputRef.current) { inputRef.current.focus(); } };

  useEffect(() => {
    forceFocus();
    const reFocusHandler = () => setTimeout(forceFocus, 100);
    window.addEventListener('click', reFocusHandler);
    return () => window.removeEventListener('click', reFocusHandler);
  }, [lastScan]);

  // --- processScan (ALL business logic preserved exactly) ---
  const processScan = async (tagToProcess) => {
      if (!tagToProcess || isLoading) return;
      const tag = normalizeRfidTag(tagToProcess);

      // Pentashih handling
      if (lastScan?.type === 'success' && lastScan.isPentashih && lastScan.rfid === tag) {
          setIsLoading(true);
          const { data: history } = await supabase.from('class_mutations').select(`*, santri(nama_lengkap, foto_url, jilid), from_class:from_class_id(nama_kelas, guru:id_guru(nama)), to_class:to_class_id(nama_kelas, guru:id_guru(nama))`).order('mutation_date', { ascending: false }).limit(6);
          setLastScan({ ...lastScan, type: 'pentashih_history', historyData: history || [] });
          setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); return;
      }

      // Guru Detail View handling
      if ((lastScan?.type === 'guru_info' || lastScan?.type === 'warning' || lastScan?.type === 'success') && lastScan.rfid === tag && lastScan.role === 'guru' && !lastScan.isPentashih) {
          if(!lastScan.classesData) {
             setIsLoading(true);
             const { data: guruData } = await supabase.from('guru').select('id').eq('rfid_tag', tag).single();
             if(guruData) {
                 const { data: classes } = await supabase.from('classes').select('*, santri(id, nama_lengkap, jilid, foto_url)').eq('id_guru', guruData.id).order('sesi');
                 setLastScan({ ...lastScan, type: 'guru_schedule_detail', classesData: classes || [] });
             }
             setIsLoading(false);
          } else { setLastScan({ ...lastScan, type: 'guru_schedule_detail' }); }
          setRfidTag(''); setTimeout(forceFocus, 50); return;
      }

      // Re-scan confirmation handling for normal attendance
      if (lastScan?.type === 'confirmation') {
        if (tag === lastScan.rfid) {
          setIsLoading(true);
          try {
            const now = new Date();
            const nowTime = getJakartaTimeString(now);
            const timestamp = now.toISOString();

            if (lastScan.isMMQ) {
                 const { error: updErr } = await supabase.from('mmq_attendance').update({ check_in_timestamp: timestamp }).eq('id', lastScan.attendanceId);
                 if (updErr) throw updErr;
                 setLastScan(prev => ({ ...prev, type: 'success', time: nowTime, message: 'Absensi MMQ diperbarui!', quote: lastScan.pendingQuote }));
            } else {
                const levelInfo = (lastScan.role === 'santri' && lastScan.kategori !== 'Dewasa') ? getLevelInfo(lastScan.points, lastScan.gender) : null;
                setLastScan(prev => ({ ...prev, type: 'success', levelInfo, message: 'Absensi sudah tercatat.', quote: lastScan.pendingQuote }));
            }
          } catch (err) { setLastScan({ type: 'error', message: err.message, name: 'Error' }); }
          finally { setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); return; }
        } else { setLastScan(null); setRfidTag(''); return; }
      }

      setIsLoading(true);
      setLastScan({ type: 'scanning' });

      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const todayDate = new Date();
        const todayStr = getLocalDateString(todayDate);

        const { data: guruData } = await supabase.from('guru').select('*').eq('rfid_tag', tag).maybeSingle();
        // Guru check-ins share one flow with the face kiosk: sessions, MMQ, info card and Pentashih.
        if (guruData) {
          setLastScan(await runGuruAttendanceScan({ guruData, tag, sessionTimes }));
          return;
        }

        let user = null, userRole = '', sesiUser = '', kategori = '';
        let { data: santriData } = await supabase
          .from('santri')
          .select('id, nama_lengkap, nama_panggilan, kategori, status, foto_url, avatar_path, rfid_tag, current_class_id, sesi_mengaji, jilid, points, jenis_kelamin, class:current_class_id(id, nama_kelas, sesi, id_guru, is_active)')
          .eq('rfid_tag', tag)
          .maybeSingle();
        if (santriData) {
            const foto_url = await resolveAvatarUrl({
                ownerType: 'santri',
                ownerId: santriData.id,
                avatarPath: santriData.avatar_path,
                fallbackUrl: santriData.foto_url,
            });
            santriData = { ...santriData, foto_url };
            if (!isActiveSantri(santriData.status)) {
                setLastScan({ type: 'warning', message: 'Santri nonaktif tidak dapat dicatat absensinya.', name: santriData.nama_lengkap, photo: santriData.foto_url });
                return;
            }
            user = santriData; userRole = 'santri'; kategori = santriData.kategori || 'Anak';
            sesiUser = getSantriSession(santriData);
        }

        if (!user) { setLastScan({ type: 'error', message: 'RFID tidak dikenal. Tidak ada absensi yang dibuat.', name: 'Tidak Dikenal' }); return; }

        if (facePilotEnabled) {
          try {
            const result = await faceAttendanceRequest({ action: 'rfid', rfidTag: tag, receiptId: crypto.randomUUID() });
            if (!['saved', 'already_recorded'].includes(result.state)) {
              setLastScan({ type: 'warning', message: result.message || 'Absensi belum dapat dicatat.' });
              return;
            }
            const [monthlyStats, learningHighlights] = await Promise.all([
              getSantriMonthlyAttendanceStats(user.id), getSantriLearningHighlights(user.id),
            ]);
            const adult = kategori === 'Dewasa';
            setLastScan({ type: 'success', role: 'santri', kategori,
              name: user.nama_lengkap, photo: user.foto_url, points: result.points, pointsAward: result.pointsAward,
              jilid: user.jilid, sesi: result.attendance.sesi, rfid: tag, gender: user.jenis_kelamin,
              time: result.attendance.check_in_time, status: result.attendance.status,
              levelInfo: adult ? null : getLevelInfo(result.points, user.jenis_kelamin), monthlyStats, ...learningHighlights,
              message: result.created ? getSantriAttendanceSuccessMessage({ assignedSession: result.attendance.sesi,
                attendedSession: result.attendance.attended_session }) : 'Absensi sudah tercatat.',
            });
          } catch (error) { setLastScan({ type: 'error', message: error.message }); }
          return;
        }

        const { data: existingAttendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('attendance_date', todayStr)
          .order('check_in_timestamp', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        const isAdult = kategori === 'Dewasa';
        const randomQuote = isAdult ? adultQuotes[Math.floor(Math.random() * adultQuotes.length)] : motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        const successData = { type: 'success', role: userRole, kategori, name: user.nama_lengkap, photo: user.foto_url, quote: randomQuote, points: user.points, jilid: user.jilid, rfid: tag, gender: user.jenis_kelamin, sesi: sesiUser };

        const shouldRestoreAbsentAttendance = existingAttendance && isExplicitAbsentAttendance(existingAttendance.status);

        if (existingAttendance && !shouldRestoreAbsentAttendance) {
          const levelInfo = (!isAdult) ? getLevelInfo(user.points, user.jenis_kelamin) : null;
          const [monthlyStats, learningHighlights] = await Promise.all([
              getSantriMonthlyAttendanceStats(user.id),
              getSantriLearningHighlights(user.id),
          ]);
          setLastScan({
             ...successData,
             message: 'Absensi sudah tercatat.',
             time: existingAttendance.check_in_time,
             status: existingAttendance.status,
             levelInfo,
             monthlyStats,
             ...learningHighlights
          });
          return;
        }

        const checkInStatus = resolveSantriAttendanceSession({
          timestamp: todayDate,
          dateStr: todayStr,
          assignedSession: sesiUser,
          sessionTimes,
        });
        if (!checkInStatus.can) {
          setLastScan({ type: 'warning', message: checkInStatus.message, name: user.nama_lengkap, photo: user.foto_url, role: userRole, rfid: tag });
          return;
        }

        const attendanceStatusText = checkInStatus.status || 'Hadir';
        const newAttendance = buildSantriAttendancePayload({
          santri: user,
          timestamp: todayDate,
          status: attendanceStatusText,
          attendedSession: checkInStatus.attendedSession,
        });
        const attendanceMutation = shouldRestoreAbsentAttendance
          ? supabase
              .from('attendance')
              .update({
                check_in_time: newAttendance.check_in_time,
                check_in_timestamp: newAttendance.check_in_timestamp,
                class_id: newAttendance.class_id,
                attended_session: newAttendance.attended_session,
                status: newAttendance.status,
                source: 'rfid',
              })
              .eq('id', existingAttendance.id)
          : supabase.from('attendance').insert(newAttendance);
        const { error: insertError } = await attendanceMutation;

        if (insertError) { setLastScan({ type: 'error', message: getAttendanceErrorMessage(insertError), name: user.nama_lengkap, photo: user.foto_url }); }
        else {
          let newPoints = Number(user.points) || 0;
          let pointsAward = 0;
          const award = computeAttendancePointAward({
            role: userRole,
            isAdult,
            status: attendanceStatusText,
            timestamp: todayDate,
            dateStr: todayStr,
            sesi: checkInStatus.attendedSession || sesiUser,
            sessionTimes,
          });
          if (award > 0) {
            const { data: updatedPoints, error: pointsError } = await supabase.rpc('increment_santri_points', { p_santri_id: user.id, p_amount: award });
            if (pointsError) {
              console.error('[Absensi] Gagal menambah poin santri:', pointsError.message);
            } else if (updatedPoints != null) {
              newPoints = Number(updatedPoints);
              pointsAward = award;
            }
          }
          const levelInfo = !isAdult ? getLevelInfo(newPoints, user.jenis_kelamin) : null;
          const [monthlyStats, learningHighlights] = await Promise.all([
            getSantriMonthlyAttendanceStats(user.id),
            getSantriLearningHighlights(user.id),
          ]);
          let adultStats = null;
          if (isAdult) {
              const { count: daysCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
              adultStats = { daysStudied: daysCount || 1, timesStudied: daysCount || 1 };
          }
          setLastScan({
            ...successData,
            message: getSantriAttendanceSuccessMessage({ assignedSession: sesiUser, attendedSession: newAttendance.attended_session }),
            time: newAttendance.check_in_time,
            status: newAttendance.status,
            points: newPoints,
            pointsAward,
            levelInfo,
            monthlyStats,
            ...learningHighlights,
            adultStats,
          });
        }
      } catch (error) {
        // Any unexpected failure must leave the scanning state, never hang on the loader.
        setLastScan({ type: 'error', message: error?.message || 'Terjadi kesalahan saat memproses RFID.', name: 'Error' });
      } finally { setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); }
  };

  const handleRfidSubmit = async e => { e.preventDefault(); processScan(rfidTag); };

  // --- Scan Result Component (modernized) ---
  const ScanResult = ({ scan }) => {
    // Processing state
    if (scan?.type === 'scanning') {
      return (
        <div className="attendance-status-processing" role="status" aria-live="polite" aria-label="Sedang memproses">
          <div className="attendance-status-processing__ring">
            <div className="attendance-status-processing__ring-outer" />
            <div className="attendance-status-processing__ring-inner" />
            <Fingerprint className="w-12 h-12" style={{ color: 'hsl(var(--att-accent))' }} />
          </div>
          <p className="attendance-status-processing__text">MEMPROSES DATA</p>
        </div>
      );
    }

    // Ready state (no scan)
    if (!scan) {
      return (
        <div className="attendance-status-ready" aria-label="Siap memindai">
          <Fingerprint className="attendance-status-ready__icon" />
          <p className="attendance-status-ready__text">SIAP MEMINDAI</p>
        </div>
      );
    }

    // Confirmation
    if (scan.type === 'confirmation') {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="attendance-result" role="status" aria-live="polite">
          <div className="attendance-result-card attendance-result-card--info">
            {scan.isMMQ && (
              <div className="absolute top-4 right-4">
                <Badge className="bg-[hsl(var(--att-accent-soft))] text-[hsl(var(--att-accent))] border-none text-xs">
                  <Library className="w-3 h-3 mr-1" /> MMQ
                </Badge>
              </div>
            )}
            <div className="attendance-confirmation">
              <Avatar className="attendance-confirmation__avatar">
                <AvatarImage src={scan.photo} className="object-cover" />
                <AvatarFallback>{scan.name?.[0]}</AvatarFallback>
              </Avatar>
              <h2 className="attendance-confirmation__name">{scan.name}</h2>
              <p className="attendance-confirmation__text">Anda sudah absen hari ini.</p>
              <div className="attendance-confirmation__prompt">
                <p>Tap kartu sekali lagi untuk update jam pulang/masuk.</p>
              </div>
              <p className="attendance-confirmation__hint">Atau biarkan untuk membatalkan.</p>
            </div>
          </div>
        </motion.div>
      );
    }

    // Guru Schedule Detail
    if (scan.type === 'guru_schedule_detail') {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="attendance-result" role="region" aria-label="Daftar kelas" style={{ maxWidth: '72rem' }}>
          <div className="attendance-result-card" style={{ maxWidth: '100%' }}>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'hsl(var(--att-border-subtle))' }}>
              <Briefcase className="w-5 h-5" style={{ color: 'hsl(var(--att-accent))' }} />
              <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--att-text-primary))' }}>Kelas Anda</h2>
            </div>
            <div className="attendance-schedule-grid">
              {scan.classesData && scan.classesData.length > 0 ? scan.classesData.map(cls => (
                <div key={cls.id} className="attendance-schedule-card">
                  <div className="attendance-schedule-card__header">
                    <h3 className="attendance-schedule-card__name">{cls.nama_kelas}</h3>
                    <span className="attendance-schedule-card__session">{cls.sesi}</span>
                  </div>
                  <div className="attendance-schedule-card__santri">
                    {cls.santri && cls.santri.length > 0 ? (
                      cls.santri.map(s => (
                        <span key={s.id} className="attendance-schedule-card__santri-chip">{s.nama_lengkap}</span>
                      ))
                    ) : (
                      <span className="text-xs italic" style={{ color: 'hsl(var(--att-text-muted))' }}>Kosong</span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="col-span-full text-center py-10" style={{ color: 'hsl(var(--att-text-muted))' }}>
                  Tidak ada kelas yang diampu.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    // Pentashih History
    if (scan.type === 'pentashih_history') {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="attendance-result" role="region" aria-label="Riwayat mutasi" style={{ maxWidth: '64rem' }}>
          <div className="attendance-result-card" style={{ maxWidth: '100%' }}>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b" style={{ borderColor: 'hsl(var(--att-border-subtle))' }}>
              <Activity className="w-5 h-5" style={{ color: 'hsl(var(--att-accent))' }} />
              <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--att-text-primary))' }}>Riwayat Mutasi Terkini</h2>
            </div>
            <div className="attendance-schedule-grid">
              {scan.historyData.map((history, idx) => (
                <div key={idx} className="attendance-schedule-card">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                      <AvatarImage src={history.santri?.foto_url} />
                      <AvatarFallback>{history.santri?.nama_lengkap?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-bold text-sm truncate" style={{ color: 'hsl(var(--att-text-primary))' }}>{history.santri?.nama_lengkap}</p>
                      <p className="text-xs" style={{ color: 'hsl(var(--att-text-muted))' }}>{new Date(history.mutation_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ backgroundColor: 'hsl(var(--att-surface))', border: '1px solid hsl(var(--att-border-subtle))' }}>
                    <div className="text-center w-1/2">
                      <p className="font-bold" style={{ color: 'hsl(var(--att-danger))' }}>{history.from_jilid || '?'}</p>
                      <p className="text-[10px] truncate" style={{ color: 'hsl(var(--att-text-muted))' }}>{history.from_class?.nama_kelas || '-'}</p>
                    </div>
                    <ArrowRight className="w-4 h-4" style={{ color: 'hsl(var(--att-text-muted))' }} />
                    <div className="text-center w-1/2">
                      <p className="font-bold" style={{ color: 'hsl(var(--att-success))' }}>{history.to_jilid || '?'}</p>
                      <p className="text-[10px] truncate" style={{ color: 'hsl(var(--att-text-muted))' }}>{history.to_class?.nama_kelas || '-'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      );
    }

    // Error
    if (scan.type === 'error') {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="attendance-result" role="alert" aria-live="assertive">
          <div className="attendance-result-card attendance-result-card--error">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(var(--att-danger-bg))' }}>
                <XCircle className="w-10 h-10" style={{ color: 'hsl(var(--att-danger))' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'hsl(var(--att-text-primary))' }}>{scan.name}</h2>
              <div className="w-full p-4 rounded-xl mb-4" style={{ backgroundColor: 'hsl(var(--att-danger-bg))', border: '1px solid hsl(var(--att-danger-border))' }}>
                <p className="font-medium" style={{ color: 'hsl(var(--att-danger))' }}>{scan.message}</p>
              </div>
              <p className="text-sm" style={{ color: 'hsl(var(--att-text-muted))' }}>Silakan hubungi admin jika ini adalah kesalahan.</p>
            </div>
          </div>
        </motion.div>
      );
    }

    // Warning
    if (scan.type === 'warning') {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="attendance-result" role="alert" aria-live="polite">
          <div className="attendance-result-card attendance-result-card--warning">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(var(--att-amber-bg))' }}>
                <AlertTriangle className="w-10 h-10" style={{ color: 'hsl(var(--att-amber))' }} />
              </div>
              {scan.photo && (
                <Avatar className="w-20 h-20 mb-3 border-2" style={{ borderColor: 'hsl(var(--att-amber))' }}>
                  <AvatarImage src={scan.photo} className="object-cover" />
                  <AvatarFallback>{scan.name?.[0]}</AvatarFallback>
                </Avatar>
              )}
              <h2 className="text-xl font-bold mb-2" style={{ color: 'hsl(var(--att-text-primary))' }}>{scan.name}</h2>
              <p className="text-sm" style={{ color: 'hsl(var(--att-text-secondary))' }}>{scan.message}</p>
            </div>
          </div>
        </motion.div>
      );
    }

    // Guru results (info, session, Pentashih, MMQ) share their card props with the face kiosk.
    const guruCard = guruScanCardProps(scan);
    if (guruCard) {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="attendance-result" role="status" aria-live="polite">
          <AttendanceProfileCard {...guruCard} />
          {/* Pentashih success: extra info grid */}
          {scan.type === 'success' && guruCard.isPentashih && scan.name && (
            <div className="attendance-stats-row mt-4">
              <div className="attendance-stat-item">
                <span className="attendance-stat-item__value">{scan.name}</span>
                <span className="attendance-stat-item__label">Nama</span>
              </div>
              <div className="attendance-stat-item attendance-stat-item--amber">
                <span className="attendance-stat-item__value">{scan.jabatan || '-'}</span>
                <span className="attendance-stat-item__label">Jabatan</span>
              </div>
            </div>
          )}
        </motion.div>
      );
    }

    // Santri Success — Adult
    if (scan.type === 'success' && scan.role === 'santri' && scan.kategori === 'Dewasa') {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="attendance-result" role="status" aria-live="polite">
          <AttendanceProfileCard
            variant="student"
            name={scan.name}
            photo={scan.photo}
            status={scan.status || 'Hadir'}
            time={scan.time}
            jilid={scan.jilid}
            points={scan.points}
            pointsAward={scan.pointsAward}
            monthlyStats={scan.monthlyStats}
            hafalanCount={scan.hafalanCount}
            characterStrength={scan.characterStrength}
            strongestHafalanCategory={scan.strongestHafalanCategory}
            sesi={scan.sesi}
            message={scan.message}
            quote={scan.quote}
            showSuccessBadge
          />
        </motion.div>
      );
    }

    // Santri Success — Child
    if (scan.type === 'success' && scan.role === 'santri') {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="attendance-result" role="status" aria-live="polite">
          <AttendanceProfileCard
            variant="student"
            name={scan.name}
            photo={scan.photo}
            status={scan.status || 'Hadir'}
            time={scan.time}
            jilid={scan.jilid}
            points={scan.points}
            pointsAward={scan.pointsAward}
            levelInfo={scan.levelInfo}
            monthlyStats={scan.monthlyStats}
            hafalanCount={scan.hafalanCount}
            characterStrength={scan.characterStrength}
            strongestHafalanCategory={scan.strongestHafalanCategory}
            sesi={scan.sesi}
            message={scan.message}
            quote={scan.quote}
            showSuccessBadge
          />
        </motion.div>
      );
    }

    return null;
  };

  // --- Render ---
  return (
    <>
      <Helmet><title>Absensi Digital - LPQ Al-Fath Maulana</title></Helmet>
      <div className="attendance-page">
        {/* Background */}
        <div className="attendance-page__bg" aria-hidden="true" />

        {/* Header */}
        <header className="attendance-header">
          <div className="attendance-header__left">
            <button
              className="attendance-header__back"
              onClick={() => navigate('/dashboard')}
              aria-label="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
          </div>
          <div className="attendance-header__right">
            {facePilotEnabled && (
              <button type="button" className="attendance-header__action-btn attendance-header__action-btn--face" onClick={() => navigate('/absensi-wajah')}>
                <Camera className="w-4 h-4" aria-hidden="true" /><span>Absensi Wajah</span>
              </button>
            )}
            {enableGameFeatures && (
              <>
                <button
                  className="attendance-header__action-btn attendance-header__action-btn--gatcha"
                  onClick={() => navigate('/gatcha-game')}
                  title="Play Gatcha"
                  aria-label="Play Gatcha"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>Gatcha</span>
                </button>
                <button
                  className="attendance-header__action-btn attendance-header__action-btn--quiz"
                  onClick={() => navigate('/quiz-hafalan')}
                  title="Play Quiz"
                  aria-label="Play Quiz"
                >
                  <Library className="w-4 h-4" />
                  <span>Quiz</span>
                </button>
                <button
                  className="attendance-header__action-btn attendance-header__action-btn--random"
                  onClick={() => navigate('/random-name')}
                  title="Acak Nama"
                  aria-label="Acak Nama"
                >
                  <Dices className="w-4 h-4" />
                  <span>Acak Nama</span>
                </button>
                <button
                  className="attendance-header__action-btn attendance-header__action-btn--leaderboard"
                  onClick={() => navigate('/top-score')}
                  title="Leaderboard"
                  aria-label="Leaderboard"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Leaderboard</span>
                </button>
              </>
            )}
            <button
              className="attendance-header__action-btn attendance-header__action-btn--tv"
              onClick={() => navigate('/tv-display-mode')}
              title="TV Display Mode"
              aria-label="TV Display Mode"
            >
              <Tv className="w-4 h-4" />
              <span>TV Display</span>
            </button>
            <button className="attendance-header__icon-btn" onClick={toggleTheme} title={isDark ? 'Mode Terang' : 'Mode Gelap'} aria-label={isDark ? 'Mode Terang' : 'Mode Gelap'}>
              {isDark ? <Sun className="w-4 h-4" style={{ color: 'hsl(var(--att-amber))' }} /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="attendance-header__system-chip">
              <span className="attendance-header__system-dot" />
              <span>SYSTEM ONLINE</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-4 md:p-8 gap-6 md:gap-8">
          <DigitalClock />

          {/* Scan Result Area */}
          <div className="w-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              <ScanResult key={lastScan?.type || 'ready'} scan={lastScan} />
            </AnimatePresence>
          </div>

          {/* RFID Input */}
          <div className="attendance-scan-area">
            <div className="attendance-scan-area__glow" aria-hidden="true" />
            <form onSubmit={handleRfidSubmit} className="attendance-scan-area__form">
              <Search className="attendance-scan-area__icon w-5 h-5" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Menunggu Scan Kartu..."
                value={rfidTag}
                onChange={e => setRfidTag(e.target.value)}
                className="attendance-scan-area__input"
                disabled={isLoading}
                autoFocus
                autoComplete="off"
                aria-label="Input RFID"
              />
              {isLoading && <div className="attendance-scan-area__spinner" aria-hidden="true" />}
            </form>
            <p className="attendance-scan-area__hint">Silakan tap kartu untuk scan absen</p>
          </div>

          <MediaPlayerWidget />
        </main>

        {/* Footer */}
        <footer className="attendance-footer">
          <p className="attendance-footer__text">LPQ AL-FATH MAULANA &bull; DIGITAL ATTENDANCE SYSTEM v5.0</p>
        </footer>
      </div>
    </>
  );
};

export default DigitalAttendancePage;
