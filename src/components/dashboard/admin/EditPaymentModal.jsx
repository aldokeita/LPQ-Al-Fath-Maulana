import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, AlertTriangle } from 'lucide-react';
import { MONTH_NAMES, getPaymentErrorMessage, monthNameToNumber, validatePaymentAmount } from '@/lib/paymentAdapters';

const monthsList = MONTH_NAMES;

const ConfirmationDialog = ({ open, onOpenChange, onConfirm, details }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="w-5 h-5"/> Konfirmasi Perubahan
                </DialogTitle>
                <DialogDescription>
                    Anda akan mengubah data pembayaran berikut:
                    <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                        <li>Jumlah: <strong>Rp {details?.jumlah?.toLocaleString('id-ID')}</strong></li>
                        <li>Tanggal: <strong>{details?.tanggal_pembayaran}</strong></li>
                        <li>Metode: <strong>{details?.metode_pembayaran}</strong></li>
                    </ul>
                    Apakah Anda yakin ingin menyimpan perubahan ini?
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                <Button onClick={() => { onConfirm(); onOpenChange(false); }}>Ya, Simpan</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

const EditPaymentModal = ({ isOpen, onClose, payment, onUpdate }) => {
    const [formData, setFormData] = useState({
        jumlah: 0,
        tanggal_pembayaran: '',
        metode_pembayaran: 'Tunai',
        bulan: '',
        catatan: '',
        tahun: new Date().getFullYear()
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (payment) {
            setFormData({
                jumlah: payment.jumlah || 0,
                tanggal_pembayaran: payment.tanggal_pembayaran ? new Date(payment.tanggal_pembayaran).toISOString().split('T')[0] : '',
                metode_pembayaran: payment.metode_pembayaran || 'Tunai',
                bulan: payment.bulan || '',
                catatan: payment.catatan || '',
                tahun: payment.tahun || new Date().getFullYear()
            });
        }
    }, [payment]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const validateForm = () => {
        if (!validatePaymentAmount(formData.jumlah) || Number(formData.jumlah) <= 0) {
            toast({ title: "Validasi Gagal", description: "Jumlah pembayaran harus lebih dari 0.", variant: "destructive" });
            return false;
        }
        if (!formData.tanggal_pembayaran) {
            toast({ title: "Validasi Gagal", description: "Tanggal pembayaran wajib diisi.", variant: "destructive" });
            return false;
        }
        if (!formData.metode_pembayaran) {
             toast({ title: "Validasi Gagal", description: "Metode pembayaran wajib dipilih.", variant: "destructive" });
             return false;
        }
        return true;
    };

    const handleSubmit = () => {
        if (!validateForm()) return;
        setConfirmOpen(true);
    };

    const handleConfirmUpdate = async () => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('payments')
                .update({
                    jumlah: formData.jumlah,
                    tanggal_pembayaran: formData.tanggal_pembayaran,
                    metode_pembayaran: formData.metode_pembayaran,
                    bulan: monthNameToNumber(formData.bulan),
                    catatan: formData.catatan,
                    tahun: Number(formData.tahun),
                    status: 'paid',
                })
                .eq('id', payment.id);

            if (error) throw error;

            toast({ title: "Berhasil", description: "Data pembayaran berhasil diperbarui." });
            onUpdate(); // Trigger refresh in parent
            onClose();
        } catch (error) {
            toast({ title: "Gagal", description: getPaymentErrorMessage(error), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!payment) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Pembayaran</DialogTitle>
                        <DialogDescription>Perbarui detail pembayaran untuk santri.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">ID Transaksi</Label>
                                <Input value={payment.transaction_id || payment.id} disabled className="bg-muted font-mono text-xs" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Nama Santri</Label>
                                <Input value={payment.santri?.nama_lengkap || '-'} disabled className="bg-muted" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tanggal Pembayaran</Label>
                                <Input
                                    type="date"
                                    value={formData.tanggal_pembayaran}
                                    onChange={(e) => handleChange('tanggal_pembayaran', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Jumlah (Rp)</Label>
                                <Input
                                    type="number"
                                    value={formData.jumlah}
                                    onChange={(e) => handleChange('jumlah', parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Bulan Tagihan</Label>
                                <Select value={formData.bulan ? String(formData.bulan) : 'none'} onValueChange={(val) => handleChange('bulan', val === 'none' ? null : Number(val))}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Bulan" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Tidak Ada</SelectItem>
                                        {monthsList.map((m, index) => <SelectItem key={m} value={String(index + 1)}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div>
                                <Label>Tahun Tagihan</Label>
                                <Input
                                    type="number"
                                    value={formData.tahun}
                                    onChange={(e) => handleChange('tahun', parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                             <div>
                                <Label>Metode Pembayaran</Label>
                                <Select value={formData.metode_pembayaran} onValueChange={(val) => handleChange('metode_pembayaran', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Tunai">Tunai</SelectItem>
                                        <SelectItem value="Transfer">Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Catatan</Label>
                            <Textarea
                                value={formData.catatan}
                                onChange={(e) => handleChange('catatan', e.target.value)}
                                className="min-h-[80px]"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={handleConfirmUpdate}
                details={formData}
            />
        </>
    );
};

export default EditPaymentModal;
