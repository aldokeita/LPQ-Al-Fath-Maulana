import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Users, BookOpen, Award, Calendar, Phone, ShieldCheck,
  GraduationCap, AlertTriangle, Trophy, BarChart3, FileSpreadsheet,
  Printer, Search, Clock, History
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';
import ClassManagement from '@/components/dashboard/admin/ClassManagement';
import * as XLSX from 'xlsx';

const KHOTIM_JILID_LIST = ['Jilid 6A', 'Jilid 6B', 'Al-Qur\'an', 'Ghorib Tajwid', 'Finishing'];

// Helper calculation for untested duration
const calculateUntestedDuration = (lastDateStr) => {
  if (!lastDateStr) return { durationText: 'Belum pernah tes', daysAgo: 999, formattedDate: '-' };
  const lastDate = new Date(lastDateStr);
  const now = new Date();
  const diffTime = Math.max(0, now - lastDate);
  const daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let durationText = '';
  if (daysAgo >= 30) {
    const months = Math.floor(daysAgo / 30);
    const remainingDays = daysAgo % 30;
    durationText = remainingDays > 0 ? `${months} Bln ${remainingDays} Hri` : `${months} Bulan`;
  } else {
    durationText = `${daysAgo} Hari`;
  }

  const formattedDate = lastDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return { durationText, daysAgo, formattedDate };
};

