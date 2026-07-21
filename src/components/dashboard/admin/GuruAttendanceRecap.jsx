import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Download, UserCheck, Search, Eye, Lock, Unlock, RefreshCw, Edit, BarChart, CheckCircle2, Clock, XCircle, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GuruPerformanceSummary from './GuruPerformanceSummary';
import {
    buildJakartaTimestamp,
    buildSessionStartTimestamp,
    calculateTimeDifference,
    determineAttendanceStatus,
    formatTimestamp,
    normalizeAttendanceSessionName,
    resolveAttendanceRecordStatus,
} from '@/utils/AttendanceStatusLogic';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const normalizeSessionList = (sessions = []) => [
    ...new Set(sessions.map(normalizeAttendanceSessionName).filter(Boolean)),
];

const isPresentStatus = (status) => ['hadir', 'terlambat', 'on_time'].includes(
    String(status || '').trim().toLowerCase(),
);

const GuruAttendanceRecap = ({ isReadOnly = false }) => {
    const { role, user } = useAuth();
    const [attendanceData, setAttendanceData] = useState([]);
    const [gurus, setGurus] = useState([]);
    const [classes, setClasses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [availableYears, setAvailableYears] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGuruDetail, setSelectedGuruDetail] = useState(null);
    const [holidays, setHolidays] = useState(new Set());

    // Admin Edit Session State
    const [isSessionEditOpen, setIsSessionEditOpen] = useState(false);
    const [sessionEditGuru, setSessionEditGuru] = useState(null);
    const [tempSessions, setTempSessions] = useState([]);
    const [availableSessionsForGuru, setAvailableSessionsForGuru] = useState([]);
    const [overriddenSessions, setOverriddenSessions] = useState({});

    // Advanced Edit Modal State (replaces simple confirmation dialog)
    const [editModal, setEditModal] = useState({ isOpen: false, data: null });
    const [editTime, setEditTime] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canEdit = !isReadOnly && role === 'admin';

    const fetchData = async () => {
        setIsLoading(true);

        let attQuery = supabase.from('attendance').select('*').eq('role', 'guru');
        let guruQuery = supabase.from('guru').select('id, nama, foto_url, no_hp');
        const classQuery = supabase.from('classes').select('id, nama_kelas, sesi, id_guru, kategori');
        const overridesQuery = supabase.from('website_content').select('content').eq('key', 'guru_session_overrides').maybeSingle();

        if (role === 'guru' && user) {
             attQuery = attQuery.eq('user_id', user.id);
             guruQuery = guruQuery.eq('id', user.id);
        }

        const { data: att } = await attQuery;
        const { data: guruList } = await guruQuery;
        const { data: classList } = await classQuery;
        const { data: overrides } = await overridesQuery;

        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        const { data: calendarData } = await supabase.from('academic_calendar').select('date').gte('date', startDate).lte('date', endDate).eq('is_holiday', true);

        if (att && guruList && classList) {
            const resolvedGuruList = await resolveAvatarRecords(guruList, { ownerType: 'guru' });
            setAttendanceData(att);
            setGurus(resolvedGuruList);
            setClasses(classList);

            if (overrides?.content) {
                setOverriddenSessions(overrides.content);
            }

            const years = [...new Set(att.map(a => new Date(a.attendance_date).getFullYear()))].sort((a,b) => b-a);
            const currentYear = new Date().getFullYear();
            if (!years.includes(currentYear)) years.unshift(currentYear);
            setAvailableYears(years);

            if (calendarData) {
                setHolidays(new Set(calendarData.map(c => c.date)));
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [selectedYear]);

    const handleSaveAttendance = async ({ markAbsent = false } = {}) => {
        if (!editModal.data) return;
        setIsSubmitting(true);

        const { guruId, dateStr, sesi, record } = editModal.data;
        const normalizedSession = normalizeAttendanceSessionName(sesi);
        const sessionStart = buildSessionStartTimestamp(dateStr, normalizedSession);
        const attendanceTime = markAbsent ? '' : editTime;
        const checkInTs = attendanceTime ? buildJakartaTimestamp(dateStr, attendanceTime) : null;

        let newStatus = 'Tidak Hadir';
        if (checkInTs) {
             newStatus = determineAttendanceStatus(checkInTs, sessionStart);
        }

        try {
            // Save to attendance table
            let mutation;
            if (record?.id) {
                mutation = await supabase.from('attendance').update({
                    check_in_time: attendanceTime || null,
                    check_in_timestamp: checkInTs,
                    status: newStatus
                }).eq('id', record.id).select('id').single();
            } else {
                mutation = await supabase.from('attendance').insert({
                    user_id: guruId,
                    role: 'guru',
                    attendance_date: dateStr,
                    check_in_time: attendanceTime || null,
                    check_in_timestamp: checkInTs,
                    sesi: normalizedSession,
                    status: newStatus
                }).select('id').single();
            }

            if (mutation.error) throw mutation.error;

            toast({
                title: "Berhasil",
                description: markAbsent
                    ? "Guru telah ditandai tidak hadir."
                    : "Kehadiran guru diperbarui."
            });
            setEditModal({ isOpen: false, data: null });
            fetchData();
        } catch (err) {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSessions = (guru) => {
        const guruClasses = classes.filter(c => c.id_guru === guru.id);
        const derivedSessions = normalizeSessionList(guruClasses.map(c => c.sesi));
        const existingOverride = overriddenSessions[guru.id];

        setSessionEditGuru(guru);
        setAvailableSessionsForGuru(derivedSessions);
        setTempSessions(existingOverride || derivedSessions);
        setIsSessionEditOpen(true);
    };

    const saveSessionOverride = async () => {
        if (!sessionEditGuru) return;
        const newOverrides = { ...overriddenSessions, [sessionEditGuru.id]: tempSessions };

        const { error } = await supabase.from('website_content').upsert(
            { key: 'guru_session_overrides', content: newOverrides },
            { onConflict: 'key' }
        );

        if (error) {
            toast({ title: "Gagal Menyimpan", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Berhasil", description: "Jadwal sesi guru diperbarui manual." });
            setOverriddenSessions(newOverrides);
            setIsSessionEditOpen(false);
        }
    };

    const toggleSession = (sesi) => {
        setTempSessions(prev =>
            prev.includes(sesi) ? prev.filter(s => s !== sesi) : [...prev, sesi]
        );
    };

    const recapData = useMemo(() => {
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const activeDays = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for(let d=1; d<=daysInMonth; d++) {
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const date = new Date(selectedYear, selectedMonth, d);
            const dayOfWeek = date.getDay();

            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = holidays.has(dateStr);

            if (!isWeekend && !isHoliday) {
                activeDays.push({ day: d, isPast: date <= today });
            }
        }

        let filteredGurus = gurus;
        if (searchTerm) filteredGurus = gurus.filter(g => g.nama.toLowerCase().includes(searchTerm.toLowerCase()));

        const processedData = filteredGurus.map(guru => {
            let assignedSessions = [];

            if (overriddenSessions[guru.id]) {
                assignedSessions = normalizeSessionList(overriddenSessions[guru.id]);
            } else {
                const guruClasses = classes.filter(c => c.id_guru === guru.id);
                assignedSessions = normalizeSessionList(guruClasses.map(c => c.sesi));
            }

            assignedSessions.sort();

            if (assignedSessions.length === 0) return null;

            const pastActiveDaysCount = activeDays.filter(d => d.isPast).length;
            let totalSessionsExpected = pastActiveDaysCount * assignedSessions.length;
            let totalSessionsAttended = 0;
            let sessionBreakdown = {};

            assignedSessions.forEach(s => sessionBreakdown[s] = 0);

            let dailyDetails = {};

            activeDays.forEach(({ day, isPast }) => {
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                dailyDetails[day] = {};

                assignedSessions.forEach(sesi => {
                    const attendanceRecord = attendanceData.find(a =>
                        a.user_id === guru.id &&
                        a.attendance_date === dateStr &&
                        normalizeAttendanceSessionName(a.sesi) === sesi
                    );

                    const sessionStartTs = buildSessionStartTimestamp(dateStr, sesi);
                    const computedRecordStatus = resolveAttendanceRecordStatus(attendanceRecord, sessionStartTs);
                    const isPresent = isPresentStatus(computedRecordStatus);

                    dailyDetails[day][sesi] = {
                        isPresent,
                        id: attendanceRecord?.id || null,
                        record: attendanceRecord || null,
                        computedStatus: computedRecordStatus,
                        dateStr: dateStr,
                        isPast: isPast
                    };

                    if(isPresent && isPast) {
                        totalSessionsAttended++;
                        sessionBreakdown[sesi] = (sessionBreakdown[sesi] || 0) + 1;
                    }
                });
            });

            const percentage = totalSessionsExpected > 0 ? Math.round((totalSessionsAttended / totalSessionsExpected) * 100) : 0;

            return {
                ...guru,
                assignedSessions,
                totalSessionsExpected,
                totalSessionsAttended,
                percentage,
                dailyDetails,
                activeDays: activeDays.map(d => d.day),
                sessionBreakdown
            };
        }).filter(Boolean);

        if (selectedGuruDetail) {
            const updatedDetail = processedData.find(g => g.id === selectedGuruDetail.id);
            if (updatedDetail && JSON.stringify(updatedDetail) !== JSON.stringify(selectedGuruDetail)) {
                setSelectedGuruDetail(updatedDetail);
            }
        }

        return processedData;
    }, [attendanceData, gurus, classes, selectedYear, selectedMonth, searchTerm, selectedGuruDetail, holidays, overriddenSessions]);

    const handleExport = () => {
        const exportData = [];
        recapData.forEach(guru => {
            const row = {
                'Nama Guru': guru.nama,
                'Sesi Diampu': guru.assignedSessions.join(', '),
                'Total Wajib Hadir (Sesi)': guru.totalSessionsExpected,
                'Total Realisasi (Sesi)': guru.totalSessionsAttended,
                'Persentase': `${guru.percentage}%`
            };
            guru.activeDays.forEach(day => {
                guru.assignedSessions.forEach(sesi => {
                    const detail = guru.dailyDetails[day][sesi];
                    row[`Tgl ${day} (${sesi})`] = !detail.isPast ? '-' : (detail.computedStatus || 'Tidak Hadir');
                });
            });
            exportData.push(row);
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Guru");
        XLSX.writeFile(wb, `Rekap_Absensi_Guru_${months[selectedMonth]}_${selectedYear}.xlsx`);
        toast({ title: "Ekspor Berhasil" });
    };

    const getProgressColor = (percentage) => {
        if (percentage >= 71) return 'bg-green-500';
        if (percentage >= 41) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const getProgressBgColor = (percentage) => {
        if (percentage >= 71) return 'bg-green-100';
        if (percentage >= 41) return 'bg-amber-100';
        return 'bg-red-100';
    };

    // Derived modal data values
    const isReadOnlyMode = editModal.data?.readOnly;
    const sessionStartTs = editModal.data ? buildSessionStartTimestamp(editModal.data.dateStr, editModal.data.sesi) : null;
    const checkInTs = editTime && editModal.data ? buildJakartaTimestamp(editModal.data.dateStr, editTime) : null;
    const computedStatusForModal = isReadOnlyMode
        ? (editModal.data?.computedStatus || 'Tidak Hadir')
        : (checkInTs ? determineAttendanceStatus(checkInTs, sessionStartTs) : 'Tidak Hadir');
    const timeDiff = calculateTimeDifference(checkInTs || editModal.data?.record?.check_in_timestamp, sessionStartTs);
    const ModalStatusIcon = computedStatusForModal === 'Terlambat' ? Clock : computedStatusForModal === 'Hadir' ? CheckCircle2 : XCircle;
    const modalStatusTone = computedStatusForModal === 'Terlambat'
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-200'
        : computedStatusForModal === 'Hadir'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/35 dark:text-emerald-200'
            : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/35 dark:text-rose-200';

    return (
        <Tabs defaultValue="rekap_absensi" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
                <TabsTrigger value="rekap_absensi" className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" /> Rekap Absensi
                </TabsTrigger>
                <TabsTrigger value="kinerja_guru" className="flex items-center gap-2">
                    <BarChart className="w-4 h-4" /> Rekap Kinerja
                </TabsTrigger>
            </TabsList>

            <TabsContent value="rekap_absensi">
                <div className="space-y-6">
                     <div className="admin-panel-header">
                        <div className="flex items-center gap-3">
                            <div className="admin-panel-header-icon"><UserCheck /></div>
                            <div className="admin-panel-header-text">
                                <h2>Rekap Absensi Guru Per Sesi</h2>
                                <p>Pantau kehadiran guru per bulan dan sesi.</p>
                            </div>
                        </div>
                        <div className="admin-panel-header-actions">
                            <button onClick={handleExport} className="admin-panel-primary-btn"><Download className="w-4 h-4"/> Export Excel</button>
                        </div>
                    </div>

                    <div className="admin-filter-bar">
                        <div className="admin-search-input"><Search /><Input placeholder="Cari guru..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        <div className="flex items-center gap-2">
                            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(Number(val))}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{months.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                            <Button onClick={fetchData} variant="outline" size="icon" title="Refresh Data"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}/></Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recapData.map(guru => (
                            <div key={guru.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-4 hover:shadow-md transition-all flex flex-col relative group">
                                {canEdit && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditSessions(guru); }}
                                        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Edit Sesi Manual"
                                    >
                                        <Edit className="w-4 h-4"/>
                                    </button>
                                )}
                                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4 text-center sm:text-left">
                                    <Avatar className="h-16 w-16 sm:h-14 sm:w-14 border-2 border-slate-100 shadow-sm shrink-0"><AvatarImage src={guru.foto_url} /><AvatarFallback>{guru.nama.charAt(0)}</AvatarFallback></Avatar>
                                    <div className="overflow-hidden w-full">
                                        <h3 className="font-bold text-lg truncate">{guru.nama}</h3>
                                        <div className="flex flex-wrap justify-center sm:justify-start gap-1 mt-1">
                                            {guru.assignedSessions.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4 flex-grow">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Kehadiran Sesi</span>
                                        <span className="font-bold">{guru.totalSessionsAttended} / {guru.totalSessionsExpected}</span>
                                    </div>
                                    <Progress value={guru.percentage} className={`h-2 ${getProgressBgColor(guru.percentage)}`} indicatorClassName={getProgressColor(guru.percentage)} />
                                    <p className="text-right text-xs text-muted-foreground">{guru.percentage}% Kehadiran</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-xs space-y-1 mb-4">
                                    <p className="font-semibold mb-2 border-b pb-1">Detail Kehadiran (Hingga Hari Ini):</p>
                                    {Object.entries(guru.sessionBreakdown).map(([sesi, count]) => (
                                        <div key={sesi} className="flex justify-between">
                                            <span className="text-muted-foreground">{sesi}</span>
                                            <span>{count} Sesi</span>
                                        </div>
                                    ))}
                                </div>

                                <Button variant="outline" className="w-full mt-auto" onClick={() => setSelectedGuruDetail(guru)}>
                                    <Eye className="w-4 h-4 mr-2"/> Lihat Detail & Edit
                                </Button>
                            </div>
                        ))}
                        {recapData.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground">Tidak ada data guru atau jadwal mengajar ditemukan.</div>}
                    </div>

                    <Dialog open={!!selectedGuruDetail} onOpenChange={(open) => !open && setSelectedGuruDetail(null)}>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between">
                                    <span>Detail Absensi: {selectedGuruDetail?.nama}</span>
                                    {canEdit ?
                                        <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200"><Unlock className="w-3 h-3 mr-1"/> Mode Edit Aktif</Badge> :
                                        <Badge variant="outline" className="ml-2 bg-slate-50 text-slate-500 border-slate-200"><Lock className="w-3 h-3 mr-1"/> Read Only</Badge>
                                    }
                                </DialogTitle>
                                <p className="text-sm text-muted-foreground">Bulan: {months[selectedMonth]} {selectedYear}</p>
                                {canEdit && <p className="text-xs text-blue-500 mt-1">Klik pada sel sesi (Hari Berjalan) untuk melihat timestamp dan edit status</p>}
                            </DialogHeader>
                            {selectedGuruDetail && (
                                <div className="mt-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {selectedGuruDetail.activeDays.map(day => (
                                            <div key={day} className="border rounded-lg p-2 text-center bg-slate-50 dark:bg-slate-800/50">
                                                <div className="font-bold text-lg mb-1">{day}</div>
                                                <div className="space-y-1">
                                                    {selectedGuruDetail.assignedSessions.map(sesi => {
                                                        const detail = selectedGuruDetail.dailyDetails[day][sesi];

                                                        if (!detail.isPast) {
                                                            return (
                                                                <div key={sesi} className="text-xs px-1 py-1 rounded bg-slate-100 text-slate-400 dark:bg-slate-800 border border-slate-200">
                                                                    {sesi}: -
                                                                </div>
                                                            )
                                                        }

                                                        const statusStr = detail.computedStatus?.toLowerCase() || '';
                                                        let icon = <XCircle className="w-3 h-3 text-red-500" />;
                                                        let bgClass = "bg-red-100 text-red-700 dark:bg-red-900/30 border-red-200";
                                                        let label = 'Tidak Hadir';

                                                        if (statusStr === 'terlambat') {
                                                            icon = <Clock className="w-3 h-3 text-amber-500" />;
                                                            bgClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 border-amber-200";
                                                            label = 'Terlambat';
                                                        } else if (statusStr === 'hadir' || statusStr === 'on_time') {
                                                            icon = <CheckCircle2 className="w-3 h-3 text-green-500" />;
                                                            bgClass = "bg-green-100 text-green-700 dark:bg-green-900/30 border-green-200";
                                                            label = 'Hadir';
                                                        } else if (statusStr === 'izin' || statusStr === 'sakit') {
                                                            icon = <Clock className="w-3 h-3 text-blue-500" />;
                                                            bgClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 border-blue-200";
                                                            label = statusStr === 'izin' ? 'Izin' : 'Sakit';
                                                        }

                                                        return (
                                                            <div
                                                                key={sesi}
                                                                onClick={() => {
                                                                    if (detail.isPast) {
                                                                        setEditModal({
                                                                            isOpen: true,
                                                                            data: {
                                                                                guruId: selectedGuruDetail.id,
                                                                                guruName: selectedGuruDetail.nama,
                                                                                dateStr: detail.dateStr,
                                                                                sesi,
                                                                                record: detail.record,
                                                                                computedStatus: detail.computedStatus,
                                                                                readOnly: !canEdit
                                                                            }
                                                                        });

                                                                        if (detail.record?.check_in_time) {
                                                                            setEditTime(detail.record.check_in_time);
                                                                        } else if (!detail.record && canEdit) {
                                                                            setEditTime(''); // empty for manual input
                                                                        }
                                                                    }
                                                                }}
                                                                className={`text-xs px-1 py-1 rounded flex flex-col items-center justify-center gap-1 transition-all duration-200
                                                                    ${bgClass}
                                                                    ${canEdit || detail.isPast ? 'cursor-pointer hover:scale-105 hover:shadow-sm active:scale-95' : 'cursor-default'}
                                                                `}
                                                            >
                                                                <span className="font-semibold">{sesi}</span>
                                                                <div className="flex items-center gap-1">
                                                                    {icon} {label}
                                                                </div>
                                                                {detail.record?.check_in_time && (
                                                                    <span className="text-[10px] opacity-70">
                                                                        {detail.record.check_in_time.substring(0, 5)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                    <Dialog open={editModal.isOpen} onOpenChange={(open) => !open && setEditModal({ isOpen: false, data: null })}>
                        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
                            <DialogHeader className="border-b bg-muted/35 px-5 py-4 text-left">
                                <div className="flex items-start gap-3">
                                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-background text-primary shadow-sm">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <DialogTitle className="text-base">Detail Kehadiran Guru</DialogTitle>
                                        <DialogDescription className="mt-1 truncate text-xs">
                                            {editModal.data?.guruName || 'Guru'} · {editModal.data?.dateStr || '-'} · {editModal.data?.sesi || '-'}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="space-y-4 px-5 py-4">
                                <div className="grid grid-cols-2 divide-x rounded-lg border bg-background shadow-sm">
                                    <div className="px-3 py-2.5">
                                        <p className="text-[11px] text-muted-foreground">Mulai sesi</p>
                                        <p className="mt-0.5 font-mono text-sm font-semibold">{sessionStartTs ? formatTimestamp(sessionStartTs) : '-'}</p>
                                    </div>
                                    <div className="px-3 py-2.5">
                                        <p className="text-[11px] text-muted-foreground">Waktu tercatat</p>
                                        <p className="mt-0.5 font-mono text-sm font-semibold">
                                            {editModal.data?.record?.check_in_timestamp ? formatTimestamp(editModal.data.record.check_in_timestamp) : 'Belum absen'}
                                        </p>
                                    </div>
                                </div>

                                {!isReadOnlyMode && (
                                    <div className="space-y-1.5">
                                        <label htmlFor="guru-attendance-time" className="text-xs font-semibold">Ubah waktu hadir</label>
                                        <Input id="guru-attendance-time" type="time" step="1" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="h-10 font-mono" />
                                        <p className="text-[11px] text-muted-foreground">Kosongkan atau gunakan tombol tidak hadir untuk mengubah status.</p>
                                    </div>
                                )}

                                <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${modalStatusTone}`}>
                                    <ModalStatusIcon className="h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold">{isReadOnlyMode ? 'Status kehadiran' : 'Status yang akan disimpan'}: {computedStatusForModal}</p>
                                        {computedStatusForModal === 'Terlambat' && <p className="mt-0.5 text-[11px] opacity-80">Terlambat {timeDiff} menit dari jadwal sesi.</p>}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="border-t bg-muted/20 px-5 py-3 sm:justify-between">
                                <Button variant="outline" onClick={() => setEditModal({ isOpen: false, data: null })}>
                                    {isReadOnlyMode ? 'Tutup' : 'Batal'}
                                </Button>
                                {!isReadOnlyMode && (
                                    <>
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleSaveAttendance({ markAbsent: true })}
                                            disabled={isSubmitting || computedStatusForModal === 'Tidak Hadir'}
                                        >
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Tandai Tidak Hadir
                                        </Button>
                                        <Button
                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                            onClick={() => handleSaveAttendance()}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                                        </Button>
                                    </>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isSessionEditOpen} onOpenChange={setIsSessionEditOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit Sesi Mengajar: {sessionEditGuru?.nama}</DialogTitle>
                                <DialogDescription>
                                    Pilih sesi yang dihitung sebagai kewajiban hadir.
                                    Hanya menampilkan sesi yang sesuai dengan jadwal kelas guru.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                                {availableSessionsForGuru.length > 0 ? (
                                    availableSessionsForGuru.map(sesi => (
                                        <div key={sesi} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => toggleSession(sesi)}>
                                            <Checkbox checked={tempSessions.includes(sesi)} onCheckedChange={() => toggleSession(sesi)} />
                                            <span className="font-medium">{sesi}</span>
                                        </div>
                                    ))
                                ) : (
                                     <div className="col-span-2 text-center text-muted-foreground text-sm py-4">
                                        Guru ini tidak memiliki jadwal kelas aktif. Tidak ada sesi untuk diedit.
                                     </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsSessionEditOpen(false)}>Batal</Button>
                                <Button onClick={saveSessionOverride}>Simpan Perubahan</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </TabsContent>

            <TabsContent value="kinerja_guru">
                <GuruPerformanceSummary />
            </TabsContent>
        </Tabs>
    );
};

export default GuruAttendanceRecap;
