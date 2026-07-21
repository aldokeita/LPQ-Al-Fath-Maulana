import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Download, RefreshCw, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import {
    createExpense,
    expenseCategories,
    fetchCashflowSummary,
    fetchExpensesByPeriod,
    formatRupiah,
    getFinanceErrorMessage,
    getMonthOptions,
    monthNames,
    softDeleteExpense,
    updateExpense
} from '@/lib/financeAdapters';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
const monthOptions = getMonthOptions();

const emptyForm = () => ({
    tanggal_pengeluaran: new Date().toISOString().slice(0, 10),
    kategori: expenseCategories[0],
    deskripsi: '',
    jumlah: ''
});

const ExpenseManagement = () => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [cashflow, setCashflow] = useState({
        totalPemasukan: 0,
        totalPengeluaran: 0,
        saldoBersih: 0,
        paymentCount: 0,
        expenseCount: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [filter, setFilter] = useState({ year: currentYear, month: new Date().getMonth() + 1 });

    const fetchFinanceData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [expenseRows, summary] = await Promise.all([
                fetchExpensesByPeriod(filter),
                fetchCashflowSummary(filter)
            ]);
            setExpenses(expenseRows);
            setCashflow(summary);
        } catch (error) {
            toast({
                title: 'Gagal memuat data keuangan',
                description: getFinanceErrorMessage(error),
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchFinanceData();
    }, [fetchFinanceData]);

    const resetForm = () => {
        setFormData(emptyForm());
        setEditingExpense(null);
    };

    const handleAdd = () => {
        resetForm();
        setIsFormOpen(true);
    };

    const handleEdit = (expense) => {
        setEditingExpense(expense);
        setFormData({
            tanggal_pengeluaran: expense.tanggal_pengeluaran,
            kategori: expense.kategori || expenseCategories[0],
            deskripsi: expense.deskripsi || '',
            jumlah: String(expense.jumlah || '')
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus pengeluaran ini?')) return;

        try {
            await softDeleteExpense(id, user?.id);
            toast({ title: 'Berhasil', description: 'Data pengeluaran telah dihapus.' });
            fetchFinanceData();
        } catch (error) {
            toast({
                title: 'Gagal menghapus',
                description: getFinanceErrorMessage(error),
                variant: 'destructive'
            });
        }
    };

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData((prev) => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (editingExpense) {
                await updateExpense(editingExpense.id, formData, user?.id);
            } else {
                await createExpense(formData, user?.id);
            }

            toast({ title: 'Berhasil', description: 'Data pengeluaran berhasil disimpan.' });
            setIsFormOpen(false);
            resetForm();
            fetchFinanceData();
        } catch (error) {
            toast({
                title: 'Gagal menyimpan',
                description: getFinanceErrorMessage(error),
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        const dataToExport = expenses.map((expense) => ({
            Tanggal: expense.tanggal_pengeluaran,
            Kategori: expense.kategori,
            Keterangan: expense.deskripsi,
            Jumlah: Number(expense.jumlah || 0)
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pengeluaran');
        const monthLabel = filter.month === 'all' ? 'Semua' : monthNames[Number(filter.month) - 1];
        XLSX.writeFile(workbook, `Pengeluaran_${filter.year}_${monthLabel}.xlsx`);
    };

    const chartData = useMemo(() => {
        const monthlyTotals = Array(12).fill(0);
        expenses.forEach((expense) => {
            const date = new Date(`${expense.tanggal_pengeluaran}T00:00:00`);
            if (date.getFullYear() === Number(filter.year)) {
                monthlyTotals[date.getMonth()] += Number(expense.jumlah || 0);
            }
        });
        return monthNames.map((month, index) => ({
            name: month.slice(0, 3),
            Pengeluaran: monthlyTotals[index]
        }));
    }, [expenses, filter.year]);

    return (
        <div className="space-y-6">
            <div className="admin-panel-header">
                <div className="flex items-center gap-3">
                    <div className="admin-panel-header-icon">
                        <TrendingDown />
                    </div>
                    <div className="admin-panel-header-text">
                        <h2>Manajemen Pengeluaran</h2>
                        <p>Kelola pengeluaran dan pantau arus kas sederhana.</p>
                    </div>
                </div>
                <div className="admin-panel-header-actions">
                    <div className="admin-action-cluster">
                        <button onClick={fetchFinanceData} className="admin-action-cluster-btn" disabled={isLoading}>
                            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
                        </button>
                        <button onClick={handleExport} className="admin-action-cluster-btn" disabled={expenses.length === 0}>
                            <Download className="w-3.5 h-3.5" /> Export
                        </button>
                    </div>
                    <button onClick={handleAdd} className="admin-panel-primary-btn">
                        <Plus className="w-4 h-4" /> Tambah Pengeluaran
                    </button>
                </div>
            </div>

            <div className="admin-filter-bar">
                <Select value={String(filter.year)} onValueChange={(value) => setFilter((prev) => ({ ...prev, year: Number(value) }))}>
                    <SelectTrigger className="w-full md:w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(filter.month)} onValueChange={(value) => setFilter((prev) => ({ ...prev, month: value === 'all' ? 'all' : Number(value) }))}>
                    <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Bulan</SelectItem>
                        {monthOptions.map((month) => <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="admin-stat-card admin-stat-card--accent">
                    <p className="admin-stat-card-label">Pemasukan</p>
                    <p className="admin-stat-card-value">{formatRupiah(cashflow.totalPemasukan)}</p>
                    <p className="text-xs mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>{cashflow.paymentCount} pembayaran aktif</p>
                </div>
                <div className="admin-stat-card" style={{ borderColor: 'hsl(0 84% 60% / 0.2)', backgroundColor: 'hsl(0 84% 60% / 0.04)' }}>
                    <p className="admin-stat-card-label">Pengeluaran</p>
                    <p className="admin-stat-card-value">{formatRupiah(cashflow.totalPengeluaran)}</p>
                    <p className="text-xs mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>{cashflow.expenseCount} pengeluaran aktif</p>
                </div>
                <div className="admin-stat-card admin-stat-card--amber">
                    <p className="admin-stat-card-label">Saldo Bersih</p>
                    <p className="admin-stat-card-value">{formatRupiah(cashflow.saldoBersih)}</p>
                    <p className="text-xs mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>Pemasukan dikurangi pengeluaran</p>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => `Rp${(value / 1000).toLocaleString('id-ID')}k`} />
                        <Tooltip formatter={(value) => formatRupiah(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="Pengeluaran" stroke="#ef4444" activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="admin-table-shell">
                <div className="admin-table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Kategori</th>
                                <th>Keterangan</th>
                                <th>Jumlah</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">Memuat data pengeluaran...</td></tr>
                            ) : expenses.length === 0 ? (
                                <tr><td colSpan="5">
                                    <div className="admin-table-empty">
                                        <TrendingDown />
                                        <p>Belum ada pengeluaran pada periode ini.</p>
                                    </div>
                                </td></tr>
                            ) : expenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td>{expense.tanggal_pengeluaran}</td>
                                    <td>{expense.kategori}</td>
                                    <td className="font-medium">{expense.deskripsi}</td>
                                    <td>{formatRupiah(expense.jumlah)}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(expense)} aria-label="Edit pengeluaran">
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(expense.id)} aria-label="Hapus pengeluaran">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran Baru'}</DialogTitle>
                        <DialogDescription>Isi detail pengeluaran. Semua nominal hanya dapat diakses admin.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="tanggal_pengeluaran">Tanggal</label>
                                <Input id="tanggal_pengeluaran" type="date" value={formData.tanggal_pengeluaran} onChange={handleInputChange} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="kategori">Kategori</label>
                                <Select value={formData.kategori} onValueChange={(value) => setFormData((prev) => ({ ...prev, kategori: value }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{expenseCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" htmlFor="deskripsi">Keterangan</label>
                            <Textarea id="deskripsi" value={formData.deskripsi} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" htmlFor="jumlah">Jumlah (Rp)</label>
                            <Input id="jumlah" type="number" min="1" step="1" value={formData.jumlah} onChange={handleInputChange} required />
                        </div>
                        <DialogFooter><Button type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ExpenseManagement;
