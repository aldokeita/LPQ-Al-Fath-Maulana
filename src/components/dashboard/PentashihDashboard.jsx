import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { Users, BookOpen, Award, Calendar, CheckCircle2, Phone, ShieldCheck, GraduationCap, Briefcase } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';
import ClassManagement from '@/components/dashboard/admin/ClassManagement';

const PentashihDashboard = () => {
  const { user } = useAuth();
  const [guruData, setGuruData] = useState(null);
  const [stats, setStats] = useState({ totalSantri: 0, totalClasses: 0, tpqSantri: 0, ptptSantri: 0, dewasaSantri: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardStats = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const [guruRes, classesRes, santriRes] = await Promise.all([
        supabase
          .from('guru')
          .select('id, nama, foto_url, rfid_tag, no_hp, jabatan')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('classes')
          .select('id, nama_kelas, sesi, kategori, is_active')
          .eq('is_active', true),
        supabase
          .from('santri')
          .select('id, kategori, status')
          .or('status.eq.Aktif,status.eq.active,status.is.null'),
      ]);

      if (guruRes.error) throw guruRes.error;

      const resolvedGuru = await resolveAvatarRecord(guruRes.data, { ownerType: 'guru' });
      setGuruData(resolvedGuru || null);

      const allSantri = santriRes.data || [];
      const tpqCount = allSantri.filter(s => !s.kategori || s.kategori.toLowerCase() === 'anak' || s.kategori.toLowerCase() === 'tpq').length;
      const ptptCount = allSantri.filter(s => s.kategori === 'PTPT').length;
      const dewasaCount = allSantri.filter(s => s.kategori === 'Dewasa').length;

      setStats({
        totalSantri: allSantri.length,
        totalClasses: (classesRes.data || []).length,
        tpqSantri: tpqCount,
        ptptSantri: ptptCount,
        dewasaSantri: dewasaCount,
      });
    } catch (error) {
      toast({ title: 'Gagal memuat statistik pentashih', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-slate-50 dark:bg-slate-950 min-h-screen space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-black uppercase text-purple-700 dark:text-purple-400 tracking-wide">
              Dashboard Pentashih
            </h1>
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1 text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" /> Penguji Resmi
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Akses penuh peninjauan kelas, santri, dan manajemen pengujian Qiroati lembaga.
          </p>
        </div>

        <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Hero Stats & Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Metric Cards Grid */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-slate-900 border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3.5 bg-purple-100 dark:bg-purple-950/50 rounded-2xl">
                <Users className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalSantri}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Santri Aktif</p>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
                  {stats.tpqSantri} TPQ • {stats.ptptSantri} PTPT • {stats.dewasaSantri} Dewasa
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3.5 bg-blue-100 dark:bg-blue-950/50 rounded-2xl">
                <BookOpen className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalClasses}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Kelas Aktif</p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">Seluruh Sesi & Kategori</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Card */}
        <div className="md:col-span-4">
          {guruData ? (
            <Card className="bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-800 text-white h-full shadow-lg relative overflow-hidden border-0 rounded-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Award className="w-32 h-32 text-white" />
              </div>
              <CardContent className="p-5 flex flex-col justify-center h-full relative z-10">
                <div className="flex items-center gap-3.5 mb-2">
                  <Avatar className="w-14 h-14 border-2 border-white/40 shadow-md">
                    <AvatarImage src={guruData.foto_url} className="object-cover" />
                    <AvatarFallback className="text-purple-700 font-bold text-lg bg-white">
                      {guruData.nama?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold leading-tight truncate">{guruData.nama}</h2>
                    <span className="inline-flex items-center gap-1 text-purple-100 text-xs font-semibold bg-white/20 px-2.5 py-0.5 rounded-full mt-1">
                      <ShieldCheck className="w-3 h-3" /> {guruData.jabatan || 'Pentashih Official'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/15 text-xs text-purple-100 flex items-center justify-between">
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
            <div className="h-full bg-slate-200 dark:bg-slate-800 animate-pulse rounded-2xl min-h-[110px]" />
          )}
        </div>
      </div>

      {/* Main Class Management View for Pentashih */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
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
