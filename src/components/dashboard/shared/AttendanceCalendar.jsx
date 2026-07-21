import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle, XCircle, Info, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const AttendanceCalendar = ({ attendanceData }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, percentage: 0 });

  // Extract year and month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar helpers
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay(); // 0 = Sunday

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Calculate stats based on ALL data passed, not just current month (or maybe current month is better context?)
  // Let's do current month stats for the calendar view context
  useEffect(() => {
    const currentMonthData = attendanceData.filter(item => {
      const d = new Date(item.attendance_date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const total = currentMonthData.length;
    const present = currentMonthData.filter(i => {
      const s = i.status?.toLowerCase() || '';
      return s.includes('hadir') || s === 'on_time' || s.includes('terlambat');
    }).length;

    const absent = currentMonthData.filter(i => {
      const s = i.status?.toLowerCase() || '';
      return s === 'alpha' || s === 'izin' || s === 'sakit' || s.includes('tidak hadir');
    }).length;

    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    setStats({ total, present, absent, percentage });
  }, [attendanceData, month, year]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Render cells
  const renderCalendarCells = () => {
    const cells = [];
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    // Day headers
    days.forEach(day => {
      cells.push(
        <div key={`header-${day}`} className="h-10 flex items-center justify-center font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          {day}
        </div>
      );
    });

    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/50"></div>);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const statusData = attendanceData.find(a => a.attendance_date === dateString);

      let bgClass = "bg-white dark:bg-slate-900";
      let statusColor = "text-slate-400";
      let statusIcon = null;

      if (statusData) {
        const s = statusData.status?.toLowerCase() || '';

        if (s === 'hadir' || s === 'on_time' || s.includes('tepat waktu')) {
          bgClass = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
          statusColor = "text-emerald-600 dark:text-emerald-400";
          statusIcon = <CheckCircle className="w-4 h-4" />;
        } else if (s === 'terlambat' || s.includes('terlambat')) {
          bgClass = "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
          statusColor = "text-amber-600 dark:text-amber-400";
          statusIcon = <Clock className="w-4 h-4" />;
        } else {
          bgClass = "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800";
          statusColor = "text-rose-600 dark:text-rose-400";
          statusIcon = <XCircle className="w-4 h-4" />;
        }
      }

      cells.push(
        <motion.div
          key={d}
          whileHover={{ scale: 0.98 }}
          className={cn(
            "h-24 md:h-32 p-2 border border-slate-100 dark:border-slate-800 relative transition-all duration-200 group overflow-hidden",
            bgClass
          )}
        >
          <span className={cn(
            "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-1",
            statusData ? statusColor + " bg-white/80 dark:bg-black/20 shadow-sm" : "text-slate-500"
          )}>
            {d}
          </span>

          {statusData ? (
            <div className="flex flex-col gap-1 items-start mt-1">
               <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md bg-white/50 dark:bg-black/20 backdrop-blur-sm", statusColor)}>
                  {statusIcon}
                  <span>{statusData.status}</span>
               </div>
               {statusData.check_in_time && (
                   <span className="text-[10px] text-muted-foreground ml-1">
                     {statusData.check_in_time.substring(0, 5)}
                   </span>
               )}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-slate-400">Tidak ada jadwal</span>
            </div>
          )}
        </motion.div>
      );
    }

    return cells;
  };

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  return (
    <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-6">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                 <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                    <CalendarDays className="w-6 h-6" />
                 </div>
                 <div>
                    <CardTitle className="text-xl font-bold">Kalender Absensi</CardTitle>
                    <p className="text-sm text-muted-foreground">Rekapitulasi kehadiran bulanan</p>
                 </div>
             </div>

             {/* Stats Cards Mini */}
             <div className="flex gap-2 text-sm">
                <div className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                    <span className="block text-xs uppercase tracking-wider opacity-70">Hadir</span>
                    <span className="font-bold text-lg">{stats.present}</span>
                </div>
                <div className="px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800">
                    <span className="block text-xs uppercase tracking-wider opacity-70">Alpha</span>
                    <span className="font-bold text-lg">{stats.absent}</span>
                </div>
                <div className="px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 hidden sm:block">
                    <span className="block text-xs uppercase tracking-wider opacity-70">Rate</span>
                    <span className="font-bold text-lg">{stats.percentage}%</span>
                </div>
             </div>
         </div>
      </CardHeader>

      <CardContent className="p-6">
         {/* Navigation */}
         <div className="flex items-center justify-between mb-6">
             <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                 {monthNames[month]} <span className="text-slate-400 font-light">{year}</span>
             </h2>
             <div className="flex gap-2">
                 <Button variant="outline" size="icon" onClick={handlePrevMonth} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                     <ChevronLeft className="w-5 h-5" />
                 </Button>
                 <Button variant="outline" size="icon" onClick={handleNextMonth} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                     <ChevronRight className="w-5 h-5" />
                 </Button>
             </div>
         </div>

         {/* Calendar Grid */}
         <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
             {renderCalendarCells()}
         </div>

         <div className="mt-4 flex items-center flex-wrap gap-4 text-xs text-muted-foreground">
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Hadir</div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Terlambat</div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-rose-500"></div> Alpha/Izin/Sakit</div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></div> Tidak Ada Data</div>
         </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendar;
