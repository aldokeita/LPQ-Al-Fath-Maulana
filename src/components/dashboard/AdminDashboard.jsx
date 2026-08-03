import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Users, DollarSign, BookOpen, TrendingDown, BookUser, Fingerprint, LogIn, FileText, CalendarCheck, Tv, Gamepad2, PieChart, Settings, GraduationCap, Briefcase, Calendar, Calculator, Shuffle, Database, Library, FileSpreadsheet } from 'lucide-react';
import SantriManagement from './admin/SantriManagement';
import SantriDewasaManagement from './admin/SantriDewasaManagement';
import GuruManagement from './admin/GuruManagement';
import PaymentSystem from './admin/PaymentSystem';
import PaymentRecap from './admin/PaymentRecap';
import PaymentHistory from './admin/PaymentHistory';
import ContentManagement from './admin/ContentManagement';
import LoginLogs from './admin/LoginLogs';
import ExpenseManagement from './admin/ExpenseManagement';
import ClassManagement from './admin/ClassManagement';
import ClassAttendanceSheets from './admin/ClassAttendanceSheets';
import AttendanceRecap from './admin/AttendanceRecap';
import GuruAttendanceRecap from './admin/GuruAttendanceRecap';
import TvDisplaySettings from './admin/TvDisplaySettings';
import GameConfiguration from './admin/GameConfiguration';
import CalendarManagement from './admin/CalendarManagement';
import SalaryCalculation from './admin/SalaryCalculation';
import BackupRestoreManagement from './admin/BackupRestoreManagement';
import MMQManagement from './admin/MMQManagement';
import { supabase } from '@/lib/customSupabaseClient';
import { enableBackupRestore, enableGameFeatures } from '@/lib/featureFlags';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import GlobalSearch from './shared/GlobalSearch';
import SantriDetailModal from './shared/SantriDetailModal';
import { toast } from '@/components/ui/use-toast';
import { fetchCashflowSummary } from '@/lib/financeAdapters';
import AdminPageHeader from './shared/AdminPageHeader';
import AdminStatCard from './shared/AdminStatCard';
import AdminModuleNav from './shared/AdminModuleNav';
import { resolveAvatarRecord } from '@/lib/storageAdapters';

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout exceeded')), ms)
  );
  return Promise.race([promise, timeout]);
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("santri");
  const [activeSantriSubTab, setActiveSantriSubTab] = useState("tpq");
  const [stats, setStats] = useState({
    totalSantri: 0,
    totalPemasukanBulanIni: 0,
    totalPengeluaranBulanIni: 0
  });

  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  // State for global search navigation
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [isSantriModalOpen, setIsSantriModalOpen] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const santriQuery = supabase.from('santri').select('*', { count: 'exact', head: true }).in('status', ['Aktif', 'active']);
        const [santriResult, financeSummary] = await Promise.all([
          withTimeout(santriQuery, 10000),
          fetchCashflowSummary({ year: currentYear, month: currentMonth })
        ]);

        const { count: santriCount, error: santriErr } = santriResult;
        if (santriErr) throw new Error(`Santri query failed: ${santriErr.message}`);

        setStats({
          totalSantri: santriCount || 0,
          totalPemasukanBulanIni: financeSummary.totalPemasukan,
          totalPengeluaranBulanIni: financeSummary.totalPengeluaran
        });
      } catch (err) {
        setError(err.message);
        toast({
          title: "Gagal memuat data",
          description: "Terjadi kesalahan saat memuat statistik dashboard. " + err.message,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleGlobalSearchNavigate = async (item, category) => {
    try {
      switch (category) {
        case 'santri':
          const { data: fullSantri } = await supabase.from('santri').select('*, class:classes!santri_current_class_id_fkey(nama_kelas, id_guru)').eq('id', item.id).single();
          if (fullSantri) {
            setSelectedSantri(await resolveAvatarRecord(fullSantri, { ownerType: 'santri' }));
            setIsSantriModalOpen(true);
          } else {
             toast({ title: "Gagal", description: "Data santri tidak ditemukan.", variant: "destructive" });
          }
          break;
        case 'guru':
          setActiveTab('guru');
          toast({ title: "Navigasi", description: `Menuju profil guru: ${item.nama}` });
          break;
        case 'kelas':
          setActiveTab('kelas');
          toast({ title: "Navigasi", description: `Menuju kelas: ${item.nama_kelas}` });
          break;
        case 'pembayaran':
          setActiveTab('history');
          toast({ title: "Navigasi", description: `Menuju riwayat pembayaran ${item.santri?.nama_lengkap || ''}` });
          break;
        case 'hafalan':
          if (item.santri?.id) {
             const { data: santriFromHafalan } = await supabase.from('santri').select('*, class:classes!santri_current_class_id_fkey(nama_kelas, id_guru)').eq('id', item.santri.id).single();
             if (santriFromHafalan) {
                setSelectedSantri(await resolveAvatarRecord(santriFromHafalan, { ownerType: 'santri' }));
                setIsSantriModalOpen(true);
             }
          } else {
             setActiveTab('santri');
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("Navigation error:", error);
      toast({ title: "Error", description: "Terjadi kesalahan saat navigasi.", variant: "destructive" });
    }
  };

  // Tab definitions with group property for AdminModuleNav
  const santriSubTabs = [
    { id: 'tpq', label: 'Santri TPQ', icon: GraduationCap },
    { id: 'ptpt', label: 'Santri PTPT', icon: BookOpen },
    { id: 'dewasa', label: 'Santri Dewasa', icon: Briefcase },
  ];

  const adminTabs = [
    { value: 'santri', label: 'Data Santri', icon: Users, group: 'data' },
    { value: 'guru', label: 'Data Guru', icon: BookUser, group: 'data' },
    { value: 'kelas', label: 'Manajemen Kelas', icon: BookOpen, group: 'akademik' },
    { value: 'absensi-kelas', label: 'Absensi Kelas', icon: FileSpreadsheet, group: 'akademik' },
    { value: 'rekap-absensi', label: 'Rekap Santri', icon: CalendarCheck, group: 'akademik' },
    { value: 'rekap-guru', label: 'Rekap Guru', icon: GraduationCap, group: 'akademik' },
    { value: 'mmq', label: 'MMQ', icon: Library, group: 'akademik' },
    { value: 'salary', label: 'Bisyaroh', icon: Calculator, group: 'akademik' },
    { value: 'academic-calendar', label: 'Kalender', icon: Calendar, group: 'akademik' },
    { value: 'payment', label: 'Pembayaran', icon: DollarSign, group: 'keuangan' },
    { value: 'recap', label: 'Rekap SPP', icon: PieChart, group: 'keuangan' },
    { value: 'history', label: 'Riwayat Bayar', icon: FileText, group: 'keuangan' },
    { value: 'expense', label: 'Pengeluaran', icon: TrendingDown, group: 'keuangan' },
    { value: 'content', label: 'Konten', icon: FileText, group: 'konten' },
    { value: 'tv-settings', label: 'Pengaturan TV', icon: Tv, group: 'konten' },
    { value: 'game-config', label: 'Konfigurasi', icon: Settings, group: 'konten' },
    { value: 'backup', label: 'Backup & Restore', icon: Database, group: 'sistem' },
    { value: 'logs', label: 'Log Login', icon: LogIn, group: 'sistem' },
  ].filter(tab => {
    if (tab.value === 'backup') return enableBackupRestore;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-20">

      {/* Global Search Section — below navbar */}
      <div className="mb-6">
        <GlobalSearch onNavigate={handleGlobalSearchNavigate} />
      </div>

      {/* Page Header with Quick Actions */}
      <AdminPageHeader
        title="Dashboard Administrator"
        subtitle="Kelola seluruh sistem LPQ Al-Fath Maulana"
      >
        <button
          type="button"
          onClick={() => navigate('/tv-display-mode')}
          className="attendance-header__action-btn attendance-header__action-btn--tv lpq-shiny-button"
        >
          <Tv className="w-4 h-4"/><span>TV Display</span>
        </button>
        {enableGameFeatures && (
          <>
            <button
              type="button"
              onClick={() => navigate('/gatcha-game')}
              className="attendance-header__action-btn attendance-header__action-btn--gatcha lpq-shiny-button"
            >
              <Gamepad2 className="w-4 h-4"/><span>Play Gatcha</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/quiz-hafalan')}
              className="attendance-header__action-btn attendance-header__action-btn--quiz lpq-shiny-button"
            >
              <Library className="w-4 h-4"/><span>Play Quiz</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/random-name')}
              className="attendance-header__action-btn attendance-header__action-btn--random lpq-shiny-button"
            >
              <Shuffle className="w-4 h-4"/><span>Acak Nama</span>
            </button>
          </>
        )}
      </AdminPageHeader>

      {/* Error State */}
      {error && (
        <div
          className="admin-error-state mb-6"
          role="alert"
        >
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="flex-shrink-0 ml-auto">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 relative z-10">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-xl admin-skeleton-shimmer" />
            <Skeleton className="h-28 rounded-xl admin-skeleton-shimmer" />
            <Skeleton className="h-28 rounded-xl admin-skeleton-shimmer" />
            <Skeleton className="h-28 rounded-xl admin-skeleton-shimmer" />
          </>
        ) : (
          <>
            <AdminStatCard
              label="Santri Aktif"
              value={stats.totalSantri}
              icon={Users}
              variant="students"
            />
            <AdminStatCard
              label="Pemasukan"
              value={stats.totalPemasukanBulanIni}
              icon={DollarSign}
              variant="income"
              masked
              showMask={showIncome}
              onToggleMask={() => setShowIncome(!showIncome)}
            />
            <AdminStatCard
              label="Pengeluaran"
              value={stats.totalPengeluaranBulanIni}
              icon={TrendingDown}
              variant="expense"
              masked
              showMask={showExpense}
              onToggleMask={() => setShowExpense(!showExpense)}
            />
            <AdminStatCard
              label="MODE KIOSK"
              value="Absensi Digital"
              icon={Fingerprint}
              variant="kiosk"
              onClick={() => navigate('/absensi-digital')}
            />
          </>
        )}
      </div>

      {/* Module Navigation */}
      <AdminModuleNav
        tabs={adminTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Santri Subcategory Segmented Control — visible only when Data Santri is active */}
      {activeTab === 'santri' && (
        <div className="flex justify-center mt-6">
          <div className="admin-glass-tab-list inline-flex p-1 rounded-full gap-1">
            {santriSubTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSantriSubTab(tab.id)}
                className={`
                  admin-glass-tab-button lpq-shiny-button relative px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2
                  ${activeSantriSubTab === tab.id ? 'text-primary dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}
                `}
              >
                {activeSantriSubTab === tab.id && (
                  <motion.div
                    layoutId="santri-subcat-pill"
                    className="admin-glass-tab-indicator"
                    transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.72 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 mt-6">
        <div>
            <TabsContent value="santri">
              {activeSantriSubTab === 'dewasa' ? (
                <SantriDewasaManagement />
              ) : (
                <SantriManagement subCategory={activeSantriSubTab} />
              )}
            </TabsContent>
            <TabsContent value="kelas"><ClassManagement /></TabsContent>
            <TabsContent value="absensi-kelas"><ClassAttendanceSheets /></TabsContent>
            <TabsContent value="guru"><GuruManagement /></TabsContent>
            <TabsContent value="rekap-absensi"><AttendanceRecap /></TabsContent>
            <TabsContent value="rekap-guru"><GuruAttendanceRecap /></TabsContent>
            <TabsContent value="mmq"><MMQManagement /></TabsContent>
            <TabsContent value="salary"><SalaryCalculation /></TabsContent>
            <TabsContent value="academic-calendar"><CalendarManagement /></TabsContent>
            <TabsContent value="payment"><PaymentSystem /></TabsContent>
            <TabsContent value="expense"><ExpenseManagement /></TabsContent>
            <TabsContent value="tv-settings"><TvDisplaySettings /></TabsContent>
            <TabsContent value="game-config"><GameConfiguration /></TabsContent>
            <TabsContent value="backup"><BackupRestoreManagement /></TabsContent>
            <TabsContent value="history"><PaymentHistory /></TabsContent>
            <TabsContent value="recap"><PaymentRecap /></TabsContent>
            <TabsContent value="content"><ContentManagement /></TabsContent>
            <TabsContent value="logs"><LoginLogs /></TabsContent>
        </div>
      </Tabs>

      {/* Global Modals for Search Navigation */}
      <SantriDetailModal
        santri={selectedSantri}
        isOpen={isSantriModalOpen}
        onOpenChange={setIsSantriModalOpen}
      />
    </div>
  );
};

export default AdminDashboard;
