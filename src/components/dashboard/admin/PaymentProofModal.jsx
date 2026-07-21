
import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Printer, MessageSquare } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from '@/components/ui/use-toast';
import QRCode from 'qrcode';
import { supabase } from '@/lib/customSupabaseClient';
import { PAYMENT_DETAIL_SELECT, formatPaymentPeriod } from '@/lib/paymentAdapters';
import { fetchReceiptLogoDataUrl, waitForImagesToLoad } from '@/lib/publicContentAdapters';
import { DEFAULT_WHATSAPP_TEMPLATES, fetchWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsappTemplateAdapters';

const PaymentProofModal = ({ isOpen, onClose, payment }) => {
    const receiptRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingPayment, setIsLoadingPayment] = useState(false);
    const [completePayment, setCompletePayment] = useState(null);
    const [qrCodeDataURL, setQrCodeDataURL] = useState('');
    const [receiptLogoUrl, setReceiptLogoUrl] = useState('/logo-lpq-al-fath-maulana.webp');
    const [paymentMessageTemplate, setPaymentMessageTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATES.paymentReceipt);

    useEffect(() => {
        const fetchCompletePayment = async () => {
            if (!isOpen || !payment?.id) {
                setCompletePayment(null);
                return;
            }

            setIsLoadingPayment(true);
            try {
                const { data, error } = await supabase
                    .from('payments')
                    .select(PAYMENT_DETAIL_SELECT)
                    .eq('id', payment.id)
                    .maybeSingle();

                if (error) throw error;
                if (!data) throw new Error('Record pembayaran tidak ditemukan.');
                setCompletePayment(data);
            } catch (error) {
                setCompletePayment(null);
                toast({ title: 'Gagal Memuat Bukti', description: error.message, variant: 'destructive' });
            } finally {
                setIsLoadingPayment(false);
            }
        };

        fetchCompletePayment();
    }, [isOpen, payment?.id]);

    useEffect(() => {
        let active = true;
        const loadReceiptLogo = async () => {
            if (!isOpen) return;
            const logoUrl = await fetchReceiptLogoDataUrl('/logo-lpq-al-fath-maulana.webp');
            if (active) setReceiptLogoUrl(logoUrl);
        };
        loadReceiptLogo();
        return () => {
            active = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        fetchWhatsAppTemplates().then((templates) => setPaymentMessageTemplate(templates.paymentReceipt));
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && completePayment) {
            const qrCodeLoginUrl = `${window.location.origin}/login`;
            QRCode.toDataURL(qrCodeLoginUrl, { width: 120, margin: 1 }, (err, url) => {
                if (!err) setQrCodeDataURL(url);
            });
        }
    }, [isOpen, completePayment]);

    const receiptPayment = completePayment || payment;
    const amount = Number(receiptPayment?.jumlah || 0);
    const paymentDate = receiptPayment?.tanggal_pembayaran || receiptPayment?.created_at || new Date().toISOString();
    const paymentMethod = receiptPayment?.metode_pembayaran || '-';
    const transactionRef = receiptPayment?.transaction_id || receiptPayment?.id || '-';
    const studentName = receiptPayment?.santri?.nama_lengkap || 'Santri';
    const studentId = receiptPayment?.santri?.nomor_induk_qiroati || '-';
    const period = formatPaymentPeriod(receiptPayment?.bulan, receiptPayment?.tahun);
    const notes = receiptPayment?.catatan || 'Pembayaran Administrasi';

    const handleDownload = async () => {
        if (!receiptRef.current || !receiptPayment?.id) {
            toast({ title: 'Gagal', description: 'Data pembayaran belum lengkap.', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        try {
            await waitForImagesToLoad(receiptRef.current);
            const dataUrl = await toPng(receiptRef.current, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                imagePlaceholder: '/logo-lpq-al-fath-maulana.webp',
            });
            const link = document.createElement('a');
            const santriName = studentName.replace(/\s+/g, '_') || 'Santri';
            const dateStr = new Date(paymentDate).toLocaleDateString('id-ID').replace(/\//g, '-');
            link.download = `Bukti-Pembayaran-${santriName}-${dateStr}.png`;
            link.href = dataUrl;
            link.click();
            toast({ title: "Berhasil", description: "Bukti pembayaran berhasil diunduh." });
        } catch (err) {
            toast({ title: "Gagal", description: `Gagal membuat gambar bukti pembayaran: ${err?.message || 'gambar tidak dapat diproses.'}`, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendWhatsApp = () => {
        if (!receiptPayment || !receiptPayment.santri?.no_hp_ortu) {
            toast({ title: "Gagal", description: "Nomor HP Wali Santri tidak ditemukan.", variant: "destructive" });
            return;
        }

        let phoneNumber = receiptPayment.santri.no_hp_ortu.replace(/\D/g, '');
        if (phoneNumber.startsWith('0')) phoneNumber = '62' + phoneNumber.substring(1);
        else if (!phoneNumber.startsWith('62')) phoneNumber = '62' + phoneNumber;

        if (phoneNumber.length < 10) {
            toast({ title: "Gagal", description: "Format nomor HP tidak valid.", variant: "destructive" });
            return;
        }

        const formattedAmount = `Rp ${amount.toLocaleString('id-ID')}`;
        const date = new Date(paymentDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        const message = renderWhatsAppTemplate(paymentMessageTemplate, {
            nama_santri: studentName,
            nomor_induk: studentId,
            rincian: notes,
            nominal: formattedAmount,
            tanggal: date,
            periode: period,
            metode: paymentMethod,
            transaction_id: transactionRef,
            status: 'LUNAS',
            nama_lembaga: 'LPQ Al-Fath Maulana',
        });

        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        toast({ title: "Membuka WhatsApp", description: "Pesan telah disiapkan." });
    };

    if (!payment) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[480px] p-0 overflow-hidden bg-transparent border-none shadow-none">
                <DialogTitle className="sr-only">Bukti Pembayaran</DialogTitle>
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
                    <div ref={receiptRef} className="p-6 bg-white text-slate-800 relative font-sans">
                        {/* Header */}
                        <div className="text-center pb-4 mb-4 border-b border-dashed border-slate-300 relative z-10">
                            <img src={receiptLogoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain"/>
                            <h3 className="font-bold text-xl text-primary tracking-tight font-poppins">LPQ AL-FATH MAULANA</h3>
                            <p className="text-xs text-slate-500 mt-1">Alamat resmi belum diisi</p>
                            <p className="text-xs text-slate-500">Kontak resmi belum diisi</p>
                        </div>

                        {/* Watermark LUNAS */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none select-none">
                            <div className="border-4 border-red-500 text-red-500 rounded-lg px-8 py-3 text-5xl font-bold -rotate-12 opacity-15 whitespace-nowrap">
                                LUNAS
                            </div>
                        </div>

                        {/* Meta Info */}
                        <div className="flex justify-between text-xs mb-4 text-slate-600 bg-slate-50 p-3 rounded-lg relative z-10">
                            <div className="space-y-1">
                                <p>Tgl: <span className="font-semibold text-slate-900">{new Date(paymentDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                                <p>Jam: <span className="font-semibold text-slate-900">{new Date(paymentDate).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span></p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p>Metode: <span className="font-semibold text-slate-900 uppercase">{paymentMethod}</span></p>
                                <p>Ref: <span className="font-mono">{String(transactionRef).substring(0, 18)}</span></p>
                            </div>
                        </div>

                        {/* Student Info */}
                        <div className="mb-4 relative z-10">
                            <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Diterima Dari:</p>
                            <p className="text-sm font-bold text-slate-900">{studentName}</p>
                            <p className="text-xs text-slate-500 font-mono">No. Induk: {studentId}</p>
                        </div>

                        {/* Items */}
                        <div className="space-y-3 mb-6 relative z-10">
                            <div className="border-t border-slate-200 pt-3"></div>
                            <div className="flex justify-between text-sm py-1">
                                <span className="text-slate-700 flex-1 font-medium">{notes}</span>
                                <span className="font-bold text-slate-900">Rp {amount.toLocaleString('id-ID')}</span>
                            </div>
                            {period !== '-' && (
                                <div className="text-xs text-slate-500 pl-2">
                                    Tagihan: {period}
                                </div>
                            )}
                            <div className="border-t border-slate-200 pt-3"></div>
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100 mb-6 relative z-10">
                            <span className="text-sm font-bold text-green-800">TOTAL BAYAR</span>
                            <span className="text-xl font-black text-green-900">Rp {amount.toLocaleString('id-ID')}</span>
                        </div>

                        {/* Footer */}
                        <div className="text-center relative z-10 flex flex-col items-center">
                             <div className="bg-white p-1 inline-block rounded-lg shadow-sm border border-slate-100 mb-2">
                                {qrCodeDataURL && <img src={qrCodeDataURL} alt="QR Code" className="w-20 h-20"/>}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Terima Kasih</p>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/90 flex justify-center gap-2 border-t dark:border-slate-700 flex-wrap">
                        <Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>
                        <Button variant="outline" size="sm" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={handleSendWhatsApp} disabled={isLoadingPayment}>
                            <MessageSquare className="mr-2 h-4 w-4"/> Kirim WA
                        </Button>
                        <Button size="sm" onClick={handleDownload} disabled={isGenerating || isLoadingPayment || !completePayment}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            {isLoadingPayment ? 'Memuat...' : 'Simpan Bukti'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PaymentProofModal;
