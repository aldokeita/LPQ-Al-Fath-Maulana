
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Sector } from 'recharts';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Search, Calendar, TrendingUp, PieChart as PieChartIcon, ListChecks, DollarSign } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { MONTH_NAMES, monthNumberToName, selectedMonthToNumber } from '@/lib/paymentAdapters';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

const months = MONTH_NAMES;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A3'];

const paymentItemsList = [
  'SPP (100k)', 'SPP (50k)', 'Seragam', 'Tas Santri', 'ID Card Santri', 'Buku Prestasi', 'Buku Jilid Pra TK',
  'Buku Jilid 1-6 - Jilid 1', 'Buku Jilid 1-6 - Jilid 2', 'Buku Jilid 1-6 - Jilid 3', 'Buku Jilid 1-6 - Jilid 4', 'Buku Jilid 1-6 - Jilid 5', 'Buku Jilid 1-6 - Jilid 6', 'Buku Gharib & Tajwid',
];

const renderActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>{payload.name}</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="dark:fill-gray-300">
        {`Rp ${value.toLocaleString('id-ID')}`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999">
        {`(${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

const PaymentRecap = () => {
  const [allPayments, setAllPayments] = useState([]);
  const [allSantri, setAllSantri] = useState([]);

  const [recapData, setRecapData] = useState([]);
  const [filteredRecapData, setFilteredRecapData] = useState([]);
  const [itemRecapData, setItemRecapData] = useState([]);
  const [itemDetailData, setItemDetailData] = useState([]);
  const [activePieIndex, setActivePieIndex] = useState(0);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedItem, setSelectedItem] = useState('SPP (100k)');
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemDataLoading, setIsItemDataLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [activeTab, setActiveTab] = useState("status");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: paymentData, error: paymentError } = await supabase
          .from('payments')
          .select('id, santri_id, jumlah, tanggal_pembayaran, catatan, bulan, tahun, status')
          .eq('status', 'paid')
          .is('deleted_at', null)
          .order('tanggal_pembayaran', { ascending: false });

        const { data: santriData, error: santriError } = await supabase
          .from('santri')
          .select('id, nama_lengkap, status, sesi_mengaji, foto_url, avatar_path, rfid_tag');

        if (paymentError || santriError) {
          toast({ title: "Error", description: "Gagal memuat data.", variant: "destructive" });
          return;
        }

        const resolvedSantri = await resolveAvatarRecords(santriData, { ownerType: 'santri' });
        setAllPayments(paymentData || []);
        setAllSantri(resolvedSantri);

        const years = [...new Set(paymentData.map(p => p.tahun || new Date(p.tanggal_pembayaran).getFullYear()))].filter(y => y).sort((a,b) => b-a);
        const currentYear = new Date().getFullYear();
        if (!years.includes(currentYear)) years.unshift(currentYear);
        setAvailableYears([...new Set(years)]);

        if(!years.includes(selectedYear)) setSelectedYear(years[0] || currentYear);

      } catch (error) {
        toast({ title: "Error", description: "Terjadi kesalahan tidak terduga.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const activeSantri = allSantri.filter(s => s.status === 'Aktif');
    const statusData = activeSantri.map(santri => {
        const sppPayment = allPayments.find(p => {
             const isSantri = p.santri_id === santri.id;
             const isSPP = p.catatan && p.catatan.toLowerCase().includes('spp');
             const isBillingYear = p.tahun === selectedYear;
             const selectedMonthNumber = selectedMonthToNumber(selectedMonth);
             const isBillingMonth = selectedMonth === 'all' || p.bulan === selectedMonthNumber;
             return isSantri && isSPP && isBillingYear && isBillingMonth;
        });
        return {
            ...santri,
            status_spp: sppPayment ? 'Sudah Bayar' : 'Belum Bayar',
            jumlah: sppPayment ? sppPayment.jumlah : 0,
            tanggal_pembayaran: sppPayment ? new Date(sppPayment.tanggal_pembayaran) : null,
            bulan_tagihan: sppPayment ? monthNumberToName(sppPayment.bulan) : (selectedMonth !== 'all' ? months[Number(selectedMonth)] : '-'),
            tahun_tagihan: sppPayment ? sppPayment.tahun : selectedYear
        };
    });
    setRecapData(statusData);
  }, [allPayments, allSantri, selectedYear, selectedMonth, isLoading]);

  useEffect(() => {
    if (isLoading || !allPayments.length) return;
    setIsItemDataLoading(true);
    try {
      const normalizeItemName = (note) => {
        if (!note) return 'Lainnya';
        const trimmed = note.trim();
        for (const item of paymentItemsList) {
          if (trimmed.startsWith(item)) return item;
        }
        return trimmed.split('(')[0].trim() || 'Lainnya';
      };

      const itemData = allPayments.reduce((acc, p) => {
        const itemCategory = normalizeItemName(p.catatan);
        if (!acc[itemCategory]) acc[itemCategory] = { total: 0, count: 0 };
        acc[itemCategory].total += p.jumlah || 0;
        acc[itemCategory].count += 1;
        return acc;
      }, {});
      setItemRecapData(Object.entries(itemData).map(([name, data]) => ({ name, value: data.total, count: data.count })).sort((a, b) => b.value - a.value));
    } finally {
      setIsItemDataLoading(false);
    }
  }, [allPayments, isLoading]);

  useEffect(() => {
    if (isLoading || !allPayments.length || !selectedItem) return;
    setIsItemDataLoading(true);
    try {
      const itemPayments = allPayments
        .filter(p => p.catatan && p.catatan.trim().startsWith(selectedItem))
        .map(p => {
          const santri = allSantri.find(s => s.id === p.santri_id);
          return {
            ...p,
            nama_lengkap: santri?.nama_lengkap || 'Santri Tidak Ditemukan',
            sesi_mengaji: santri?.sesi_mengaji || '-',
            foto_url: santri?.foto_url || null,
            billing_year: p.tahun,
            billing_month: monthNumberToName(p.bulan),
            transaction_year: new Date(p.tanggal_pembayaran).getFullYear(),
          };
        })
        .sort((a, b) => new Date(b.tanggal_pembayaran) - new Date(a.tanggal_pembayaran));
      setItemDetailData(itemPayments);
    } finally {
      setIsItemDataLoading(false);
    }
  }, [allPayments, allSantri, selectedItem, isLoading]);

  useEffect(() => {
    let sortedData = [...recapData];
    if (searchQuery) {
        sortedData = sortedData.filter(item => item.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || (item.rfid_tag && item.rfid_tag.toLowerCase().includes(searchQuery.toLowerCase())));
    }
    if (sortConfig.key) {
        sortedData.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    setFilteredRecapData(sortedData);
  }, [recapData, searchQuery, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const onPieEnter = (_, index) => setActivePieIndex(index);

  const totalPaid = useMemo(() => recapData.filter(s => s.status_spp === 'Sudah Bayar').length, [recapData]);
  const totalUnpaid = useMemo(() => recapData.filter(s => s.status_spp === 'Belum Bayar').length, [recapData]);

  const totalIncome = useMemo(() => recapData.reduce((sum, s) => sum + (s.jumlah || 0), 0), [recapData]);

  const tabs = [
    { id: 'status', label: 'Status Pembayaran SPP', icon: ListChecks },
    { id: 'item', label: 'Rekap per Item', icon: PieChartIcon },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="admin-panel-header">
          <div className="flex items-center gap-3">
            <div className="admin-panel-header-icon"><DollarSign /></div>
            <div className="admin-panel-header-text"><h2>Rekap Pembayaran</h2><p>Memuat data...</p></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div><Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="admin-panel-header">
            <div className="flex items-center gap-3">
                <div className="admin-panel-header-icon"><DollarSign /></div>
                <div className="admin-panel-header-text">
                    <h2>Rekap Pembayaran</h2>
                    <p>Monitor status pembayaran SPP dan rekap per item.</p>
                </div>
            </div>
            <div className="admin-panel-header-actions">
                <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(val === 'all' ? 'all' : val.toString())}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Bulan</SelectItem>
                        {months.map((month, index) => <SelectItem key={month} value={index.toString()}>{month}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-6">
                <div className="admin-segmented-control">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`admin-segmented-control-item ${activeTab === tab.id ? 'active' : ''}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <TabsContent value="status" className="mt-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
                    <div className="relative w-full md:w-1/3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" /><Input placeholder="Cari nama atau RFID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-lg" /></div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4 rounded-xl mb-4 text-sm text-blue-800 dark:text-blue-300">
                    <TrendingUp className="w-4 h-4 inline-block mr-2"/>
                    Menampilkan status pembayaran tagihan untuk periode: <strong>{selectedMonth === 'all' ? 'Semua Bulan' : months[selectedMonth]} {selectedYear}</strong>.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="admin-stat-card admin-stat-card--accent">
                        <p className="admin-stat-card-label">Sudah Bayar SPP</p>
                        <p className="admin-stat-card-value">{totalPaid}</p>
                    </div>
                    <div className="admin-stat-card" style={{ borderColor: 'hsl(0 84% 60% / 0.2)', backgroundColor: 'hsl(0 84% 60% / 0.04)' }}>
                        <p className="admin-stat-card-label">Belum Bayar SPP</p>
                        <p className="admin-stat-card-value">{totalUnpaid}</p>
                    </div>
                    <div className="admin-stat-card admin-stat-card--amber">
                        <p className="admin-stat-card-label">Total Pemasukan SPP</p>
                        <p className="admin-stat-card-value">Rp {totalIncome.toLocaleString('id-ID')}</p>
                    </div>
                </div>

                <div className="admin-table-shell">
                    <div className="admin-table-scroll" style={{ maxHeight: '500px' }}>
                        <table>
                            <thead><tr>
                                <th>No</th>
                                <th colSpan={2}>Nama Santri</th>
                                <th className="cursor-pointer" onClick={() => handleSort('sesi_mengaji')}>Sesi</th>
                                <th className="cursor-pointer" onClick={() => handleSort('status_spp')}>Status</th>
                                <th>Jumlah</th>
                                <th className="cursor-pointer" onClick={() => handleSort('tanggal_pembayaran')}>Tanggal Bayar</th>
                            </tr></thead>
                            <tbody>{filteredRecapData.map((item, index) => (<tr key={item.id}>
                                <td>{index + 1}</td>
                                <td><Avatar className="w-8 h-8"><AvatarImage src={item.foto_url} alt={item.nama_lengkap} /><AvatarFallback>{item.nama_lengkap.charAt(0)}</AvatarFallback></Avatar></td>
                                <td className="font-medium">{item.nama_lengkap}</td>
                                <td>{item.sesi_mengaji}</td>
                                <td>{item.status_spp === 'Sudah Bayar' ? (<span className="admin-status-badge admin-status-badge--success"><CheckCircle className="w-3 h-3"/> Lunas</span>) : (<span className="admin-status-badge admin-status-badge--danger"><XCircle className="w-3 h-3"/> Belum</span>)}</td>
                                <td>{item.jumlah > 0 ? `Rp ${item.jumlah.toLocaleString('id-ID')}` : '-'}</td>
                                <td>{item.tanggal_pembayaran ? item.tanggal_pembayaran.toLocaleDateString('id-ID') : '-'}</td>
                            </tr>))}</tbody>
                        </table>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="item" className="mt-6 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                {isItemDataLoading ? (
                  <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" /></div>
                ) : (
                  <>
                    <div className="text-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/50 dark:to-blue-900/20 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Calendar className="w-5 h-5 text-primary" />
                          <h3 className="text-xl font-bold">Total Pemasukan per Item (Semua Waktu)</h3>
                        </div>
                        <p className="text-muted-foreground mb-6">
                            Total: <span className="text-primary font-bold text-lg">
                                Rp {itemRecapData.reduce((sum, item) => sum + item.value, 0).toLocaleString('id-ID')}
                            </span>
                        </p>
                        {itemRecapData.length > 0 && (
                          <div className="h-[400px] w-full max-w-2xl mx-auto">
                            <PieChart width={700} height={400}>
                                <Pie
                                    activeIndex={activePieIndex}
                                    activeShape={renderActiveShape}
                                    data={itemRecapData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    dataKey="value"
                                    onMouseEnter={onPieEnter}
                                >
                                    {itemRecapData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                </Pie>
                            </PieChart>
                          </div>
                        )}
                    </div>
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <Select value={selectedItem} onValueChange={setSelectedItem}><SelectTrigger className="w-full sm:w-[280px] rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{paymentItemsList.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="admin-table-shell">
                            <div className="admin-table-scroll" style={{ maxHeight: '500px' }}>
                                <table>
                                    <thead><tr><th>No</th><th>Nama Santri</th><th>Sesi</th><th>Jumlah</th><th>Tanggal</th><th>Tagihan</th></tr></thead>
                                    <tbody>
                                        {itemDetailData.map((item, index) => (
                                            <tr key={item.id}>
                                                <td>{index + 1}</td>
                                                <td className="font-medium">{item.nama_lengkap}</td>
                                                <td>{item.sesi_mengaji}</td>
                                                <td className="text-right font-mono font-semibold text-green-600 dark:text-green-400">
                                                    Rp {(item.jumlah || 0).toLocaleString('id-ID')}
                                                </td>
                                                <td className="text-center">{new Date(item.tanggal_pembayaran).toLocaleDateString('id-ID')}</td>
                                                <td className="text-center"><span className="admin-status-badge admin-status-badge--info">{item.billing_month || '-'} {item.billing_year}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                  </>
                )}
            </TabsContent>
        </Tabs>
    </div>
  );
};

export default PaymentRecap;
