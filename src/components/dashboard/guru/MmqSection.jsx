import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  createMmqAttendance,
  createMmqNotulensi,
  deleteMmqNotulensi,
  fetchGuruForMmq,
  fetchMmqAttendance,
  fetchMmqNotulensi,
  fetchMmqSchedules,
  findGuruByRfid,
  getMmqErrorMessage,
  pickScheduleForToday,
} from '@/lib/mmqAdapters';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const formatScheduleLabel = (schedule) => {
  if (!schedule) return 'Belum ada jadwal aktif';
  const start = schedule.start_time?.substring(0, 5) || '-';
  const end = schedule.end_time ? ` - ${schedule.end_time.substring(0, 5)}` : '';
  return `${DAYS[schedule.day_of_week]} ${start}${end} WIB, ${schedule.location || 'Lokasi belum diatur'}`;
};

const MmqSection = ({ open, onOpenChange, guru }) => {
  const { role: currentUserRole } = useAuth();
  const [rfidInput, setRfidInput] = useState('');
  const [notulenTitle, setNotulenTitle] = useState('');
  const [notulenText, setNotulenText] = useState('');
  const [allGuru, setAllGuru] = useState([]);
  const [history, setHistory] = useState([]);
  const [notulenList, setNotulenList] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedNotulen, setSelectedNotulen] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const rfidInputRef = useRef(null);

  const activeSchedule = useMemo(() => pickScheduleForToday(schedules), [schedules]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scheduleData, historyData, notulenData, guruData] = await Promise.all([
        fetchMmqSchedules(),
        fetchMmqAttendance(),
        fetchMmqNotulensi(),
        currentUserRole === 'admin' ? fetchGuruForMmq() : Promise.resolve([]),
      ]);

      setSchedules(scheduleData);
      setHistory(historyData);
      setNotulenList(notulenData);
      setAllGuru(guruData);
    } catch (error) {
      toast({ title: 'Gagal memuat MMQ', description: getMmqErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserRole]);

  useEffect(() => {
    if (open) {
      loadData();
      setTimeout(() => rfidInputRef.current?.focus(), 100);
    }
  }, [open, loadData]);

  const buildAttendancePayload = (guruId, status = 'Hadir') => {
    if (!activeSchedule) {
      throw new Error('Jadwal MMQ aktif belum tersedia.');
    }

    return {
      schedule_id: activeSchedule.id,
      guru_id: guruId,
      attendance_date: new Date().toLocaleDateString('en-CA'),
      check_in_timestamp: new Date().toISOString(),
      status,
    };
  };

  const submitAttendance = async (guruId, guruName, status = 'Hadir') => {
    try {
      await createMmqAttendance(buildAttendancePayload(guruId, status));
      toast({ title: 'Absen Berhasil', description: `Kehadiran ${guruName} tercatat.` });
      await loadData();
    } catch (error) {
      toast({ title: 'Absen Gagal', description: getMmqErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleRfidAbsen = async (event) => {
    event.preventDefault();
    const scannedRfid = rfidInput.trim();
    if (!scannedRfid) return;

    try {
      const targetGuru = await findGuruByRfid(scannedRfid);
      if (!targetGuru) {
        toast({ title: 'Gagal', description: 'RFID tidak terdaftar.', variant: 'destructive' });
        return;
      }

      if (targetGuru.id !== guru?.id && currentUserRole !== 'admin') {
        toast({ title: 'Ditolak', description: 'Guru hanya boleh mencatat kehadiran MMQ miliknya sendiri.', variant: 'destructive' });
        return;
      }

      await submitAttendance(targetGuru.id, targetGuru.nama);
    } catch (error) {
      toast({ title: 'Absen Gagal', description: getMmqErrorMessage(error), variant: 'destructive' });
    } finally {
      setRfidInput('');
    }
  };

  const handleManualAbsen = async (guruId, guruName) => {
    if (currentUserRole !== 'admin') {
      toast({ title: 'Ditolak', description: 'Absensi manual guru lain hanya tersedia untuk admin.', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Konfirmasi kehadiran untuk ${guruName} hari ini?`)) return;
    await submitAttendance(guruId, guruName, 'Hadir');
  };

  const handleSaveNotulen = async () => {
    if (!notulenText.trim() || !notulenTitle.trim()) {
      toast({ title: 'Gagal', description: 'Judul dan isi notulensi tidak boleh kosong.', variant: 'destructive' });
      return;
    }
    if (!activeSchedule) {
      toast({ title: 'Gagal', description: 'Jadwal MMQ aktif belum tersedia.', variant: 'destructive' });
      return;
    }

    try {
      await createMmqNotulensi({
        schedule_id: activeSchedule.id,
        tanggal: new Date().toLocaleDateString('en-CA'),
        judul: notulenTitle.trim(),
        isi: notulenText.trim(),
        notulen_id: guru.id,
      });
      toast({ title: 'Sukses', description: 'Notulensi berhasil disimpan.' });
      setNotulenText('');
      setNotulenTitle('');
      await loadData();
    } catch (error) {
      toast({ title: 'Gagal Menyimpan', description: getMmqErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleDeleteNotulen = async (notulenId) => {
    if (currentUserRole !== 'admin') return;
    if (window.confirm('Anda yakin ingin menghapus notulensi ini?')) {
      try {
        await deleteMmqNotulensi(notulenId);
        toast({ title: 'Berhasil', description: 'Notulensi telah dihapus.' });
        await loadData();
        setSelectedNotulen(null);
      } catch (error) {
        toast({ title: 'Gagal Menghapus', description: getMmqErrorMessage(error), variant: 'destructive' });
      }
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayAttendance = history.filter((item) => item.attendance_date === todayStr);
  const absentGuruToday = allGuru.filter((item) => !todayAttendance.some((attendance) => attendance.guru_id === item.id));
  const canWriteNotulen = Boolean(guru?.is_notulen || currentUserRole === 'admin');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Majelis Mu'allimil Qur'an (MMQ)</DialogTitle>
          <DialogDescription>Sistem absensi dan notulensi untuk guru.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="absensi">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="absensi">Absensi</TabsTrigger>
            <TabsTrigger value="notulensi" disabled={!canWriteNotulen}>Notulensi</TabsTrigger>
            <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          </TabsList>

          <TabsContent value="absensi" className="mt-4">
            <h3 className="font-semibold mb-1">Absensi via RFID</h3>
            <p className="text-sm text-muted-foreground mb-3">{formatScheduleLabel(activeSchedule)}</p>
            <form onSubmit={handleRfidAbsen} className="flex gap-2">
              <Input
                ref={rfidInputRef}
                value={rfidInput}
                onChange={(event) => setRfidInput(event.target.value)}
                placeholder="Scan kartu RFID Anda..."
                disabled={isLoading || !activeSchedule}
              />
              <Button type="submit" disabled={isLoading || !activeSchedule}>Absen</Button>
            </form>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold">Hadir Hari Ini</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {todayAttendance.map((item) => (
                    <div key={item.id} className="p-2 border rounded-lg">
                      <p className="font-bold">
                        {item.guru?.nama || 'Guru'} - <span className="font-normal text-sm">{item.status}</span>
                      </p>
                    </div>
                  ))}
                  {todayAttendance.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada.</p>}
                </div>
              </div>
              {currentUserRole === 'admin' && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Belum Hadir Hari Ini</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {absentGuruToday.map((item) => (
                      <div key={item.id} className="p-2 border rounded-lg flex justify-between items-center">
                        <span>{item.nama}</span>
                        <Button size="sm" onClick={() => handleManualAbsen(item.id, item.nama)}>
                          <CheckCircle className="w-4 h-4 mr-2" />Hadir
                        </Button>
                      </div>
                    ))}
                    {absentGuruToday.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Semua sudah hadir.</p>}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notulensi" className="mt-4">
            <h3 className="font-semibold mb-1">Buat Notulensi MMQ</h3>
            <p className="text-sm text-muted-foreground mb-3">{formatScheduleLabel(activeSchedule)}</p>
            <Input value={notulenTitle} onChange={(event) => setNotulenTitle(event.target.value)} placeholder="Judul notulensi..." className="mb-2" />
            <Textarea value={notulenText} onChange={(event) => setNotulenText(event.target.value)} placeholder="Tulis hasil pertemuan MMQ hari ini..." rows={8} />
            <Button onClick={handleSaveNotulen} className="mt-2" disabled={!activeSchedule}>Simpan Notulensi</Button>
          </TabsContent>

          <TabsContent value="riwayat" className="mt-4">
            <h3 className="font-semibold mb-2">Riwayat Notulensi</h3>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {notulenList.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-bold">{item.judul}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.tanggal).toLocaleDateString('id-ID')} oleh {item.notulen?.nama || 'N/A'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedNotulen(item)}>Lihat</Button>
                    {currentUserRole === 'admin' && (
                      <Button size="icon" variant="destructive" onClick={() => handleDeleteNotulen(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {notulenList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada notulensi.</p>}
            </div>
          </TabsContent>
        </Tabs>

        {selectedNotulen && (
          <Dialog open={!!selectedNotulen} onOpenChange={() => setSelectedNotulen(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedNotulen.judul}</DialogTitle>
                <DialogDescription>
                  {new Date(selectedNotulen.tanggal).toLocaleDateString('id-ID')} oleh {selectedNotulen.notulen?.nama || 'N/A'}
                </DialogDescription>
              </DialogHeader>
              <div className="prose dark:prose-invert max-h-80 overflow-y-auto whitespace-pre-wrap">{selectedNotulen.isi}</div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MmqSection;
