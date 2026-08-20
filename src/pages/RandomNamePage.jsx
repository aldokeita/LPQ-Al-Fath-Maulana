
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    RefreshCw, ArrowLeft, Loader2, Sparkles, Sun, Moon,
    Search, Settings, Save, X
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

// --- Particle Component for Background ---
const FloatingParticle = ({ delay, isDark }) => (
    <motion.div
        className={`absolute rounded-full blur-[1px] ${isDark ? 'bg-white/20' : 'bg-blue-500/20'}`}
        initial={{ y: "110vh", x: Math.random() * 100 + "vw", opacity: 0, scale: 0 }}
        animate={{
            y: "-10vh",
            opacity: [0, 0.5, 0],
            scale: [0, Math.random() * 2 + 1, 0],
            rotate: 360
        }}
        transition={{
            duration: Math.random() * 10 + 15,
            repeat: Infinity,
            delay: delay,
            ease: "linear"
        }}
        style={{ width: Math.random() * 6 + 2, height: Math.random() * 6 + 2 }}
    />
);

const RandomNamePage = () => {
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const { role } = useAuth(); // Destructure role from useAuth

    // Core Data State
    const [santriList, setSantriList] = useState([]);
    const [displaySantri, setDisplaySantri] = useState(null);
    const [finalSelected, setFinalSelected] = useState(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isShuffling, setIsShuffling] = useState(false);
    const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    // Settings State
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [pointSettings, setPointSettings] = useState({
        id: null,
        additions: [1, 3, 10],
        deductions: [-1, -3, -5]
    });

    const handleBackNavigation = () => {
        if (role === 'guru' || role === 'admin' || role === 'santri') {
            navigate('/dashboard');
        } else {
            // Default fallback if role is undefined or something else (e.g. public access if allowed in future)
            navigate('/');
        }
    };

    // --- Fetch Data ---
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoadingData(true);
            try {
                // 1. Fetch Santri
                const { data: santriData, error: santriError } = await supabase
                    .rpc('list_random_name_santri');

                if (santriError) throw santriError;
                const resolvedSantri = await resolveAvatarRecords(santriData || [], {
                    ownerType: 'santri',
                });
                setSantriList(resolvedSantri);

                // 2. Fetch Settings using website_content instead of hallucinated table
                const { data: settingsData, error: settingsError } = await supabase
                    .from('website_content')
                    .select('id, content')
                    .eq('key', 'random_name_settings')
                    .maybeSingle();

                if (!settingsError && settingsData?.content) {
                    setPointSettings({
                        id: settingsData.id,
                        additions: settingsData.content.addition_buttons || [1, 3, 10],
                        deductions: settingsData.content.deduction_buttons || [-1, -3, -5]
                    });
                }
            } catch (error) {
                console.error("Error loading data:", error);
                toast({ title: 'Error', description: 'Gagal memuat data.', variant: 'destructive' });
            } finally {
                setIsLoadingData(false);
            }
        };

        loadInitialData();
    }, []);

    // --- Search Logic ---
    useEffect(() => {
        if (searchTerm.trim() === "") {
            setSearchResults([]);
            return;
        }
        const lowerTerm = searchTerm.toLowerCase();
        const filtered = santriList.filter(s =>
            s.nama_lengkap.toLowerCase().includes(lowerTerm)
        ).slice(0, 5); // Limit to 5 results
        setSearchResults(filtered);
    }, [searchTerm, santriList]);

    const handleSelectSearchedSantri = (santri) => {
        setDisplaySantri(santri);
        setFinalSelected(santri);
        setSearchTerm("");
        setSearchResults([]);
        setIsShuffling(false);
    };

    // --- Save Settings ---
    const handleSaveSettings = async () => {
        try {
            const contentPayload = {
                addition_buttons: pointSettings.additions,
                deduction_buttons: pointSettings.deductions
            };

            if (!pointSettings.id) {
                const { error } = await supabase.from('website_content').insert({
                    key: 'random_name_settings',
                    content: contentPayload
                });
                if (error) throw error;
            } else {
                // Update
                const { error } = await supabase
                    .from('website_content')
                    .update({
                        content: contentPayload,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', pointSettings.id);
                if (error) throw error;
            }
            toast({ title: "Berhasil", description: "Pengaturan poin disimpan." });
            setSettingsOpen(false);
        } catch (error) {
            toast({ title: "Gagal", description: "Gagal menyimpan pengaturan.", variant: "destructive" });
        }
    };

    // --- Shuffle Logic (Extended Duration) ---
    const pickRandomSantri = async () => {
        if (santriList.length === 0) return;

        setIsShuffling(true);
        setFinalSelected(null);
        setDisplaySantri(null);
        setSearchTerm(""); // Clear search if any

        const randomIndex = Math.floor(Math.random() * santriList.length);
        const winner = santriList[randomIndex];

        // Extended shuffle sequence ~3.5s total
        // Phase 1: Rapid fire
        const rapidCount = 15;
        for (let i = 0; i < rapidCount; i++) {
            const tempIndex = Math.floor(Math.random() * santriList.length);
            setDisplaySantri(santriList[tempIndex]);
            await new Promise(r => setTimeout(r, 60));
        }

        // Phase 2: Decelerating
        const decelCount = 8;
        for (let i = 0; i < decelCount; i++) {
            const tempIndex = Math.floor(Math.random() * santriList.length);
            setDisplaySantri(santriList[tempIndex]);
            await new Promise(r => setTimeout(r, 100 + (i * 50)));
        }

        // Phase 3: Final Suspense
        const finalCount = 3;
        for (let i = 0; i < finalCount; i++) {
            const tempIndex = Math.floor(Math.random() * santriList.length);
            setDisplaySantri(santriList[tempIndex]);
            await new Promise(r => setTimeout(r, 500 + (i * 250)));
        }

        // Reveal Winner
        setDisplaySantri(winner);
        setFinalSelected(winner);
        setIsShuffling(false);
    };

    // --- Points Logic ---
    const updatePoints = async (amount) => {
        if (!finalSelected || isUpdatingPoints) return;

        setIsUpdatingPoints(true);
        try {
            const previousPoints = Number(finalSelected.points) || 0;
            const { data, error } = await supabase.rpc('increment_santri_points', {
                p_santri_id: finalSelected.id,
                p_amount: amount
            });

            if (error) throw error;

            const updatedPoints = Number(data);
            if (!Number.isInteger(updatedPoints) || updatedPoints < 0) {
                throw new Error('Nilai poin terbaru tidak valid. Silakan muat ulang halaman.');
            }
            const appliedAmount = updatedPoints - previousPoints;

            const updatedSantri = { ...finalSelected, points: updatedPoints };
            setFinalSelected(updatedSantri);
            setDisplaySantri(updatedSantri);

            setSantriList(prev => prev.map(s => s.id === finalSelected.id ? { ...s, points: updatedPoints } : s));

            const isDeduction = amount < 0;
            toast({
                title: isDeduction ? "Poin Dikurangi" : "Poin Ditambahkan!",
                description: `${appliedAmount > 0 ? '+' : ''}${appliedAmount} Poin untuk ${finalSelected.nama_lengkap}`,
                className: isDeduction
                    ? "bg-red-500 text-white border-none shadow-lg"
                    : "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none shadow-lg"
            });
        } catch (error) {
            toast({ title: "Gagal memperbarui poin", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdatingPoints(false);
        }
    };

    // --- Gender Based Styles ---
    const getGenderStyles = (gender) => {
        const isFemale = gender?.toLowerCase() === 'perempuan';
        return {
            color: isFemale ? 'text-pink-500' : 'text-blue-500',
            bg: isFemale ? 'bg-pink-500' : 'bg-blue-500',
            gradient: isFemale ? 'from-pink-500 to-rose-500' : 'from-blue-500 to-cyan-500',
            shadow: isFemale ? 'shadow-pink-500/50' : 'shadow-blue-500/50',
            borderColor: isFemale ? 'border-pink-200 dark:border-pink-900' : 'border-blue-200 dark:border-blue-900',
        };
    };

    const genderStyle = getGenderStyles(displaySantri?.jenis_kelamin);

    // --- Button Color Maps ---
    const additionColors = [
        { from: 'from-emerald-400', to: 'to-green-500', text: 'text-emerald-700' }, // +1 Green
        { from: 'from-blue-400', to: 'to-cyan-500', text: 'text-blue-700' },     // +3 Blue
        { from: 'from-purple-400', to: 'to-violet-500', text: 'text-purple-700' } // +10 Purple
    ];

    const deductionColors = [
        { from: 'from-orange-400', to: 'to-red-500', text: 'text-red-700' },
        { from: 'from-red-400', to: 'to-rose-500', text: 'text-rose-700' },
        { from: 'from-rose-500', to: 'to-pink-600', text: 'text-pink-700' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-500">

            {/* --- Premium Background Effects --- */}
            <div className="absolute inset-0 z-0 overflow-hidden transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-500" />
                <motion.div
                    animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] transition-colors duration-500 ${isDark ? 'bg-purple-600/20' : 'bg-blue-300/30'}`}
                />
                <motion.div
                    animate={{ x: [0, -100, 0], y: [0, 100, 0], scale: [1, 1.5, 1] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className={`absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] transition-colors duration-500 ${isDark ? 'bg-cyan-600/10' : 'bg-purple-300/30'}`}
                />
                <div className={`absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 mix-blend-overlay ${!isDark && 'invert opacity-10'}`}></div>
                <div className={`absolute inset-0 bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] ${
                    isDark
                    ? 'bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]'
                    : 'bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)]'
                }`}></div>
                {[...Array(20)].map((_, i) => <FloatingParticle key={`particle-${i}`} delay={i * 0.5} isDark={isDark} />)}
            </div>

            {/* --- Navigation & Controls --- */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-6 w-full px-4 md:px-8 z-50 flex justify-between items-center gap-4"
            >
                {/* Back Button */}
                <Button
                    variant="ghost"
                    className="shrink-0 text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-full px-4 md:px-6 transition-all duration-300"
                    onClick={handleBackNavigation}
                >
                    <ArrowLeft className="w-5 h-5 mr-0 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
                </Button>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-md mx-auto z-[60]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Cari Santri..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10 rounded-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(""); setSearchResults([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full"
                            >
                                <X className="w-3 h-3 text-slate-500" />
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    <AnimatePresence>
                        {searchResults.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-12 left-0 right-0 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-[70]"
                            >
                                {searchResults.map((santri) => (
                                    <div
                                        key={santri.id}
                                        onClick={() => handleSelectSearchedSantri(santri)}
                                        className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border-b border-slate-100 dark:border-white/5 last:border-0"
                                    >
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={santri.foto_url} />
                                            <AvatarFallback>{santri.nama_lengkap.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">{santri.nama_lengkap}</span>
                                            <span className="text-xs text-slate-500">{santri.jilid}</span>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right Actions */}
                <div className="flex gap-2 shrink-0">
                    {/* Settings Modal */}
                    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5">
                                <Settings className="w-5 h-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10">
                            <DialogHeader>
                                <DialogTitle>Pengaturan Poin</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-slate-500">Tombol Penambahan (Positif)</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[0, 1, 2].map(idx => (
                                            <div key={`add-${idx}`}>
                                                <Label className="text-xs mb-1 block">Tombol {idx + 1}</Label>
                                                <Input
                                                    type="number"
                                                    value={pointSettings.additions[idx]}
                                                    onChange={(e) => {
                                                        const newAdds = [...pointSettings.additions];
                                                        newAdds[idx] = parseInt(e.target.value) || 0;
                                                        setPointSettings({...pointSettings, additions: newAdds});
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-slate-500">Tombol Pengurangan (Negatif)</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[0, 1, 2].map(idx => (
                                            <div key={`deduct-${idx}`}>
                                                <Label className="text-xs mb-1 block">Tombol {idx + 1}</Label>
                                                <Input
                                                    type="number"
                                                    value={pointSettings.deductions[idx]}
                                                    onChange={(e) => {
                                                        const newDeds = [...pointSettings.deductions];
                                                        newDeds[idx] = parseInt(e.target.value) || 0;
                                                        setPointSettings({...pointSettings, deductions: newDeds});
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Save className="w-4 h-4 mr-2" /> Simpan Perubahan
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-all duration-300 border border-slate-200 dark:border-white/5"
                    >
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </Button>
                </div>
            </motion.div>

            {/* --- Main Content --- */}
            <div className="relative z-10 w-full max-w-xl perspective-1000 mt-12">
                <AnimatePresence mode="wait">

                    {/* STATE 1: IDLE / START BUTTON */}
                    {!displaySantri && !isShuffling ? (
                        <motion.div
                            key="start"
                            initial={{ opacity: 0, scale: 0.8, rotateX: 20 }}
                            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotateX: -20 }}
                            transition={{ type: "spring", stiffness: 100 }}
                            className="flex flex-col items-center justify-center space-y-12 py-10"
                        >
                            <div className="relative group cursor-pointer" onClick={pickRandomSantri}>
                                <div className="absolute -inset-4 bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 rounded-full blur-xl opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="relative w-56 h-56 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center shadow-2xl overflow-hidden group transition-colors duration-300"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    {isLoadingData ? (
                                        <Loader2 className="w-16 h-16 text-cyan-500 dark:text-cyan-400 animate-spin" />
                                    ) : (
                                        <>
                                            <Sparkles className="w-20 h-20 text-slate-400 dark:text-white/80 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors duration-300 mb-2" />
                                            <span className="text-sm font-bold tracking-[0.2em] text-slate-500 dark:text-white/60 uppercase">Mulai Acak</span>
                                        </>
                                    )}
                                </motion.button>
                            </div>

                            <div className="text-center space-y-2">
                                <motion.h1
                                    className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-700 via-slate-900 to-slate-700 dark:from-white dark:via-cyan-200 dark:to-white drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    RANDOM SANTRI
                                </motion.h1>
                                <motion.p
                                    className="text-slate-500 dark:text-blue-200/60 font-medium tracking-wide transition-colors duration-300"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    Pilih santri terbaik untuk mendapatkan poin apresiasi
                                </motion.p>
                            </div>
                        </motion.div>
                    ) : (

                        /* STATE 2: SHUFFLING / RESULT */
                        <motion.div
                            key="card"
                            initial={{ opacity: 0, y: 100, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            className="w-full"
                        >
                            <Card className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden rounded-[2.5rem] relative transition-colors duration-300">
                                {/* Card Background Gradient */}
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-slate-100/50 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

                                <div className="p-8 md:p-12 flex flex-col items-center text-center relative z-10">

                                    {/* Avatar Section with Gender Styling */}
                                    <motion.div
                                        className="relative mb-8"
                                        animate={isShuffling ? {
                                            rotateY: [0, 180, 360],
                                            scale: [1, 0.9, 1]
                                        } : {
                                            rotateY: 0,
                                            scale: [1, 1.05, 1]
                                        }}
                                        transition={isShuffling ? {
                                            duration: 0.4,
                                            repeat: Infinity,
                                            ease: "linear"
                                        } : {
                                            duration: 0.5,
                                            type: "spring"
                                        }}
                                    >
                                        {/* Dynamic Glow Pulse based on Gender */}
                                        <motion.div
                                            className={`${isShuffling ? '' : genderStyle.bg} absolute inset-0 rounded-full blur-2xl opacity-60 transition-all duration-500`}
                                            animate={!isShuffling ? {
                                                opacity: [0.4, 0.8, 0.4],
                                                scale: [0.9, 1.1, 0.9]
                                            } : { opacity: 0.3 }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                            }}
                                        />

                                        <Avatar
                                            className={`w-40 h-40 md:w-48 md:h-48 border-4 shadow-2xl relative z-10 transition-all duration-500 object-cover ${isShuffling ? 'border-white/20' : genderStyle.borderColor}`}
                                            style={{
                                                boxShadow: !isShuffling ? `0 0 40px var(--tw-shadow-color)` : 'none'
                                            }}
                                        >
                                            <AvatarImage src={displaySantri?.foto_url} className="object-cover" />
                                            <AvatarFallback className="text-5xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                {displaySantri?.nama_lengkap?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* Gender Badge with Points - REPLACES RANK BADGE */}
                                        {!isShuffling && (
                                            <motion.div
                                                initial={{ scale: 0, rotate: -45 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                className={`absolute -bottom-4 left-1/2 -translate-x-1/2 ${genderStyle.bg} text-white px-6 py-2 rounded-full shadow-lg z-20 flex items-center gap-2 border-2 border-white dark:border-slate-900 whitespace-nowrap`}
                                            >
                                                <Sparkles className="w-4 h-4 text-white" />
                                                <span className="font-bold text-sm tracking-wider uppercase">{displaySantri?.points || 0} Poin</span>
                                            </motion.div>
                                        )}
                                    </motion.div>

                                    {/* Text Section */}
                                    <div className="space-y-2 mb-8 min-h-[100px] flex flex-col justify-center">
                                        <motion.h2
                                            className={`text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r transition-all duration-300 ${
                                                isShuffling
                                                    ? "from-slate-400 to-slate-300 dark:from-white dark:to-white blur-sm scale-90"
                                                    : genderStyle.gradient
                                            }`}
                                        >
                                            {displaySantri?.nama_lengkap || "..."}
                                        </motion.h2>
                                        {!isShuffling && (
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-slate-500 dark:text-slate-400 font-medium tracking-widest uppercase text-sm"
                                            >
                                                {displaySantri?.jilid}
                                            </motion.p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {!isShuffling && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="w-full space-y-6"
                                        >
                                            {/* Addition Buttons */}
                                            <div className="grid grid-cols-3 gap-3 w-full">
                                                {pointSettings.additions.map((val, idx) => {
                                                    const color = additionColors[idx] || additionColors[0];
                                                    return (
                                                        <motion.button
                                                            key={`add-${idx}`}
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => updatePoints(val)}
                                                            disabled={isUpdatingPoints}
                                                            className="relative overflow-hidden group rounded-xl p-3 border border-slate-200 dark:border-white/10 shadow-lg bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:cursor-wait disabled:opacity-60"
                                                        >
                                                            <div className={`absolute inset-0 bg-gradient-to-br ${color.from} ${color.to} opacity-10 group-hover:opacity-20 transition-opacity`} />
                                                            <div className="relative z-10 flex flex-col items-center gap-1">
                                                                <span className={`text-xl font-black bg-clip-text text-transparent bg-gradient-to-br ${color.from} ${color.to}`}>+{val}</span>
                                                            </div>
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>

                                            {/* Deduction Buttons */}
                                            <div className="grid grid-cols-3 gap-3 w-full">
                                                {pointSettings.deductions.map((val, idx) => {
                                                    const color = deductionColors[idx] || deductionColors[0];
                                                    return (
                                                        <motion.button
                                                            key={`deduct-${idx}`}
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => updatePoints(val)}
                                                            disabled={isUpdatingPoints}
                                                            className="relative overflow-hidden group rounded-xl p-3 border border-slate-200 dark:border-white/10 shadow-lg bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:cursor-wait disabled:opacity-60"
                                                        >
                                                            <div className={`absolute inset-0 bg-gradient-to-br ${color.from} ${color.to} opacity-10 group-hover:opacity-20 transition-opacity`} />
                                                            <div className="relative z-10 flex flex-col items-center gap-1">
                                                                <span className={`text-xl font-black bg-clip-text text-transparent bg-gradient-to-br ${color.from} ${color.to}`}>{val}</span>
                                                            </div>
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>

                                            <div className="pt-4 border-t border-slate-200 dark:border-white/5">
                                                <Button
                                                    onClick={pickRandomSantri}
                                                    variant="ghost"
                                                    className="w-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 h-12 rounded-xl border border-slate-200 dark:border-white/5"
                                                >
                                                    <RefreshCw className="w-4 h-4 mr-2" /> Acak Lagi
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default RandomNamePage;
