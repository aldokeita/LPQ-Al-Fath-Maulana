
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Trash2, Search, AlertTriangle, Edit, FileText, Download, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EditPaymentModal from './EditPaymentModal';
import PaymentProofModal from './PaymentProofModal';
import { AnimatePresence, motion } from 'framer-motion';
import { PAYMENT_DETAIL_SELECT, getPaymentErrorMessage, monthNumberToName } from '@/lib/paymentAdapters';
import DataPagination from '@/components/dashboard/shared/DataPagination';
import { loadXlsx } from '@/lib/xlsxLoader';

const PAGE_SIZE = 50;
const BACKUP_PAGE_SIZE = 1000;
const PAYMENT_DETAIL_INNER_SELECT = PAYMENT_DETAIL_SELECT.replace('santri:santri_id(', 'santri:santri_id!inner(');

const DeleteConfirmationDialog = ({ open, onOpenChange, onConfirm, count }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5"/> Konfirmasi Hapus
                </DialogTitle>
                <DialogDescription>
                    Anda akan menghapus <strong>{count}</strong> riwayat pembayaran. Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin?
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>Ya, Hapus Permanen</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

const PaymentHistory = () => {
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPayments, setTotalPayments] = useState(0);
    const [selectedPayments, setSelectedPayments] = useState(new Set());
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [filter, setFilter] = useState({ year: 'all', month: 'all' });

    // Edit Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);

    // Proof Modal State
    const [proofModalOpen, setProofModalOpen] = useState(false);
    const [viewingProofPayment, setViewingProofPayment] = useState(null);

    const years = [2027, 2026, 2025, 2024, 2023, 2022];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const fetchPayments = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const from = (currentPage - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const normalizedSearch = debouncedSearch.replace(/[%_,().]/g, ' ').trim();
            let query = supabase
                .from('payments')
                .select(normalizedSearch ? PAYMENT_DETAIL_INNER_SELECT : PAYMENT_DETAIL_SELECT, { count: 'exact' })
                .order('created_at', { ascending: false });

            if (normalizedSearch) query = query.ilike('santri.nama_lengkap', `%${normalizedSearch}%`);
            if (filter.year !== 'all') query = query.eq('tahun', filter.year);
            if (filter.month !== 'all') query = query.eq('bulan', filter.month + 1);

            const { data, count, error: queryError } = await query.range(from, to);

            if (queryError) {
                setError(queryError.message);
                toast({ title: 'Query Error', description: queryError.message, variant: 'destructive' });
                setPayments([]);
                return;
            }

            setPayments(data || []);
            setTotalPayments(count || 0);

            const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
            if (currentPage > totalPages) setCurrentPage(totalPages);

        } catch (err) {
            setError(err.message);
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
            setPayments([]);
            setTotalPayments(0);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, debouncedSearch, filter.month, filter.year]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedPayments(new Set());
    }, [debouncedSearch, filter.month, filter.year]);

    const handleEditClick = (payment) => {
        setEditingPayment(payment);
        setEditModalOpen(true);
    };

    const handleProofClick = (payment) => {
        setViewingProofPayment(payment);
        setProofModalOpen(true);
    };

    const onPaymentUpdated = () => {
        fetchPayments();
    };

    const confirmDelete = () => {
        if (selectedPayments.size === 0) return;
        setDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        const idsToDelete = Array.from(selectedPayments);
        const { error } = await supabase.from('payments').delete().in('id', idsToDelete);
        if (error) {
            toast({ title: 'Gagal Menghapus', description: getPaymentErrorMessage(error), variant: 'destructive' });
        } else {
            toast({ title: 'Berhasil', description: `${selectedPayments.size} riwayat pembayaran telah dihapus.` });
            setSelectedPayments(new Set());
            fetchPayments();
        }
    };

    const handleSelect = (id) => {
        const newSelection = new Set(selectedPayments);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedPayments(newSelection);
    };

    const handleSelectAll = (isChecked) => {
        if (isChecked) {
            setSelectedPayments(new Set(payments.map(p => p.id)));
        } else {
            setSelectedPayments(new Set());
        }
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const XLSX = await loadXlsx();
            const allPayments = [];
            let page = 0;

            while (true) {
                const from = page * BACKUP_PAGE_SIZE;
                const to = from + BACKUP_PAGE_SIZE - 1;
                const { data, error: backupError } = await supabase
                    .from('payments')
                    .select(PAYMENT_DETAIL_SELECT)
                    .order('created_at', { ascending: true })
                    .range(from, to);

                if (backupError) throw backupError;
                allPayments.push(...(data || []));
                if (!data || data.length < BACKUP_PAGE_SIZE) break;
                page += 1;
            }

            if (allPayments.length === 0) {
                toast({ title: 'Backup kosong', description: 'Belum ada riwayat pembayaran untuk dicadangkan.' });
                return;
            }

            const exportRows = allPayments.map((payment, index) => ({
                No: index + 1,
                ID_Pembayaran: payment.id,
                ID_Santri: payment.santri_id,
                Nomor_Induk_Qiroati: payment.santri?.nomor_induk_qiroati || '',
                Nama_Santri: payment.santri?.nama_lengkap || 'Santri Dihapus',
                Kategori: payment.santri?.kategori || '',
                Bulan_Tagihan: payment.bulan ? monthNumberToName(payment.bulan) : '',
                Nomor_Bulan: payment.bulan || '',
                Tahun_Tagihan: payment.tahun || '',
                Jumlah: Number(payment.jumlah || 0),
                Tanggal_Pembayaran: payment.tanggal_pembayaran || '',
                Metode_Pembayaran: payment.metode_pembayaran || '',
                Status: payment.status || '',
                Catatan: payment.catatan || '',
                ID_Transaksi: payment.transaction_id || '',
                Dibuat_Pada: payment.created_at || '',
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportRows);
            worksheet['!cols'] = [
                { wch: 6 }, { wch: 38 }, { wch: 38 }, { wch: 22 }, { wch: 28 }, { wch: 14 },
                { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
                { wch: 12 }, { wch: 40 }, { wch: 38 }, { wch: 24 },
            ];
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Pembayaran');
            const dateStamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `Backup_Riwayat_Pembayaran_${dateStamp}.xlsx`);

            toast({
                title: 'Backup berhasil',
                description: `${allPayments.length.toLocaleString('id-ID')} riwayat pembayaran telah diunduh dalam format Excel.`,
            });
        } catch (backupError) {
            toast({
                title: 'Backup gagal',
                description: getPaymentErrorMessage(backupError),
                variant: 'destructive',
            });
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="admin-panel-header">
                <div className="flex items-center gap-3">
                    <div className="admin-panel-header-icon"><FileText /></div>
                    <div className="admin-panel-header-text">
                        <h2>Riwayat Pembayaran Santri</h2>
                        <p>Total {totalPayments.toLocaleString('id-ID')} riwayat pembayaran</p>
                    </div>
                </div>
                <div className="admin-panel-header-actions">
                    <Button type="button" variant="outline" onClick={handleBackup} disabled={isBackingUp}>
                        {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {isBackingUp ? 'Menyiapkan Backup...' : 'Backup Excel'}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-4 shadow-xl">
                    <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                        <AlertTriangle className="w-5 h-5" /> Terjadi Kesalahan
                    </div>
                    <p className="text-red-700">{error}</p>
                    <Button onClick={fetchPayments} variant="outline" className="mt-4">Coba Lagi</Button>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-end md:items-center gap-4">
                <div className="flex gap-2">
                    {selectedPayments.size > 0 && (
                        <Button variant="destructive" onClick={confirmDelete}>
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus ({selectedPayments.size})
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input placeholder="Cari nama santri..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-sm font-medium whitespace-nowrap hidden md:inline">Filter Tagihan:</span>
                    <Select value={filter.year.toString()} onValueChange={(val) => setFilter(f => ({ ...f, year: val === 'all' ? 'all' : Number(val) }))}>
                        <SelectTrigger className="w-full md:w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Tahun</SelectItem>
                            {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filter.month.toString()} onValueChange={(val) => setFilter(f => ({ ...f, month: val === 'all' ? 'all' : Number(val) }))}>
                        <SelectTrigger className="w-full md:w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Bulan</SelectItem>
                            {months.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="admin-table-shell">
                <div className="admin-table-scroll" style={{maxHeight:"60vh"}}><table>
                    <thead>
                        <tr>
                            <th className="p-3 text-left w-12">
                                <Checkbox
                                    checked={selectedPayments.size === payments.length && payments.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </th>
                            <th className="p-3 text-left">Nama Santri</th>
                            <th className="p-3 text-left">Keterangan</th>
                            <th className="p-3 text-left">Bulan Tagihan</th>
                            <th className="p-3 text-left">Tahun Tagihan</th>
                            <th className="p-3 text-left">Jumlah</th>
                            <th className="p-3 text-left">Tanggal Bayar</th>
                            <th className="p-3 text-left">Metode</th>
                            <th className="p-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        <AnimatePresence>
                            {isLoading ? (
                                <tr><td colSpan="9" className="text-center p-4 text-muted-foreground">Memuat data...</td></tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center p-8 text-muted-foreground bg-gray-50/50">
                                        <p className="text-gray-600">Tidak ada riwayat pembayaran yang ditemukan.</p>
                                    </td>
                                </tr>
                            ) : (
                                payments.map((p) => (
                                    <motion.tr
                                        key={p.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="border-b last:border-b-0 hover:bg-muted/50"
                                    >
                                        <td className="p-3">
                                            <Checkbox
                                                checked={selectedPayments.has(p.id)}
                                                onCheckedChange={() => handleSelect(p.id)}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="font-medium">{p.santri?.nama_lengkap || 'Santri Dihapus'}</div>
                                            {p.santri?.nomor_induk_qiroati && (
                                                <div className="text-[10px] text-muted-foreground">{p.santri.nomor_induk_qiroati}</div>
                                            )}
                                        </td>
                                        <td className="p-3 max-w-xs truncate" title={p.catatan}>{p.catatan || 'Lainnya'}</td>
                                        <td className="p-3">
                                            {p.bulan ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{monthNumberToName(p.bulan)}</span> : '-'}
                                        </td>
                                        <td className="p-3 font-mono">{p.tahun || '-'}</td>
                                        <td className="p-3 font-semibold">Rp {(p.jumlah || 0).toLocaleString('id-ID')}</td>
                                        <td className="p-3">{p.tanggal_pembayaran ? new Date(p.tanggal_pembayaran).toLocaleDateString('id-ID') : '-'}</td>
                                        <td className="p-3">{p.metode_pembayaran || '-'}</td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full"
                                                    onClick={() => handleEditClick(p)}
                                                    title="Edit Pembayaran"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full"
                                                    onClick={() => handleProofClick(p)}
                                                    title="Lihat Bukti"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </AnimatePresence>
                    </tbody>
                    </table>
                </div>
                <DataPagination
                    currentPage={currentPage}
                    totalItems={totalPayments}
                    pageSize={PAGE_SIZE}
                    onPageChange={(page) => {
                        setCurrentPage(page);
                        setSelectedPayments(new Set());
                    }}
                    itemLabel="pembayaran"
                />
            </div>

            <DeleteConfirmationDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                onConfirm={handleDelete}
                count={selectedPayments.size}
            />

            <EditPaymentModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                payment={editingPayment}
                onUpdate={onPaymentUpdated}
            />

            <PaymentProofModal
                isOpen={proofModalOpen}
                onClose={() => setProofModalOpen(false)}
                payment={viewingProofPayment}
            />
        </div>
    );
};

export default PaymentHistory;
