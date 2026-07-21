import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Crown, Star, Sparkles, CheckCircle } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';

const TopScorePage = () => {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rfidTag, setRfidTag] = useState('');
    const inputRef = useRef(null);
    const [lastScanTime, setLastScanTime] = useState(0);

    // Auto-focus input for RFID scanning
    useEffect(() => {
        const focusInput = () => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        };

        focusInput();
        const interval = setInterval(focusInput, 2000);
        window.addEventListener('click', focusInput);

        return () => {
            clearInterval(interval);
            window.removeEventListener('click', focusInput);
        };
    }, []);

    useEffect(() => {
        const fetchTopScores = async () => {
            try {
                const { data, error } = await supabase
                    .from('santri')
                    .select('id, nama_lengkap, points, foto_url, sesi_mengaji, jilid')
                    .order('points', { ascending: false })
                    .limit(10);

                if (error) throw error;
                setStudents(data || []);
            } catch (err) {
                console.error("Error fetching top scores:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTopScores();
    }, []);

    const processRfidScan = async (tag) => {
        const now = Date.now();
        if (now - lastScanTime < 2000) return; // Prevent double scans within 2 seconds
        setLastScanTime(now);

        const cleanTag = tag.trim();
        if (!cleanTag) return;

        try {
            // Find student by RFID
            const { data: student, error: studentError } = await supabase
                .from('santri')
                .select('*')
                .eq('rfid_tag', cleanTag)
                .single();

            if (studentError || !student) {
                toast({
                    title: "Kartu Tidak Dikenal",
                    description: "Data santri tidak ditemukan untuk kartu ini.",
                    variant: "destructive"
                });
                return;
            }

            const today = new Date().toISOString().split('T')[0];

            // Check if already present today
            const { data: existingAttendance } = await supabase
                .from('attendance')
                .select('id')
                .eq('user_id', student.id)
                .eq('attendance_date', today)
                .maybeSingle();

            if (existingAttendance) {
                toast({
                    title: "Sudah Absen",
                    description: `${student.nama_lengkap} sudah melakukan absensi hari ini.`,
                    className: "bg-blue-50 border-blue-200 text-blue-800"
                });
                return;
            }

            // Insert attendance
            const { error: insertError } = await supabase.from('attendance').insert({
                user_id: student.id,
                role: 'santri',
                attendance_date: today,
                check_in_time: new Date().toTimeString().split(' ')[0],
                status: 'Hadir',
                sesi: student.sesi_mengaji || 'Pagi',
                class_id: student.id_kelas
            });

            if (insertError) throw insertError;

            toast({
                title: "Absensi Berhasil!",
                description: `Selamat datang, ${student.nama_lengkap}`,
                className: "bg-green-50 border-green-200 text-green-800"
            });

        } catch (error) {
            console.error("Attendance scan error:", error);
            toast({
                title: "Gagal Memproses",
                description: "Terjadi kesalahan saat memproses absensi.",
                variant: "destructive"
            });
        } finally {
            setRfidTag(''); // Clear input
        }
    };

    const handleRfidSubmit = (e) => {
        e.preventDefault();
        processRfidScan(rfidTag);
    };

    const getRankStyles = (index) => {
        switch (index) {
            case 0: // 1st Place - Gold
                return {
                    borderColor: 'border-yellow-400',
                    gradient: 'from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/20',
                    iconColor: 'text-yellow-500',
                    shadow: 'shadow-yellow-200 dark:shadow-yellow-900/50',
                    badge: { bg: 'bg-gradient-to-br from-yellow-300 to-amber-500', text: 'text-white' }
                };
            case 1: // 2nd Place - Silver
                return {
                    borderColor: 'border-slate-300',
                    gradient: 'from-slate-50 to-slate-200 dark:from-slate-800/50 dark:to-slate-900/50',
                    iconColor: 'text-slate-400',
                    shadow: 'shadow-slate-200 dark:shadow-slate-900/50',
                    badge: { bg: 'bg-gradient-to-br from-slate-300 to-slate-500', text: 'text-white' }
                };
            case 2: // 3rd Place - Bronze
                return {
                    borderColor: 'border-orange-300',
                    gradient: 'from-orange-50 to-red-100 dark:from-orange-900/30 dark:to-red-900/20',
                    iconColor: 'text-orange-600',
                    shadow: 'shadow-orange-200 dark:shadow-orange-900/50',
                    badge: { bg: 'bg-gradient-to-br from-orange-300 to-red-600', text: 'text-white' }
                };
            default: // Others
                return {
                    borderColor: 'border-white dark:border-slate-700',
                    gradient: 'from-white to-blue-50 dark:from-slate-800 dark:to-slate-900',
                    iconColor: 'text-blue-500',
                    shadow: 'shadow-sm',
                    badge: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' }
                };
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    // Premium Trophy Animation Variants
    const trophyVariants = {
        animate: {
            rotateY: [0, 360],
            scale: [1, 1.1, 1],
            filter: [
                "drop-shadow(0px 0px 5px rgba(59, 130, 246, 0.3))",
                "drop-shadow(0px 0px 15px rgba(59, 130, 246, 0.6))",
                "drop-shadow(0px 0px 5px rgba(59, 130, 246, 0.3))"
            ]
        }
    };

    const sparkleVariants = {
        animate: {
            opacity: [0, 1, 0],
            scale: [0.5, 1.2, 0.5],
            y: [0, -20]
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 relative overflow-hidden font-sans text-slate-900 dark:text-slate-100">
            <Helmet>
                <title>Papan Skor Santri Terbaik - LPQ Al-Fath Maulana</title>
                <meta name="description" content="Leaderboard Top 10 Santri dengan poin tertinggi di LPQ Al-Fath Maulana." />
            </Helmet>

            {/* Hidden RFID Input */}
            <form onSubmit={handleRfidSubmit} className="absolute opacity-0 -z-50 top-0 left-0 w-0 h-0 overflow-hidden">
                <Input
                    ref={inputRef}
                    value={rfidTag}
                    onChange={(e) => setRfidTag(e.target.value)}
                    autoFocus
                    autoComplete="off"
                />
                <button type="submit">Scan</button>
            </form>

            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100 to-transparent dark:from-blue-950/40 dark:to-transparent -z-10" />
            <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-purple-200/50 dark:bg-purple-900/20 rounded-full blur-[100px] -z-10" />
            <div className="absolute bottom-[-100px] left-[-100px] w-96 h-96 bg-yellow-200/50 dark:bg-yellow-900/20 rounded-full blur-[100px] -z-10" />

            <div className="max-w-4xl mx-auto relative z-10">
                <div className="flex items-center justify-between mb-12">
                     <Button
                        variant="ghost"
                        onClick={() => navigate('/absensi-digital')}
                        className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" /> Kembali
                    </Button>
                    <div className="flex flex-col items-center">
                         <div className="flex items-center gap-4 mb-2 relative">
                             {/* Premium Left Trophy */}
                             <div className="relative">
                                 <motion.div
                                    variants={trophyVariants}
                                    animate="animate"
                                    transition={{
                                        duration: 4,
                                        ease: "easeInOut",
                                        repeat: Infinity,
                                        repeatType: "loop"
                                    }}
                                 >
                                    <Trophy className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                                 </motion.div>

                                 {/* Sparkles */}
                                 <motion.div
                                    className="absolute -top-2 -right-2"
                                    variants={sparkleVariants}
                                    animate="animate"
                                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                                 >
                                    <Sparkles className="w-4 h-4 text-yellow-400" fill="currentColor" />
                                 </motion.div>
                                 <motion.div
                                    className="absolute bottom-0 -left-2"
                                    variants={sparkleVariants}
                                    animate="animate"
                                    transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
                                 >
                                    <Star className="w-3 h-3 text-blue-300" fill="currentColor" />
                                 </motion.div>
                             </div>

                             <h1 className="text-3xl md:text-5xl font-black text-center text-blue-600 dark:text-blue-400 drop-shadow-sm tracking-tight">
                                Papan Skor Santri Terbaik
                             </h1>

                             {/* Premium Right Trophy */}
                             <div className="relative">
                                 <motion.div
                                    variants={trophyVariants}
                                    animate="animate"
                                    transition={{
                                        duration: 4,
                                        ease: "easeInOut",
                                        repeat: Infinity,
                                        repeatType: "loop",
                                        delay: 0.5 // Offset animation
                                    }}
                                 >
                                    <Trophy className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                                 </motion.div>

                                 {/* Sparkles */}
                                 <motion.div
                                    className="absolute -top-3 left-0"
                                    variants={sparkleVariants}
                                    animate="animate"
                                    transition={{ duration: 2.2, repeat: Infinity, delay: 0.8 }}
                                 >
                                    <Sparkles className="w-4 h-4 text-yellow-400" fill="currentColor" />
                                 </motion.div>
                             </div>
                         </div>
                        <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs md:text-sm animate-pulse">Leaderboard Poin Tertinggi • Tap Kartu Untuk Absen</p>
                    </div>
                    <div className="w-[100px]" /> {/* Spacer for balance */}
                </div>

                {isLoading ? (
                     <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-24 bg-white/50 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-4"
                    >
                        {students.map((student, index) => {
                            const styles = getRankStyles(index);
                            return (
                                <motion.div
                                    key={student.id}
                                    variants={itemVariants}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    className={`
                                        relative group flex items-center p-4 rounded-3xl border-2 transition-all duration-300
                                        bg-gradient-to-r ${styles.gradient}
                                        ${styles.borderColor} ${styles.shadow} shadow-lg
                                    `}
                                >
                                    {/* Rank Badge */}
                                    <div className={`
                                        absolute -left-3 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12
                                        rounded-full flex items-center justify-center font-black text-lg md:text-xl shadow-md z-20
                                        ${styles.badge.bg} ${styles.badge.text} border-2 border-white dark:border-slate-900
                                    `}>
                                        {index + 1}
                                    </div>

                                    {/* Special Icon for Top 3 */}
                                    {index < 3 && (
                                        <div className="absolute -top-3 -right-2 transform rotate-12 z-20">
                                            <Crown className={`w-8 h-8 md:w-10 md:h-10 ${styles.iconColor} drop-shadow-md`} fill="currentColor" />
                                        </div>
                                    )}

                                    {/* Avatar */}
                                    <div className="ml-8 md:ml-10 relative">
                                        <Avatar className={`w-14 h-14 md:w-20 md:h-20 border-4 border-white dark:border-slate-900 shadow-md`}>
                                            <AvatarImage src={student.foto_url} className="object-cover" />
                                            <AvatarFallback className="bg-slate-200 text-slate-500 text-xl font-bold">{student.nama_lengkap.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        {index < 3 && <Sparkles className="absolute -bottom-1 -right-1 w-5 h-5 text-yellow-400 animate-pulse" fill="currentColor"/>}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 ml-4 md:ml-6 min-w-0">
                                        <h3 className="font-bold text-lg md:text-2xl truncate text-slate-800 dark:text-slate-100">
                                            {student.nama_lengkap}
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground mt-1">
                                            <span className="bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5">{student.sesi_mengaji || '-'}</span>
                                            <span className="bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5">{student.jilid || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Points */}
                                    <div className="flex items-center gap-4 ml-4">
                                        <div className="text-right pr-2 md:pr-4">
                                            <div className="text-xs md:text-sm font-bold uppercase text-muted-foreground tracking-wider mb-0.5">Total Poin</div>
                                            <div className="flex items-center justify-end gap-1.5 text-yellow-600 dark:text-yellow-400">
                                                <Star className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                                                <span className="text-2xl md:text-4xl font-black tracking-tight">{student.points}</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default TopScorePage;
