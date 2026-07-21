import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Percent, Calendar as CalendarIcon, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import AttendanceDetailsModal from '../shared/AttendanceDetailsModal';
import { DEFAULT_SESSION_TIMES, buildSessionStartTimestamp, resolveAttendanceRecordStatus, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';

const getSessionStartTimestamp = (dateStr, sesiName) => buildSessionStartTimestamp(dateStr, sesiName, DEFAULT_SESSION_TIMES);

const normalizeStatus = (rawStatus) => {
    if (!rawStatus) return 'Tidak Hadir';
    const s = String(rawStatus).toLowerCase().trim();

    if (s === 'on_time' || s === 'hadir' || s.includes('tepat waktu')) {
        return 'Hadir';
    }
    if (s.includes('terlambat')) {
        return 'Terlambat';
    }
    if (s.includes('tidak hadir') || s === 'alpa' || s === 'alpha') {
        return 'Tidak Hadir';
    }

    return 'Hadir'; // Fallback for unexpected valid values
};

const getComputedStatus = (record, sessionStart) => {
    if (!record) return 'Tidak Hadir';
    if (!record.check_in_timestamp) return normalizeStatus(record.status);
    return resolveAttendanceRecordStatus(record, sessionStart);
};

const SantriAbsensiRecap = () => {
    const { user } = useAuth();
    const [attendance, setAttendance] = useState([]);
    const [holidays, setHolidays] = useState(new Set());
    const [santriData, setSantriData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalDetails, setModalDetails] = useState(null);

    const fetchAllData = useCallback(async () => {
        if (!user?.id) {
            console.error("SantriAbsensiRecap Error: No user_id available.");
            return;
        }

        setIsLoading(true);

        try {
            const [attendanceRes, calendarRes, santriRes] = await Promise.all([
                supabase.from('attendance')
                    .select('id, user_id, attendance_date, check_in_timestamp, check_in_time, status, role, class_id, sesi, attended_session')
                    .eq('user_id', user.id)
                    .order('attendance_date', { ascending: true }),
                supabase.from('academic_calendar').select('date').eq('is_holiday', true),
                supabase
                    .from('santri')
                    .select('id, nama_lengkap, sesi_mengaji, current_class_id, foto_url, kategori, status, class:current_class_id(sesi, nama_kelas)')
                    .eq('id', user.id)
                    .single()
            ]);

            if (attendanceRes.error) {
                console.error("[DEBUG] Error fetching attendance:", attendanceRes.error);
                throw attendanceRes.error;
            }

            setAttendance(attendanceRes.data || []);
            setHolidays(new Set((calendarRes.data || []).map(c => c.date)));
            setSantriData(santriRes.data);
        } catch (err) {
            setError(err.message);
            console.error("[DEBUG] Error in fetchAllData:", err);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const stats = useMemo(() => {
        let totalSessions = 0;
        let hadirCount = 0;
        let terlambatCount = 0;
        let tidakHadirCount = 0;

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let d = 1; d <= daysInMonth; d++) {
            const dateToCompare = new Date(year, month, d);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = dateToCompare.getDay();

            // Count only weekday dates in the month (Mon-Fri)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const isHoliday = holidays.has(dateStr);
                const isPastOrToday = dateToCompare <= today;

                if (!isHoliday && isPastOrToday) {
                    totalSessions++;

                    const record = attendance.find(a => a.attendance_date === dateStr);
                    const sessionStart = getSessionStartTimestamp(
                        dateStr,
                        record?.attended_session || santriData?.sesi_mengaji || santriData?.class?.sesi,
                    );
                    const computedStatus = getComputedStatus(record, sessionStart);

                    if (computedStatus === 'Hadir') {
                        hadirCount++;
                    } else if (computedStatus === 'Terlambat') {
                        terlambatCount++;
                    } else {
                        tidakHadirCount++;
                    }
                }
            }
        }

        let hadirPerc = 0;
        let terlambatPerc = 0;
        let tidakHadirPerc = 0;
        let overallPerc = 0;

        if (totalSessions > 0) {
            hadirPerc = Math.round((hadirCount / totalSessions) * 1000) / 10;
            terlambatPerc = Math.round((terlambatCount / totalSessions) * 1000) / 10;
            tidakHadirPerc = Math.round((tidakHadirCount / totalSessions) * 1000) / 10;
            overallPerc = hadirPerc + terlambatPerc;
        }

        return {
            hadir_count: hadirCount,
            hadir_percentage: hadirPerc,
            terlambat_count: terlambatCount,
            terlambat_percentage: terlambatPerc,
            tidak_hadir_count: tidakHadirCount,
            tidak_hadir_percentage: tidakHadirPerc,
            total_sessions: totalSessions,
            overall_percentage: overallPerc
        };
    }, [attendance, currentDate, holidays, santriData]);

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const handleDayClick = (day) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = attendance.find(a => a.attendance_date === dateStr);

        const registeredSession = santriData?.sesi_mengaji || santriData?.class?.sesi;
        const attendedSession = record?.attended_session || registeredSession;
        const sessionStart = getSessionStartTimestamp(dateStr, attendedSession);
        const finalStatus = getComputedStatus(record, sessionStart);

        setModalDetails({
            id: record?.id,
            user_id: user.id,
            user_role: 'santri',
            status: finalStatus,
            attendance_date: dateStr,
            checkInTimestamp: record?.check_in_timestamp,
            sessionStartTime: sessionStart,
            lateMinutes: record ? calculateTimeDifference(record.check_in_timestamp, sessionStart) : 0,
            sesi: registeredSession,
            attended_session: attendedSession,
            class_id: santriData?.current_class_id,
        });
        setIsModalOpen(true);
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = [];
        let firstWeekdayFound = false;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateToCompare = new Date(year, month, i);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayOfWeek = dateToCompare.getDay();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
            }

            if (!firstWeekdayFound) {
                const emptyCellsCount = dayOfWeek - 1;
                for (let e = 0; e < emptyCellsCount; e++) {
                    days.push(<div key={`empty-${e}`} className="p-2 border border-transparent"></div>);
                }
                firstWeekdayFound = true;
            }

            const record = attendance.find(a => a.attendance_date === dateStr);
            const isPastOrToday = dateToCompare <= today;

            let bgColor = "border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-slate-900/65 dark:text-slate-500";
            let tooltip = "Belum ada sesi/Libur";

            if (isPastOrToday) {
                const sessionStart = getSessionStartTimestamp(dateStr, santriData?.sesi_mengaji || santriData?.class?.sesi);
                let computedStatus = getComputedStatus(record, sessionStart);

                if (holidays.has(dateStr)) {
                    bgColor = "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-slate-900/65 dark:text-slate-500";
                    tooltip = "Libur Akademik";
                } else if (computedStatus === 'Hadir') {
                    bgColor = "border-emerald-300 bg-emerald-50 font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-400/35 dark:bg-slate-900/80 dark:text-emerald-300 dark:hover:bg-slate-800";
                    tooltip = computedStatus;
                } else if (computedStatus === 'Terlambat') {
                    bgColor = "border-amber-300 bg-amber-50 font-bold text-amber-700 shadow-sm hover:bg-amber-100 dark:border-amber-400/35 dark:bg-slate-900/80 dark:text-amber-300 dark:hover:bg-slate-800";
                    tooltip = computedStatus;
                } else {
                    bgColor = "border-rose-300 bg-rose-50 font-bold text-rose-700 shadow-sm hover:bg-rose-100 dark:border-rose-400/35 dark:bg-slate-900/80 dark:text-rose-300 dark:hover:bg-slate-800";
                    tooltip = "Tidak Hadir";
                }
            }

            const canInspect = isPastOrToday && (!holidays.has(dateStr) || record);

            days.push(
                <button
                    type="button"
                    key={i}
                    title={tooltip}
                    onClick={() => canInspect && handleDayClick(i)}
                    disabled={!canInspect}
                    aria-label={`${i} ${monthNames[month]}: ${tooltip}`}
                    className={cn(
                        "flex h-9 w-full items-center justify-center rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-default sm:h-10 sm:text-sm lg:h-11",
                        bgColor
                    )}
                >
                    {i}
                </button>
            );
        }

        return days;
    };

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat data absensi...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    const statItems = [
        { label: 'Tepat waktu', value: stats.hadir_count, detail: `${stats.hadir_percentage}% bulan ini`, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-400/25' },
        { label: 'Terlambat', value: stats.terlambat_count, detail: `${stats.terlambat_percentage}% bulan ini`, icon: Clock, tone: 'text-amber-600 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-400/25' },
        { label: 'Tidak hadir', value: stats.tidak_hadir_count, detail: `${stats.tidak_hadir_percentage}% bulan ini`, icon: XCircle, tone: 'text-rose-600 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-400/25' },
        { label: 'Kehadiran', value: `${stats.overall_percentage}%`, detail: `${stats.total_sessions} hari belajar`, icon: Percent, tone: 'text-cyan-600 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-400/25' }
    ];

    return (
        <div className="space-y-5">
            <header className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/75">
                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                            <Sparkles className="h-4 w-4" /> Ritme belajar bulan ini
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">Rekap Kehadiran</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Pantau konsistensi hadir, ketepatan waktu, dan detail setiap hari belajar dalam satu tampilan.</p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/80">
                        <div className="flex items-end justify-between gap-3">
                            <div><p className="text-xs font-bold uppercase text-muted-foreground">Kehadiran</p><p className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{stats.overall_percentage}%</p></div>
                            <CalendarIcon className="h-7 w-7 text-cyan-600 dark:text-cyan-300" />
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-cyan-500 transition-[width] duration-500" style={{ width: `${Math.min(100, stats.overall_percentage)}%` }} /></div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {statItems.map(({ label, value, detail, icon: Icon, tone, border }) => (
                    <article key={label} className={cn('rounded-lg border bg-white p-4 shadow-sm dark:bg-slate-950/70', border)}>
                        <div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><Icon className={cn('h-5 w-5', tone)} /></div>
                        <p className={cn('mt-4 text-3xl font-black tracking-tight', tone)}>{value}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p>
                    </article>
                ))}
            </div>

            <section className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/25">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold"><CalendarIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />Kalender Kehadiran</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Hari belajar Senin sampai Jumat</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Bulan sebelumnya"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="min-w-[132px] text-center text-sm font-bold">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Bulan berikutnya" disabled={currentDate.getMonth() >= new Date().getMonth() && currentDate.getFullYear() >= new Date().getFullYear()}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="p-3 sm:p-4">
                    <div className="w-full">
                      <div className="mb-1 grid grid-cols-5 gap-1 sm:gap-1.5">
                        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum'].map(day => <div key={day} className="py-1.5 text-center text-[11px] font-bold uppercase text-muted-foreground">{day}</div>)}
                      </div>
                      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">{renderCalendar()}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-xs font-medium text-muted-foreground dark:border-white/10 sm:justify-start">
                        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Tepat waktu</span>
                        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Terlambat</span>
                        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />Tidak hadir</span>
                    </div>
                </div>
            </section>

            <AttendanceDetailsModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setModalDetails(null); }}
                details={modalDetails}
                onSuccess={fetchAllData}
            />
        </div>
    );
};

export default SantriAbsensiRecap;
