
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  CreditCard,
  User,
  FileText,
  Hash,
  Download,
  Check,
  X,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { calculateAttendanceData, getHafalanProgressData, getPointsData } from '@/utils/reportUtils';

const PaymentStatusPage = () => {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [relatedPayments, setRelatedPayments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const receiptRef = useRef(null);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');

  // Report Card Data States
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [hafalanData, setHafalanData] = useState(null);
  const [santriPoints, setSantriPoints] = useState(0);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const { data: payment, error } = await supabase
          .from('payments')
          .select('*, santri:santri_id(*, class:classes!santri_current_class_id_fkey(nama_kelas, id_guru, guru:id_guru(nama)))')
          .eq('id', paymentId)
          .single();

        if (error) throw error;
        setPaymentData(payment);

        if (payment.transaction_id) {
          const { data: siblings, error: sibError } = await supabase
            .from('payments')
            .select('*')
            .eq('transaction_id', payment.transaction_id);
          if (!sibError && siblings) setRelatedPayments(siblings);
          else setRelatedPayments([payment]);
        } else {
            setRelatedPayments([payment]);
        }

        if (payment.santri_id) {
            // Fetch comprehensive report data
            const date = new Date();
            const start = new Date(date.getFullYear(), 0, 1).toISOString().split('T')[0]; // Year start
            const end = new Date(date.getFullYear(), 11, 31).toISOString().split('T')[0]; // Year end

            const attendance = await calculateAttendanceData(payment.santri_id, start, end);
            setAttendanceSummary(attendance);

            const hafalan = await getHafalanProgressData(payment.santri_id);
            setHafalanData(hafalan);

            const points = await getPointsData(payment.santri_id, start, end);
            setSantriPoints(points.totalPoints);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        toast({ title: 'Gagal memuat data', description: 'Data tidak ditemukan atau terjadi kesalahan.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    if (paymentId) fetchAllData();
  }, [paymentId]);

  useEffect(() => {
    if (paymentData) {
        const qrCodeVerificationUrl = `${window.location.origin}/verify/${paymentData.id}`;
        QRCode.toDataURL(qrCodeVerificationUrl, { width: 120, margin: 1 }, (err, url) => {
            if (!err) setQrCodeDataURL(url);
        });
    }
  }, [paymentData]);

  const saveReportCard = async () => {
    if (!paymentData || !receiptRef.current) return;
    setIsSaving(true);

    try {
      toast({ title: "Memproses...", description: "Sedang membuat dokumen resmi." });

      const dataUrl = await toPng(receiptRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 });

      const link = document.createElement('a');
      const santriName = paymentData.santri ? paymentData.santri.nama_lengkap.replace(/\s+/g, '_') : 'Santri';
      const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
      link.download = `Rapor_BuktiBayar_${santriName}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();

      toast({ title: "Berhasil!", description: "Dokumen resmi berhasil diunduh." });

    } catch (err) {
      console.error("Error generating image:", err);
      toast({ title: "Gagal Menyimpan", description: "Terjadi kesalahan saat menyimpan dokumen.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Memuat data santri dan pembayaran...</p>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
        <Card className="w-full max-w-md text-center p-6">
            <div className="flex justify-center mb-4"><FileText className="h-16 w-16 text-gray-300" /></div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Data Tidak Ditemukan</h2>
            <p className="text-gray-500 mb-6">Maaf, data yang Anda cari tidak ditemukan atau Anda tidak memiliki akses.</p>
            <Button onClick={() => navigate(-1)} variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/> Kembali</Button>
        </Card>
      </div>
    );
  }

  const totalAmount = relatedPayments.reduce((sum, p) => sum + p.jumlah, 0);
  const teacherName = paymentData.santri?.class?.guru?.nama || 'Ustadz/Ustadzah';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 flex justify-center relative overflow-hidden">

      <div className="w-full max-w-4xl space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border">
             <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2"/> Kembali</Button>
             <Button onClick={saveReportCard} disabled={isSaving} className="bg-primary shadow-md">
                 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Download className="w-4 h-4 mr-2"/>} Unduh Rapor & Kwitansi
             </Button>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 print-break-inside-avoid relative" ref={receiptRef} style={{ width: '100%', maxWidth: '210mm', margin: '0 auto', backgroundColor: '#fff', color: '#1e293b' }}>
              {/* HEADER SECTION (Dual Logos) */}
              <div className="px-10 pt-10 pb-6 border-b-4 border-primary/20 relative">
                  <div className="flex justify-between items-center">
                      <img src="/logo-lpq-al-fath-maulana.webp" alt="Logo LPQ Al-Fath Maulana" className="w-20 h-20 object-contain"/>
                      <div className="text-center flex-1 px-4">
                          <h1 className="text-2xl font-black text-slate-900 font-serif uppercase tracking-widest">LPQ Al-Fath Maulana</h1>
                          <h2 className="text-lg font-bold text-primary tracking-wide">Lembaga Pendidikan Al-Qur'an</h2>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                              Alamat resmi belum diisi<br/>
                              Kontak dan domain resmi belum diisi
                          </p>
                      </div>
                      <div className="w-20 h-20 flex items-center justify-center border-2 border-slate-200 rounded-full bg-slate-50 text-[10px] font-bold text-center text-slate-400">
                          <span className="font-serif">METODE<br/>QIROATI</span>
                      </div>
                  </div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white px-4">
                      <span className="text-sm font-bold bg-primary text-white px-4 py-1 rounded-full shadow-sm tracking-widest uppercase">
                          Laporan Akademik & Administrasi
                      </span>
                  </div>
              </div>

              <div className="p-10 space-y-8">
                  {/* SANTRI INFO */}
                  <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                          <table className="w-full">
                              <tbody>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Nama Lengkap</td><td className="font-bold text-slate-900 pb-1">: {paymentData.santri?.nama_lengkap}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Jilid Saat Ini</td><td className="font-bold text-slate-900 pb-1">: {paymentData.santri?.jilid || '-'}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium">Kelas / Sesi</td><td className="font-bold text-slate-900">: {paymentData.santri?.class?.nama_kelas || '-'} / {paymentData.santri?.sesi_mengaji || '-'}</td></tr>
                              </tbody>
                          </table>
                      </div>
                      <div>
                          <table className="w-full">
                              <tbody>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Guru Pengampu</td><td className="font-bold text-slate-900 pb-1">: {teacherName}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Wali Santri</td><td className="font-bold text-slate-900 pb-1">: {paymentData.santri?.nama_ayah || paymentData.santri?.nama_ibu || '-'}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium">Dicetak Tanggal</td><td className="font-bold text-slate-900">: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* ACADEMIC SECTION */}
                  <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                          <BookOpen className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-bold text-slate-800">Progres Akademik (Tahun Ini)</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                          {/* Attendance */}
                          <div>
                              <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-400" /> Ringkasan Kehadiran
                              </h4>
                              {attendanceSummary ? (
                                  <div className="bg-white border rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                          <tbody className="divide-y divide-slate-100">
                                              <tr className="bg-slate-50"><td className="px-3 py-2 font-medium">Total Hadir</td><td className="px-3 py-2 text-right font-bold text-emerald-600">{attendanceSummary.totalPresent} Hari</td></tr>
                                              <tr><td className="px-3 py-2 font-medium">Terlambat</td><td className="px-3 py-2 text-right font-bold text-amber-600">{attendanceSummary.totalLate} Hari</td></tr>
                                              <tr className="bg-slate-50"><td className="px-3 py-2 font-medium">Izin / Sakit</td><td className="px-3 py-2 text-right font-bold text-blue-600">{attendanceSummary.totalPermit} Hari</td></tr>
                                              <tr><td className="px-3 py-2 font-medium">Alpha</td><td className="px-3 py-2 text-right font-bold text-red-600">{attendanceSummary.totalAbsent} Hari</td></tr>
                                              <tr className="bg-primary/5"><td className="px-3 py-2 font-bold text-primary">Persentase</td><td className="px-3 py-2 text-right font-black text-primary text-lg">{attendanceSummary.attendancePercentage}%</td></tr>
                                          </tbody>
                                      </table>
                                  </div>
                              ) : <div className="text-sm text-slate-500 italic">Data kehadiran tidak tersedia.</div>}
                          </div>

                          {/* Hafalan Progress */}
                          <div>
                              <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                                  <Star className="w-4 h-4 text-slate-400" /> Status Hafalan
                              </h4>
                              {hafalanData ? (
                                  <div className="bg-white border rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                          <thead className="bg-slate-50 text-slate-500">
                                              <tr><th className="px-3 py-2 text-left font-semibold">Kategori</th><th className="px-3 py-2 text-right font-semibold">Progres</th></tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              <tr><td className="px-3 py-2 font-medium">Surat Pendek</td><td className="px-3 py-2 text-right font-bold">{hafalanData.surat.completed} / {hafalanData.surat.total}</td></tr>
                                              <tr className="bg-slate-50"><td className="px-3 py-2 font-medium">Doa Harian</td><td className="px-3 py-2 text-right font-bold">{hafalanData.doa.completed} / {hafalanData.doa.total}</td></tr>
                                              <tr><td className="px-3 py-2 font-medium">Bacaan Sholat</td><td className="px-3 py-2 text-right font-bold">{hafalanData.sholat.completed} / {hafalanData.sholat.total}</td></tr>
                                              <tr className="bg-emerald-50"><td className="px-3 py-2 font-bold text-emerald-700">Pencapaian</td><td className="px-3 py-2 text-right font-black text-emerald-700 text-lg">{hafalanData.overallProgress}%</td></tr>
                                          </tbody>
                                      </table>
                                  </div>
                              ) : <div className="text-sm text-slate-500 italic">Data hafalan tidak tersedia.</div>}
                          </div>
                      </div>
                  </div>

                  {/* FINANCIAL SECTION */}
                  <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                          <CreditCard className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-bold text-slate-800">Kwitansi Pembayaran Resmi</h3>
                      </div>

                      <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden relative">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
                              <div className="border-8 border-green-500 text-green-500 rounded-xl px-8 py-3 text-5xl font-black -rotate-12 opacity-10 whitespace-nowrap">
                                  L U N A S
                              </div>
                          </div>

                          <div className="flex justify-between items-center p-4 bg-slate-50 border-b">
                              <div>
                                  <p className="text-xs text-slate-500 font-medium">Tanggal Transaksi</p>
                                  <p className="font-bold text-slate-900">{new Date(paymentData.tanggal_pembayaran).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-xs text-slate-500 font-medium">Metode & No. Transaksi</p>
                                  <p className="font-mono text-sm font-bold text-slate-900">{paymentData.metode_pembayaran?.toUpperCase()} - {paymentData.transaction_id ? paymentData.transaction_id.substring(0,8) : 'MANUAL'}</p>
                              </div>
                          </div>

                          <div className="p-4 relative z-10">
                              <table className="w-full text-sm">
                                  <thead className="border-b-2 border-slate-200 text-slate-500">
                                      <tr><th className="py-2 text-left">Deskripsi Pembayaran</th><th className="py-2 text-right">Jumlah</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {relatedPayments.map((item, idx) => (
                                          <tr key={idx}>
                                              <td className="py-3 font-medium text-slate-800">
                                                  {item.catatan || 'Pembayaran Administrasi'}
                                                  {item.bulan && item.tahun && <span className="block text-xs text-slate-500 font-normal">Periode: {item.bulan} {item.tahun}</span>}
                                              </td>
                                              <td className="py-3 text-right font-bold text-slate-900">Rp {item.jumlah.toLocaleString('id-ID')}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot>
                                      <tr className="bg-primary/5">
                                          <td className="py-4 px-3 font-bold text-primary text-base">TOTAL DIBAYARKAN</td>
                                          <td className="py-4 px-3 text-right font-black text-primary text-xl">Rp {totalAmount.toLocaleString('id-ID')}</td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>
                  </div>

                  {/* SIGNATURE SECTION */}
                  <div className="pt-8 flex justify-between items-end">
                      <div className="flex flex-col items-center">
                          {qrCodeDataURL && <img src={qrCodeDataURL} alt="QR Code Verification" className="w-24 h-24 border p-1 rounded-lg shadow-sm" />}
                          <p className="text-[10px] text-slate-500 mt-2 font-mono flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Dokumen Tervalidasi</p>
                      </div>

                      <div className="text-center">
                          <p className="text-sm text-slate-800 mb-16">[Kota belum diisi], {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          <p className="font-bold text-slate-900 border-b border-slate-900 pb-1 px-4">{teacherName}</p>
                          <p className="text-xs text-slate-500 mt-1">Guru Kelas / Administrasi</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

function Star(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}

export default PaymentStatusPage;
