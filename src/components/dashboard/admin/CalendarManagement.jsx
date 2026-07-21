import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Trash2, CalendarOff, CalendarCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { deleteCalendarEvent, fetchCalendarEvents, getAcademicErrorMessage, saveCalendarEvent } from '@/lib/academicAdapters';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const CalendarManagement = () => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [holidays, setHolidays] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [holidayForm, setHolidayForm] = useState({ description: '', is_holiday: true });

  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    try {
      const data = await fetchCalendarEvents({ startDate, endDate });
      const holidayMap = {};
      data.forEach(item => {
        holidayMap[item.date] = item;
      });
      setHolidays(holidayMap);
    } catch (error) {
      toast({ title: 'Gagal memuat kalender', description: getAcademicErrorMessage(error), variant: 'destructive' });
    }
    setIsLoading(false);
  }, [selectedYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleDateClick = (day) => {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);

    if (holidays[dateStr]) {
      setHolidayForm({
        description: holidays[dateStr].description || '',
        is_holiday: holidays[dateStr].is_holiday
      });
    } else {
      // Check if weekend for default suggestion
      const d = new Date(selectedYear, selectedMonth, day);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      setHolidayForm({
          description: isWeekend ? 'Libur Akhir Pekan' : '',
          is_holiday: true
      });
    }
    setDialogOpen(true);
  };

  const handleSaveHoliday = async () => {
    if (!selectedDate) return;

    try {
      await saveCalendarEvent({
        existingId: holidays[selectedDate]?.id,
        selectedDate,
        description: holidayForm.description,
        isHoliday: holidayForm.is_holiday,
        userId: user?.id
      });
      toast({ title: 'Berhasil', description: 'Status tanggal diperbarui.' });
      setDialogOpen(false);
      fetchHolidays();
    } catch (error) {
      toast({ title: 'Gagal menyimpan', description: getAcademicErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleDeleteHoliday = async () => {
    if (!selectedDate || !holidays[selectedDate]) return;

    try {
      await deleteCalendarEvent(holidays[selectedDate].id);
      toast({ title: 'Berhasil', description: 'Tanggal kembali aktif (Default).' });
      setDialogOpen(false);
      fetchHolidays();
    } catch (error) {
      toast({ title: 'Gagal menghapus', description: getAcademicErrorMessage(error), variant: 'destructive' });
    }
  };

  const generateCalendarDays = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDayObj = new Date(selectedYear, selectedMonth, 1);
    const startDayOfWeek = firstDayObj.getDay() === 0 ? 6 : firstDayObj.getDay() - 1;

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/50 dark:bg-slate-900/20 border border-transparent rounded-lg"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(selectedYear, selectedMonth, d);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const holidayInfo = holidays[dateStr];

      // Logic: It's a holiday if marked in DB OR if it's a weekend (unless explicitly marked NOT holiday in DB)
      const isDbHoliday = holidayInfo?.is_holiday === true;
      const isDbActive = holidayInfo?.is_holiday === false;
      const isEffectiveHoliday = isDbHoliday || (isWeekend && !isDbActive);

      let bgClass = "bg-white dark:bg-slate-800 hover:border-blue-500";
      let statusIcon = null;
      let statusText = "";

      if (isEffectiveHoliday) {
        if (isWeekend && !holidayInfo) {
             // Implicit Weekend
             bgClass = "bg-slate-100 dark:bg-slate-900/50 text-slate-500 hover:border-slate-400";
             statusText = "Akhir Pekan";
        } else {
             // Explicit Holiday
             bgClass = "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 hover:border-red-500";
             statusIcon = <CalendarOff className="w-4 h-4 text-red-500" />;
             statusText = holidayInfo?.description || "Libur";
        }
      } else {
        // Active Day
        statusIcon = <CalendarCheck className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />;
      }

      days.push(
        <div
          key={d}
          onClick={() => handleDateClick(d)}
          className={`h-24 p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${bgClass}`}
        >
          <div className="flex justify-between items-start">
            <span className={`font-bold text-lg ${isEffectiveHoliday ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{d}</span>
            {statusIcon}
          </div>
          <div className="text-xs font-medium truncate mt-1">
            {statusText && <Badge variant="outline" className={`text-[10px] h-5 px-1 border-0 ${isEffectiveHoliday ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{statusText}</Badge>}
          </div>
        </div>
      );
    }
    return days;
  };

  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };

  return (
    <Card className="border-none shadow-md bg-white dark:bg-slate-950">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between pb-4 border-b gap-4">
        <div>
            <CardTitle className="text-xl flex items-center gap-2"><CalendarIcon className="w-6 h-6 text-primary"/> Kalender Akademik</CardTitle>
            <CardDescription>Atur hari libur. Sabtu & Minggu otomatis dianggap libur kecuali diubah.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4 justify-center">
            {/* Button removed as requested */}
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4"/></Button>
                <div className="text-center w-32">
                    <div className="font-bold text-lg">{months[selectedMonth]}</div>
                    <div className="text-xs text-muted-foreground">{selectedYear}</div>
                </div>
                <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4"/></Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-7 gap-4 mb-4 text-center">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
                <div key={day} className={`font-semibold text-sm uppercase ${day === 'Sab' || day === 'Min' ? 'text-red-400' : 'text-muted-foreground'}`}>{day}</div>
            ))}
        </div>
        <div className="grid grid-cols-7 gap-2 md:gap-4">
            {generateCalendarDays()}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground justify-center">
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border rounded"></div> Hari Efektif</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-100 border rounded"></div> Akhir Pekan (Libur)</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div> Hari Libur Nasional / Cuti</div>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Pengaturan Tanggal</DialogTitle>
                <DialogDescription>
                    {selectedDate && new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                        value={holidayForm.is_holiday ? "yes" : "no"}
                        onValueChange={v => setHolidayForm(prev => ({ ...prev, is_holiday: v === "yes" }))}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yes">Libur (Tidak Ada KBM)</SelectItem>
                            <SelectItem value="no">Masuk (Ada KBM)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Keterangan</Label>
                    <Input
                        placeholder="Contoh: Libur Idul Fitri"
                        value={holidayForm.description}
                        onChange={e => setHolidayForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                </div>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between">
                {holidays[selectedDate] ? (
                    <Button variant="destructive" onClick={handleDeleteHoliday} type="button"><Trash2 className="w-4 h-4 mr-2"/> Reset ke Default</Button>
                ) : <div></div>}
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                    <Button onClick={handleSaveHoliday}><Save className="w-4 h-4 mr-2"/> Simpan</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CalendarManagement;
