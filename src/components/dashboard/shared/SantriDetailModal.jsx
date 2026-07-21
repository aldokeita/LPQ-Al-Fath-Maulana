
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Award, Edit, Trash2, Clock, CalendarDays, History, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, X, Minus, FileText, Download, Loader2, PieChart as PieChartIcon, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateAttendanceData, getHafalanProgressData, getPointsData, generateRaporPDF } from '@/utils/reportUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { getSessionName } from '@/utils/sessionMapping';
import { fetchSantriNotes, getAcademicErrorMessage, saveSantriNote } from '@/lib/academicAdapters';
import SantriDevelopmentProfile from '@/components/dashboard/shared/SantriDevelopmentProfile';

const jilidOptions = [
    'Pra TK A', 'Pra TK B', 'Pra TK C',
    'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
    'Jilid 2A', 'Jilid 2B',
    'Jilid 3A', 'Jilid 3B',
    'Jilid 4A', 'Jilid 4B',
    'Jilid 5A', 'Jilid 5B',
    'Jilid Juz 27',
    'Jilid 6A', 'Jilid 6B',
    'Al-Qur\'an', 'Ghorib Tajwid', 'Finishing'
];

const SantriDetailModal = ({ santri, isOpen, onOpenChange, onPromote, onDemote }) => {
    const { user, role } = useAuth();
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [editingNote, setEditingNote] = useState(null);
    const [jilidDuration, setJilidDuration] = useState(null);
    const [lastPromotedDate, setLastPromotedDate] = useState(null);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [hafalanData, setHafalanData] = useState(null);
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [isReportViewOpen, setIsReportViewOpen] = useState(false);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Rapor State
    const [isRaporDialogOpen, setIsRaporDialogOpen] = useState(false);
    const [raporPeriodType, setRaporPeriodType] = useState('bulanan');
    const [raporMonth, setRaporMonth] = useState((new Date().getMonth() + 1).toString());
    const [raporYear, setRaporYear] = useState(new Date().getFullYear().toString());
    const [isGeneratingRapor, setIsGeneratingRapor] = useState(false);
    const [isLoadingReportData, setIsLoadingReportData] = useState(false);
    const isPtpt = String(santri?.kategori || '').toUpperCase() === 'PTPT';
    const reportHafalanItems = isPtpt ? hafalanData?.tahfizh?.items : hafalanData?.surat?.items;

    const fetchNotes = useCallback(async () => {
        if (!santri) return;
        try {
            const data = await fetchSantriNotes(santri.id);
            setNotes(data);
        } catch (error) {
            toast({ title: "Gagal memuat catatan", description: getAcademicErrorMessage(error), variant: 'destructive' });
        }
    }, [santri]);

    const fetchJilidHistory = useCallback(async () => {
        if (!santri) return;
        const { data, error } = await supabase
            .from('jilid_history')
            .select('changed_at')
            .eq('santri_id', santri.id)
            .order('changed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let startDate = new Date(santri.created_at);
        if (data?.changed_at) {
            startDate = new Date(data.changed_at);
        }

        setLastPromotedDate(startDate);

        const now = new Date();
        const diffTime = Math.abs(now - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setJilidDuration(diffDays);

    }, [santri]);

    useEffect(() => {
        if (isOpen) {
            fetchNotes();
            fetchJilidHistory();
        }
    }, [isOpen, fetchNotes, fetchJilidHistory]);

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

    const handleDeleteNote = async (noteId) => {
        toast({ title: "Aksi tidak tersedia", description: "Penghapusan catatan santri ditunda pada fase ini.", variant: 'destructive' });
    };

    const fetchReportViewData = async () => {
        if (!santri) return;
        setIsLoadingReportData(true);
        try {
            // Get full attendance history
            const { data: attData, error: attErr } = await supabase.from('attendance').select('*').eq('user_id', santri.id);
            if (attErr) throw attErr;
            setAttendanceHistory(attData);

            // Fetch summary stats for current month initially
            const date = new Date();
            const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
            const summary = await calculateAttendanceData(santri.id, start, end);
            setAttendanceSummary(summary);

            // Fetch hafalan progress
            const hafalan = await getHafalanProgressData(santri.id);
            setHafalanData(hafalan);

            setIsReportViewOpen(true);
        } catch (error) {
            toast({ title: "Gagal memuat data", description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingReportData(false);
        }
    };

    // Update attendance summary when month changes in report view
    useEffect(() => {
        if (isReportViewOpen && santri) {
            const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
            const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];
            calculateAttendanceData(santri.id, start, end).then(setAttendanceSummary).catch(console.error);
        }
    }, [currentMonth, isReportViewOpen, santri]);

    const handleGenerateRapor = async () => {
        setIsGeneratingRapor(true);
        try {
            let startDate, endDate, periodText;
            const yearNum = parseInt(raporYear);

            if (raporPeriodType === 'bulanan') {
                const monthNum = parseInt(raporMonth);
                startDate = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
                endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
                const monthName = new Date(yearNum, monthNum - 1, 1).toLocaleString('id-ID', { month: 'long' });
                periodText = `Bulan ${monthName} Tahun ${yearNum}`;
            } else {
                startDate = new Date(yearNum, 0, 1).toISOString().split('T')[0];
                endDate = new Date(yearNum, 11, 31).toISOString().split('T')[0];
                periodText = `Tahun ${yearNum}`;
            }

            const attendance = await calculateAttendanceData(santri.id, startDate, endDate);
            const hafalan = await getHafalanProgressData(santri.id);
            const points = await getPointsData(santri.id, startDate, endDate);

            const doc = await generateRaporPDF(santri, attendance, hafalan, points, periodText);

            // Clean filename
            const cleanName = santri.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_');
            const cleanPeriod = periodText.replace(/[^a-zA-Z0-9]/g, '_');

            doc.save(`Rapor_${cleanName}_${cleanPeriod}.pdf`);

            toast({ title: "Berhasil", description: "Rapor berhasil diunduh!" });
            setIsRaporDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingRapor(false);
        }
    };

    // Calendar Helpers
    const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    if (!santri) return null;

    // Helper for year options
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({length: 5}, (_, i) => (currentYear - i).toString());

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mr-6">
                            <div>
                                <DialogTitle className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100">
                                    Detail Santri: {santri.nama_lengkap}
                                </DialogTitle>
                                <DialogDescription>Informasi lengkap & catatan perkembangan akademik.</DialogDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={fetchReportViewData}
                                    disabled={isLoadingReportData}
                                    className="bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                                >
                                    {isLoadingReportData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <History className="w-4 h-4 mr-2"/>}
                                    Preview Rapor
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={() => setIsRaporDialogOpen(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                                >
                                    <FileText className="w-4 h-4 mr-2"/> Download Rapor
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 pt-4 border-b border-slate-200 dark:border-slate-800 pb-6 relative">
                        <div className="flex flex-col gap-3 items-center">
                            <Avatar className="w-32 h-32 flex-shrink-0 border-4 border-slate-100 shadow-md">
                                <AvatarImage src={santri.foto_url} className="object-cover" />
                                <AvatarFallback className="text-4xl font-bold">{santri.nama_lengkap.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex gap-2 w-full justify-center">
                                {(onPromote || onDemote) && (
                                    <>
                                        {onPromote && (
                                            <Button onClick={onPromote} size="sm" variant="outline" className="h-8 flex-1 border-green-200 hover:bg-green-50 text-green-700" title="Naik Jilid">
                                                <ChevronUp className="w-4 h-4 mr-1" /> Naik
                                            </Button>
                                        )}
                                        {onDemote && (
                                            <Button onClick={onDemote} size="sm" variant="outline" className="h-8 flex-1 border-red-200 hover:bg-red-50 text-red-700" title="Turun Jilid">
                                                <ChevronDown className="w-4 h-4 mr-1" /> Turun
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                            {jilidDuration !== null && (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${jilidDuration > 90 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-blue-100 text-blue-600 border-blue-200'} flex items-center gap-1 mt-1`}>
                                    <Clock className="w-3 h-3"/> {jilidDuration} Hari di Jilid {santri.jilid}
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
                                <p className="font-bold text-base text-slate-800 dark:text-slate-200">{santri.nama_panggilan || '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Jilid Saat Ini</p>
                                <p className="font-black text-lg text-purple-600 dark:text-purple-400">{santri.jilid}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Terakhir Naik Jilid</p>
                                <p className="font-bold flex items-center gap-1 text-slate-800 dark:text-slate-200">
                                    <CalendarDays className="w-4 h-4 text-purple-500"/>
                                    {lastPromotedDate ? new Date(lastPromotedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'}) : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Kelas</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.class?.nama_kelas || '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Wali Santri</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.nama_ayah || santri.nama_ibu || '-'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6">
                        <SantriDevelopmentProfile
                            santriId={santri.id}
                            userId={user?.id}
                            editable={role === 'guru'}
                            showBehavior={role === 'guru'}
                        />
                    </div>

                    <div className="pt-6 space-y-4">
                        <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <Award className="w-5 h-5 text-yellow-500"/> Catatan Guru & Perkembangan
                        </h3>
                        <div className="space-y-3 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <Textarea
                                placeholder="Tulis catatan, rekomendasi, atau evaluasi akademik..."
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                className="border-slate-300 dark:border-slate-700 focus:border-primary min-h-[100px] resize-none"
                            />
                            <div className="flex justify-end gap-2">
                                {editingNote && <Button variant="ghost" onClick={() => { setEditingNote(null); setNewNote('')}}>Batal Edit</Button>}
                                <Button onClick={handleSaveNote} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
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
                                                {note.guru?.nama?.substring(0,2) || 'GU'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">{note.guru?.nama || 'Unknown'}</p>
                                                <p className="text-[10px] text-muted-foreground">{new Date(note.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                            </div>
                                        </div>
                                        {note.guru_id === user.id && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" onClick={() => { setEditingNote(note); setNewNote(note.note); }}>
                                                    <Edit className="w-4 h-4"/>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {notes.length === 0 && (
                                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                                    <p className="text-muted-foreground italic">Belum ada catatan evaluasi untuk santri ini.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Comprehensive Report View Dialog (Interactive Rapor Preview) */}
            <Dialog open={isReportViewOpen} onOpenChange={setIsReportViewOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 bg-slate-50 dark:bg-slate-950 print-break-inside-avoid">
                    <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 print-hide">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-indigo-600"/> Preview Rapor Santri
                            </DialogTitle>
                            <DialogDescription>Ringkasan kehadiran dan progres hafalan</DialogDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4"/></Button>
                                <span className="text-sm font-bold min-w-[120px] text-center">{currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4"/></Button>
                            </div>
                            <Button onClick={() => window.print()} variant="outline" className="hidden sm:flex border-slate-300">
                                Cetak
                            </Button>
                        </div>
                    </div>

                    <div className="p-6 space-y-8 bg-white dark:bg-slate-950 m-4 rounded-2xl shadow-sm border print:m-0 print:border-none print:shadow-none">
                        {/* Header Rapor */}
                        <div className="text-center pb-6 border-b-2 border-indigo-100 dark:border-indigo-900/30">
                            <h2 className="text-2xl font-black font-serif text-slate-800 dark:text-slate-100 uppercase tracking-widest">Laporan Akademik Santri</h2>
                            <p className="text-muted-foreground mt-1">Bulan {currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</p>
                        </div>

                        {/* Profil Ringkas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Nama Lengkap</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.nama_lengkap}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Kelas</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.class?.nama_kelas || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Jilid</p>
                                <p className="font-bold text-indigo-600 dark:text-indigo-400">{santri.jilid || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Tingkat / Sesi</p>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{santri.kategori || 'Anak'} / {getSessionName(santri.sesi_mengaji) || '-'}</p>
                            </div>
                        </div>

                        {/* Tabel Absensi Modern */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <History className="w-5 h-5 text-blue-500"/> Ringkasan Kehadiran
                            </h3>

                            <div className="rapor-table-container">
                                <table className="rapor-table">
                                    <thead>
                                        <tr>
                                            <th className="rapor-th">Status</th>
                                            <th className="rapor-th text-center">Hadir</th>
                                            <th className="rapor-th text-center">Terlambat</th>
                                            <th className="rapor-th text-center">Izin / Sakit</th>
                                            <th className="rapor-th text-center">Alpha</th>
                                            <th className="rapor-th text-right">Persentase</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceSummary ? (
                                            <tr className="rapor-row">
                                                <td className="rapor-td">
                                                    <span className={cn("status-badge", attendanceSummary.attendancePercentage >= 85 ? "status-badge-good" : attendanceSummary.attendancePercentage >= 70 ? "status-badge-moderate" : "status-badge-poor")}>
                                                        {attendanceSummary.attendancePercentage >= 85 ? 'Sangat Baik' : attendanceSummary.attendancePercentage >= 70 ? 'Cukup' : 'Kurang'}
                                                    </span>
                                                </td>
                                                <td className="rapor-td text-center font-bold text-slate-700 dark:text-slate-300">{attendanceSummary.totalPresent} Hari</td>
                                                <td className="rapor-td text-center font-bold text-slate-700 dark:text-slate-300">{attendanceSummary.totalLate || 0} Hari</td>
                                                <td className="rapor-td text-center font-bold text-slate-700 dark:text-slate-300">{attendanceSummary.totalPermit} Hari</td>
                                                <td className="rapor-td text-center font-bold text-slate-700 dark:text-slate-300">{attendanceSummary.totalAbsent} Hari</td>
                                                <td className="rapor-td text-right">
                                                    <span className={cn("text-lg font-black", attendanceSummary.attendancePercentage >= 85 ? "text-[hsl(var(--status-good))]" : attendanceSummary.attendancePercentage >= 70 ? "text-[hsl(var(--status-moderate))]" : "text-[hsl(var(--status-poor))]")}>
                                                        {attendanceSummary.attendancePercentage}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr><td colSpan="6" className="p-4 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto"/></td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Tabel Progres Hafalan Detail */}
                        <div className="space-y-4 mt-8">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <BookOpen className="w-5 h-5 text-green-500"/> {isPtpt ? 'Progres Tahfizh PTPT' : 'Progres Hafalan Surat Pendek'}
                            </h3>

                            <div className="rapor-table-container">
                                <table className="rapor-table">
                                    <thead>
                                        <tr>
                                            <th className="rapor-th">Nama Surat / Item</th>
                                            <th className="rapor-th">Kategori</th>
                                            <th className="rapor-th text-center">Status Penyelesaian</th>
                                            <th className="rapor-th text-right">Tanggal Update</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportHafalanItems?.length > 0 ? (
                                            reportHafalanItems.map((item, idx) => (
                                                <tr key={item.id || idx} className="rapor-row">
                                                    <td className="rapor-td font-semibold text-slate-800 dark:text-slate-200">{item.item_name}</td>
                                                    <td className="rapor-td text-muted-foreground">{isPtpt ? item.jilid : 'Surat Pendek'}</td>
                                                    <td className="rapor-td text-center">
                                                        {item.hafal ? (
                                                            <span className="status-badge status-badge-good"><Check className="w-3 h-3 mr-1"/> Lulus</span>
                                                        ) : (
                                                            <span className="status-badge status-badge-moderate"><Clock className="w-3 h-3 mr-1"/> Sedang Hafalan</span>
                                                        )}
                                                    </td>
                                                    <td className="rapor-td text-right text-xs text-muted-foreground">
                                                        {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric'})}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="p-8 text-center text-muted-foreground italic bg-slate-50 dark:bg-slate-900/30">
                                                    {isPtpt ? 'Belum ada data tahfizh yang tercatat.' : 'Belum ada data hafalan surat yang tercatat.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="pt-8 border-t mt-8 print-hide text-center">
                            <p className="text-sm text-muted-foreground mb-4">Ingin mengunduh versi PDF resmi yang dilengkapi kop surat?</p>
                            <Button onClick={() => { setIsReportViewOpen(false); setIsRaporDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
                                <Download className="w-4 h-4 mr-2"/> Download Rapor PDF
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rapor Generation Dialog */}
            <Dialog open={isRaporDialogOpen} onOpenChange={setIsRaporDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Generate Rapor Santri</DialogTitle>
                        <DialogDescription>Pilih periode untuk mengunduh laporan PDF.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipe Periode</label>
                            <Select value={raporPeriodType} onValueChange={setRaporPeriodType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih tipe periode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bulanan">Rapor Bulanan</SelectItem>
                                    <SelectItem value="tahunan">Rapor Tahunan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {raporPeriodType === 'bulanan' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Bulan</label>
                                    <Select value={raporMonth} onValueChange={setRaporMonth}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Bulan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({length: 12}, (_, i) => (
                                                <SelectItem key={i+1} value={(i+1).toString()}>
                                                    {new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' })}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className={raporPeriodType === 'tahunan' ? "col-span-2 space-y-2" : "space-y-2"}>
                                <label className="text-sm font-medium">Tahun</label>
                                <Select value={raporYear} onValueChange={setRaporYear}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tahun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map(y => (
                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRaporDialogOpen(false)} disabled={isGeneratingRapor}>Batal</Button>
                        <Button onClick={handleGenerateRapor} disabled={isGeneratingRapor} className="bg-indigo-600 hover:bg-indigo-700">
                            {isGeneratingRapor ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Memproses...</>
                            ) : (
                                <><Download className="w-4 h-4 mr-2"/> Unduh Rapor PDF</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default SantriDetailModal;
