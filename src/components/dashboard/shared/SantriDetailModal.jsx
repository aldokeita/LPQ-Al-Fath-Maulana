import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  Award, Edit, Clock, CalendarDays, History, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Check, X, FileText, Download, Loader2,
  BookOpen, Printer, Sparkles, Star, ShieldCheck, CheckCircle2,
  TrendingUp, BarChart2, HeartHandshake, UserCheck, GraduationCap, FileCode2
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  calculateAttendanceData,
  getHafalanProgressData,
  getPointsData,
  fetchSantriCharacterReportData,
  calculateProgressAverageScores,
  generateRaporPDF,
  generateRaporDOCX
} from '@/utils/reportUtils';
import { getSessionName } from '@/utils/sessionMapping';
import { fetchSantriNotes, getAcademicErrorMessage, saveSantriNote } from '@/lib/academicAdapters';
import SantriDevelopmentProfile from '@/components/dashboard/shared/SantriDevelopmentProfile';
import { downloadRaporHTML } from '@/utils/raporHtmlUtils';

const SantriDetailModal = ({ santri, isOpen, onOpenChange, onPromote, onDemote }) => {
    const { user, role } = useAuth();
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [editingNote, setEditingNote] = useState(null);
    const [jilidDuration, setJilidDuration] = useState(null);
    const [lastPromotedDate, setLastPromotedDate] = useState(null);

    // Rapor & Report State
    const [isReportViewOpen, setIsReportViewOpen] = useState(false);
    const [isGeneratingRapor, setIsGeneratingRapor] = useState(false);
    const [isGeneratingHtml, setIsGeneratingHtml] = useState(false);
    const [isAttendanceRecapOpen, setIsAttendanceRecapOpen] = useState(false);
    const [attendanceMatrix, setAttendanceMatrix] = useState(null);
    const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
    const [isLoadingReportData, setIsLoadingReportData] = useState(false);

    // Period Selection: '1bulan' | '6bulan' | '1tahun'
    const [raporPeriodType, setRaporPeriodType] = useState('1bulan');
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
    const [selectedSemester, setSelectedSemester] = useState('1'); // '1' (Ganjil) or '2' (Genap)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    // Report Datasets
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [hafalanData, setHafalanData] = useState(null);
    const [characterData, setCharacterData] = useState(null);
    const [scoresSummary, setScoresSummary] = useState(null);

    const isPtpt = String(santri?.kategori || '').toUpperCase() === 'PTPT';

    const fetchNotes = useCallback(async () => {
        if (!santri?.id) return;
        try {
            const data = await fetchSantriNotes(santri.id);
            setNotes(data);
        } catch (error) {
            toast({ title: "Gagal memuat catatan", description: getAcademicErrorMessage(error), variant: 'destructive' });
        }
    }, [santri?.id]);

    // Fetch full santri data (including nama_ibu which may not be passed via props)
    const [santriFullData, setSantriFullData] = useState(null);
    const fetchSantriFullData = useCallback(async () => {
        if (!santri?.id) return;
        const { data } = await supabase
            .from('santri')
            .select('id, nama_ibu, nama_ayah, nama_wali, no_hp_ortu')
            .eq('id', santri.id)
            .maybeSingle();
        if (data) setSantriFullData(data);
    }, [santri?.id]);

    const guardianName = santriFullData?.nama_ibu || santriFullData?.nama_ayah || santriFullData?.nama_wali
        || santri?.nama_ibu || santri?.nama_ayah || santri?.nama_wali || '-';

    const fetchJilidHistory = useCallback(async () => {
        if (!santri?.id) return;
        const { data } = await supabase
            .from('jilid_history')
            .select('changed_at')
            .eq('santri_id', santri.id)
            .order('changed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let startDate = new Date(santri.created_at || Date.now());
        if (data?.changed_at) {
            startDate = new Date(data.changed_at);
        }

        setLastPromotedDate(startDate);
        const now = new Date();
        const diffTime = Math.abs(now - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setJilidDuration(diffDays);
    }, [santri?.id, santri?.created_at]);

    useEffect(() => {
        if (isOpen && santri?.id) {
            fetchNotes();
            fetchJilidHistory();
            fetchSantriFullData();
        }
    }, [isOpen, santri?.id, fetchNotes, fetchJilidHistory, fetchSantriFullData]);

    // Calculate Date Range based on Period Selection
    const dateRange = useMemo(() => {
        const yearNum = parseInt(selectedYear) || new Date().getFullYear();
        let startDate, endDate, periodText;

        if (raporPeriodType === '1bulan') {
            const monthNum = parseInt(selectedMonth) || (new Date().getMonth() + 1);
            startDate = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
            endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
            const monthName = new Date(yearNum, monthNum - 1, 1).toLocaleString('id-ID', { month: 'long' });
            periodText = `1 Bulan (${monthName} ${yearNum})`;
        } else if (raporPeriodType === '6bulan') {
            if (selectedSemester === '1') {
                startDate = new Date(yearNum, 6, 1).toISOString().split('T')[0]; // Jul
                endDate = new Date(yearNum, 11, 31).toISOString().split('T')[0]; // Dec
                periodText = `6 Bulan / Semester Ganjil (${yearNum})`;
            } else {
                startDate = new Date(yearNum, 0, 1).toISOString().split('T')[0]; // Jan
                endDate = new Date(yearNum, 5, 30).toISOString().split('T')[0]; // Jun
                periodText = `6 Bulan / Semester Genap (${yearNum})`;
            }
        } else {
            // 1 Tahun
            startDate = new Date(yearNum, 0, 1).toISOString().split('T')[0];
            endDate = new Date(yearNum, 11, 31).toISOString().split('T')[0];
            periodText = `1 Tahun Ajaran (${yearNum})`;
        }

        return { startDate, endDate, periodText };
    }, [raporPeriodType, selectedMonth, selectedSemester, selectedYear]);

    // Fetch Full Comprehensive Report View Data
    const fetchReportViewData = useCallback(async () => {
        if (!santri?.id) return;
        setIsLoadingReportData(true);
        try {
            const [attSummary, hafalan, charData] = await Promise.all([
                calculateAttendanceData(santri.id, dateRange.startDate, dateRange.endDate),
                getHafalanProgressData(santri.id),
                fetchSantriCharacterReportData(santri.id)
            ]);

            const summaryScores = calculateProgressAverageScores(attSummary, hafalan, charData);

            setAttendanceSummary(attSummary);
            setHafalanData(hafalan);
            setCharacterData(charData);
            setScoresSummary(summaryScores);
        } catch (error) {
            toast({ title: "Gagal memuat data rapor", description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingReportData(false);
        }
    }, [santri?.id, dateRange]);

    const handleOpenReportView = async () => {
        setIsReportViewOpen(true);
        await Promise.all([fetchReportViewData(), fetchSantriFullData()]);
    };

    useEffect(() => {
        if (isReportViewOpen && santri?.id) {
            fetchReportViewData();
        }
    }, [dateRange, isReportViewOpen, santri?.id, fetchReportViewData]);

    const handleSaveNote = async () => {
        if (!newNote.trim()) return;
        try {
            await saveSantriNote({ noteId: editingNote?.id, santriId: santri.id, note: newNote, userId: user?.id });
            toast({ title: "Catatan disimpan!" });
            setNewNote('');
            setEditingNote(null);
            fetchNotes();
        } catch (error) {
            toast({ title: "Gagal menyimpan catatan", description: getAcademicErrorMessage(error), variant: 'destructive' });
        }
    };

    const handleDownloadRaporPDF = async () => {
        setIsGeneratingRapor(true);
        try {
            const points = await getPointsData(santri.id);
            const mergedSantri = { ...santri, ...(santriFullData || {}) };
            const doc = await generateRaporPDF(
                mergedSantri,
                attendanceSummary || { totalDays: 0, totalPresent: 0, totalLate: 0, totalPermit: 0, totalAbsent: 0, attendancePercentage: 0 },
                hafalanData || { allItems: [], doa: { total: 0, completed: 0 }, sholat: { total: 0, completed: 0 }, surat: { total: 0, completed: 0 }, tahfizh: { total: 0, completed: 0 } },
                points,
                dateRange.periodText,
                characterData,
                scoresSummary
            );

            const cleanName = santri.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_');
            const cleanPeriod = dateRange.periodText.replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Rapor_LPQ_${cleanName}_${cleanPeriod}.pdf`);

            toast({ title: "Rapor Berhasil Diunduh!", description: "File PDF rapor akademik & karakter telah tersimpan." });
        } catch (error) {
            toast({ title: "Gagal mengunduh rapor PDF", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingRapor(false);
        }
    };

    const handleDownloadRaporHTML = async () => {
        if (!attendanceSummary || !hafalanData) {
            toast({ title: 'Menyiapkan Data Rapor', description: 'Mohon tunggu sampai data rapor selesai dimuat.' });
            return;
        }

        setIsGeneratingHtml(true);
        try {
            await downloadRaporHTML({
                santri: { ...santri, ...(santriFullData || {}) },
                attendance: attendanceSummary,
                hafalan: hafalanData,
                period: dateRange.periodText,
                character: characterData,
                scores: scoresSummary
            });
            toast({ title: 'Rapor HTML Berhasil Diunduh', description: 'File HTML mandiri siap dibuka atau dicetak dari browser.' });
        } catch (error) {
            toast({ title: 'Gagal mengunduh rapor HTML', description: error.message, variant: 'destructive' });
        } finally {
            setIsGeneratingHtml(false);
        }
    };

    if (!santri) return null;

    const currentYearNum = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYearNum - i).toString());

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mr-6">
                            <div>
                                <DialogTitle className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    Detail Santri: {santri?.nama_lengkap || 'Santri'}
                                </DialogTitle>
                                <DialogDescription>Informasi lengkap & catatan perkembangan akademik santri.</DialogDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="default"
                                    onClick={handleOpenReportView}
                                    disabled={isLoadingReportData}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md"
                                >
                                    {isLoadingReportData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                                    Cetak Rapor
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 pt-4 border-b border-slate-200 dark:border-slate-800 pb-6 relative">
                        <div className="flex flex-col gap-3 items-center">
                            <Avatar className="w-32 h-32 flex-shrink-0 border-4 border-slate-100 shadow-md">
                                <AvatarImage src={santri?.foto_url} className="object-cover" />
                                <AvatarFallback className="text-4xl font-bold">{santri?.nama_lengkap?.charAt(0) || 'S'}</AvatarFallback>
                            </Avatar>
                            <div className="flex gap-2 w-full justify-center">
                                {(onPromote || onDemote) && (
                                    <>
                                        {onPromote && (
                                            <Button onClick={onPromote} size="sm" className="h-8 flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold" title="Naik Jilid">
                                                <ChevronUp className="w-4 h-4 mr-1" /> Naik Jilid
                                            </Button>
                                        )}
                                        {onDemote && (
                                            <Button onClick={onDemote} size="sm" variant="outline" className="h-8 flex-1 border-red-200 hover:bg-red-50 text-red-700" title="Turun Jilid">
                                                <ChevronDown className="w-4 h-4 mr-1" /> Turun
                                            </Button>
                                        )}
                                    </>
                                )}
                                <Button
                                    size="sm"
                                    onClick={() => setIsAttendanceRecapOpen(true)}
                                    className="h-8 bg-gradient-to-r from-teal-500/15 via-cyan-500/20 to-blue-500/15 hover:from-teal-500/25 hover:to-blue-500/25 text-cyan-800 dark:text-cyan-200 border border-cyan-400/40 dark:border-cyan-700/50 backdrop-blur-md shadow-xs font-bold rounded-xl transition-all duration-200 px-3.5"
                                >
                                    <History className="w-4 h-4 mr-1.5 text-cyan-600 dark:text-cyan-400" /> Absensi
                                </Button>
                            </div>
                            {jilidDuration !== null && (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${jilidDuration > 90 ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-blue-100 text-blue-700 border-blue-200'} flex items-center gap-1 mt-1`}>
                                    <Clock className="w-3 h-3" /> {jilidDuration} Hari di {santri.jilid}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm w-full bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Nama Lengkap</p>
                                <p className="font-bold text-base text-slate-800 dark:text-slate-200">{santri.nama_lengkap}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Nama Panggilan</p>
                                <p className="font-bold text-base text-slate-800 dark:text-slate-200">{santri.nama_panggilan || santri.nama_lengkap?.trim().split(' ')[0] || '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Jilid Saat Ini</p>
                                <p className="font-black text-lg text-purple-600 dark:text-purple-400">{santri.jilid}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Terakhir Naik Jilid</p>
                                <p className="font-bold flex items-center gap-1 text-slate-800 dark:text-slate-200">
                                    <CalendarDays className="w-4 h-4 text-purple-500" />
                                    {lastPromotedDate ? new Date(lastPromotedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Kelas</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.className || santri.class?.nama_kelas || '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Wali Santri (Ibu)</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{guardianName}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6">
                        <SantriDevelopmentProfile
                            santriId={santri.id}
                            userId={user?.id}
                            editable={role === 'guru'}
                            showBehavior={role === 'guru'}
                            collapsible={true}
                        />
                    </div>

                    <div className="pt-6 space-y-4">
                        <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <Award className="w-5 h-5 text-amber-500" /> Catatan Guru & Evaluasi
                        </h3>
                        <div className="space-y-3 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <Textarea
                                placeholder="Tulis catatan, rekomendasi, atau evaluasi akademik..."
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                className="border-slate-300 dark:border-slate-700 focus:border-primary min-h-[100px] resize-none"
                            />
                            <div className="flex justify-end gap-2">
                                {editingNote && <Button variant="ghost" onClick={() => { setEditingNote(null); setNewNote(''); }}>Batal Edit</Button>}
                                <Button onClick={handleSaveNote} className="bg-primary hover:bg-primary/90 text-white shadow-sm font-bold">
                                    {editingNote ? 'Simpan Perubahan' : 'Tambah Catatan'}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4 mt-6">
                            {notes.map(note => (
                                <div key={note.id} className="text-sm p-4 border border-slate-200 dark:border-slate-800 rounded-xl relative group bg-white dark:bg-slate-900 hover:shadow-md transition-all duration-200">
                                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 text-base leading-relaxed">{note.note}</p>
                                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                {note.guru?.nama?.substring(0, 2) || 'GU'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">{note.guru?.nama || 'Unknown'}</p>
                                                <p className="text-[10px] text-muted-foreground">{new Date(note.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                            </div>
                                        </div>
                                        {note.guru_id === user?.id && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" onClick={() => { setEditingNote(note); setNewNote(note.note); }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ========================================================================================= */}
            {/* LPQ AURORA NEO GLASS - COMPREHENSIVE INTERACTIVE RAPOR PREVIEW & PRINT MODAL               */}
            {/* ========================================================================================= */}
            <Dialog open={isReportViewOpen} onOpenChange={setIsReportViewOpen}>
                <DialogContent className="max-w-7xl w-[95vw] max-h-[96vh] overflow-y-auto p-0 bg-slate-100 dark:bg-slate-950 print:p-0 print:bg-white print:max-w-none print:max-h-none print:overflow-visible print:w-full">
                    {/* Floating Header Controls */}
                    <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm print:hidden">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                Preview & Cetak Rapor Santri
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Rapor Akademik & Karakter LPQ Aurora Neo Glass.
                            </DialogDescription>
                        </div>

                        {/* Periode Rapor Switcher: 1 Bulan, 6 Bulan, 1 Tahun */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1">
                                <button
                                    onClick={() => setRaporPeriodType('1bulan')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        raporPeriodType === '1bulan'
                                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    )}
                                >
                                    1 Bulan
                                </button>
                                <button
                                    onClick={() => setRaporPeriodType('6bulan')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        raporPeriodType === '6bulan'
                                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    )}
                                >
                                    6 Bulan (Semester)
                                </button>
                                <button
                                    onClick={() => setRaporPeriodType('1tahun')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        raporPeriodType === '1tahun'
                                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                    )}
                                >
                                    1 Tahun
                                </button>
                            </div>

                            {/* Sub-selector Dropdown */}
                            {raporPeriodType === '1bulan' && (
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="h-8 text-xs w-[130px] bg-white dark:bg-slate-900">
                                        <SelectValue placeholder="Bulan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                                                {new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' })}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {raporPeriodType === '6bulan' && (
                                <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                                    <SelectTrigger className="h-8 text-xs w-[140px] bg-white dark:bg-slate-900">
                                        <SelectValue placeholder="Semester" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Semester Ganjil</SelectItem>
                                        <SelectItem value="2">Semester Genap</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}

                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="h-8 text-xs w-[90px] bg-white dark:bg-slate-900">
                                    <SelectValue placeholder="Tahun" />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map(y => (
                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.print()}
                                className="bg-white dark:bg-slate-900 border-slate-300 font-semibold"
                            >
                                <Printer className="w-4 h-4 mr-1.5 text-purple-600" /> Cetak
                            </Button>

                             <Button
                                size="sm"
                                onClick={handleDownloadRaporPDF}
                                disabled={isGeneratingRapor}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                            >
                                {isGeneratingRapor ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                                Download PDF
                            </Button>

                            <Button
                                size="sm"
                                onClick={async () => {
                                    if (attendanceSummary && hafalanData) {
                                        const mergedSantri = { ...santri, ...(santriFullData || {}) };
                                        await generateRaporDOCX(mergedSantri, attendanceSummary, hafalanData, dateRange.periodText, characterData, scoresSummary);
                                        toast({ title: 'Rapor DOCX Berhasil Diunduh', description: 'File Word (.docx) resmi telah tersimpan.' });
                                    } else {
                                        toast({ title: 'Menyiapkan Data Rapor', description: 'Mohon tunggu sejenak...' });
                                    }
                                }}
                                variant="outline"
                                className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100"
                            >
                                <FileText className="w-4 h-4 mr-1.5 text-blue-600" /> Download DOCX
                            </Button>

                            <Button
                                size="sm"
                                onClick={handleDownloadRaporHTML}
                                disabled={isGeneratingHtml || isLoadingReportData}
                                variant="outline"
                                className="border-cyan-300/80 bg-gradient-to-r from-teal-50 via-cyan-50 to-violet-50 text-cyan-800 shadow-sm hover:border-cyan-400 hover:from-teal-100 hover:via-cyan-100 hover:to-violet-100 dark:border-cyan-700/60 dark:from-teal-950/40 dark:via-cyan-950/40 dark:to-violet-950/40 dark:text-cyan-200 font-bold"
                            >
                                {isGeneratingHtml ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileCode2 className="w-4 h-4 mr-1.5 text-cyan-600 dark:text-cyan-400" />}
                                Download HTML
                            </Button>
                        </div>
                    </div>

                    {/* RAPOR CONTENT BODY (AURORA NEO GLASS DESIGN) */}
                    <div className="p-6 md:p-8 space-y-8 bg-white dark:bg-slate-900 m-4 md:m-6 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 print:m-0 print:p-6 print:border-none print:shadow-none print:bg-white">

                        {/* Kop / Header Rapor Official */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 text-white p-6 md:p-8 shadow-lg print:bg-none print:text-black print:p-0 print:border-b-2 print:border-black print:rounded-none">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck className="w-6 h-6 text-purple-200 print:hidden" />
                                        <h2 className="text-2xl md:text-3xl font-black font-sans tracking-tight uppercase print:text-black">
                                            RAPOR AKADEMIK & KARAKTER SANTRI
                                        </h2>
                                    </div>
                                    <p className="text-purple-100 font-semibold text-sm print:text-slate-700">
                                        LPQ AL-FATH MAULANA — METODE QIROATI
                                    </p>
                                    <p className="text-xs text-purple-200 mt-1 font-mono print:text-slate-500">
                                        Periode Evaluasi: <strong className="text-white print:text-black">{dateRange.periodText}</strong>
                                    </p>
                                </div>
                                <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-widest border border-white/30 print:border-black print:text-black">
                                    Qiroati Certified
                                </Badge>
                            </div>
                        </div>

                        {/* Biodata Santri Card */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-800 print:border print:bg-white">
                            <div>
                                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Nama Santri</p>
                                <p className="font-extrabold text-base text-slate-900 dark:text-slate-100">{santri.nama_lengkap}</p>
                                <p className="text-xs text-muted-foreground font-mono">NIQ: {santri.nomor_induk_qiroati || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Kelas & Sesi</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.className || santri.class?.nama_kelas || '-'}</p>
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">{getSessionName(santri.sesi_mengaji) || 'Sesi Regular'}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Tingkat Jilid</p>
                                <p className="font-black text-lg text-purple-600 dark:text-purple-400">{santri.jilid || '-'}</p>
                                <p className="text-xs text-muted-foreground">Kategori: {santri.kategori || 'Anak'}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Wali Santri (Ibu)</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{guardianName}</p>
                                <p className="text-xs text-muted-foreground">HP: {santriFullData?.no_hp_ortu || santri.no_hp_ortu || '-'}</p>
                            </div>
                            <div className="sm:col-span-2 md:col-span-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Karakter Unggulan:
                                </span>
                                {(characterData?.strengths || ['Disiplin Tepat Waktu', 'Sopan & Beradab']).map((strength, idx) => (
                                    <Badge key={idx} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-[10px] px-2.5 py-0.5 shadow-xs">
                                        ⭐ {strength}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* SCORE HIGHLIGHT & OVERALL AVERAGE SKOR */}
                        {scoresSummary && (
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50/50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-blue-950/30 border border-purple-100 dark:border-purple-900/40 shadow-sm print:border print:bg-white">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                    {/* Overall Score Circle Card */}
                                    <div className="flex items-center gap-5 w-full md:w-auto">
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex flex-col items-center justify-center font-black text-2xl shadow-lg shrink-0">
                                            <span>{scoresSummary.overallAverage}</span>
                                            <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Skor</span>
                                        </div>
                                        <div>
                                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1 mb-1">
                                                Grade {scoresSummary.grade} — {scoresSummary.predicate}
                                            </Badge>
                                            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                                                Skor Rata-Rata Keseluruhan
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                Gabungan evaluasi kehadiran, ketuntasan hafalan, & karakter.
                                            </p>
                                        </div>
                                    </div>

                                    {/* 3 Domain Progress Bars */}
                                    <div className="grid grid-cols-3 gap-3 w-full md:w-auto flex-1 max-w-md">
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border text-center space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Kehadiran</p>
                                            <p className="text-lg font-black text-blue-600">{scoresSummary.attendanceScore}%</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border text-center space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Hafalan</p>
                                            <p className="text-lg font-black text-emerald-600">{scoresSummary.hafalanScore}%</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border text-center space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Karakter</p>
                                            <p className="text-lg font-black text-amber-600">{scoresSummary.characterScore}%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* REKAPITULASI KEHADIRAN */}
                        <div className="space-y-3">
                            <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <History className="w-5 h-5 text-blue-600" />
                                1. Rekapitulasi Kehadiran Santri
                            </h3>

                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                                            <th className="py-2.5 px-4 text-center">Total Hari Efektif</th>
                                            <th className="py-2.5 px-4 text-center">Hadir</th>
                                            <th className="py-2.5 px-4 text-center">Terlambat</th>
                                            <th className="py-2.5 px-4 text-center">Alpha</th>
                                            <th className="py-2.5 px-4 text-right">Persentase Kehadiran</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {attendanceSummary ? (
                                            <tr>
                                                <td className="py-3 px-4 text-center font-bold">{attendanceSummary.totalDays} Hari</td>
                                                <td className="py-3 px-4 text-center font-bold text-emerald-600">{attendanceSummary.totalPresent} Hari</td>
                                                <td className="py-3 px-4 text-center font-bold text-amber-600">{attendanceSummary.totalLate || 0} Hari</td>
                                                <td className="py-3 px-4 text-center font-bold text-rose-600">{attendanceSummary.totalAbsent} Hari</td>
                                                <td className="py-3 px-4 text-right font-black text-sm text-purple-700 dark:text-purple-400">
                                                    {attendanceSummary.attendancePercentage}%
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* PERKEMBANGAN KARAKTER & KARAKTER UNGGULAN ⭐ */}
                        <div className="space-y-4">
                            <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                2. Perkembangan Karakter & Karakter Unggulan ⭐
                            </h3>

                            {/* Highlight Karakter Unggulan Badges */}
                            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                                <p className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Karakter Unggulan Santri:
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {(characterData?.strengths && characterData.strengths.length > 0)
                                        ? characterData.strengths.map((strength, idx) => (
                                            <Badge key={idx} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs px-3 py-1 flex items-center gap-1 shadow-xs">
                                                ⭐ {strength}
                                            </Badge>
                                        ))
                                        : <p className="text-xs text-muted-foreground italic">Belum ditetapkan oleh guru pengampu.</p>
                                    }
                                </div>
                            </div>

                            {/* Aspek Evaluasi Karakter - 15 Items */}
                            {(characterData?.assessedItems && characterData.assessedItems.length > 0) ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                    {characterData.assessedItems.map((item, idx) => (
                                        <div key={item.id || idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center gap-2">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">{item.item_name || item.title}</span>
                                            <Badge variant="outline" className={`font-bold shrink-0 ${
                                                item.score === 4 ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                                                item.score === 3 ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' :
                                                item.score === 2 ? 'border-amber-300 bg-amber-50 text-amber-700' :
                                                'border-rose-300 bg-rose-50 text-rose-700'
                                            }`}>
                                                {item.score}/4 {item.score === 4 ? '(SB)' : item.score === 3 ? '(BSH)' : item.score === 2 ? '(MB)' : '(BB)'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic text-center py-4">Belum ada data penilaian karakter untuk santri ini.</p>
                            )}
                        </div>

                        {/* REKAPITULASI SEMUA HAFALAN SANTRI */}
                        <div className="space-y-3">
                            <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <BookOpen className="w-5 h-5 text-emerald-600" />
                                3. Rekapitulasi Semua Hafalan Santri ({isPtpt ? 'PTPT' : 'Surat Pendek / Doa / Sholat'})
                            </h3>

                            <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-xs text-left">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b z-10">
                                        <tr>
                                            <th className="py-2.5 px-4 text-center">Jilid</th>
                                            <th className="py-2.5 px-4">Nama Item / Surat</th>
                                            <th className="py-2.5 px-4">Kategori</th>
                                            <th className="py-2.5 px-4 text-center">Skor (1-4)</th>
                                            <th className="py-2.5 px-4 text-center">Status Penyelesaian</th>
                                            <th className="py-2.5 px-4 text-right">Tanggal Evaluasi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {hafalanData?.allItems?.length > 0 ? (
                                            hafalanData.allItems.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                    <td className="py-2.5 px-4 text-center font-bold text-purple-700 dark:text-purple-400">
                                                        {item.jilid || '-'}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                                                        {item.item_name || item.display_name || item.nama_item || item.title || '-'}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-muted-foreground">
                                                        {item.category || (isPtpt ? 'Tahfizh PTPT' : 'Surat Pendek')}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center font-bold text-slate-700 dark:text-slate-200">
                                                        {item.score ? `${item.score} / 4` : '-'}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        {item.is_completed ? (
                                                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 font-bold text-[10px]">
                                                                <Check className="w-3 h-3 mr-1" /> Lulus / Dihafal
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-semibold text-[10px]">
                                                                <Clock className="w-3 h-3 mr-1" /> Dalam Proses
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right text-muted-foreground font-mono text-[11px]">
                                                        {item.evaluated_at ? new Date(item.evaluated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Belum Evaluasi'}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                                                    Belum ada rincian item hafalan yang tercatat untuk santri ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Signatures Box */}
                        <div className="grid grid-cols-3 gap-6 pt-12 pb-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs">
                            <div className="space-y-16">
                                <p className="font-semibold text-slate-700 dark:text-slate-300">Mengetahui,<br/>Orang Tua / Wali Santri</p>
                                <p className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700 pb-1 w-3/4 mx-auto">
                                    ( .................................... )
                                </p>
                            </div>
                            <div className="space-y-16">
                                <p className="font-semibold text-slate-700 dark:text-slate-300">Guru Pengampu Kelas,<br/>Ustadz / Ustadzah</p>
                                <p className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700 pb-1 w-3/4 mx-auto">
                                    ( {santri.class?.guru?.nama || santri.guru?.nama || santri.nama_guru || '....................................'} )
                                </p>
                            </div>
                            <div className="space-y-16">
                                <p className="font-semibold text-slate-700 dark:text-slate-300">Disahkan oleh,<br/>Pentashih Official LPQ</p>
                                <p className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700 pb-1 w-3/4 mx-auto">
                                    Pentashih LPQ Al-Fath Maulana
                                </p>
                            </div>
                        </div>

                    </div>
                </DialogContent>
            </Dialog>

            {/* Rekap Absensi Matriks Modal */}
            <Dialog open={isAttendanceRecapOpen} onOpenChange={setIsAttendanceRecapOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="w-5 h-5 text-blue-600" />
                            Rekap Absensi: {santri?.nama_lengkap}
                        </DialogTitle>
                        <DialogDescription>Matriks kehadiran santri per bulan.</DialogDescription>
                    </DialogHeader>
                    <AttendanceMatrixPanel santriId={santri?.id} />
                </DialogContent>
            </Dialog>
        </>
    );
};

// Komponen Matriks Kehadiran
const AttendanceMatrixPanel = ({ santriId }) => {
    const [year, setYear] = React.useState(new Date().getFullYear());
    const [month, setMonth] = React.useState(new Date().getMonth() + 1);
    const [records, setRecords] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum']; // Mon-Fri
    const STATUS_CONFIG = {
        hadir:      { bg: 'bg-emerald-500', text: 'text-white', label: 'H', title: 'Hadir' },
        present:    { bg: 'bg-emerald-500', text: 'text-white', label: 'H', title: 'Hadir' },
        terlambat:  { bg: 'bg-amber-400',   text: 'text-white', label: 'T', title: 'Terlambat' },
        late:       { bg: 'bg-amber-400',   text: 'text-white', label: 'T', title: 'Terlambat' },
        alpha:      { bg: 'bg-rose-500',    text: 'text-white', label: 'A', title: 'Alpha' },
        absent:     { bg: 'bg-rose-500',    text: 'text-white', label: 'A', title: 'Alpha' },
        izin:       { bg: 'bg-blue-400',    text: 'text-white', label: 'I', title: 'Izin' },
        sakit:      { bg: 'bg-purple-400',  text: 'text-white', label: 'S', title: 'Sakit' },
    };
    // Past weekday without record = Tidak Hadir
    const TH_CONFIG = { bg: 'bg-rose-100 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-400', label: 'TH', title: 'Tidak Hadir' };
    // Today/future weekday without record = Belum Absen
    const UNASSESSED_CONFIG = { bg: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700', text: 'text-slate-400 dark:text-slate-500', label: '-', title: 'Belum Absen' };

    React.useEffect(() => {
        if (!santriId) return;
        setLoading(true);
        const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
        const endDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
        supabase.from('attendance')
            .select('attendance_date, status')
            .eq('user_id', santriId)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)
            .order('attendance_date')
            .then(({ data }) => {
                setRecords(data || []);
                setLoading(false);
            });
    }, [santriId, year, month]);

    const recordMap = Object.fromEntries((records || []).map(r => [r.attendance_date, r.status?.toLowerCase()]));
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    // Only weekdays (Mon=1 to Fri=5)
    const weekdays = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(day => {
        const dow = new Date(year, month - 1, day).getDay();
        return dow >= 1 && dow <= 5;
    });

    const totalHadir = records.filter(r => ['hadir','present'].includes(r.status?.toLowerCase())).length;
    const totalTerlambat = records.filter(r => ['terlambat','late'].includes(r.status?.toLowerCase())).length;
    const totalAlpha = records.filter(r => ['alpha','absent'].includes(r.status?.toLowerCase())).length;
    // TH = ONLY past weekdays with no record
    const totalTH = weekdays.filter(d => {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        return dateStr < todayStr && !recordMap[dateStr];
    }).length;
    const currentYear = new Date().getFullYear();

    return (
        <div className="space-y-5">
            {/* Controls */}
            <div className="flex gap-3 flex-wrap items-center">
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                    className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium">
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                    className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium">
                    {Array.from({length:5},(_,i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="flex flex-wrap gap-2 text-xs ml-auto">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> Hadir ({totalHadir})
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"/> Terlambat ({totalTerlambat})
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/> Alpha ({totalAlpha})
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-300 dark:bg-rose-700 inline-block"/> Tidak Hadir ({totalTH})
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : weekdays.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Tidak ada hari kerja di bulan ini.</p>
            ) : (
                <div className="overflow-x-auto">
                    {/* Grid: 5 columns = Mon-Fri */}
                    <div className="grid gap-1.5 min-w-[300px]" style={{gridTemplateColumns: 'repeat(5, minmax(52px, 1fr))'}}>
                        {/* Day name headers */}
                        {DAY_NAMES.map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-1">
                                {d}
                            </div>
                        ))}

                        {/* Offset empty cells for the first week */}
                        {(() => {
                            const firstDay = new Date(year, month - 1, weekdays[0]).getDay(); // 1=Mon..5=Fri
                            return Array.from({ length: firstDay - 1 }, (_, i) => <div key={`empty-${i}`} />);
                        })()}

                        {/* Weekday cells */}
                        {weekdays.map(day => {
                            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                            const status = recordMap[dateStr];
                            const isPast = dateStr < todayStr;
                            const isToday = dateStr === todayStr;

                            let cfg;
                            if (status) {
                                cfg = STATUS_CONFIG[status] || { bg: 'bg-slate-400', text: 'text-white', label: status.charAt(0).toUpperCase(), title: status };
                            } else if (isPast) {
                                cfg = TH_CONFIG;
                            } else {
                                cfg = { ...UNASSESSED_CONFIG, title: isToday ? 'Belum Absen (Hari Ini)' : 'Belum Absen' };
                            }

                            return (
                                <div key={day}
                                    title={`${day} — ${cfg.title}`}
                                    className={`flex flex-col items-center justify-center rounded-xl p-1.5 min-h-[56px] text-center transition-all cursor-default border ${cfg.bg} ${cfg.text} ${isToday ? 'ring-2 ring-offset-1 ring-cyan-500' : ''}`}>
                                    <span className="text-[9px] font-bold opacity-75">{day}</span>
                                    <span className="text-[13px] font-black leading-tight mt-0.5">{cfg.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SantriDetailModal;
