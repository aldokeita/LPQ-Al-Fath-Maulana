
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    XCircle, Clock, Star, BookOpen, Users, MessageCircle, Globe2, Calendar,
    MinusCircle, CheckCircle, Trophy, BookCopy, UserCircle, Monitor, Smartphone, Sun, Moon, Sparkles, Keyboard, Tv, Crown
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import { buildSantriAttendancePayload, getLocalDateString, getLocalTimeString, isExplicitAbsentAttendance } from '@/lib/attendanceAdapters';
import { resolveSantriAttendanceSession } from '@/utils/AttendanceStatusLogic';
import { useAttendanceSessionConfiguration } from '@/hooks/useAttendanceSessionConfiguration';

const registrationSessionTimes = {
  'Pagi': { start: 'Belum diisi', end: 'Belum diisi', defaultQuota: 0 },
  'Siang': { start: 'Belum diisi', end: 'Belum diisi', defaultQuota: 0 },
  'Sore': { start: 'Belum diisi', end: 'Belum diisi', defaultQuota: 0 },
  'Malam': { start: 'Belum diisi', end: 'Belum diisi', defaultQuota: 0 },
};

const waliQuotes = [
    "Pendidikan anak adalah investasi terbaik dunia akhirat.",
    "Doa orang tua adalah kunci kesuksesan anak.",
    "Mari bersinergi membangun generasi Qur'ani.",
    "Terima kasih Ayah Bunda telah mempercayakan ananda kepada kami.",
    "Kesabaran orang tua dalam mendidik anak berbuah surga.",
    "Setiap langkah ananda menuju tempat mengaji adalah pahala bagi Ayah Bunda.",
    "Anak yang sholeh adalah penyejuk hati orang tua.",
    "Ilmu yang bermanfaat akan menjadi amal jariyah."
];

const DigitalClock = ({ showSeconds = true, size = "large", colorClass = "" }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  if (size === "small") {
      return (
          <div className={`text-right ${colorClass}`}>
              <div className="text-2xl font-bold font-mono leading-none">
                  {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: showSeconds ? '2-digit' : undefined })}
              </div>
              <div className="text-xs opacity-80 mt-1 font-light">
                  {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
          </div>
      )
  }
  return (
      <div className="flex flex-col items-center justify-center space-y-2">
        <div className="text-6xl md:text-8xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 dark:from-blue-400 dark:to-indigo-500 drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300">
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: showSeconds ? '2-digit' : undefined })}
        </div>
        <div className="text-xl md:text-2xl text-slate-500 dark:text-slate-200/70 font-light tracking-widest transition-colors duration-300">
            {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
    </div>
  );
};

const PopupScanResult = ({ scan }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 flex items-center gap-6 border-2 border-blue-500 max-w-md w-full"
        >
            <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-blue-500 shadow-lg">
                    <AvatarImage src={scan.photo} className="object-cover"/>
                    <AvatarFallback>{scan.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-md">
                   <CheckCircle className="w-6 h-6" />
                </div>
            </div>
            <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{scan.name}</h3>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mt-1">{scan.role === 'guru' ? 'Guru Pengajar' : `Santri - ${scan.jilid || ''}`}</p>
                <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold inline-block mt-2">
                    ABSEN BERHASIL
                </div>
            </div>
        </motion.div>
    );
};

