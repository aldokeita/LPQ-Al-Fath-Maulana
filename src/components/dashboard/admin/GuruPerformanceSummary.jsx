import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, TrendingUp, Users, CheckCircle, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const CustomSessionTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl text-sm">
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 border-b border-slate-100 dark:border-slate-800 pb-1">{label}</p>
        <p className="text-blue-600 dark:text-blue-400 font-medium">Sesi Terlaksana: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const CustomAttendanceTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl text-sm min-w-[150px]">
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">{label}</p>
        <div className="space-y-1">
          <p className="flex justify-between"><span className="text-slate-500">Kehadiran:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{data.Kehadiran}%</span></p>
          <p className="flex justify-between text-xs"><span className="text-slate-500">Hadir/Izin/Sakit:</span> <span className="font-medium text-slate-700 dark:text-slate-300">{data.present}</span></p>
          <p className="flex justify-between text-xs"><span className="text-slate-500">Total Sesi (Lalu):</span> <span className="font-medium text-slate-700 dark:text-slate-300">{data.totalExpected}</span></p>
        </div>
      </div>
    );
  }
  return null;
};

const CustomProgressTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl text-sm min-w-[200px]">
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 border-b border-slate-100 dark:border-slate-800 pb-1 truncate max-w-[200px]">{label}</p>
        <div className="space-y-1 mt-2">
          <p className="flex justify-between"><span className="text-slate-500">Progres:</span> <span className="font-bold text-purple-600 dark:text-purple-400">{data.Progres}%</span></p>
          <p className="flex justify-between text-xs"><span className="text-slate-500">Kelas:</span> <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{data.className}</span></p>
        </div>
      </div>
    );
  }
  return null;
};