const PentashihDashboard = () => {
  const { user } = useAuth();
  const [guruData, setGuruData] = useState(null);
  const [santriList, setSantriList] = useState([]);
  const [classList, setClassList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search States
  const [khotimSearch, setKhotimSearch] = useState('');
  const [stagnantSearch, setStagnantSearch] = useState('');

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const [guruRes, classesRes, santriRes, membershipsRes, jilidHistoryRes] = await Promise.all([
        supabase
          .from('guru')
          .select('id, nama, foto_url, rfid_tag, no_hp, jabatan')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('classes')
          .select('id, nama_kelas, sesi, kategori, is_active, id_guru, guru:id_guru(id, nama, no_hp)')
          .or('is_active.eq.true,is_active.is.null'),
        supabase
          .from('santri')
          .select('id, nomor_induk_qiroati, nama_lengkap, nama_panggilan, kategori, jenis_kelamin, jilid, current_class_id, sesi_mengaji, status, foto_url, avatar_path, created_at, updated_at')
          .or('status.eq.Aktif,status.eq.active,status.is.null'),
        supabase
          .from('class_memberships')
          .select('santri_id, class_id')
          .eq('status', 'active'),
        supabase
          .from('jilid_history')
          .select('santri_id, changed_at')
          .order('changed_at', { ascending: false }),
      ]);

      if (guruRes.error) throw guruRes.error;

      const resolvedGuru = await resolveAvatarRecord(guruRes.data, { ownerType: 'guru' });
      const resolvedSantri = await resolveAvatarRecords(santriRes.data || [], { ownerType: 'santri' });

      const membershipMap = Object.fromEntries(
        (membershipsRes.data || []).map(m => [m.santri_id, m.class_id])
      );

      const classMap = Object.fromEntries(
        (classesRes.data || []).map(c => [c.id, c])
      );

      // Map last jilid test / change date per santri
      const jilidHistoryMap = {};
      (jilidHistoryRes.data || []).forEach(h => {
        if (!jilidHistoryMap[h.santri_id]) {
          jilidHistoryMap[h.santri_id] = h.changed_at;
        }
      });

      const mappedSantri = resolvedSantri.map(s => {
        const classId = s.current_class_id || membershipMap[s.id] || null;
        const cls = classId ? classMap[classId] : null;
        const lastTestDate = jilidHistoryMap[s.id] || s.updated_at || s.created_at || null;
        const untestedInfo = calculateUntestedDuration(lastTestDate);

        return {
          ...s,
          classId,
          className: cls?.nama_kelas || 'Belum Ada Kelas',
          teacherName: cls?.guru?.nama || 'Belum Ada Guru',
          teacherHp: cls?.guru?.no_hp || null,
          lastTestDate,
          untestedDurationText: untestedInfo.durationText,
          untestedDaysAgo: untestedInfo.daysAgo,
          untestedFormattedDate: untestedInfo.formattedDate,
        };
      });

      setGuruData(resolvedGuru || null);
      setClassList(classesRes.data || []);
      setSantriList(mappedSantri);
    } catch (error) {
      toast({ title: 'Gagal memuat data pentashih', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // -------------------------------------------------------------
  // Poin 4: Analytics & Level Distribution Calculations
  // -------------------------------------------------------------
  const levelStats = useMemo(() => {
    let praTk = 0;
    let dasar = 0;
    let menengah = 0;
    let khotim = 0;

    santriList.forEach(s => {
      const j = (s.jilid || '').trim();
      if (j.includes('Pra TK')) praTk++;
      else if (['Jilid 1A', 'Jilid 1B', 'Jilid 1C', 'Jilid 2A', 'Jilid 2B', 'Jilid 3A', 'Jilid 3B'].includes(j)) dasar++;
      else if (['Jilid 4A', 'Jilid 4B', 'Jilid 5A', 'Jilid 5B', 'Jilid Juz 27'].includes(j)) menengah++;
      else if (KHOTIM_JILID_LIST.includes(j)) khotim++;
      else dasar++;
    });

    const total = santriList.length || 1;
    return {
      praTk,
      dasar,
      menengah,
      khotim,
      praTkPct: Math.round((praTk / total) * 100),
      dasarPct: Math.round((dasar / total) * 100),
      menengahPct: Math.round((menengah / total) * 100),
      khotimPct: Math.round((khotim / total) * 100),
    };
  }, [santriList]);

  // -------------------------------------------------------------
  // Poin 3: Candidate Khotim & Pra-Imtihan List
  // -------------------------------------------------------------
  const khotimCandidates = useMemo(() => {
    return santriList.filter(s => {
      const j = (s.jilid || '').trim();
      const isCandidate = KHOTIM_JILID_LIST.includes(j);
      if (!isCandidate) return false;
      if (!khotimSearch) return true;
      const search = khotimSearch.toLowerCase();
      return (
        s.nama_lengkap.toLowerCase().includes(search) ||
        (s.nomor_induk_qiroati && s.nomor_induk_qiroati.toLowerCase().includes(search)) ||
        s.className.toLowerCase().includes(search)
      );
    });
  }, [santriList, khotimSearch]);

  // -------------------------------------------------------------
  // Poin 1: Stagnant Student Alert Filter (Ordered by untested duration)
  // -------------------------------------------------------------
  const stagnantSantriList = useMemo(() => {
    return santriList
      .filter(s => {
        const isStagnant = s.untestedDaysAgo >= 90; // 3+ months threshold
        if (!isStagnant) return false;

        if (!stagnantSearch) return true;
        const search = stagnantSearch.toLowerCase();
        return (
          s.nama_lengkap.toLowerCase().includes(search) ||
          (s.nomor_induk_qiroati && s.nomor_induk_qiroati.toLowerCase().includes(search)) ||
          s.className.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.untestedDaysAgo - a.untestedDaysAgo);
  }, [santriList, stagnantSearch]);

  // -------------------------------------------------------------
  // Poin 5: Excel & PDF Export Handlers
  // -------------------------------------------------------------
  const exportExcelReport = () => {
    try {
      const khotimData = khotimCandidates.map((s, idx) => ({
        'No': idx + 1,
        'Nomor Induk Qiroati': s.nomor_induk_qiroati || '-',
        'Nama Santri': s.nama_lengkap,
        'Nama Panggilan': s.nama_panggilan || '-',
        'Jilid Saat Ini': s.jilid || '-',
        'Kelas': s.className,
        'Guru Pengampu': s.teacherName,
        'No HP Ortu': s.no_hp_ortu || '-',
      }));

      const stagnantData = stagnantSantriList.map((s, idx) => ({
        'No': idx + 1,
        'Nomor Induk': s.nomor_induk_qiroati || '-',
        'Nama Santri': s.nama_lengkap,
        'Jilid': s.jilid || '-',
        'Kelas': s.className,
        'Guru Pengampu': s.teacherName,
        'Lama Belum Tes': s.untestedDurationText,
        'Tanggal Tes Terakhir': s.untestedFormattedDate,
      }));

      const levelSummaryData = [
        { 'Kategori Jilid': 'Pra-TK (Pra-A / Pra-B / Pra-C)', 'Jumlah Santri': levelStats.praTk, 'Persentase': `${levelStats.praTkPct}%` },
        { 'Kategori Jilid': 'Dasar (Jilid 1A - 3B)', 'Jumlah Santri': levelStats.dasar, 'Persentase': `${levelStats.dasarPct}%` },
        { 'Kategori Jilid': 'Menengah (Jilid 4A - 5B)', 'Jumlah Santri': levelStats.menengah, 'Persentase': `${levelStats.menengahPct}%` },
        { 'Kategori Jilid': 'Khotim / Tajwid / Finishing', 'Jumlah Santri': levelStats.khotim, 'Persentase': `${levelStats.khotimPct}%` },
        { 'Kategori Jilid': 'TOTAL SANTRI', 'Jumlah Santri': santriList.length, 'Persentase': '100%' },
      ];

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(levelSummaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Jilid');

      const wsKhotim = XLSX.utils.json_to_sheet(khotimData);
      XLSX.utils.book_append_sheet(wb, wsKhotim, 'Calon Khotim');

      const wsStagnant = XLSX.utils.json_to_sheet(stagnantData);
      XLSX.utils.book_append_sheet(wb, wsStagnant, 'Evaluasi Santri Stagnan');

      const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
      XLSX.writeFile(wb, `Laporan_Pentashih_LPQ_${dateStr}.xlsx`);

      toast({ title: 'Berhasil Ekspor Excel', description: 'File laporan pentashih berhasil diunduh.' });
    } catch (err) {
      toast({ title: 'Gagal Ekspor', description: err.message, variant: 'destructive' });
    }
  };

  const printPdfReport = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 bg-slate-50 dark:bg-slate-950 min-h-screen space-y-8 print:pt-4 print:pb-4 print:bg-white print:dark:bg-white print:text-black">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 print:border-b-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-black uppercase text-purple-700 dark:text-purple-400 tracking-wide print:text-black">
              Dashboard Pentashih
            </h1>
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1 text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm print:hidden">
              <ShieldCheck className="w-3.5 h-3.5" /> Penguji & Quality Assurance
            </Badge>
          </div>
          <p className="text-muted-foreground print:text-slate-600">
            Pusat pengawasan mutu bacaan, distribusi jilid, dan calon khotim LPQ Al-Fath Maulana.
          </p>
        </div>

        {/* Poin 5: Print & Export Actions */}
        <div className="flex items-center gap-3 flex-wrap print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={printPdfReport}
            className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Cetak PDF
          </Button>

          <Button
            size="sm"
            onClick={exportExcelReport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Ekspor Excel
          </Button>

          <div className="px-3.5 py-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Hero Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:grid-cols-4 print:gap-3">
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4 print:col-span-4 print:grid-cols-4">
          <Card className="bg-white dark:bg-slate-900 border-l-4 border-purple-500 shadow-sm print:border print:shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-950/50 rounded-xl shrink-0 print:hidden">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 print:text-black">{santriList.length}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider print:text-slate-600">Total Santri Aktif</p>
              </div>
            </CardContent>
          </Card>

          {/* Poin 3 Metric: Khotim Candidates */}
          <Card className="bg-white dark:bg-slate-900 border-l-4 border-amber-500 shadow-sm print:border print:shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-xl shrink-0 print:hidden">
                <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-400 print:text-amber-800">{khotimCandidates.length}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider print:text-slate-600">Calon Khotim</p>
              </div>
            </CardContent>
          </Card>

          {/* Poin 1 Metric: Stagnant Santri Alert */}
          <Card className="bg-white dark:bg-slate-900 border-l-4 border-rose-500 shadow-sm print:border print:shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl shrink-0 print:hidden">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 print:text-rose-800">{stagnantSantriList.length}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider print:text-slate-600">Santri Perlu Evaluasi</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Card Pentashih */}
        <div className="md:col-span-4 print:hidden">
          {guruData ? (
            <Card className="bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-800 text-white h-full shadow-lg relative overflow-hidden border-0 rounded-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Award className="w-32 h-32 text-white" />
              </div>
              <CardContent className="p-4 flex flex-col justify-center h-full relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="w-12 h-12 border-2 border-white/40 shadow-md">
                    <AvatarImage src={guruData.foto_url} className="object-cover" />
                    <AvatarFallback className="text-purple-700 font-bold text-lg bg-white">
                      {guruData.nama?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold leading-tight truncate">{guruData.nama}</h2>
                    <span className="inline-flex items-center gap-1 text-purple-100 text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full mt-0.5">
                      <ShieldCheck className="w-3 h-3" /> {guruData.jabatan || 'Pentashih Official'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/15 text-[11px] text-purple-100 flex items-center justify-between">
                  <span>RFID: <strong className="font-mono text-white">{guruData.rfid_tag || '-'}</strong></span>
                  {guruData.no_hp && (
                    <span className="flex items-center gap-1 opacity-90">
                      <Phone className="w-3 h-3" /> {guruData.no_hp}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full bg-slate-200 dark:bg-slate-800 animate-pulse rounded-2xl min-h-[90px]" />
          )}
        </div>
      </div>

      {/* POIN 4: Matriks Performa & Distribusi Jilid */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden print:border-slate-300">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400 print:text-black" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 print:text-black">
                Matriks Distribusi Tingkat Jilid Santri
              </h2>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-purple-700 border-purple-200 dark:text-purple-300 print:border-slate-400 print:text-black">
              Total {santriList.length} Santri
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pra-TK */}
            <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-purple-800 dark:text-purple-300">
                <span>Pra-TK (Pra A-C)</span>
                <span className="text-sm font-black">{levelStats.praTk} <span className="text-[11px] font-medium opacity-80">({levelStats.praTkPct}%)</span></span>
              </div>
              <div className="w-full h-2 bg-purple-200 dark:bg-purple-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full transition-all duration-500" style={{ width: `${levelStats.praTkPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">Tahap pengenalan huruf & hijaiyah dasar.</p>
            </div>

            {/* Jilid Dasar */}
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-blue-800 dark:text-blue-300">
                <span>Jilid Dasar (1A - 3B)</span>
                <span className="text-sm font-black">{levelStats.dasar} <span className="text-[11px] font-medium opacity-80">({levelStats.dasarPct}%)</span></span>
              </div>
              <div className="w-full h-2 bg-blue-200 dark:bg-blue-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${levelStats.dasarPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">Pembiasaan makhroj & harokat santri.</p>
            </div>

            {/* Jilid Menengah */}
            <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-sky-800 dark:text-sky-300">
                <span>Jilid Menengah (4A - 5B)</span>
                <span className="text-sm font-black">{levelStats.menengah} <span className="text-[11px] font-medium opacity-80">({levelStats.menengahPct}%)</span></span>
              </div>
              <div className="w-full h-2 bg-sky-200 dark:bg-sky-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-sky-600 rounded-full transition-all duration-500" style={{ width: `${levelStats.menengahPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">Penerapan tajwid & panjang pendek.</p>
            </div>

            {/* Khotim / Tajwid */}
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-amber-900 dark:text-amber-300">
                <span>Khotim & Tajwid (6A+)</span>
                <span className="text-sm font-black text-amber-700 dark:text-amber-400">{levelStats.khotim} <span className="text-[11px] font-medium opacity-80">({levelStats.khotimPct}%)</span></span>
              </div>
              <div className="w-full h-2 bg-amber-200 dark:bg-amber-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${levelStats.khotimPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">Persiapan Imtihan & Khotaman resmi.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WIDGET GRID: POIN 3 (Khotim) & POIN 1 (Stagnant Alert dengan Durasi Belum Tes) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
        {/* POIN 3: Calon Khotim & Pra-Imtihan */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col print:border-slate-300">
          <CardContent className="p-5 flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/50 rounded-lg text-amber-700 dark:text-amber-400 print:hidden">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                    Pipeline Calon Khotim & Pra-Imtihan
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Santri di tingkat Jilid 6, Al-Qur'an, Ghorib, Tajwid, & Finishing.
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-500 text-white font-bold text-xs w-fit">
                {khotimCandidates.length} Santri
              </Badge>
            </div>

            {/* Search Filter */}
            <div className="relative print:hidden">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari calon khotim..."
                value={khotimSearch}
                onChange={e => setKhotimSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* List Table */}
            <div className="flex-1 overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-muted-foreground bg-slate-50 dark:bg-slate-800/50">
                    <th className="py-2.5 px-3 font-semibold">Santri</th>
                    <th className="py-2.5 px-3 font-semibold">Jilid</th>
                    <th className="py-2.5 px-3 font-semibold">Kelas & Guru</th>
                    <th className="py-2.5 px-3 font-semibold text-right print:hidden">Kontak Ortu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {khotimCandidates.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 print:hidden">
                            <AvatarImage src={s.foto_url} />
                            <AvatarFallback className="text-[10px] font-bold bg-amber-100 text-amber-800">
                              {s.nama_lengkap?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold leading-tight">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{s.nomor_induk_qiroati || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-[10px]">
                          {s.jilid}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{s.className}</p>
                        <p className="text-[10px] text-muted-foreground">{s.teacherName}</p>
                      </td>
                      <td className="py-2.5 px-3 text-right print:hidden">
                        {s.no_hp_ortu ? (
                          <a
                            href={`https://wa.me/${s.no_hp_ortu.replace(/\D/g, '').replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            <Phone className="w-3 h-3" /> WA Ortu
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {khotimCandidates.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        Tidak ada calon khotim yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* POIN 1: Peringatan Santri Stagnant dengan Indikator Durasi Belum Tes */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col print:border-slate-300">
          <CardContent className="p-5 flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400 print:hidden">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                    Evaluasi Perkembangan Santri Stagnan
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Santri yang paling lama belum tes / naik jilid (berdasarkan riwayat pengujian).
                  </p>
                </div>
              </div>
              <Badge variant="destructive" className="font-bold text-xs w-fit">
                {stagnantSantriList.length} Perlu Evaluasi
              </Badge>
            </div>

            {/* Search Filter */}
            <div className="relative print:hidden">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari santri evaluasi..."
                value={stagnantSearch}
                onChange={e => setStagnantSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* List Table with Untested Duration */}
            <div className="flex-1 overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-muted-foreground bg-slate-50 dark:bg-slate-800/50">
                    <th className="py-2.5 px-3 font-semibold">Santri</th>
                    <th className="py-2.5 px-3 font-semibold">Jilid</th>
                    <th className="py-2.5 px-3 font-semibold">Lama Belum Tes</th>
                    <th className="py-2.5 px-3 font-semibold">Guru Pengampu</th>
                    <th className="py-2.5 px-3 font-semibold text-right print:hidden">Kontak Guru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stagnantSantriList.map(s => {
                    const isVeryLong = s.untestedDaysAgo >= 180; // >= 6 Months
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7 print:hidden">
                              <AvatarImage src={s.foto_url} />
                              <AvatarFallback className="text-[10px] font-bold bg-rose-100 text-rose-700">
                                {s.nama_lengkap?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold leading-tight">{s.nama_lengkap}</p>
                              <p className="text-[10px] text-muted-foreground">{s.className}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[10px]">
                            {s.jilid || '-'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col">
                            <Badge
                              variant="outline"
                              className={`w-fit font-bold text-[10px] px-2 py-0.5 flex items-center gap-1 ${
                                isVeryLong
                                  ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {s.untestedDurationText}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              sejak {s.untestedFormattedDate}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{s.teacherName}</p>
                        </td>
                        <td className="py-2.5 px-3 text-right print:hidden">
                          {s.teacherHp ? (
                            <a
                              href={`https://wa.me/${s.teacherHp.replace(/\D/g, '').replace(/^0/, '62')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                            >
                              <Phone className="w-3 h-3" /> WA Guru
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {stagnantSantriList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        Tidak ada santri yang membutuhkan evaluasi khusus saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Class Management View for Pentashih */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 print:hidden">
        <div className="border-b pb-4 mb-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Manajemen Kelas & Santri
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tampilan interaktif berbasis sesi dan kelas. Klik santri untuk melihat rincian jilid, histori absensi, dan performa santri.
          </p>
        </div>

        {/* Render ClassManagement with pentashih view permissions */}
        <ClassManagement userRole="pentashih" />
      </div>
    </div>
  );
};

export default PentashihDashboard;