const TvDisplayPage = () => {
  const { sessionTimes: attendanceSessionTimes } = useAttendanceSessionConfiguration();
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const [activeSession, setActiveSession] = useState(0);
    const [sessionStartTime, setSessionStartTime] = useState(Date.now());

    const [config, setConfig] = useState({
        transitionTime: 15,
        showSeconds: true,
        showAdults: true,
        enabledSessions: {},
        sessionQuotas: {},
        registration: {},
        leaderboard: {},
        durations: {},
        sessionSettings: {}
    });
    const [orientation, setOrientation] = useState('landscape');

    const [classData, setClassData] = useState([]);
    const [santriList, setSantriList] = useState([]);
    const [dailyAttendance, setDailyAttendance] = useState([]);
    const [profileIndex, setProfileIndex] = useState(0);
    const [activeClassIndex, setActiveClassIndex] = useState(0);
    const [waliQuoteIndex, setWaliQuoteIndex] = useState(0);
    const [levelConfig, setLevelConfig] = useState(null);
    const [logoUrl, setLogoUrl] = useState('/logo-lpq-al-fath-maulana.webp');

    // Invisible Scanning State
    const [scanBuffer, setScanBuffer] = useState('');
    const [popupScan, setPopupScan] = useState(null);
    const scanTimeoutRef = useRef(null);
    const popupTimerRef = useRef(null);

    // Manual Scan Dialog State
    const [manualScanOpen, setManualScanOpen] = useState(false);
    const [manualScanId, setManualScanId] = useState('');

    const sessionOrder = [
        { id: 0, key: 'attendance', label: 'Detail Kelas' },
        { id: 1, key: 'quotas', label: 'Info Kuota' },
        { id: 3, key: 'wali', label: 'Info Wali' },
        { id: 4, key: 'profiles', label: 'Profil Santri' },
        { id: 5, key: 'leaderboard', label: 'Leaderboard' }
    ];

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                if (scanBuffer) processScan(scanBuffer);
                setScanBuffer('');
            } else {
                setScanBuffer(prev => prev + e.key);
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = setTimeout(() => setScanBuffer(''), 200);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        };
    }, [scanBuffer]);

    const calculateLevelStyles = (points = 0, gender) => {
        const defaultInfo = {
            level: 1, label: 'Level C',
            badgeIcon: <BookCopy className="w-8 h-8 text-[#1B7D3F]" />,
            styleClass: 'style-default',
            textClass: '',
            badgeBg: 'bg-white',
            premiumBorderClass: 'border-2 border-slate-100 dark:border-slate-800',
            borderColor: '#e2e8f0', // default slate-200
            floatingEffect: false,
            cardBgColor: '#ffffff',
            textColor: '#333333'
        };

        if (!levelConfig) return defaultInfo;

        const isFemale = gender === 'Perempuan';
        const levels = isFemale ? levelConfig.female : levelConfig.male;

        // Ensure levels is an array and not empty before executing .find()
        if (!Array.isArray(levels) || levels.length === 0) return defaultInfo;

        // Find matching level with safe boundaries
        const matchedLevel = levels.find(l => points >= (l.min || 0) && points <= (l.max || 9999)) || levels[0];
        if (!matchedLevel) return defaultInfo;

        // Determine icon based on name keyword (flexible fallback)
        let icon = <BookCopy className="w-8 h-8" style={{ color: matchedLevel.color }} />;
        if ((matchedLevel.name || '').toLowerCase().includes('mahir') || (matchedLevel.name || '').toLowerCase().includes('s')) {
            icon = <Trophy className="w-10 h-10 animate-bounce drop-shadow-md" style={{ color: matchedLevel.color }} />;
        } else if ((matchedLevel.name || '').toLowerCase().includes('menengah') || (matchedLevel.name || '').toLowerCase().includes('a')) {
            icon = <Globe2 className="w-10 h-10 animate-pulse" style={{ color: matchedLevel.color }} />;
        }

        // Construct border styles using inline styles for color precision
        const isPremium = (matchedLevel.name || '').toLowerCase().includes('mahir') || (matchedLevel.name || '').toLowerCase().includes('s') || (matchedLevel.name || '').toLowerCase().includes('a');

        return {
            level: matchedLevel.id,
            label: matchedLevel.name,
            badgeIcon: icon,
            styleClass: '', // Handled by inline styles now
            textClass: '',
            badgeBg: 'bg-white',
            premiumBorderClass: isPremium ? 'shadow-lg z-10' : '',
            borderColor: matchedLevel.color || '#e2e8f0',
            floatingEffect: isPremium,
            cardBgColor: matchedLevel.cardBgColor || '#ffffff',
            textColor: matchedLevel.textColor || '#333333'
        };
    };

    const processScan = async (tag) => {
        const today = getLocalDateString();
        let user = null, userRole = '', sesiUser = '';

        // Check Guru
        let { data: guruData } = await supabase.from('guru').select('*').eq('rfid_tag', tag).maybeSingle();
        if (guruData) {
            user = guruData; userRole = 'guru';
            const hour = new Date().getHours();
            if (hour < 12) sesiUser = 'Pagi';
            else if (hour < 15) sesiUser = 'Siang';
            else if (hour < 18) sesiUser = 'Sore';
            else sesiUser = 'Malam';
        } else {
            // Check Santri
            let { data: santriData } = await supabase
                .from('santri')
                .select('id, nama_lengkap, nama_panggilan, kategori, status, foto_url, avatar_path, rfid_tag, current_class_id, sesi_mengaji, jilid, points, class:current_class_id(id, nama_kelas, sesi)')
                .eq('rfid_tag', tag)
                .maybeSingle();
            if (santriData) {
                const foto_url = await resolveAvatarUrl({
                    ownerType: 'santri',
                    ownerId: santriData.id,
                    avatarPath: santriData.avatar_path,
                    fallbackUrl: santriData.foto_url,
                });
                user = { ...santriData, id_kelas: santriData.current_class_id, foto_url };
                userRole = 'santri';
                sesiUser = santriData.sesi_mengaji || santriData.class?.sesi || 'Pagi';
            }
        }

        if (!user) return;

        // Check existing attendance
        const { data: existing } = await supabase.from('attendance').select('id, status').eq('user_id', user.id).eq('attendance_date', today).maybeSingle();
        const shouldRestoreAbsentAttendance = userRole === 'santri'
            && existing
            && isExplicitAbsentAttendance(existing.status);

        if (!existing || shouldRestoreAbsentAttendance) {
            const now = new Date();
            const santriSession = userRole === 'santri'
                ? resolveSantriAttendanceSession({
                    timestamp: now,
                    dateStr: today,
                    assignedSession: sesiUser,
                    sessionTimes: attendanceSessionTimes,
                })
                : null;

            if (santriSession && !santriSession.can) return;

            const payload = userRole === 'santri'
                ? buildSantriAttendancePayload({
                    santri: user,
                    timestamp: now,
                    status: santriSession.status,
                    attendedSession: santriSession.attendedSession,
                })
                : {
                    user_id: user.id,
                    role: userRole,
                    attendance_date: today,
                    check_in_time: getLocalTimeString(now),
                    check_in_timestamp: now.toISOString(),
                    class_id: null,
                    sesi: sesiUser,
                    status: 'Hadir',
                    source: 'rfid',
                };
            if (shouldRestoreAbsentAttendance) {
                await supabase
                    .from('attendance')
                    .update({
                        check_in_time: payload.check_in_time,
                        check_in_timestamp: payload.check_in_timestamp,
                        class_id: payload.class_id,
                        attended_session: payload.attended_session,
                        status: payload.status,
                        source: 'rfid',
                    })
                    .eq('id', existing.id);
                setDailyAttendance(prev => prev.map(record => (
                    record.user_id === user.id
                        ? { ...record, check_in_time: payload.check_in_time, class_id: payload.class_id, status: payload.status }
                        : record
                )));
            } else {
                await supabase.from('attendance').insert(payload);
                setDailyAttendance(prev => [...prev, { user_id: user.id, check_in_time: payload.check_in_time, class_id: payload.class_id, status: payload.status }]);
            }
        }

        setPopupScan({ name: user.nama || user.nama_lengkap, photo: user.foto_url, role: userRole, jilid: user.jilid });
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setPopupScan(null), 5000);
    };

    const handleManualScanSubmit = (e) => {
        e.preventDefault();
        if (manualScanId) {
            processScan(manualScanId);
            setManualScanId('');
            setManualScanOpen(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            const today = getLocalDateString();
            try {
                const { data: cfg } = await supabase.from('website_content').select('content').eq('key', 'tv_config').maybeSingle();
                if(cfg?.content) setConfig(prev => ({...prev, ...cfg.content}));

                const { data: lvlCfg } = await supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle();
                if(lvlCfg?.content) setLevelConfig(lvlCfg.content);

                const { data: logoContent } = await supabase.from('website_content').select('content').eq('key', 'logoUrl').maybeSingle();
                if (typeof logoContent?.content === 'string' && logoContent.content.trim()) {
                    setLogoUrl(logoContent.content.trim());
                }

                const [classesRes, santriRes, attendanceRes] = await Promise.all([
                    supabase
                        .from('classes')
                        .select('id, nama_kelas, sesi, kategori, sort_order, is_active, guru:id_guru(nama)')
                        .eq('is_active', true)
                        .order('sort_order', { ascending: true, nullsFirst: false }),
                    supabase
                        .from('santri')
                        .select('id, nama_lengkap, nama_panggilan, nomor_induk_qiroati, kategori, status, foto_url, avatar_path, current_class_id, sesi_mengaji, jilid, points, jenis_kelamin')
                        .eq('status', 'Aktif')
                        .order('nama_lengkap', { ascending: true }),
                    supabase.from('attendance').select('*').eq('attendance_date', today),
                ]);

                if (classesRes.error) throw classesRes.error;
                if (santriRes.error) throw santriRes.error;
                if (attendanceRes.error) throw attendanceRes.error;

                const santriWithAvatars = await Promise.all((santriRes.data || []).map(async (item) => {
                    const foto_url = await resolveAvatarUrl({
                        ownerType: 'santri',
                        ownerId: item.id,
                        avatarPath: item.avatar_path,
                        fallbackUrl: item.foto_url,
                    });
                    return {
                        ...item,
                        id_kelas: item.current_class_id,
                        foto_url,
                    };
                }));

                const classes = classesRes.data || [];
                const santri = santriWithAvatars;

                if (classes && santri) {
                    setSantriList(santri);
                    setDailyAttendance(attendanceRes.data || []);

                    const sessionPriority = { 'Pagi': 1, 'Siang': 2, 'Sore': 3, 'Malam': 4 };
                    const sortedClasses = classes.sort((a, b) => (sessionPriority[a.sesi] || 99) - (sessionPriority[b.sesi] || 99));

                    const enrichedClasses = sortedClasses.map(c => ({
                        ...c,
                        santri: santri.filter(s => (s.current_class_id || s.id_kelas) === c.id),
                        santriCount: santri.filter(s => (s.current_class_id || s.id_kelas) === c.id).length
                    }));
                    setClassData(enrichedClasses);
                }
            } catch {
                setSantriList([]);
                setDailyAttendance([]);
                setClassData([]);
            }
        };
        fetchData();
        const dataInterval = setInterval(fetchData, 30000);
        return () => clearInterval(dataInterval);
    }, []);

    const getCurrentSessionTime = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Pagi';
        if (hour < 15) return 'Siang';
        if (hour < 18) return 'Sore';
        return 'Malam';
    };

    const currentSessionTime = getCurrentSessionTime();

    // Logic for filtering classes in Detail View (Case 0)
    const getActiveClassesForDetail = () => {
        let classesToShow = classData;

        // Apply global adult filter first
        if (!config.showAdults) {
            classesToShow = classesToShow.filter(c => c.kategori !== 'Dewasa' && c.sesi !== 'Malam');
        } else {
             const showAdultClassesInDetail = config.sessionSettings?.attendance?.showAdultClasses;
             if (!showAdultClassesInDetail) {
                 classesToShow = classesToShow.filter(c => c.kategori !== 'Dewasa' && c.sesi !== 'Malam');
             }
        }

        // Filter by current session time
        return classesToShow.filter(c => c.sesi === currentSessionTime);
    };

    const activeClasses = getActiveClassesForDetail();

    // Auto-Orientation and Session Config Effect
    useEffect(() => {
        const sessionKey = sessionOrder.find(s => s.id === activeSession)?.key;
        if (sessionKey) {
            const configuredOrientation = config.sessionSettings?.[sessionKey]?.orientation || 'landscape';
            setOrientation(configuredOrientation);
        }
    }, [activeSession, config.sessionSettings]);

    // --- Session Reset Handlers ---
    useEffect(() => {
        setSessionStartTime(Date.now());
        if (activeSession === 0) setActiveClassIndex(0);
        if (activeSession === 3) setWaliQuoteIndex(0);
        if (activeSession === 4) setProfileIndex(0);
    }, [activeSession]);

    // --- Robust Session Switcher Timer ---
    useEffect(() => {
        const checkSessionSwitch = () => {
            const elapsed = Date.now() - sessionStartTime;
            const sessionKey = sessionOrder.find(s => s.id === activeSession)?.key;

            let duration = (config.durations?.[sessionKey] || config.transitionTime || 15) * 1000;

            if (sessionKey === 'attendance') {
                 const count = activeClasses.length;
                 const pageDuration = (config.durations?.attendancePage || 10) * 1000;
                 duration = count > 0 ? count * pageDuration : duration;
            } else if (sessionKey === 'profiles') {
                 const mode = config.sessionSettings?.profiles?.mode || 'auto';
                 const filteredSantriList = config.showAdults ? santriList : santriList.filter(s => s.kategori !== 'Dewasa');
                 if (mode === 'auto') {
                     const itemsPerPage = orientation === 'landscape' ? 12 : 10;
                     let totalPages = Math.ceil((filteredSantriList.length || 1) / itemsPerPage);
                     const maxPages = config.sessionSettings?.profiles?.maxPages || 0;
                     if (maxPages > 0 && totalPages > maxPages) totalPages = maxPages;
                     const pageDuration = (config.durations?.profilesPage || 10) * 1000;
                     duration = totalPages * pageDuration;
                 } else {
                     duration = (config.durations?.profilesTotal || 300) * 1000;
                 }
            }

            // Quick skip if empty data
            if (sessionKey === 'profiles' && (!santriList.length)) duration = 3000;
            if (sessionKey === 'attendance' && activeClasses.length === 0) duration = 5000;

            if (elapsed > duration) {
                setActiveSession(prev => {
                    let currentIndex = sessionOrder.findIndex(s => s.id === prev);
                    if (currentIndex === -1) currentIndex = 0;

                    let nextIndex = (currentIndex + 1) % sessionOrder.length;

                    let attempts = 0;
                    while (!config.enabledSessions[sessionOrder[nextIndex].key] && attempts < sessionOrder.length) {
                        nextIndex = (nextIndex + 1) % sessionOrder.length;
                        attempts++;
                    }
                    return sessionOrder[nextIndex].id;
                });
            }
        };

        const timer = setInterval(checkSessionSwitch, 1000);
        return () => clearInterval(timer);
    }, [sessionStartTime, activeSession, config, activeClasses.length, santriList.length, orientation]);


    // --- Page/Item Rotation Interval Logic ---
    useEffect(() => {
        let interval;
        const sessionKey = sessionOrder.find(s => s.id === activeSession)?.key;

        if (sessionKey === 'attendance' && activeClasses.length > 0) {
            const pageDuration = (config.durations?.attendancePage || 10) * 1000;
            interval = setInterval(() => setActiveClassIndex(prev => (prev + 1) % activeClasses.length), pageDuration);
        } else if (sessionKey === 'profiles') {
            const filteredSantriList = config.showAdults ? santriList : santriList.filter(s => s.kategori !== 'Dewasa');
            if (filteredSantriList.length > 0) {
                const itemsPerPage = orientation === 'landscape' ? 12 : 10;
                const pageDuration = (config.durations?.profilesPage || 10) * 1000;
                const maxPages = config.sessionSettings?.profiles?.maxPages || 0;
                const totalRealPages = Math.ceil(filteredSantriList.length / itemsPerPage);
                const limitPages = (maxPages > 0 && maxPages < totalRealPages) ? maxPages : totalRealPages;

                interval = setInterval(() => {
                    setProfileIndex(prev => {
                        const next = prev + itemsPerPage;
                        const currentPagNum = Math.ceil((next + 1) / itemsPerPage);
                        if (currentPagNum > limitPages || next >= filteredSantriList.length) return 0;
                        return next;
                    });
                }, pageDuration);
            }
        } else if (sessionKey === 'wali') {
            const quoteDuration = (config.durations?.waliMessage || 10) * 1000;
            interval = setInterval(() => setWaliQuoteIndex(prev => (prev + 1) % waliQuotes.length), quoteDuration);
        }
        return () => clearInterval(interval);
    }, [activeSession, activeClasses.length, santriList.length, config.durations, orientation, config.sessionSettings, config.showAdults]);

    const currentClass = activeClasses.length > 0 ? activeClasses[activeClassIndex % activeClasses.length] : null;

    const renderContent = () => {
        const filteredSantriList = config.showAdults ? santriList : santriList.filter(s => s.kategori !== 'Dewasa');

        switch (activeSession) {
            case 0:
                if (activeClasses.length === 0) return <div className="flex-1 flex items-center justify-center text-2xl opacity-50 font-bold uppercase tracking-widest">Tidak ada kelas untuk sesi {currentSessionTime} saat ini.</div>;
                if (!currentClass) return <div className="flex-1 flex items-center justify-center text-2xl opacity-50">Memuat data kelas...</div>;
                let capacityColor = 'border-[#1B7D3F]';
                let capacityHeaderBg = 'bg-gradient-to-r from-[#0F5C2E] to-[#1B7D3F]';
                let capacityTextColor = 'text-[#1B7D3F] dark:text-[#4CAF50]';
                if (currentClass.santriCount > 15) {
                    capacityColor = 'border-red-500'; capacityHeaderBg = 'bg-gradient-to-r from-red-600 to-red-500'; capacityTextColor = 'text-red-600 dark:text-red-400';
                } else if (currentClass.santriCount >= 11) {
                    capacityColor = 'border-yellow-500'; capacityHeaderBg = 'bg-gradient-to-r from-yellow-500 to-amber-500'; capacityTextColor = 'text-yellow-600 dark:text-yellow-400';
                }
                return (
                    <div className="h-full p-6 animate-in fade-in zoom-in duration-500 flex flex-col">
                        <h2 className={`text-3xl font-black text-center mb-4 uppercase tracking-widest flex items-center justify-center gap-3 ${isDark ? 'text-[#4CAF50]' : 'text-[#1B7D3F]'}`}><BookOpen className="w-8 h-8"/> Informasi Manajemen Kelas - Sesi {currentClass.sesi}</h2>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentClass.id}
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -100, opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                className={`flex-1 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border-4 ${capacityColor}`}
                            >
                                <div className={`p-6 ${capacityHeaderBg} text-white shadow-lg`}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                                {currentClass.nama_kelas}
                                                <Badge variant="outline" className={`text-lg px-3 py-1 ${capacityTextColor} bg-white`}>{currentClass.santriCount}/15 Santri</Badge>
                                            </h3>
                                            <p className="text-xl opacity-90">Guru: {currentClass.guru?.nama || 'Belum ditentukan'}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm opacity-70 uppercase tracking-wider">Kehadiran</div>
                                            <div className="text-4xl font-bold">{dailyAttendance.filter(a => a.class_id === currentClass.id).length}<span className="text-xl opacity-70">/{currentClass.santri.length}</span></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 p-6 overflow-hidden bg-white dark:bg-slate-950">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-full content-start">
                                        {currentClass.santri.map(s => {
                                            const att = dailyAttendance.find(a => a.user_id === s.id);
                                            return (
                                                <div key={s.id} className={`p-3 rounded-xl border-l-4 flex items-center justify-between ${att ? 'bg-green-50 border-green-500 dark:bg-green-900/20' : 'bg-slate-50 border-slate-300 dark:bg-slate-800'}`}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <Avatar className="h-10 w-10 border border-slate-200"><AvatarImage src={s.foto_url}/><AvatarFallback>{s.nama_lengkap[0]}</AvatarFallback></Avatar>
                                                        <div className="min-w-0"><p className={`font-bold truncate text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.nama_lengkap}</p><p className="text-xs text-muted-foreground truncate">{s.jilid}</p></div>
                                                    </div>
                                                    {att ? (<div className="shrink-0 flex flex-col items-end"><CheckCircle className="w-5 h-5 text-green-600"/><span className="text-[10px] font-bold text-green-700">{att.check_in_time.slice(0,5)}</span></div>) : (<div className="shrink-0 text-slate-300 dark:text-slate-600"><MinusCircle className="w-5 h-5"/></div>)}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                        <div className="p-2 bg-slate-100 dark:bg-slate-900 text-center text-xs text-muted-foreground border-t border-slate-200 dark:border-slate-800">Menampilkan Kelas {activeClassIndex + 1} dari {activeClasses.length} (Sesi {currentSessionTime})</div>
                    </div>
                );
            case 1:
                const quotas = ['Pagi', 'Siang', 'Sore'].map(sesi => { const q = config.sessionQuotas?.[sesi.toLowerCase()] || registrationSessionTimes[sesi].defaultQuota; const registeredSantriCount = filteredSantriList.filter(s => s.sesi_mengaji === sesi).length; const available = Math.max(0, q - registeredSantriCount); const percentage = Math.min(100, Math.round((registeredSantriCount / q) * 100)); const availabilityColor = available > 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-red-600'; return { sesi, quota: q, filled: registeredSantriCount, available, percentage, availabilityColor }; });
                const regStart = config.registration?.startDate ? new Date(config.registration.startDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-';
                const regEnd = config.registration?.endDate ? new Date(config.registration.endDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-';
                return (<div className="flex flex-col items-center h-full animate-in slide-in-from-right duration-500 p-8 overflow-hidden"><div className="text-center mb-6 w-full"><h2 className={`text-4xl font-black uppercase tracking-widest mb-4 ${isDark ? 'text-[#4CAF50]' : 'text-[#1B7D3F]'}`}>Informasi Pendaftaran & Kuota</h2><div className="inline-flex items-center gap-3 bg-white/90 dark:bg-slate-800/90 px-8 py-3 rounded-full border-2 border-orange-200 dark:border-orange-900/50 shadow-lg animate-pulse"><Calendar className="w-6 h-6 text-orange-500" /><span className="text-xl font-bold text-slate-700 dark:text-slate-200">Periode Pendaftaran: <span className="text-orange-600 dark:text-orange-400 ml-2">{regStart} s/d {regEnd}</span></span></div></div><div className={`grid ${orientation === 'portrait' ? 'grid-cols-1 gap-4' : 'grid-cols-3 gap-8'} w-full max-w-7xl flex-1 mb-6 px-4 transition-all duration-500`}>{quotas.map(q => (<div key={q.sesi} className={`relative overflow-hidden rounded-[2.5rem] p-0 border-4 shadow-2xl flex flex-row justify-between transition-all duration-500 transform hover:scale-[1.02] ${isDark ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-100'} backdrop-blur-sm`}><div className="flex-1 flex flex-col justify-between p-8 relative z-10"><div><div className={`inline-block px-4 py-1 mb-2 rounded-full font-black text-white text-xs tracking-widest shadow-sm ${q.available > 0 ? 'bg-green-50' : 'bg-red-500'}`}>{q.available > 0 ? 'TERSEDIA' : 'PENUH'}</div><h3 className="text-5xl font-black mb-1 text-primary tracking-tight drop-shadow-sm">Sesi {q.sesi}</h3><p className="text-xl font-medium text-muted-foreground flex items-center gap-2"><Clock className="w-5 h-5"/> {registrationSessionTimes[q.sesi].start} - {registrationSessionTimes[q.sesi].end}</p></div><div className="py-4"><div className={`text-7xl font-black drop-shadow-md ${q.available > 10 ? 'text-green-500' : 'text-orange-500'}`}>{q.available}</div><div className="text-sm uppercase tracking-[0.2em] font-bold mt-1 opacity-60">Sisa Kursi</div></div><div className="flex justify-between items-end border-t pt-4 border-slate-200 dark:border-slate-700"><div className="flex flex-col"><span className="text-[10px] uppercase tracking-wider font-bold opacity-60 mb-1">Terisi</span><span className="text-2xl font-black text-[#1B7D3F] dark:text-[#4CAF50]">{q.filled}</span></div><div className="flex flex-col items-end"><span className="text-[10px] uppercase tracking-wider font-bold opacity-60 mb-1">Kapasitas</span><span className="text-2xl font-black text-slate-700 dark:text-slate-300">{q.quota}</span></div></div></div><div className="w-16 bg-slate-100 dark:bg-slate-900 relative border-l border-slate-200 dark:border-slate-700"><div className={`absolute bottom-0 w-full bg-gradient-to-t ${q.availabilityColor} transition-all duration-1000 ease-out flex flex-col justify-center items-center`} style={{ height: `${q.percentage}%` }}><span className="text-white font-black text-sm rotate-[-90deg] whitespace-nowrap drop-shadow-md tracking-widest flex justify-center w-full">{q.percentage}%</span></div></div></div>))}</div><div className="w-full max-w-5xl bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-full px-10 py-4 flex justify-between items-center shadow-2xl border border-white/10 ring-4 ring-white/20"><div className="flex items-center gap-4"><div className="bg-green-500 p-3 rounded-full shadow-lg shadow-green-500/30 animate-bounce"><MessageCircle className="w-6 h-6 text-white" /></div><div className="flex flex-col leading-tight"><span className="text-sm font-medium text-green-300 uppercase tracking-wider">Hubungi Admin</span><span className="font-black text-2xl tracking-wide font-mono">{config.registration?.contactWa || '-'}</span></div></div><div className="h-12 w-px bg-white/10"></div><div className="flex items-center gap-4 text-right"><div className="flex flex-col leading-tight"><span className="text-sm font-medium text-[#F0F8F4] uppercase tracking-wider">Website Resmi</span><span className="font-black text-2xl tracking-wide">{config.registration?.websiteUrl || '-'}</span></div><div className="bg-[#1B7D3F] p-3 rounded-full shadow-lg shadow-[#1B7D3F]/30"><Globe2 className="w-6 h-6 text-white" /></div></div></div></div>);
            case 3:
                const currentQuote = waliQuotes[waliQuoteIndex % waliQuotes.length];
                return (
                    <div className="relative flex h-full items-center justify-center overflow-hidden px-8 py-10 animate-in zoom-in duration-700">
                        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
                        <div className="absolute -right-20 bottom-4 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
                        <motion.div
                            initial={{ opacity: 0, y: 28, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                            className={`relative w-full max-w-6xl overflow-hidden rounded-[3rem] border px-10 py-12 text-center shadow-[0_30px_90px_rgba(15,118,110,0.18)] backdrop-blur-2xl md:px-16 md:py-14 ${isDark ? 'border-white/10 bg-slate-900/65' : 'border-white/70 bg-white/66'}`}
                        >
                            <div className="absolute inset-x-24 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
                            <div className="mb-10 flex items-center justify-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-700 text-white shadow-lg shadow-emerald-500/20">
                                    <MessageCircle className="h-7 w-7" />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-500">Sinergi Ayah Bunda & LPQ</p>
                                    <h2 className={`mt-1 text-3xl font-black tracking-tight md:text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Pesan untuk Wali Santri</h2>
                                </div>
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.blockquote
                                    key={currentQuote}
                                    initial={{ opacity: 0, y: 18, filter: 'blur(5px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, y: -18, filter: 'blur(5px)' }}
                                    transition={{ duration: 0.55 }}
                                    className={`mx-auto max-w-5xl text-4xl font-semibold italic leading-[1.22] tracking-tight md:text-6xl ${isDark ? 'text-slate-50' : 'text-slate-800'}`}
                                >
                                    “{currentQuote}”
                                </motion.blockquote>
                            </AnimatePresence>
                            <div className="mt-12 flex items-center justify-center gap-4">
                                <span className="h-px w-20 bg-gradient-to-r from-transparent to-emerald-500/70" />
                                <p className={`text-sm font-semibold tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Mendampingi dengan doa, teladan, dan kasih sayang</p>
                                <span className="h-px w-20 bg-gradient-to-l from-transparent to-emerald-500/70" />
                            </div>
                        </motion.div>
                    </div>
                );
            case 4:
                if (filteredSantriList.length === 0) {
                    return (
                        <div className="h-full flex flex-col p-4 animate-in fade-in duration-700 items-center justify-center">
                           <div className="mb-3 text-center">
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.32em] text-emerald-500">Galeri Peserta Didik</p>
                            <h2 className={`mt-1 text-3xl font-black tracking-tight md:text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Profil Santri LPQ Al-Fath Maulana</h2>
                            <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tumbuh, belajar, dan berprestasi bersama Al-Qur&apos;an</p>
                           </div>
                           <div className="flex-1 flex items-center justify-center text-xl opacity-50 font-bold">Data profil santri belum tersedia.</div>
                        </div>
                    );
                }

                const itemsPerPage = orientation === 'landscape' ? 12 : 10;
                const currentProfiles = filteredSantriList.slice(profileIndex, profileIndex + itemsPerPage);

                const gridClass = orientation === 'landscape'
                    ? 'grid-cols-4 grid-rows-3 gap-3'
                    : 'grid-cols-2 grid-rows-5 gap-4';

                const currentPage = Math.ceil((profileIndex + 1) / itemsPerPage);
                const totalPages = Math.ceil(filteredSantriList.length / itemsPerPage);

                return (
                    <div className="h-full flex flex-col p-4 animate-in fade-in duration-700">
                        <div className="mb-3 text-center">
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.32em] text-emerald-500">Galeri Peserta Didik</p>
                            <h2 className={`mt-1 text-3xl font-black tracking-tight md:text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Profil Santri LPQ Al-Fath Maulana</h2>
                            <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tumbuh, belajar, dan berprestasi bersama Al-Qur&apos;an</p>
                           </div>
                        <div className={`grid ${gridClass} flex-1 w-full max-w-7xl mx-auto min-h-0`}>
                            <AnimatePresence mode="wait">
                                {currentProfiles.map((santri, idx) => {
                                    const levelInfo = calculateLevelStyles(santri.points || 0, santri.jenis_kelamin);
                                    return (
                                        <motion.div
                                            key={santri.id}
                                            initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                rotateY: 0,
                                                y: levelInfo.floatingEffect ? [0, -8, 0] : 0
                                            }}
                                            exit={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                                            transition={{
                                                opacity: { duration: 0.4, delay: idx * 0.05 },
                                                scale: { duration: 0.4, delay: idx * 0.05 },
                                                rotateY: { duration: 0.4, delay: idx * 0.05 },
                                                y: levelInfo.floatingEffect ? {
                                                    duration: 3,
                                                    repeat: Infinity,
                                                    ease: "easeInOut",
                                                    delay: idx * 0.05
                                                } : { duration: 0 }
                                            }}
                                            className={`profile-card-base flex flex-col items-center p-2 rounded-xl text-center h-full justify-between shadow-md ${levelInfo.styleClass} ${levelInfo.premiumBorderClass} ${isDark ? 'bg-opacity-20' : 'bg-opacity-100'} transition-all`}
                                            style={{
                                                borderColor: levelInfo.borderColor,
                                                borderWidth: '3px',
                                                borderStyle: 'solid',
                                                backgroundColor: levelInfo.cardBgColor,
                                                color: levelInfo.textColor
                                            }}
                                        >
                                            <div className="w-full shrink-0">
                                                <h3 className={`text-sm md:text-base font-black truncate w-full leading-tight`}>{santri.nama_lengkap || 'Tanpa Nama'}</h3>
                                            </div>

                                            <div className="flex-1 w-full flex items-center justify-center relative py-1 min-h-0 overflow-hidden">
                                                <div className="relative aspect-square h-full w-auto max-h-full">
                                                    <div className={`absolute -top-1 -right-1 ${levelInfo.badgeBg} rounded-full p-1 shadow-sm z-20 border border-white scale-75 origin-top-right`}>
                                                        {React.cloneElement(levelInfo.badgeIcon, { className: "w-4 h-4" })}
                                                    </div>
                                                    <Avatar className="h-full w-full rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" style={{ border: `3px solid ${levelInfo.borderColor}` }}>
                                                        <AvatarImage src={santri.foto_url} className="object-cover" />
                                                        <AvatarFallback className="rounded-xl text-xl">{santri.nama_lengkap?.[0] || '?'}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                            </div>

                                            <div className="w-full shrink-0 bg-white/60 dark:bg-black/30 rounded-lg px-2 py-1 border border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 mt-1 backdrop-blur-sm">
                                                <div className="flex flex-col items-center flex-1">
                                                    <span className="text-[8px] uppercase font-bold opacity-60 tracking-wider leading-none mb-0.5">Jilid</span>
                                                    <Badge variant="secondary" className="text-[9px] font-black font-mono bg-white dark:bg-slate-800 shadow-sm px-1.5 py-0 h-4">{santri.jilid || '-'}</Badge>
                                                </div>
                                                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                                                <div className="flex flex-col items-center flex-1">
                                                    <span className="text-[8px] uppercase font-bold opacity-60 tracking-wider leading-none mb-0.5">Poin</span>
                                                    <span className="text-sm font-black text-yellow-600 dark:text-yellow-400 leading-none">{santri.points || 0}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                        <div className="absolute bottom-4 right-4 text-xs opacity-50 bg-black/10 dark:bg-white/10 px-2 py-1 rounded-full backdrop-blur-md">
                            Halaman {currentPage} / {totalPages}
                        </div>
                    </div>
                );
            case 5:
                 const lBoard = config.leaderboard || {};
                 const leaderboardCategories = [{ id: 'disciplined', label: 'Santri Paling Disiplin', icon: Trophy }, { id: 'drilling', label: 'Santri Terbaik Drilling', icon: Star }, { id: 'memorization', label: 'Santri Hafalan Terbanyak', icon: BookCopy }];

                 const lbGridClass = orientation === 'landscape'
                    ? 'grid-cols-3 gap-4'
                    : 'grid-cols-1 gap-3';

                 const headerTitle = "SANTRI TERBAIK LPQ AL-FATH MAULANA";

                 return (
                    <div className="h-full p-4 flex flex-col animate-in fade-in zoom-in duration-700 bg-[url('https://www.transparenttextures.com/patterns/diamond-upholstery.png')]">
                        <h2 className="text-3xl md:text-4xl font-black text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#4CAF50] via-[#1B7D3F] to-[#4CAF50] drop-shadow-lg flex items-center justify-center gap-4 animate-pulse leading-tight">
                            <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-500 fill-yellow-200 shrink-0" />
                            <span className="text-center">{headerTitle}</span>
                            <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-500 fill-yellow-200 shrink-0" />
                        </h2>

                        <div className={`grid ${lbGridClass} flex-1 min-h-0 w-full overflow-hidden`}>
                            {leaderboardCategories.map(cat => (
                                <div key={cat.id} className={`luxurious-border rounded-2xl overflow-hidden flex flex-col bg-white/90 dark:bg-slate-900/90 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl h-full`}>
                                    <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white px-4 py-2 text-left shadow-lg flex items-center gap-3 border-b-2 border-yellow-500/50 relative overflow-hidden shrink-0">
                                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                                        <cat.icon className="w-5 h-5 text-yellow-400 shrink-0" />
                                        <h3 className="font-black text-sm md:text-md uppercase tracking-widest relative z-10 text-yellow-100 flex-1 truncate">{cat.label}</h3>
                                    </div>
                                    <div className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-hidden">
                                        {['Pagi', 'Siang', 'Sore'].map(time => {
                                            const sessionData = lBoard[cat.id]?.[time];
                                            return (
                                                <div key={time} className="flex flex-col flex-1 min-h-0 bg-white/50 dark:bg-black/20 rounded-xl p-1.5 border border-white/10">
                                                    <div className="flex items-center gap-2 mb-1 shrink-0">
                                                        <div className="text-[9px] font-bold uppercase text-center text-slate-500 dark:text-slate-400 tracking-widest bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-0.5">Sesi {time}</div>
                                                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                                                        {[{ id: sessionData?.male, color: 'blue', label: 'Putra' }, { id: sessionData?.female, color: 'pink', label: 'Putri' }].map((item, i) => {
                                                            const santri = santriList.find(s => s.id === item.id);
                                                            return (
                                                                <div key={i} className={`relative rounded-lg overflow-hidden h-full w-full group ${item.color === 'blue' ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-pink-50/50 dark:bg-pink-900/10'} flex flex-row items-center border border-black/5 dark:border-white/5`}>
                                                                    <div className="relative z-10 h-full w-full flex flex-row items-center p-1.5 gap-2">
                                                                        {santri ? (
                                                                            <>
                                                                                <div className="shrink-0 h-full aspect-square relative overflow-hidden rounded-lg border border-white/20 shadow-sm">
                                                                                    <img src={santri.foto_url} className="w-full h-full object-cover" alt={santri.nama_lengkap} />
                                                                                </div>
                                                                                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                                                    <div className={`font-black text-xs md:text-sm uppercase tracking-wide truncate leading-tight ${item.color === 'blue' ? 'text-blue-700 dark:text-blue-400' : 'text-pink-700 dark:text-pink-300'}`}>{santri.nama_panggilan || santri.nama_lengkap.split(' ')[0]}</div>
                                                                                    <div className="text-[9px] font-bold text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/30 self-start px-1.5 rounded-sm">{santri.points || 0} Poin</div>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <div className="w-full flex flex-row items-center gap-2 opacity-30 px-2">
                                                                                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center"><UserCircle className="w-4 h-4" /></div>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] font-bold">-</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                 );
            default: return null;
        }
    };

    return (
        <>
        <Helmet><title>TV Display Mode - LPQ Al-Fath Maulana</title></Helmet>
        <div className={`fixed inset-0 z-50 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'} overflow-hidden flex flex-col transition-colors duration-500`}>
            <div className={`h-20 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-b flex justify-between items-center px-8 shadow-lg z-20`}>
                <div className="flex items-center gap-4"><img src={logoUrl} onError={() => setLogoUrl('/logo-lpq-al-fath-maulana.webp')} alt="Logo LPQ Al-Fath Maulana" className="h-14 w-14 rounded-2xl bg-white/95 p-1.5 object-contain shadow-lg ring-1 ring-blue-500/20" /><div><h1 className="text-2xl font-bold tracking-wider font-cinzel">LPQ AL-FATH MAULANA</h1><p className={`text-xs tracking-[0.3em] font-mono ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>INFORMATION DISPLAY SYSTEM</p></div></div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => setManualScanOpen(true)} className="hidden md:flex" title="Manual Scan"><Keyboard className="w-5 h-5"/></Button>
                    <Button variant="outline" size="icon" onClick={toggleTheme}>{isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}</Button>
                    <div className={`w-px h-8 ${isDark ? 'bg-slate-700' : 'bg-slate-300'} mx-2`}></div>
                    <DigitalClock size="small" showSeconds={config.showSeconds} colorClass={isDark ? 'text-white' : 'text-slate-800'} />
                    <div onClick={(e) => { e.stopPropagation(); navigate('/absensi-digital'); }} className="ml-4 opacity-50 hover:opacity-100 cursor-pointer p-2"><XCircle className="w-8 h-8" /></div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-gradient-to-br from-slate-100 to-white dark:from-slate-950 dark:to-black">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <AnimatePresence>
                    {popupScan && <PopupScanResult scan={popupScan} />}
                </AnimatePresence>
                <AnimatePresence mode="wait"><motion.div key={activeSession} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full relative z-10">{renderContent()}</motion.div></AnimatePresence>
            </div>
            <div className={`h-12 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-t flex justify-center items-center gap-4 overflow-x-auto z-20`}>{sessionOrder.map((s, idx) => (<div key={idx} onClick={() => setActiveSession(s.id)} className={`cursor-pointer flex items-center gap-2 px-4 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap hover:scale-110 ${activeSession === s.id ? (isDark ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-400' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-700') : 'opacity-30 hover:opacity-100'}`}><div className={`w-2 h-2 rounded-full ${activeSession === s.id ? 'bg-current animate-pulse' : 'bg-gray-400'}`}></div>{s.label}</div>))}</div>

            <Dialog open={manualScanOpen} onOpenChange={setManualScanOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Manual Input ID</DialogTitle></DialogHeader>
                    <form onSubmit={handleManualScanSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input placeholder="Masukkan ID/NIP/Tag..." value={manualScanId} onChange={(e) => setManualScanId(e.target.value)} autoFocus />
                            <p className="text-xs text-muted-foreground">Gunakan fitur ini jika scanner tidak merespon atau untuk input manual.</p>
                        </div>
                        <div className="flex justify-end"><Button type="submit">Proses Scan</Button></div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
        </>
    );
};

export default TvDisplayPage;