const GuruPerformanceSummary = () => {
  const [gurus, setGurus] = useState([]);
  const [selectedGuru, setSelectedGuru] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [availableYears] = useState([new Date().getFullYear(), new Date().getFullYear() - 1]);

  const [isLoading, setIsLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState({
    sessionsByClass: [],
    attendanceByClass: [],
    progressByStudent: [],
    summary: { totalSessions: 0, avgAttendance: 0, avgProgress: 0 }
  });

  useEffect(() => {
    const fetchGurus = async () => {
      try {
        const { data, error } = await supabase.from('guru').select('id, nama').order('nama', { ascending: true });
        if (error) throw error;
        setGurus(data || []);
      } catch (err) {
        console.error("Error fetching gurus:", err);
        toast({ title: "Error", description: "Gagal mengambil daftar guru.", variant: "destructive" });
      }
    };
    fetchGurus();
  }, []);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      if (selectedGuru === 'all') {
        setPerformanceData({
          sessionsByClass: [], attendanceByClass: [], progressByStudent: [],
          summary: { totalSessions: 0, avgAttendance: 0, avgProgress: 0 }
        });
        return;
      }

      setIsLoading(true);
      try {
        // 1. Get Classes assigned to Guru
        const { data: classes, error: classesError } = await supabase.from('classes')
          .select('id, nama_kelas, sesi')
          .eq('id_guru', selectedGuru);
        if (classesError) throw classesError;

        const classIds = classes?.map(c => c.id) || [];
        const classMap = {};
        const sesiClassMap = {};
        classes?.forEach(c => {
            classMap[c.id] = c.nama_kelas;
            if(c.sesi) sesiClassMap[c.sesi] = c.nama_kelas;
        });

        // Date range
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

        // Fetch Holidays to exclude from expected sessions
        const { data: calendarData } = await supabase
            .from('academic_calendar')
            .select('date')
            .gte('date', startDate)
            .lte('date', endDate)
            .eq('is_holiday', true);
        const holidaySet = new Set(calendarData?.map(c => c.date) || []);

        // Calculate past active session days in the selected month
        let pastSessionDays = 0;
        const today = new Date();
        today.setHours(0,0,0,0);

        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const loopDate = new Date(selectedYear, selectedMonth, d);
            const isWeekend = loopDate.getDay() === 0 || loopDate.getDay() === 6;

            if (loopDate <= today && !isWeekend && !holidaySet.has(dateStr)) {
                pastSessionDays++;
            }
        }

        // 2. Fetch Guru Attendance (Sesi Terlaksana)
        const { data: guruAtt, error: guruAttError } = await supabase.from('attendance')
          .select('id, attendance_date, sesi, status, class_id')
          .eq('user_id', selectedGuru)
          .eq('role', 'guru')
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .like('status', 'Hadir%');
        if (guruAttError) throw guruAttError;

        let totalSessions = 0;
        const sesiCounts = {};

        guruAtt?.forEach(att => {
            totalSessions++;
            let cName = 'Lainnya';
            if (att.class_id && classMap[att.class_id]) cName = classMap[att.class_id];
            else if (att.sesi && sesiClassMap[att.sesi]) cName = sesiClassMap[att.sesi];
            else if (att.sesi) cName = `Sesi ${att.sesi}`;

            sesiCounts[cName] = (sesiCounts[cName] || 0) + 1;
        });
        const sessionsByClass = Object.keys(sesiCounts).map(k => ({ name: k, Sesi: sesiCounts[k] }));

        // 3. Fetch Santri Attendance & Calculate Average
        let attendanceByClass = [];
        let avgAttendance = 0;
        if (classIds.length > 0) {
          // Get total active santri per class to calculate total expected sessions
          const { data: santriList } = await supabase.from('santri')
            .select('id, current_class_id')
            .in('current_class_id', classIds)
            .eq('status', 'Aktif');

          const classSantriCount = {};
          santriList?.forEach(s => {
              classSantriCount[s.current_class_id] = (classSantriCount[s.current_class_id] || 0) + 1;
          });

          // Fetch only past dates attendance
          const todayStr = new Date().toISOString().split('T')[0];
          const queryEndDate = endDate < todayStr ? endDate : todayStr;

          const { data: santriAtt, error: santriAttError } = await supabase.from('attendance')
            .select('id, attendance_date, status, class_id')
            .eq('role', 'santri')
            .in('class_id', classIds)
            .gte('attendance_date', startDate)
            .lte('attendance_date', queryEndDate);
          if (santriAttError) throw santriAttError;

          const classAttData = {};
          let totalPresentGlobal = 0;
          let totalExpectedGlobal = 0;

          // Initialize tracking per class
          classIds.forEach(id => {
              classAttData[id] = { present: 0 };
          });

          santriAtt?.forEach(att => {
             const cId = att.class_id;
             if (classAttData[cId] && att.status && (att.status.includes('Hadir') || att.status.includes('Sakit') || att.status.includes('Izin'))) {
               classAttData[cId].present++;
             }
          });

          attendanceByClass = Object.keys(classAttData).map(id => {
             // Total Expected = Past Session Days * Active Santri in Class
             const expectedTotal = pastSessionDays * (classSantriCount[id] || 0);
             const attendanceCount = classAttData[id].present; // Hadir, Sakit, Izin

             totalPresentGlobal += attendanceCount;
             totalExpectedGlobal += expectedTotal;

             const percentage = expectedTotal > 0 ? Math.round((attendanceCount / expectedTotal) * 100) : 0;

             return {
                 name: classMap[id] || 'Unknown',
                 Kehadiran: percentage,
                 present: attendanceCount,
                 totalExpected: expectedTotal
             };
          }).filter(c => c.totalExpected > 0); // Hide empty classes

          avgAttendance = totalExpectedGlobal > 0 ? Math.round((totalPresentGlobal / totalExpectedGlobal) * 100) : 0;
        }

        // 4. Fetch Santri Progress (Progres per Santri)
        let progressByStudent = [];
        let avgProgress = 0;
        if (classIds.length > 0) {
          const { data: santriList, error: santriError } = await supabase.from('santri')
            .select('id, nama_lengkap, current_class_id')
            .in('current_class_id', classIds)
            .eq('status', 'Aktif');
          if (santriError) throw santriError;

          const santriIds = santriList?.map(s => s.id) || [];
          const santriMap = {};
          santriList?.forEach(s => santriMap[s.id] = { name: s.nama_lengkap, className: classMap[s.current_class_id] });

          if (santriIds.length > 0) {
            const { data: progressData, error: progError } = await supabase.from('hafalan_progress')
              .select('id, santri_id, hafal')
              .in('santri_id', santriIds);
            if (progError) throw progError;

            const santriProgMap = {};
            let totalHafalGlobal = 0;
            let totalProgGlobal = 0;

            progressData?.forEach(p => {
              const sId = p.santri_id;
              if (!santriProgMap[sId]) santriProgMap[sId] = { hafal: 0, total: 0 };

              santriProgMap[sId].total++;
              totalProgGlobal++;
              if (p.hafal) {
                santriProgMap[sId].hafal++;
                totalHafalGlobal++;
              }
            });

            avgProgress = totalProgGlobal > 0 ? Math.round((totalHafalGlobal / totalProgGlobal) * 100) : 0;

            progressByStudent = Object.keys(santriProgMap).map(sId => ({
                name: santriMap[sId]?.name || 'Unknown',
                className: santriMap[sId]?.className || 'Unknown',
                Progres: Math.round((santriProgMap[sId].hafal / santriProgMap[sId].total) * 100)
            })).sort((a,b) => b.Progres - a.Progres); // Sort by highest progress
          }
        }

        setPerformanceData({
          sessionsByClass,
          attendanceByClass,
          progressByStudent,
          summary: { totalSessions, avgAttendance, avgProgress }
        });

      } catch (err) {
        console.error("Error fetching performance data:", err);
        toast({ title: "Gagal memuat data", description: "Terjadi kesalahan saat menghitung kinerja.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, [selectedGuru, selectedMonth, selectedYear]);

  return (
    <div className="space-y-8 pb-10">
      {/* Filters Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-5 items-end md:items-center justify-between">
        <div className="flex-1 w-full max-w-sm">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Pilih Guru Pengajar</label>
          <Select value={selectedGuru} onValueChange={setSelectedGuru}>
            <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Pilih Guru untuk melihat kinerja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-semibold text-primary">-- Pilih Guru --</SelectItem>
              {gurus.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Bulan</label>
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(Number(val))}>
              <SelectTrigger className="w-[140px] h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tahun</label>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}>
              <SelectTrigger className="w-[100px] h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedGuru === 'all' ? (
        <div className="flex flex-col items-center justify-center py-24 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mb-5">
            <BarChart3 className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Rekap Kinerja Belum Ditampilkan</h3>
          <p className="text-slate-500 mt-2 text-center max-w-md">Silakan pilih guru dari dropdown di atas untuk melihat analisis performa mengajar secara detail.</p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-500">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="font-medium animate-pulse text-lg">Mengkalkulasi matriks kinerja...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-slate-800 dark:to-slate-800/80 border-blue-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-blue-800/70 dark:text-blue-400/80 uppercase tracking-wide">Sesi Terlaksana</p>
                    <h3 className="text-4xl font-black text-blue-700 dark:text-blue-400">{performanceData.summary.totalSessions} <span className="text-lg font-semibold text-blue-500/70">Sesi</span></h3>
                  </div>
                  <div className="p-3.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-slate-800 dark:to-slate-800/80 border-emerald-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-emerald-800/70 dark:text-emerald-400/80 uppercase tracking-wide">Rata-rata Kehadiran</p>
                    <h3 className="text-4xl font-black text-emerald-700 dark:text-emerald-400">{performanceData.summary.avgAttendance}<span className="text-2xl">%</span></h3>
                  </div>
                  <div className="p-3.5 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/20">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-slate-800 dark:to-slate-800/80 border-purple-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-purple-800/70 dark:text-purple-400/80 uppercase tracking-wide">Progres Hafalan</p>
                    <h3 className="text-4xl font-black text-purple-700 dark:text-purple-400">{performanceData.summary.avgProgress}<span className="text-2xl">%</span></h3>
                  </div>
                  <div className="p-3.5 bg-purple-500 rounded-xl text-white shadow-lg shadow-purple-500/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-8" />

          {/* Charts Section */}
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sesi Terlaksana per Kelas */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-500" /> Ringkasan Sesi Terlaksana per Kelas
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[320px] w-full" role="img" aria-label="Grafik Ringkasan Sesi Terlaksana per Kelas - menampilkan jumlah sesi yang telah dilaksanakan untuk setiap kelas yang diampu guru">
                    {performanceData.sessionsByClass.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData.sessionsByClass} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} interval={0} />
                            <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomSessionTooltip />} cursor={{fill: '#f1f5f9'}} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Bar dataKey="Sesi" name="Jumlah Sesi" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                        </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                            <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                            <p className="text-sm font-medium">Belum ada data sesi mengajar</p>
                        </div>
                    )}
                    </div>
                </CardContent>
                </Card>

                {/* Kehadiran per Kelas */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-500" /> Rata-rata Kehadiran Kelas
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[320px] w-full" role="img" aria-label="Grafik Rata-rata Kehadiran Kelas - menampilkan persentase kehadiran rata-rata santri untuk setiap kelas">
                    {performanceData.attendanceByClass.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData.attendanceByClass} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} interval={0} />
                            <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip content={<CustomAttendanceTooltip />} cursor={{fill: '#f1f5f9'}} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Bar dataKey="Kehadiran" name="Persentase Kehadiran (%)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={60} />
                        </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                            <Users className="w-10 h-10 mb-2 opacity-20" />
                            <p className="text-sm font-medium">Belum ada data kehadiran santri</p>
                        </div>
                    )}
                    </div>
                </CardContent>
                </Card>
            </div>

            {/* Progres per Santri */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-500" /> Progres Rata-rata Santri
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[400px] w-full" role="img" aria-label="Grafik Progres Rata-rata Santri - menampilkan persentase progres rata-rata santri di setiap kelas yang diampu guru">
                  {performanceData.progressByStudent.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData.progressByStudent} margin={{ top: 10, right: 20, bottom: 80, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<CustomProgressTooltip />} cursor={{fill: '#f1f5f9'}} />
                        <Legend wrapperStyle={{ bottom: 0, left: 0, paddingBottom: '10px' }} iconType="circle" />
                        <Bar dataKey="Progres" name="Persentase Progres (%)" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                        <TrendingUp className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm font-medium">Belum ada data progres hafalan santri</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuruPerformanceSummary;
