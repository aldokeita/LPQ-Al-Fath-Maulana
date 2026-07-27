import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { Trash2, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { PAYMENT_DETAIL_SELECT, getPaymentErrorMessage, monthNameToNumber, monthNumberToName } from '@/lib/paymentAdapters';

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const PaymentStatusTable = () => {
  const [statusData, setStatusData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const fetchStatus = async () => {
    setIsLoading(true);
    const selectedMonthNumber = monthNameToNumber(selectedMonth);
    const { data: santri, error: santriError } = await supabase
      .from('santri')
      .select('id, nama_lengkap, current_class_id')
      .eq('status', 'Aktif')
      .order('nama_lengkap');
    if (santriError) {
      toast({ title: 'Error', description: 'Gagal mengambil data santri.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const [{ data: statusRows, error: statusError }, { data: classes, error: classError }] = await Promise.all([
      supabase
        .from('payment_status_summary')
        .select('santri_id, class_id, bulan, tahun, status')
        .eq('bulan', selectedMonthNumber)
        .eq('tahun', selectedYear),
      supabase.from('classes').select('id, nama_kelas')
    ]);
    if (statusError || classError) {
      toast({ title: 'Error', description: 'Gagal mengambil status pembayaran.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const classMap = new Map((classes || []).map(c => [c.id, c.nama_kelas]));
    const statusMap = new Map((statusRows || []).map(row => [row.santri_id, row.status]));
    const combinedData = santri.map(s => ({
      ...s,
      class_name: classMap.get(s.current_class_id) || '-',
      periode: `${selectedMonth} ${selectedYear}`,
      status: statusMap.get(s.id) === 'Lunas' ? 'Lunas' : 'Belum Lunas',
    }));

    setStatusData(combinedData);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, [selectedMonth, selectedYear]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text(`Status Pembayaran SPP - ${selectedMonth} ${selectedYear}`, 14, 16);
    autoTable(doc, {
      head: [['Nama Santri', 'Kelas', 'Periode', 'Status']],
      body: statusData.map(s => [s.nama_lengkap, s.class_name, s.periode, s.status]),
      startY: 20,
    });
    doc.save(`status-pembayaran-${selectedMonth}-${selectedYear}.pdf`);
  };

  return (
    <div className="bg-card p-6 rounded-2xl shadow-xl space-y-4 mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-accent-foreground">Status Pembayaran SPP Bulanan</h2>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={val => setSelectedYear(Number(val))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={generatePDF} disabled={isLoading}><Download className="w-4 h-4 mr-2" /> Unduh PDF</Button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Nama Santri</th>
              <th className="p-3 text-left">Kelas</th>
              <th className="p-3 text-left">Periode</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="4" className="text-center p-4">Memuat data...</td></tr>
            ) : statusData.length === 0 ? (
              <tr><td colSpan="4" className="text-center p-4">Tidak ada data santri aktif.</td></tr>
            ) : (
              statusData.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/50">
                  <td className="p-3">{s.nama_lengkap}</td>
                  <td className="p-3">{s.class_name}</td>
                  <td className="p-3">{s.periode}</td>
                  <td className={`p-3 font-bold ${s.status === 'Lunas' ? 'text-green-600' : 'text-red-600'}`}>{s.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PaymentNotes = () => {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select(PAYMENT_DETAIL_SELECT)
      .order('tanggal_pembayaran', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Gagal mengambil riwayat pembayaran.', variant: 'destructive' });
    } else {
      setPayments(data || []);
    }
    setIsLoading(false);
  };

  const handleDeletePayment = async (paymentId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Pembayaran',
      description: 'Anda yakin ingin menghapus riwayat pembayaran ini? Aksi ini tidak dapat dibatalkan.',
      onConfirm: async () => {
        const { error } = await supabase.from('payments').delete().eq('id', paymentId);
        if (error) {
          toast({ title: 'Gagal Menghapus', description: getPaymentErrorMessage(error), variant: 'destructive' });
        } else {
          toast({ title: 'Berhasil', description: 'Riwayat pembayaran telah dihapus.' });
          fetchPayments();
        }
      }
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("Riwayat Pembayaran SPP Santri", 14, 16);
    autoTable(doc, {
      head: [['Tanggal', 'Nama Santri', 'Keterangan', 'Jumlah', 'Metode']],
      body: payments.map(p => [
        new Date(p.tanggal_pembayaran).toLocaleDateString('id-ID'),
        p.santri?.nama_lengkap || 'Santri Dihapus',
        p.bulan ? `SPP ${monthNumberToName(p.bulan)} ${p.tahun}` : p.catatan || 'Lainnya',
        `Rp ${p.jumlah.toLocaleString('id-ID')}`,
        p.metode_pembayaran
      ]),
      startY: 20
    });
    doc.save('riwayat-pembayaran-spp.pdf');
  };

  return (
    <>
      <div className="bg-card p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-accent-foreground">Riwayat Pembayaran SPP Santri</h2>
          <div className="flex gap-2">
            <Button onClick={generatePDF} disabled={isLoading}><Download className="w-4 h-4 mr-2" /> Unduh PDF</Button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Nama Santri</th>
                <th className="p-3 text-left">Keterangan</th>
                <th className="p-3 text-left">Jumlah</th>
                <th className="p-3 text-left">Metode</th>
                <th className="p-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="6" className="text-center p-4">Memuat data...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-4">Belum ada riwayat pembayaran.</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{new Date(p.tanggal_pembayaran).toLocaleDateString('id-ID')}</td>
                    <td className="p-3">{p.santri?.nama_lengkap || 'Santri Dihapus'}</td>
                    <td className="p-3">{p.bulan ? `SPP ${monthNumberToName(p.bulan)} ${p.tahun}` : p.catatan || 'Lainnya'}</td>
                    <td className="p-3">Rp {p.jumlah.toLocaleString('id-ID')}</td>
                    <td className="p-3">{p.metode_pembayaran}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(p.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaymentStatusTable />
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />
    </>
  );
};

export default PaymentNotes;
