import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Search, Calendar, Clock, CheckCircle2, XCircle, Plus, BookOpen, Trash2, Edit, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMMQAttendance } from '@/hooks/useMMQAttendance';
import MMQScheduleForm from './MMQScheduleForm';
import MMQAttendanceModal from './MMQAttendanceModal';
import { formatTimestamp, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const StatusBadge = ({ status }) => {
    switch (status) {
        case 'Hadir': return <Badge className="mmq-status-hadir shadow-sm border-none"><CheckCircle2 className="w-3 h-3 mr-1"/> Hadir</Badge>;
        case 'Terlambat': return <Badge className="mmq-status-terlambat shadow-sm border-none"><Clock className="w-3 h-3 mr-1"/> Terlambat</Badge>;
        default: return <Badge className="mmq-status-tidak-hadir shadow-sm border-none"><XCircle className="w-3 h-3 mr-1"/> Tidak Hadir</Badge>;
    }
};

const MMQManagement = () => {
    const { toast } = useToast();
    const { fetchMMQSchedule, fetchMMQAttendance, saveMMQAttendance, deleteMMQAttendance, updateMMQSchedule, deleteMMQSchedule } = useMMQAttendance();

    const [activeTab, setActiveTab] = useState('history');

    // Data states
    const [schedules, setSchedules] = useState([]);
    const [attendances, setAttendances] = useState([]);
    const [gurus, setGurus] = useState([]);

    // Filter states
    const [historyDateFilter, setHistoryDateFilter] = useState(new Date().toLocaleDateString('en-CA'));
    const [historySearch, setHistorySearch] = useState('');
    const [guruSearch, setGuruSearch] = useState('');

    // Modals & Forms
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [editingAttendance, setEditingAttendance] = useState(null);

    const loadData = async () => {
        const scheduleData = await fetchMMQSchedule();
        if (scheduleData) setSchedules(scheduleData);

        const attendanceData = await fetchMMQAttendance({ date: historyDateFilter });
        if (attendanceData) setAttendances(attendanceData);

        const { data: guruData } = await supabase.from('guru').select('id, nama, email, no_hp, foto_url');
        if (guruData) setGurus(await resolveAvatarRecords(guruData, { ownerType: 'guru' }));
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historyDateFilter]);

    // Derived Data: Guru List with Today's MMQ Status
    const guruListWithStatus = gurus.map(guru => {
        const todayAttendance = attendances.find(a => a.guru_id === guru.id && a.attendance_date === new Date().toLocaleDateString('en-CA'));
        return {
            ...guru,
            todayStatus: todayAttendance?.status || 'Belum Tap',
            checkInTime: todayAttendance?.check_in_timestamp
        };
    }).filter(g => g.nama.toLowerCase().includes(guruSearch.toLowerCase()));

    // Filtered History
    const filteredHistory = attendances.filter(a => a.guru?.nama.toLowerCase().includes(historySearch.toLowerCase()));

    // Handlers
    const handleSaveSchedule = async (data) => {
        const result = await updateMMQSchedule(data);
        if (result.success) {
            toast({ title: "Berhasil", description: "Jadwal MMQ disimpan." });
            setIsScheduleModalOpen(false);
            loadData();
        } else {
            toast({ title: "Gagal", description: result.error, variant: "destructive" });
        }
    };

    const handleDeleteSchedule = async (id) => {
        if (!window.confirm("Hapus jadwal ini?")) return;
        const result = await deleteMMQSchedule(id);
        if (result.success) {
            toast({ title: "Berhasil", description: "Jadwal dihapus." });
            loadData();
        }
    };

    const handleSaveAttendance = async (data) => {
        const result = await saveMMQAttendance(data);
        if (result.success) {
            toast({ title: "Berhasil", description: "Absensi MMQ diperbarui." });
            loadData();
        } else {
            toast({ title: "Gagal", description: result.error, variant: "destructive" });
        }
    };

    const handleDeleteAttendance = async (id) => {
        const result = await deleteMMQAttendance(id);
        if (result.success) {
            toast({ title: "Berhasil", description: "Record dihapus." });
            loadData();
        }
    };

    return (
        <div className="space-y-6">
            <div className="admin-panel-header">
                <div className="flex items-center gap-3">
                    <div className="admin-panel-header-icon">
                        <BookOpen />
                    </div>
                    <div className="admin-panel-header-text">
                        <h2>Manajemen MMQ</h2>
                        <p>Majelis Mu'allimil Qur'an — Absensi & Jadwal Guru</p>
                    </div>
                </div>
                <div className="admin-panel-header-actions">
                    <button onClick={() => { setEditingSchedule(null); setIsScheduleModalOpen(true); }} className="admin-panel-primary-btn">
                        <Plus className="w-4 h-4" /> Tambah Jadwal
                    </button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="admin-segmented-control mb-6">
                    <button
                        className={`admin-segmented-control-item ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <Clock className="w-3.5 h-3.5" /> Riwayat Absensi
                    </button>
                    <button
                        className={`admin-segmented-control-item ${activeTab === 'schedule' ? 'active' : ''}`}
                        onClick={() => setActiveTab('schedule')}
                    >
                        <Calendar className="w-3.5 h-3.5" /> Jadwal MMQ
                    </button>
                    <button
                        className={`admin-segmented-control-item ${activeTab === 'guru' ? 'active' : ''}`}
                        onClick={() => setActiveTab('guru')}
                    >
                        <User className="w-3.5 h-3.5" /> Daftar Guru
                    </button>
                </div>

                {/* TAB: HISTORY */}
                <TabsContent value="history" className="space-y-4">
                    <div className="admin-filter-bar">
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={historyDateFilter}
                                onChange={(e) => setHistoryDateFilter(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <div className="admin-search-input" style={{ maxWidth: '16rem' }}>
                            <Search />
                            <Input
                                placeholder="Cari guru..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="admin-table-shell">
                        <div className="admin-table-scroll">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Guru</th>
                                        <th className="px-4 py-3 font-semibold">Waktu Masuk</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHistory.length > 0 ? filteredHistory.map(record => {
                                        const timeDiff = record.status === 'Terlambat' && record.check_in_timestamp && record.schedule?.start_time
                                            ? calculateTimeDifference(record.check_in_timestamp, new Date(`${record.attendance_date}T${record.schedule.start_time}`).toISOString())
                                            : 0;

                                        return (
                                            <tr key={record.id}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-8 h-8">
                                                            <AvatarImage src={record.guru?.foto_url} />
                                                            <AvatarFallback>{record.guru?.nama?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-semibold" style={{ color: 'hsl(var(--admin-text-primary))' }}>{record.guru?.nama}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-mono" style={{ color: 'hsl(var(--admin-text-secondary))' }}>
                                                    {record.check_in_timestamp ? new Date(record.check_in_timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <StatusBadge status={record.status} />
                                                        {timeDiff > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">+{timeDiff} mnt</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingAttendance(record); setIsAttendanceModalOpen(true); }}>
                                                        <Edit className="w-4 h-4" style={{ color: 'hsl(var(--admin-accent-cyan))' }} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={4} className="text-center py-8" style={{ color: 'hsl(var(--admin-text-muted))' }}>Tidak ada data absensi untuk tanggal ini.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB: SCHEDULE */}
                <TabsContent value="schedule" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {schedules.map(sch => (
                            <div key={sch.id} className="admin-card p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5" style={{ color: 'hsl(var(--admin-accent-cyan))' }} />
                                        <span className="font-bold text-lg" style={{ color: 'hsl(var(--admin-text-primary))' }}>{DAYS[sch.day_of_week]}</span>
                                    </div>
                                    <span className={`admin-status-badge ${sch.is_active ? 'admin-status-badge--success' : 'admin-status-badge--neutral'}`}>
                                        {sch.is_active ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                </div>
                                <div className="space-y-2 text-sm mb-4" style={{ color: 'hsl(var(--admin-text-secondary))' }}>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {sch.start_time?.substring(0, 5) || '-'}
                                        {sch.end_time ? ` - ${sch.end_time.substring(0, 5)}` : ''} WIB
                                    </div>
                                    <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> {sch.location}</div>
                                </div>
                                <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid hsl(var(--admin-border-subtle))' }}>
                                    <Button variant="outline" size="sm" onClick={() => { setEditingSchedule(sch); setIsScheduleModalOpen(true); }}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDeleteSchedule(sch.id)} className="text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {schedules.length === 0 && (
                            <div className="admin-empty-state col-span-full">
                                <Calendar className="admin-empty-state-icon" />
                                <p className="admin-empty-state-description">Belum ada jadwal MMQ diatur.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* TAB: GURU LIST */}
                <TabsContent value="guru" className="space-y-4">
                    <div className="admin-search-input" style={{ maxWidth: '16rem', marginBottom: '1rem', position: 'relative' }}>
                        <Search />
                        <Input placeholder="Cari guru..." value={guruSearch} onChange={(e) => setGuruSearch(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {guruListWithStatus.map(guru => (
                            <div key={guru.id} className="admin-card flex items-center gap-4 p-4">
                                <Avatar className="w-12 h-12" style={{ border: '2px solid hsl(var(--admin-border))' }}>
                                    <AvatarImage src={guru.foto_url} />
                                    <AvatarFallback>{guru.nama?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate" style={{ color: 'hsl(var(--admin-text-primary))' }}>{guru.nama}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {guru.todayStatus === 'Belum Tap' ? (
                                            <span className="admin-status-badge admin-status-badge--danger">Belum Absen</span>
                                        ) : (
                                            <StatusBadge status={guru.todayStatus} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSchedule ? 'Edit Jadwal MMQ' : 'Tambah Jadwal MMQ'}</DialogTitle>
                    </DialogHeader>
                    <MMQScheduleForm
                        initialData={editingSchedule}
                        onSave={handleSaveSchedule}
                        onCancel={() => setIsScheduleModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <MMQAttendanceModal
                isOpen={isAttendanceModalOpen}
                onClose={() => { setIsAttendanceModalOpen(false); setEditingAttendance(null); }}
                record={editingAttendance}
                onSave={handleSaveAttendance}
                onDelete={handleDeleteAttendance}
            />
        </div>
    );
};

export default MMQManagement;
