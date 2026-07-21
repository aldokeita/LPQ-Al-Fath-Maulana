import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Download, Calculator, DollarSign, Wallet, Search, Edit3, Save, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const SalaryCalculation = () => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [gurus, setGurus] = useState([]);
    const [classes, setClasses] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [holidays, setHolidays] = useState(new Set());
    const [salaryData, setSalaryData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedGuruDetail, setSelectedGuruDetail] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Default Rates & Config
    const [rates, setRates] = useState({
        syahadah: 700000,
        nonSyahadah: 400000,
        deductionTpQ: 35000,
        deductionAdult: 0, // Custom by admin, but often manually handled
        adminSalary: 600000,
        pentashihSalary: 500000,
        staffOpsSalary: 1000000,
        bendaharaSalary: 1000000,
    });

    // Configuration States for Calculation
    // Using sets to track enabled statuses for each guru
    const [adminGurus, setAdminGurus] = useState(new Set());
    const [pentashihGurus, setPentashihGurus] = useState(new Set());
    const [staffOpsGurus, setStaffOpsGurus] = useState(new Set());
    const [bendaharaGurus, setBendaharaGurus] = useState(new Set());

    // Deductions
    const [autoDeductionEnabled, setAutoDeductionEnabled] = useState({}); // { guruId: boolean }
    const [manualDeductionCounts, setManualDeductionCounts] = useState({}); // { guruId: number_of_absences }

    // Incomes
    const [badalInputs, setBadalInputs] = useState({}); // { guruId: { count: 0, rate: 35000 } }

    const fetchAllData = async () => {
        setIsLoading(true);
        const { data: guruList } = await supabase.from('guru').select('*').order('nama');
        const { data: classList } = await supabase.from('classes').select('id, nama_kelas, sesi, id_guru, kategori');

        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

        const { data: calendarData } = await supabase.from('academic_calendar').select('date').gte('date', startDate).lte('date', endDate).eq('is_holiday', true);
        const { data: att } = await supabase.from('attendance').select('*').eq('role', 'guru').gte('attendance_date', startDate).lte('attendance_date', endDate);

        if (guruList && classList && att) {
            setGurus(guruList);
            setClasses(classList);
            setAttendanceData(att);
            setHolidays(new Set((calendarData || []).map(c => c.date)));

            // Initialize default states based on guru roles if needed
            // For now, we rely on manual toggles in this UI, or persistent storage if we added it to DB
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAllData();
    }, [selectedYear, selectedMonth]);

    // Calculation Logic
    useEffect(() => {
        if (gurus.length === 0) return;

        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const activeDays = [];
        for(let d=1; d<=daysInMonth; d++) {
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const date = new Date(selectedYear, selectedMonth, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            if (!isWeekend && !holidays.has(dateStr)) {
                activeDays.push(dateStr);
            }
        }

        const calculated = gurus.map(guru => {
            const myClasses = classes.filter(c => c.id_guru === guru.id);
            const uniqueSessions = [...new Set(myClasses.map(c => c.sesi))];

            const isSyahadah = guru.status_guru === 'Syahadah';
            const ratePerSession = isSyahadah ? rates.syahadah : rates.nonSyahadah;
            const baseSalary = uniqueSessions.length * ratePerSession;

            // Calculate Potential Absences (Auto)
            let calculatedAbsenceCount = 0;
            uniqueSessions.forEach(sesi => {
                const isAdultSession = myClasses.some(c => c.sesi === sesi && c.kategori === 'Dewasa');
                // Only count TPQ absences for auto deduction usually, or all if desired.
                // Assuming deductionTpQ applies to standard sessions.
                activeDays.forEach(dateStr => {
                    const isPresent = attendanceData.some(a => a.user_id === guru.id && a.attendance_date === dateStr && a.sesi === sesi);
                    if (!isPresent && !isAdultSession) { // Skip adult session auto deduction if not configured
                         calculatedAbsenceCount++;
                    }
                });
            });

            // Auto Deduction Logic
            const isAutoEnabled = autoDeductionEnabled[guru.id] !== false; // Default true if undefined
            const autoDeductionAmount = isAutoEnabled ? (calculatedAbsenceCount * rates.deductionTpQ) : 0;

            // Manual Deduction Logic (Input count * 35000)
            const manualCount = manualDeductionCounts[guru.id] || 0;
            const manualDeductionAmount = manualCount * 35000;

            const totalDeduction = autoDeductionAmount + manualDeductionAmount;

            // Allowances
            const badalInfo = badalInputs[guru.id] || { count: 0, rate: 35000 };
            const badalIncome = badalInfo.count * badalInfo.rate;

            const isAdmin = adminGurus.has(guru.id);
            const adminIncome = isAdmin ? rates.adminSalary : 0;

            const isPentashih = pentashihGurus.has(guru.id);
            const pentashihIncome = isPentashih ? rates.pentashihSalary : 0;

            const isStaffOps = staffOpsGurus.has(guru.id);
            const staffOpsIncome = isStaffOps ? rates.staffOpsSalary : 0;

            const isBendahara = bendaharaGurus.has(guru.id);
            const bendaharaIncome = isBendahara ? rates.bendaharaSalary : 0;

            const totalAllowance = adminIncome + pentashihIncome + staffOpsIncome + bendaharaIncome;

            const totalSalary = baseSalary - totalDeduction + badalIncome + totalAllowance;

            return {
                ...guru,
                uniqueSessions,
                baseSalary,
                calculatedAbsenceCount,
                autoDeductionAmount,
                isAutoEnabled,
                manualCount,
                manualDeductionAmount,
                totalDeduction,
                badalIncome,
                badalCount: badalInfo.count,
                badalRate: badalInfo.rate,
                adminIncome,
                isAdmin,
                pentashihIncome,
                isPentashih,
                staffOpsIncome,
                isStaffOps,
                bendaharaIncome,
                isBendahara,
                totalSalary,
                ratePerSession
            };
        });

        setSalaryData(calculated);

        // Update selected detail if open
        if (selectedGuruDetail) {
            const updated = calculated.find(g => g.id === selectedGuruDetail.id);
            if (updated) setSelectedGuruDetail(updated);
        }

    }, [gurus, classes, attendanceData, holidays, rates, adminGurus, pentashihGurus, staffOpsGurus, bendaharaGurus, autoDeductionEnabled, manualDeductionCounts, badalInputs, selectedYear, selectedMonth]);

    const handleBadalChange = (guruId, field, value) => {
        setBadalInputs(prev => ({
            ...prev,
            [guruId]: {
                ...prev[guruId] || { count: 0, rate: 35000 },
                [field]: Number(value)
            }
        }));
    };

    const toggleRole = (guruId, roleSet, setRoleSet) => {
        const newSet = new Set(roleSet);
        if (newSet.has(guruId)) newSet.delete(guruId);
        else newSet.add(guruId);
        setRoleSet(newSet);
    };

    const toggleAutoDeduction = (guruId) => {
        setAutoDeductionEnabled(prev => ({
            ...prev,
            [guruId]: prev[guruId] === undefined ? false : !prev[guruId]
        }));
    };

    const handleManualDeductionCountChange = (guruId, count) => {
        setManualDeductionCounts(prev => ({
            ...prev,
            [guruId]: Number(count)
        }));
    };

    const handleExport = () => {
        const data = salaryData.map(d => ({
            'Nama Guru': d.nama,
            'Status': d.status_guru || 'Non-Syahadah',
            'Sesi Mengajar': d.uniqueSessions.join(', '),
            'Gaji Pokok': d.baseSalary,
            'Potongan Absen (Auto)': d.autoDeductionAmount,
            'Potongan Manual': d.manualDeductionAmount,
            'Pendapatan Badal': d.badalIncome,
            'Tunjangan Admin': d.adminIncome,
            'Tunjangan Pentashih': d.pentashihIncome,
            'Tunjangan Staff Ops': d.staffOpsIncome,
            'Tunjangan Bendahara': d.bendaharaIncome,
            'Total Bisyaroh': d.totalSalary
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bisyaroh");
        XLSX.writeFile(wb, `Bisyaroh_${months[selectedMonth]}_${selectedYear}.xlsx`);
    };

    const filteredData = useMemo(() => {
        if (!searchTerm) return salaryData;
        return salaryData.filter(g => g.nama.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [salaryData, searchTerm]);

    const openDetail = (guru) => {
        setSelectedGuruDetail(guru);
        setIsDetailOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="admin-panel-header">
                <div className="flex items-center gap-3">
                    <div className="admin-panel-header-icon">
                        <Calculator />
                    </div>
                    <div className="admin-panel-header-text">
                        <h2>Kalkulasi Bisyaroh (Gaji)</h2>
                        <p>Pilih guru untuk melihat detail dan menghitung gaji.</p>
                    </div>
                </div>
                <div className="admin-panel-header-actions">
                    <div className="admin-action-cluster">
                        <button onClick={handleExport} className="admin-action-cluster-btn" disabled={filteredData.length === 0}>
                            <Download className="w-3.5 h-3.5" /> Export
                        </button>
                    </div>
                </div>
            </div>

            <div className="admin-filter-bar">
                <div className="admin-search-input flex-1">
                    <Search />
                    <Input placeholder="Cari nama guru..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2">
                    <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}><SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                    <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(Number(val))}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger><SelectContent>{months.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                </div>
            </div>

            {/* Config Section - Collapsible or small */}
            <Card className="bg-slate-50 dark:bg-slate-900/50">
                <CardContent className="py-4">
                    <div className="flex items-center justify-between cursor-pointer group" onClick={() => document.getElementById('config-details').classList.toggle('hidden')}>
                        <div className="flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-muted-foreground"/>
                            <span className="text-sm font-medium">Konfigurasi Tarif Dasar</span>
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:underline">Klik untuk ubah</span>
                    </div>
                    <div id="config-details" className="hidden mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><label className="text-[10px] uppercase font-bold text-muted-foreground">Sesi Syahadah</label><Input type="number" value={rates.syahadah} onChange={e => setRates({...rates, syahadah: Number(e.target.value)})} className="h-8 text-xs"/></div>
                        <div><label className="text-[10px] uppercase font-bold text-muted-foreground">Sesi Non-Syahadah</label><Input type="number" value={rates.nonSyahadah} onChange={e => setRates({...rates, nonSyahadah: Number(e.target.value)})} className="h-8 text-xs"/></div>
                        <div><label className="text-[10px] uppercase font-bold text-muted-foreground">Potongan Absen</label><Input type="number" value={rates.deductionTpQ} onChange={e => setRates({...rates, deductionTpQ: Number(e.target.value)})} className="h-8 text-xs"/></div>
                        <div><label className="text-[10px] uppercase font-bold text-muted-foreground">Admin</label><Input type="number" value={rates.adminSalary} onChange={e => setRates({...rates, adminSalary: Number(e.target.value)})} className="h-8 text-xs"/></div>
                        <div><label className="text-[10px] uppercase font-bold text-muted-foreground">Pentashih</label><Input type="number" value={rates.pentashihSalary} onChange={e => setRates({...rates, pentashihSalary: Number(e.target.value)})} className="h-8 text-xs"/></div>
                        <div><label className="text-[10px] uppercase font-bold text-muted-foreground">Staff Ops</label><Input type="number" value={rates.staffOpsSalary} onChange={e => setRates({...rates, staffOpsSalary: Number(e.target.value)})} className="h-8 text-xs"/></div>
                        <div><label className="text-[10px] uppercase font-bold text-muted-foreground">Bendahara</label><Input type="number" value={rates.bendaharaSalary} onChange={e => setRates({...rates, bendaharaSalary: Number(e.target.value)})} className="h-8 text-xs"/></div>
                    </div>
                </CardContent>
            </Card>

            {/* List of Gurus */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredData.map(guru => (
                    <div
                        key={guru.id}
                        onClick={() => openDetail(guru)}
                        className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-primary text-white p-1.5 rounded-full shadow-lg"><Calculator className="w-4 h-4"/></div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 border-2 border-white shadow-sm group-hover:scale-105 transition-transform"><AvatarImage src={guru.foto_url} /><AvatarFallback>{guru.nama.charAt(0)}</AvatarFallback></Avatar>
                            <div>
                                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{guru.nama}</h3>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    <Badge variant="secondary" className="text-[10px]">{guru.status_guru || 'Non-Syahadah'}</Badge>
                                    <Badge variant="outline" className="text-[10px]">{guru.uniqueSessions.length} Sesi</Badge>
                                </div>
                            </div>
                        </div>
                        <Separator className="my-3"/>
                        <div className="flex justify-between items-end">
                            <div className="text-xs text-muted-foreground">
                                <p>Absen: <span className="font-medium text-red-500">{guru.calculatedAbsenceCount} (Auto) + {guru.manualCount} (Manual)</span></p>
                                <p>Badal: <span className="font-medium text-green-500">{guru.badalCount}</span> kali</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Estimasi</p>
                                <p className="text-xl font-bold font-mono text-green-600">Rp {guru.totalSalary.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredData.length === 0 && <div className="col-span-full text-center py-10 text-muted-foreground">Tidak ada data guru.</div>}
            </div>

            {/* Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-md md:max-w-xl max-h-[90vh] overflow-y-auto">
                    {selectedGuruDetail && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-4 mb-2">
                                    <Avatar className="h-16 w-16 border-2 border-white shadow-md"><AvatarImage src={selectedGuruDetail.foto_url} /><AvatarFallback>{selectedGuruDetail.nama.charAt(0)}</AvatarFallback></Avatar>
                                    <div>
                                        <DialogTitle className="text-xl">{selectedGuruDetail.nama}</DialogTitle>
                                        <DialogDescription>{selectedGuruDetail.status_guru || 'Non-Syahadah'} • {selectedGuruDetail.jabatan || 'Pengajar'}</DialogDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border">
                                    <Calendar className="w-3 h-3"/> Periode: <span className="font-bold">{months[selectedMonth]} {selectedYear}</span>
                                </div>
                            </DialogHeader>

                            <div className="space-y-6 py-2">
                                {/* Pemasukan */}
                                <div>
                                    <h4 className="text-sm font-bold text-green-600 flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4"/> Pemasukan & Tunjangan</h4>
                                    <div className="space-y-3 pl-2 border-l-2 border-green-100 dark:border-green-900/30">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                                            <div className="text-sm">
                                                <p className="font-medium">Gaji Pokok Mengajar</p>
                                                <p className="text-xs text-muted-foreground">{selectedGuruDetail.uniqueSessions.length} Sesi x Rp {selectedGuruDetail.ratePerSession.toLocaleString()}</p>
                                            </div>
                                            <span className="font-mono font-medium">Rp {selectedGuruDetail.baseSalary.toLocaleString()}</span>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg space-y-2">
                                            {/* Admin Toggle */}
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="admin-switch" className="text-sm cursor-pointer">Tunjangan Admin</Label>
                                                <div className="flex items-center gap-2">
                                                    {selectedGuruDetail.isAdmin && <span className="text-xs font-mono text-green-600">+ Rp {rates.adminSalary.toLocaleString()}</span>}
                                                    <Switch id="admin-switch" checked={selectedGuruDetail.isAdmin} onCheckedChange={() => toggleRole(selectedGuruDetail.id, adminGurus, setAdminGurus)} />
                                                </div>
                                            </div>
                                            {/* Pentashih Toggle */}
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="pentashih-switch" className="text-sm cursor-pointer">Tunjangan Pentashih</Label>
                                                <div className="flex items-center gap-2">
                                                    {selectedGuruDetail.isPentashih && <span className="text-xs font-mono text-green-600">+ Rp {rates.pentashihSalary.toLocaleString()}</span>}
                                                    <Switch id="pentashih-switch" checked={selectedGuruDetail.isPentashih} onCheckedChange={() => toggleRole(selectedGuruDetail.id, pentashihGurus, setPentashihGurus)} />
                                                </div>
                                            </div>
                                            {/* Staff Ops Toggle */}
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="staff-ops-switch" className="text-sm cursor-pointer">Staff Operasional</Label>
                                                <div className="flex items-center gap-2">
                                                    {selectedGuruDetail.isStaffOps && <span className="text-xs font-mono text-green-600">+ Rp {rates.staffOpsSalary.toLocaleString()}</span>}
                                                    <Switch id="staff-ops-switch" checked={selectedGuruDetail.isStaffOps} onCheckedChange={() => toggleRole(selectedGuruDetail.id, staffOpsGurus, setStaffOpsGurus)} />
                                                </div>
                                            </div>
                                            {/* Bendahara Toggle */}
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="bendahara-switch" className="text-sm cursor-pointer">Bendahara</Label>
                                                <div className="flex items-center gap-2">
                                                    {selectedGuruDetail.isBendahara && <span className="text-xs font-mono text-green-600">+ Rp {rates.bendaharaSalary.toLocaleString()}</span>}
                                                    <Switch id="bendahara-switch" checked={selectedGuruDetail.isBendahara} onCheckedChange={() => toggleRole(selectedGuruDetail.id, bendaharaGurus, setBendaharaGurus)} />
                                                </div>
                                            </div>

                                            <Separator />
                                            <div className="flex justify-between items-center">
                                                <div className="text-sm">
                                                    <p className="font-medium">Badal / Pengganti</p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Input
                                                            type="number" className="h-6 w-12 text-xs p-1" placeholder="0" min="0"
                                                            value={badalInputs[selectedGuruDetail.id]?.count || ''}
                                                            onChange={(e) => handleBadalChange(selectedGuruDetail.id, 'count', e.target.value)}
                                                        />
                                                        <span className="text-xs text-muted-foreground">kali @</span>
                                                        <Select value={(badalInputs[selectedGuruDetail.id]?.rate || 35000).toString()} onValueChange={val => handleBadalChange(selectedGuruDetail.id, 'rate', val)}>
                                                            <SelectTrigger className="h-6 w-[70px] text-xs px-1"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="35000">35k</SelectItem>
                                                                <SelectItem value="17500">17.5k</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <span className="font-mono font-medium text-green-600">+ Rp {selectedGuruDetail.badalIncome.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Potongan */}
                                <div>
                                    <h4 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-3"><Wallet className="w-4 h-4"/> Potongan</h4>
                                    <div className="space-y-3 pl-2 border-l-2 border-red-100 dark:border-red-900/30">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-sm cursor-pointer" htmlFor="auto-deduction-switch">Absensi (Otomatis)</Label>
                                                    <Switch
                                                        id="auto-deduction-switch"
                                                        checked={selectedGuruDetail.isAutoEnabled}
                                                        onCheckedChange={() => toggleAutoDeduction(selectedGuruDetail.id)}
                                                        className="scale-75"
                                                    />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">Terdeteksi: {selectedGuruDetail.calculatedAbsenceCount} x Rp {rates.deductionTpQ.toLocaleString()}</span>
                                            </div>
                                            <span className={`font-mono ${selectedGuruDetail.isAutoEnabled ? 'text-red-500' : 'text-slate-400 decoration-line-through'}`}>
                                                - Rp {selectedGuruDetail.autoDeductionAmount.toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                                            <div className="flex flex-col gap-1">
                                                <Label className="text-sm">Potongan Manual</Label>
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number" className="h-6 w-14 text-xs p-1" placeholder="0" min="0"
                                                        value={manualDeductionCounts[selectedGuruDetail.id] || ''}
                                                        onChange={e => handleManualDeductionCountChange(selectedGuruDetail.id, e.target.value)}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground">kali absen (x 35k)</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-red-500">- Rp {selectedGuruDetail.manualDeductionAmount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Total */}
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 text-center">
                                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1">Total Bisyaroh Diterima</p>
                                    <p className="text-4xl font-black text-green-700 dark:text-green-400 font-mono tracking-tight">
                                        Rp {selectedGuruDetail.totalSalary.toLocaleString('id-ID')}
                                    </p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Tutup</Button>
                                <Button className="bg-green-600 hover:bg-green-700" onClick={() => { toast({ title: "Disimpan", description: "Perubahan data sementara disimpan." }); setIsDetailOpen(false); }}>
                                    <Save className="w-4 h-4 mr-2"/> Simpan
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SalaryCalculation;
