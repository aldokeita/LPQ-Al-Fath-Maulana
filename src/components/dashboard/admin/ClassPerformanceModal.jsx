import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { Users, TrendingUp, Activity, History, Clock, ArrowUpCircle, CalendarDays, Check, X, Search, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const ClassPerformanceModal = ({ isOpen, onClose, classItem }) => {
    const [jilidData, setJilidData] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [jilidHistory, setJilidHistory] = useState([]);
    const [stagnationData, setStagnationData] = useState([]);
    const [totalSantri, setTotalSantri] = useState(0);
    const [averageAttendance, setAverageAttendance] = useState(0);
    const [jilidIncreasePercentage, setJilidIncreasePercentage] = useState(0);

    // History Absensi Matrix State
    const [historyMonth, setHistoryMonth] = useState(new Date().getMonth());
    const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
    const [historyData, setHistoryData] = useState({ userRecap: [], weekdaysInMonth: [] });
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // Detailed Attendance Tab State
    const [detailedAttendance, setDetailedAttendance] = useState([]);
    const [isDetailedLoading, setIsDetailedLoading] = useState(false);
    const [detailFilter, setDetailFilter] = useState({ search: '', status: 'all', startDate: '', endDate: '' });
    const [detailSort, setDetailSort] = useState({ field: 'attendance_date', direction: 'desc' });
    const [detailStats, setDetailStats] = useState({ total: 0, hadir: 0, terlambat: 0, absen: 0, percentage: 0 });

    useEffect(() => {
        if (isOpen && classItem) {
            fetchClassStats();
            fetchDetailedAttendance();
        }
    }, [isOpen, classItem]);

    useEffect(() => {
        if (isOpen && classItem) {
            fetchHistoryAbsensi();
        }
    }, [isOpen, classItem, historyMonth, historyYear]);

    const fetchClassStats = async () => {
        try {
            // 1. Fetch Active Santri
            const { data: santriList, error: santriError } = await supabase
                .from('santri')
                .select('id, nama_lengkap, jilid, foto_url, avatar_path, created_at')
                .eq('current_class_id', classItem.id)
                .eq('status', 'Aktif');

            if (santriError) throw santriError;
            const resolvedSantriList = await resolveAvatarRecords(santriList, { ownerType: 'santri' });

            if (resolvedSantriList.length > 0) {
                setTotalSantri(resolvedSantriList.length);
                const santriIds = resolvedSantriList.map(s => s.id);

                // Jilid Distribution
                const counts = {};
                resolvedSantriList.forEach(s => { counts[s.jilid] = (counts[s.jilid] || 0) + 1; });
                setJilidData(Object.keys(counts).map(key => ({ name: key, value: counts[key] })));

                // 2. Fetch Jilid History for these santri
                const { data: history, error: historyError } = await supabase
                    .from('jilid_history')
                    .select('*, santri:santri_id(id, nama_lengkap, foto_url, avatar_path)')
                    .in('santri_id', santriIds)
                    .order('changed_at', { ascending: false });

                if (historyError) throw historyError;

                const resolvedHistory = await Promise.all((history || []).map(async (entry) => ({
                    ...entry,
                    santri: await resolveAvatarRecord(entry.santri, { ownerType: 'santri' }),
                })));
                setJilidHistory(resolvedHistory);

                // Calculate Increase Percentage (Last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const recentIncreases = (history || []).filter(h => new Date(h.changed_at) >= thirtyDaysAgo).length;
                setJilidIncreasePercentage(Math.round((recentIncreases / resolvedSantriList.length) * 100));

                // 3. Calculate Stagnation
                const stagnationList = resolvedSantriList.map(s => {
                    const lastChange = (history || []).find(h => h.santri_id === s.id);
                    const lastDate = lastChange ? new Date(lastChange.changed_at) : new Date(s.created_at);
                    const diffTime = Math.abs(new Date() - lastDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return { ...s, daysWithoutIncrease: diffDays, lastUpdate: lastDate };
                }).sort((a, b) => b.daysWithoutIncrease - a.daysWithoutIncrease);

                setStagnationData(stagnationList);
            } else {
                setTotalSantri(0);
                setJilidData([]);
                setJilidHistory([]);
                setStagnationData([]);
            }

            // 4. Fetch Attendance
            const { data: attendanceList, error: attError } = await supabase
                .from('attendance')
                .select('attendance_date, status')
                .eq('class_id', classItem.id)
                .order('attendance_date', { ascending: true });

            if (attError) throw attError;

            if (attendanceList) {
                const grouped = {};
                attendanceList.forEach(a => {
                    if (!grouped[a.attendance_date]) grouped[a.attendance_date] = { date: a.attendance_date, hadir: 0 };
                    if (a.status === 'Hadir') grouped[a.attendance_date].hadir += 1;
                });
                const sortedDates = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);
                const currentSize = resolvedSantriList.length || 1;
                const chartData = sortedDates.map(d => ({
                    date: new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                    persentase: Math.min(100, Math.round((d.hadir / currentSize) * 100))
                }));
                setAttendanceData(chartData);
                const avg = chartData.length > 0 ? chartData.reduce((acc, curr) => acc + curr.persentase, 0) / chartData.length : 0;
                setAverageAttendance(Math.round(avg));
            }
        } catch (err) {
            console.error("Error fetching class stats", err);
            setTotalSantri(0);
            setJilidData([]);
            setJilidHistory([]);
            setStagnationData([]);
            toast({ title: "Gagal memuat performa kelas", description: err.message, variant: "destructive" });
        }
    };

    const fetchDetailedAttendance = async () => {
        if (!classItem) return;
        setIsDetailedLoading(true);
        try {
            // First get santri IDs for this class
            const { data: santriList, error: santriError } = await supabase
                .from('santri')
                .select('id, nama_lengkap, foto_url, avatar_path')
                .eq('current_class_id', classItem.id);

            if (santriError) throw santriError;
            const resolvedSantriList = await resolveAvatarRecords(santriList, { ownerType: 'santri' });

            if (resolvedSantriList.length === 0) {
                setDetailedAttendance([]);
                setIsDetailedLoading(false);
                return;
            }

            const santriMap = {};
            resolvedSantriList.forEach(s => { santriMap[s.id] = s; });
            const santriIds = resolvedSantriList.map(s => s.id);

            let query = supabase.from('attendance')
                .select('*')
                .in('user_id', santriIds);

            const { data: attData, error: attError } = await query;
            if (attError) throw attError;

            const mappedData = (attData || []).map(record => ({
                ...record,
                santri: santriMap[record.user_id] || { nama_lengkap: 'Unknown' }
            }));

            setDetailedAttendance(mappedData);
        } catch (err) {
            console.error("Error fetching detailed attendance", err);
            toast({ title: "Gagal memuat detail absensi", description: err.message, variant: "destructive" });
        } finally {
            setIsDetailedLoading(false);
        }
    };

    const fetchHistoryAbsensi = async () => {
        if (!classItem) return;
        setIsHistoryLoading(true);

        const startDate = `${historyYear}-${String(historyMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(historyYear, historyMonth + 1, 0).getDate();
        const endDate = `${historyYear}-${String(historyMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        try {
            // 1. Fetch Calendar Data for Holidays only
            const { data: calendarData, error: calError } = await supabase
                .from('academic_calendar')
                .select('date')
                .gte('date', startDate)
                .lte('date', endDate)
                .eq('is_holiday', true);

            if (calError) throw calError;

            const holidaySet = new Set((calendarData || []).map(c => c.date));

            // 2. Filter active days (Mon-Fri and not holiday)
            const activeDays = [];
            for (let d = 1; d <= lastDay; d++) {
                const dateStr = `${historyYear}-${String(historyMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dateObj = new Date(historyYear, historyMonth, d);
                const dayOfWeek = dateObj.getDay(); // 0 is Sun, 6 is Sat
                if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidaySet.has(dateStr)) {
                    activeDays.push(d);
                }
            }

            const uniqueActiveDays = activeDays;

            // 3. Get Santri in this class
            const { data: santriList, error: santriError } = await supabase
                .from('santri')
                .select('id, nama_lengkap, foto_url, avatar_path')
                .eq('current_class_id', classItem.id)
                .eq('status', 'Aktif')
                .order('nama_lengkap');

            if (santriError) throw santriError;
            const resolvedSantriList = await resolveAvatarRecords(santriList, { ownerType: 'santri' });

            // 4. Get Attendance data
            const { data: attendance, error: attError } = await supabase
                .from('attendance')
                .select('user_id, attendance_date, status')
                .eq('class_id', classItem.id)
                .gte('attendance_date', startDate)
                .lte('attendance_date', endDate);

            if (attError) throw attError;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const pastSessionDaysCount = uniqueActiveDays.filter(d => new Date(historyYear, historyMonth, d) <= today).length;

            const userRecap = resolvedSantriList.map(user => {
                const attendanceByDate = {};
                let totalHadir = 0;

                uniqueActiveDays.forEach(day => {
                    const dateToCompare = new Date(historyYear, historyMonth, day);
                    const isPast = dateToCompare <= today;

                    const dateStr = `${historyYear}-${String(historyMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const attendanceRecord = (attendance || []).find(a => a.user_id === user.id && a.attendance_date === dateStr);

                    if (isPast) {
                        if (attendanceRecord && attendanceRecord.status.toLowerCase().includes('hadir')) {
                            attendanceByDate[day] = 'H';
                            totalHadir++;
                        } else {
                            attendanceByDate[day] = 'A';
                        }
                    } else {
                        attendanceByDate[day] = 'F'; // Future
                    }
                });

                const totalAlpha = pastSessionDaysCount - totalHadir;

                return {
                    id: user.id,
                    name: user.nama_lengkap,
                    photo: user.foto_url,
                    ...attendanceByDate,
                    totalHadir,
                    totalAlpha
                };
            });

            setHistoryData({ userRecap, weekdaysInMonth: uniqueActiveDays });

        } catch (err) {
            console.error("Error fetching history attendance", err);
            toast({ title: "Gagal memuat history absensi", description: err.message, variant: "destructive" });
        } finally {
            setIsHistoryLoading(false);
        }
    };

    // Filter and Sort Detailed Attendance
    const filteredAndSortedDetailedAttendance = useMemo(() => {
        let result = [...detailedAttendance];

        // Apply filters
        if (detailFilter.search) {
            result = result.filter(item => item.santri.nama_lengkap.toLowerCase().includes(detailFilter.search.toLowerCase()));
        }
        if (detailFilter.status !== 'all') {
            result = result.filter(item => item.status.toLowerCase() === detailFilter.status.toLowerCase());
        }
        if (detailFilter.startDate) {
            result = result.filter(item => item.attendance_date >= detailFilter.startDate);
        }
        if (detailFilter.endDate) {
            result = result.filter(item => item.attendance_date <= detailFilter.endDate);
        }

        // Apply sorting
        result.sort((a, b) => {
            let valA, valB;
            if (detailSort.field === 'name') {
                valA = a.santri.nama_lengkap.toLowerCase();
                valB = b.santri.nama_lengkap.toLowerCase();
            } else {
                valA = new Date(a.attendance_date).getTime();
                valB = new Date(b.attendance_date).getTime();
            }

            if (valA < valB) return detailSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return detailSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [detailedAttendance, detailFilter, detailSort]);

    // Calculate Detailed Stats
    useEffect(() => {
        const total = filteredAndSortedDetailedAttendance.length;
        const hadir = filteredAndSortedDetailedAttendance.filter(i => i.status.toLowerCase() === 'hadir').length;
        const terlambat = filteredAndSortedDetailedAttendance.filter(i => i.status.toLowerCase() === 'terlambat').length;
        const absen = filteredAndSortedDetailedAttendance.filter(i => ['alpha', 'tidak hadir'].includes(i.status.toLowerCase())).length;

        const validPresence = hadir + terlambat;
        const percentage = total > 0 ? Math.round((validPresence / total) * 100) : 0;

        setDetailStats({ total, hadir, terlambat, absen, percentage });
    }, [filteredAndSortedDetailedAttendance]);

    const handleSortToggle = (field) => {
        setDetailSort(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    // Generate years for filter (e.g., last 3 years)
    const currentYear = new Date().getFullYear();
    const availableYears = [currentYear, currentYear - 1, currentYear - 2];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-600"/> Performa Kelas: {classItem?.nama_kelas}
                    </DialogTitle>
                    <DialogDescription>Analisis statistik santri, kenaikan jilid, dan kehadiran.</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                    <Card>
                        <CardHeader className="pb-2 p-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Santri</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-2xl font-bold text-blue-600">{totalSantri}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 p-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Rata-rata Kehadiran</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-2xl font-bold text-green-600">{averageAttendance}%</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 p-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Kenaikan Jilid (30 Hari)</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-2xl font-bold text-purple-600">{jilidIncreasePercentage}%</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 p-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Sesi</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-0"><div className="text-2xl font-bold text-slate-700">{classItem?.sesi}</div></CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="charts" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="charts">Grafik & Statistik</TabsTrigger>
                        <TabsTrigger value="detailedAttendance">Detail Absensi</TabsTrigger>
                        <TabsTrigger value="history">Matriks Absensi</TabsTrigger>
                        <TabsTrigger value="stagnation">Durasi di Jilid</TabsTrigger>
                    </TabsList>

                    <TabsContent value="charts" className="space-y-6 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="flex flex-col">
                                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Tren Kehadiran (7 Sesi)</CardTitle></CardHeader>
                                <CardContent className="flex-1 min-h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={attendanceData}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                            <XAxis dataKey="date" fontSize={12} />
                                            <YAxis domain={[0, 100]} fontSize={12} />
                                            <RechartsTooltip />
                                            <Bar dataKey="persentase" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Kehadiran (%)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="flex flex-col">
                                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4"/> Distribusi Jilid Santri</CardTitle></CardHeader>
                                <CardContent className="flex-1 min-h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={jilidData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {jilidData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="detailedAttendance" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-500" /> Detail Riwayat Absensi
                                    </CardTitle>
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                        <div className="relative flex-1 sm:w-48">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Cari santri..."
                                                className="pl-8"
                                                value={detailFilter.search}
                                                onChange={(e) => setDetailFilter(prev => ({ ...prev, search: e.target.value }))}
                                            />
                                        </div>
                                        <Select value={detailFilter.status} onValueChange={(val) => setDetailFilter(prev => ({ ...prev, status: val }))}>
                                            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua Status</SelectItem>
                                                <SelectItem value="hadir">Hadir</SelectItem>
                                                <SelectItem value="terlambat">Terlambat</SelectItem>
                                                <SelectItem value="alpha">Alpha/Tidak Hadir</SelectItem>
                                                <SelectItem value="izin">Izin</SelectItem>
                                                <SelectItem value="sakit">Sakit</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input type="date" className="w-[140px]" value={detailFilter.startDate} onChange={(e) => setDetailFilter(prev => ({...prev, startDate: e.target.value}))} />
                                        <Input type="date" className="w-[140px]" value={detailFilter.endDate} onChange={(e) => setDetailFilter(prev => ({...prev, endDate: e.target.value}))} />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
                                    <div className="text-center"><p className="text-xs text-muted-foreground">Total Data</p><p className="font-bold text-lg">{detailStats.total}</p></div>
                                    <div className="text-center"><p className="text-xs text-muted-foreground">Hadir</p><p className="font-bold text-lg text-emerald-600">{detailStats.hadir}</p></div>
                                    <div className="text-center"><p className="text-xs text-muted-foreground">Terlambat</p><p className="font-bold text-lg text-amber-600">{detailStats.terlambat}</p></div>
                                    <div className="text-center"><p className="text-xs text-muted-foreground">Absen</p><p className="font-bold text-lg text-red-600">{detailStats.absen}</p></div>
                                    <div className="text-center"><p className="text-xs text-muted-foreground">Persentase</p><p className="font-bold text-lg text-blue-600">{detailStats.percentage}%</p></div>
                                </div>

                                <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSortToggle('name')}>
                                                    Nama Santri {detailSort.field === 'name' && (detailSort.direction === 'asc' ? '↑' : '↓')}
                                                </th>
                                                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSortToggle('attendance_date')}>
                                                    Tanggal {detailSort.field === 'attendance_date' && (detailSort.direction === 'asc' ? '↑' : '↓')}
                                                </th>
                                                <th className="px-4 py-3 font-semibold">Waktu Masuk</th>
                                                <th className="px-4 py-3 font-semibold">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                            {isDetailedLoading ? (
                                                <tr><td colSpan="4" className="text-center py-8 text-muted-foreground">Memuat data...</td></tr>
                                            ) : filteredAndSortedDetailedAttendance.length > 0 ? (
                                                filteredAndSortedDetailedAttendance.map((record) => (
                                                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                                                            <Avatar className="w-6 h-6"><AvatarImage src={record.santri.foto_url} /><AvatarFallback>{record.santri.nama_lengkap?.[0]}</AvatarFallback></Avatar>
                                                            {record.santri.nama_lengkap}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                            {new Date(record.attendance_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs">
                                                            {record.check_in_timestamp ? new Date(record.check_in_timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant={['Hadir', 'Terlambat'].includes(record.status) ? 'default' : 'destructive'}
                                                                   className={record.status === 'Hadir' ? 'bg-emerald-500' : record.status === 'Terlambat' ? 'bg-amber-500' : 'bg-red-500'}>
                                                                {record.status}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan="4" className="text-center py-8 text-muted-foreground">Tidak ada data absensi ditemukan.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history" className="mt-4">
                        <Card>
                            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CalendarDays className="w-5 h-5 text-indigo-500"/> Matriks Absensi Santri
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Select value={historyMonth.toString()} onValueChange={(val) => setHistoryMonth(Number(val))}>
                                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {months.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={historyYear.toString()} onValueChange={(val) => setHistoryYear(Number(val))}>
                                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isHistoryLoading ? (
                                    <div className="flex justify-center items-center py-10 text-muted-foreground">
                                        Memuat data absensi...
                                    </div>
                                ) : historyData.userRecap.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                        Tidak ada data santri di kelas ini.
                                    </div>
                                ) : historyData.weekdaysInMonth.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                        Tidak ada hari (efektif) pada kalender akademik untuk bulan ini.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border rounded-xl shadow-sm custom-scrollbar bg-white dark:bg-slate-950">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-20">
                                                <tr>
                                                    <th className="px-3 py-3 text-left w-48 sticky left-0 bg-slate-100 dark:bg-slate-900 z-30 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 shadow-[1px_0_5px_rgba(0,0,0,0.05)]">Nama Santri</th>
                                                    {historyData.weekdaysInMonth.map(day => (
                                                        <th key={day} className="px-2 py-3 text-center w-10 font-medium text-slate-500">{day}</th>
                                                    ))}
                                                    <th className="px-3 py-3 text-center w-24 font-semibold border-l border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">Total Hadir</th>
                                                    <th className="px-3 py-3 text-center w-24 font-bold border-l border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">Total Alpha</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {historyData.userRecap.map(user => (
                                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-20 border-r border-slate-100 dark:border-slate-800 shadow-[1px_0_5px_rgba(0,0,0,0.02)]">
                                                            {user.name}
                                                        </td>
                                                        {historyData.weekdaysInMonth.map(day => (
                                                            <td key={day} className="px-2 py-2 text-center border-x border-slate-50 dark:border-slate-800/30">
                                                                {user[day] === 'H' ? (
                                                                    <Check className="w-4 h-4 mx-auto text-emerald-500 font-bold" />
                                                                ) : user[day] === 'A' ? (
                                                                    <X className="w-4 h-4 mx-auto text-red-500 font-bold" />
                                                                ) : (
                                                                    <span className="text-slate-300 dark:text-slate-700">-</span>
                                                                )}
                                                            </td>
                                                        ))}
                                                        <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-300 border-l border-slate-100 dark:border-slate-800">
                                                            {user.totalHadir}
                                                        </td>
                                                        <td className="px-3 py-2 text-center border-l border-slate-100 dark:border-slate-800">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${user.totalAlpha > 2 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                                {user.totalAlpha}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="stagnation" className="mt-4">
                        <Card>
                            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4"/> Durasi Santri di Jilid Saat Ini</CardTitle></CardHeader>
                            <CardContent className="max-h-[400px] overflow-y-auto space-y-3">
                                {stagnationData.length > 0 ? stagnationData.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10"><AvatarImage src={s.foto_url} /><AvatarFallback>{s.nama_lengkap?.[0]}</AvatarFallback></Avatar>
                                            <div>
                                                <p className="font-bold text-sm">{s.nama_lengkap}</p>
                                                <p className="text-xs text-muted-foreground">Jilid: {s.jilid}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-bold ${s.daysWithoutIncrease > 90 ? 'text-red-500' : s.daysWithoutIncrease > 60 ? 'text-yellow-500' : 'text-green-500'}`}>
                                                {s.daysWithoutIncrease} Hari
                                            </span>
                                            <p className="text-[10px] text-muted-foreground">Tanpa Kenaikan</p>
                                        </div>
                                    </div>
                                )) : <p className="text-center text-muted-foreground py-8">Data tidak tersedia.</p>}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default ClassPerformanceModal;
