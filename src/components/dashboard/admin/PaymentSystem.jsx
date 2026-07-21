
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import { Search, Printer, Book, Wallet, Shirt, WalletCards as IdCard, BookOpen, X, Trash2, Briefcase, MessageSquare, ScanLine, Edit, Users, Check, Banknote, Loader2, AlertTriangle, Building, RotateCcw, Plus, Minus, ShoppingCart, Download, FileText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toPng } from 'html-to-image';
import {
  MONTH_NAMES,
  PAYMENT_HISTORY_SELECT,
  formatSantriCategory,
  getPaymentErrorMessage,
  getSharedDefaultSppAmount,
  monthNameToNumber,
  monthNumberToName,
  selectedMonthToNumber,
  validatePaymentAmount,
} from '@/lib/paymentAdapters';
import { fetchReceiptLogoDataUrl, waitForImagesToLoad } from '@/lib/publicContentAdapters';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import PaymentProofModal from './PaymentProofModal';
import { fetchWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsappTemplateAdapters';
import { OFFICIAL_CONTACT } from '@/lib/institutionContent';

const paymentItems = [
  { name: 'SPP Bulanan', amount: 0, monthly: true, icon: Wallet, custom: 'spp_dropdown' },
  { name: 'Sarpras', amount: 115000, monthly: false, icon: Building },
  { name: 'Seragam', amount: 175000, monthly: false, icon: Shirt },
  { name: 'Tas Santri', amount: 75000, monthly: false, icon: Briefcase },
  { name: 'ID Card Santri', amount: 25000, monthly: false, icon: IdCard },
  { name: 'Buku Prestasi', amount: 10000, monthly: false, icon: BookOpen },
  { name: 'Buku Jilid Pra TK', amount: 27500, monthly: false, icon: Book },
  { name: 'Buku Jilid 1-6', amount: 25000, monthly: false, hasSubtypes: true, icon: Book },
  { name: 'Buku Gharib & Tajwid', amount: 25000, monthly: false, icon: Book },
  { name: 'Custom', amount: 0, monthly: false, icon: Edit, custom: 'item' },
];
const bookVolumes = ['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6'];
const monthsList = MONTH_NAMES;
const sppOptions = [50000, 70000, 100000, 120000, 150000];

const SantriSelectorModal = ({ santriList, onSelect, open, onOpenChange, selectedSantriIds }) => {
  const [search, setSearch] = useState('');
  const sortedSantri = [...santriList].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
  const filteredSantri = sortedSantri.filter(s => s.nama_lengkap.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Pilih Santri</DialogTitle><DialogDescription>Cari dan klik pada santri untuk memilih. Anda bisa memilih lebih dari satu.</DialogDescription></DialogHeader>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Cari nama santri..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <div className="flex-grow overflow-y-auto p-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {filteredSantri.map(santri => (
              <div key={santri.id} onClick={() => onSelect(santri)} className={`relative flex flex-col items-center text-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-2 ${selectedSantriIds.has(santri.id) ? 'border-primary' : 'border-transparent'}`}>
                {selectedSantriIds.has(santri.id) && <div className="absolute top-1 right-1 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center"><Check className="w-3 h-3"/></div>}
                <Avatar className="w-20 h-20 mb-2"><AvatarImage src={santri.foto_url} /><AvatarFallback>{santri.nama_lengkap.charAt(0)}</AvatarFallback></Avatar>
                <p className="text-sm font-medium leading-tight">{santri.nama_lengkap}</p>
                <Badge variant={santri.kategori === 'Dewasa' ? 'secondary' : 'outline'} className="mt-1 text-[10px]">
                    {formatSantriCategory(santri.kategori)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MonthSelectorDialog = ({ open, onOpenChange, item, onConfirm, initialYear, initialMonths, resetKey, selectedSantri }) => {
    const [selectedYear, setSelectedYear] = useState(initialYear || new Date().getFullYear());
    const [selectedMonths, setSelectedMonths] = useState(initialMonths || []);
    const [customAmount, setCustomAmount] = useState(item?.amount || 0);
    const [selectedSppOption, setSelectedSppOption] = useState('50000');
    const [isProcessing, setIsProcessing] = useState(false);
    const availableYears = [2027, 2026, 2025, 2024, 2023];

    useEffect(() => {
        if(open) {
             setSelectedYear(initialYear || new Date().getFullYear());
             setSelectedMonths(initialMonths || []);
             setIsProcessing(false);
              if (item?.custom === 'spp_dropdown') {
                  const sharedDefaultAmount = getSharedDefaultSppAmount(selectedSantri);
                  const initialAmt = item.amount || sharedDefaultAmount || 0;
                  if (sppOptions.includes(initialAmt)) {
                     setSelectedSppOption(initialAmt.toString());
                     setCustomAmount(initialAmt);
                  } else if (initialAmt >= 10000) {
                      setSelectedSppOption('custom');
                      setCustomAmount(initialAmt);
                  } else {
                      setSelectedSppOption('');
                      setCustomAmount(0);
                 }
             } else {
                 setCustomAmount(item?.amount || 0);
             }
        }
    }, [open, initialYear, initialMonths, item, resetKey, selectedSantri]);

    const toggleMonth = (month) => {
        setSelectedMonths(prev =>
            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
        );
    };

    const handleSppOptionChange = (val) => {
        setSelectedSppOption(val);
        if (val !== 'custom') {
            setCustomAmount(parseInt(val));
        } else {
            setCustomAmount(0);
        }
    };

    const handleConfirm = async () => {
        if(selectedMonths.length === 0) {
            toast({title: "Pilih Bulan", description: "Minimal pilih satu bulan tagihan.", variant: "destructive"});
            return;
        }
        let finalAmount = item.amount;
        if (item?.custom === 'spp' || (item?.custom === 'spp_dropdown')) {
             if (customAmount < 10000) {
                 toast({title: "Nominal Salah", description: "Masukkan nominal yang valid (min 10.000).", variant: "destructive"});
                 return;
             }
             finalAmount = customAmount;
        }
        setIsProcessing(true);
        await onConfirm({ year: selectedYear, months: selectedMonths, amount: finalAmount });
        setIsProcessing(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Pilih Periode Tagihan</DialogTitle><DialogDescription>Pilih Bulan dan Tahun Tagihan untuk {item?.name}</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between"><label className="text-sm font-medium">Tahun Tagihan</label><Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-sm font-medium mb-2 block">Bulan Tagihan</label><div className="grid grid-cols-3 gap-2">{monthsList.map(month => (<Button key={month} variant={selectedMonths.includes(month) ? "default" : "outline"} size="sm" onClick={() => toggleMonth(month)} className={cn("w-full justify-start px-2", selectedMonths.includes(month) && "bg-primary text-white hover:bg-primary/90")}>{selectedMonths.includes(month) && <Check className="w-3 h-3 mr-1"/>}{month}</Button>))}</div></div>
                    {item?.custom === 'spp_dropdown' && (<div className="space-y-2"><label className="text-sm font-medium block">Nominal SPP</label><p className="text-xs text-muted-foreground">{getSharedDefaultSppAmount(selectedSantri) ? 'Nominal otomatis mengikuti default SPP santri. Admin tetap dapat menggantinya.' : 'Default SPP belum sama atau belum diatur. Pilih nominal untuk transaksi ini.'}</p><div className="grid grid-cols-3 gap-2">{sppOptions.map(opt => (<Button key={opt} variant={selectedSppOption === opt.toString() ? "default" : "outline"} size="sm" onClick={() => handleSppOptionChange(opt.toString())} className={cn(selectedSppOption === opt.toString() && "bg-primary hover:bg-primary/90 text-white")}>{(opt / 1000)}k</Button>))}<Button variant={selectedSppOption === 'custom' ? "default" : "outline"} size="sm" onClick={() => handleSppOptionChange('custom')} className={cn(selectedSppOption === 'custom' && "bg-primary hover:bg-primary/90 text-white")}>Custom</Button></div>{selectedSppOption === 'custom' && (<Input type="number" min="10000" step="1000" value={customAmount || ''} onChange={(e) => setCustomAmount(Number(e.target.value))} placeholder="Masukkan nominal..." className="mt-2"/>)}</div>)}
                    {item?.custom === 'spp' && (<div><label className="text-sm font-medium mb-1 block">Nominal per Bulan</label><Input type="number" value={customAmount} onChange={(e) => setCustomAmount(Number(e.target.value))} placeholder="Contoh: 120000" /></div>)}
                    <div className="pt-4 border-t flex justify-between items-center"><span className="text-sm text-muted-foreground">{selectedMonths.length} Bulan dipilih</span><span className="font-bold text-lg">Total: Rp {((item?.custom === 'spp' || item?.custom === 'spp_dropdown' ? customAmount : item?.amount || 0) * selectedMonths.length).toLocaleString('id-ID')}</span></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Batal</Button><Button onClick={handleConfirm} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : 'Simpan'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DeleteConfirmationDialog = ({ open, onOpenChange, onConfirm, count }) => (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5"/> Konfirmasi Hapus</DialogTitle><DialogDescription>Anda akan menghapus <strong>{count}</strong> riwayat pembayaran. Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>Ya, Hapus Permanen</Button></DialogFooter></DialogContent></Dialog>
);

const DuplicatePaymentDialog = ({ open, onOpenChange, onResetMonth }) => (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2 text-yellow-600"><AlertTriangle className="w-5 h-5"/> Pembayaran Sudah Ada</DialogTitle><DialogDescription className="pt-2">Pembayaran untuk bulan ini sudah ada. Mohon periksa kembali.</DialogDescription></DialogHeader><DialogFooter className="flex gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={() => { onOpenChange(false); onResetMonth(); }}>Ubah Bulan</Button></DialogFooter></DialogContent></Dialog>
);

const PaymentSystem = () => {
  const [santriList, setSantriList] = useState([]);
  const [selectedSantri, setSelectedSantri] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isSantriSelectorOpen, setIsSantriSelectorOpen] = useState(false);
  const [rfidScan, setRfidScan] = useState('');
  const rfidInputRef = useRef(null);
  const receiptRef = useRef(null);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [historyFilter, setHistoryFilter] = useState({ year: 'all', month: 'all' });
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const availableYears = [2027, 2026, 2025, 2024, 2023];
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configItem, setConfigItem] = useState(null);
  const [editingCartId, setEditingCartId] = useState(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [receiptLogoUrl, setReceiptLogoUrl] = useState('/logo-lpq-al-fath-maulana.webp');
  const [historyProofPayment, setHistoryProofPayment] = useState(null);

  const location = useLocation();

  useEffect(() => {
    let active = true;

    const fetchSantri = async () => {
      const { data, error } = await supabase
        .from('santri')
        .select('id, nomor_induk_qiroati, nama_lengkap, nama_panggilan, kategori, status, foto_url, avatar_path, rfid_tag, default_spp_amount, no_hp_ortu')
        .eq('status', 'Aktif')
        .order('nama_lengkap');
      if (error) toast({ title: "Error", description: "Gagal memuat data santri.", variant: "destructive" });
      else {
        const santriWithAvatars = await Promise.all((data || []).map(async (santri) => ({
          ...santri,
          foto_url: await resolveAvatarUrl({
            ownerType: 'santri',
            ownerId: santri.id,
            avatarPath: santri.avatar_path,
            fallbackUrl: santri.foto_url,
          }),
        })));
        if (active) setSantriList(santriWithAvatars);
      }
    };
    fetchSantri();
    if (rfidInputRef.current) {
        rfidInputRef.current.focus();
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (santriList.length > 0 && location.state?.santriId) {
       const santriToSelect = santriList.find(s => s.id === location.state.santriId);
       if (santriToSelect && !selectedSantri.some(s => s.id === santriToSelect.id)) {
           setSelectedSantri([santriToSelect]);
           loadPaymentHistory(santriToSelect.id);
           setHistoryFilter({ year: 'all', month: 'all' });
       }
    }
  }, [santriList, location.state]);

  useEffect(() => {
    const filtered = paymentHistory.filter(p => {
        const billingYear = p.tahun || new Date(p.tanggal_pembayaran).getFullYear();
        const billingMonthIndex = p.bulan ? Number(p.bulan) - 1 : new Date(p.tanggal_pembayaran).getMonth();
        return (historyFilter.year === 'all' || billingYear === historyFilter.year) && (historyFilter.month === 'all' || billingMonthIndex === historyFilter.month);
    });
    setFilteredHistory(filtered);
  }, [paymentHistory, historyFilter]);

  useEffect(() => {
    if (isReceiptOpen && receiptData?.qrCodeUrl) {
        QRCode.toDataURL(receiptData.qrCodeUrl, { width: 120, margin: 1 }, (err, url) => {
            if (!err) setQrCodeDataURL(url);
        });
    }
  }, [isReceiptOpen, receiptData]);

  useEffect(() => {
    let active = true;
    const loadReceiptLogo = async () => {
      if (!isReceiptOpen) return;
      const logoUrl = await fetchReceiptLogoDataUrl('/logo-lpq-al-fath-maulana.webp');
      if (active) setReceiptLogoUrl(logoUrl);
    };
    loadReceiptLogo();
    return () => {
      active = false;
    };
  }, [isReceiptOpen]);

  const handleRfidScan = (e) => {
    e.preventDefault();
    if(!rfidScan) return;
    const foundSantri = santriList.find(s => s.rfid_tag === rfidScan);
    if(foundSantri) {
        handleSantriSelect(foundSantri);
        toast({ title: "Santri Ditemukan!", description: `Santri ${foundSantri.nama_lengkap} (${foundSantri.kategori}) ditambahkan.`});
    } else {
        toast({ title: "RFID tidak ditemukan", description: "Pastikan kartu terdaftar.", variant: "destructive"});
    }
    setRfidScan('');
  }

  const handleSantriSelect = (santri) => {
    setSelectedSantri(prev => {
        const isSelected = prev.some(s => s.id === santri.id);
        if (isSelected) return prev.filter(s => s.id !== santri.id);
        return [...prev, santri];
    });
    if (selectedSantri.length === 0 || !selectedSantri.some(s => s.id === santri.id)) {
        loadPaymentHistory(santri.id);
        setHistoryFilter({ year: 'all', month: 'all' });
    }
  };

  const loadPaymentHistory = async (santriId) => {
    const { data, error } = await supabase
      .from('payments')
      .select(PAYMENT_HISTORY_SELECT)
      .eq('santri_id', santriId)
      .order('tanggal_pembayaran', { ascending: false });
    if (error) toast({ title: "Error", description: "Gagal memuat riwayat pembayaran.", variant: "destructive" });
    else setPaymentHistory(data || []);
  };

  const initiateAddToCart = (item) => {
    if (item.monthly) { setConfigItem(item); setEditingCartId(null); setIsConfigOpen(true); } else { addToCart(item); }
  };

  const checkDuplicates = async (config) => {
      if (selectedSantri.length === 0) return false;
      const santriIds = selectedSantri.map(s => s.id);
      const monthNumbers = config.months.map(monthNameToNumber).filter(Boolean);
      const { data, error } = await supabase
        .from('payments')
        .select('id, santri_id, bulan, tahun')
        .in('santri_id', santriIds)
        .eq('tahun', config.year)
        .in('bulan', monthNumbers)
        .eq('status', 'paid')
        .is('deleted_at', null);
      if (error) {
        toast({ title: "Error", description: "Gagal memeriksa duplikasi pembayaran.", variant: "destructive" });
        return false;
      }
      return (data || []).length > 0;
  };

  const addToCart = async (item, config = null) => {
    if (config) {
        const isDuplicate = await checkDuplicates(config);
        if (isDuplicate) {
            toast({ title: "Duplikat Terdeteksi", description: "Pembayaran untuk bulan ini sudah ada.", variant: "destructive" });
            setIsConfigOpen(false); setIsDuplicateDialogOpen(true); return;
        }
        const cartItem = { ...item, cartId: editingCartId || Date.now(), amount: config.amount, months: config.months, year: config.year, quantity: 1 };
        if(editingCartId) { setCart(prev => prev.map(i => i.cartId === editingCartId ? cartItem : i)); setEditingCartId(null); } else { setCart(prev => [...prev, cartItem]); }
        setIsConfigOpen(false);
    } else {
        const existingItem = cart.find(cartItem => cartItem.name === item.name && !item.custom && !item.monthly && !item.hasSubtypes);
        if (existingItem) { updateCartItem(existingItem.cartId, { quantity: (existingItem.quantity || 1) + 1 }); } else { const cartItem = { ...item, cartId: Date.now(), amount: item.amount || 0, quantity: 1 }; setCart(prev => [...prev, cartItem]); }
    }
  };

  const editCartItem = (item) => {
      if(item.monthly) { setConfigItem(item); setEditingCartId(item.cartId); setIsConfigOpen(true); }
  };
  const removeFromCart = (cartId) => setCart(prev => prev.filter(item => item.cartId !== cartId));
  const updateCartItem = (cartId, updates) => setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, ...updates } : item));

  const handlePayment = async () => {
    if (selectedSantri.length === 0 || cart.length === 0) return toast({ title: "Error", description: "Pilih santri dan tambahkan item pembayaran.", variant: "destructive" });
    try {
        const transactionId = crypto.randomUUID();
        let newPayments = [];

        for (const santri of selectedSantri) {
            for (const item of cart) {
                if (item.monthly) {
                    if(!item.months || item.months.length === 0) throw new Error("Data bulan tagihan SPP tidak valid.");
                    for (const month of item.months) {
                         const monthNumber = monthNameToNumber(month);
                         if (!monthNumber) throw new Error("Bulan tagihan tidak valid.");
                         if (!validatePaymentAmount(item.amount)) throw new Error("Nominal pembayaran tidak valid.");
                         newPayments.push({
                            santri_id: santri.id,
                            transaction_id: crypto.randomUUID(),
                            bulan: monthNumber,
                            tahun: item.year,
                            jumlah: Number(item.amount),
                            tanggal_pembayaran: new Date().toLocaleDateString('en-CA'),
                            status: 'paid',
                            catatan: `${item.name} (${month} ${item.year})`,
                            metode_pembayaran: paymentMethod
                         });
                    }
                } else {
                    if (item.hasSubtypes && !item.subtype) throw new Error("Pilih volume buku jilid.");
                    if (item.custom === 'item' && (!item.name || !item.amount)) throw new Error("Untuk item Custom, nama dan jumlah harus diisi.");
                    if (!validatePaymentAmount(item.amount * item.quantity)) throw new Error("Nominal pembayaran tidak valid.");
                    const paymentType = item.custom === 'item' ? item.name : (item.hasSubtypes ? `${item.name} - ${item.subtype}` : item.name);
                    newPayments.push({
                      santri_id: santri.id,
                      transaction_id: crypto.randomUUID(),
                      bulan: null,
                      tahun: null,
                      jumlah: Number(item.amount * item.quantity),
                      tanggal_pembayaran: new Date().toLocaleDateString('en-CA'),
                      status: 'paid',
                      catatan: `${paymentType} (Qty: ${item.quantity})`,
                      metode_pembayaran: paymentMethod
                    });
                }
            }
        }
        const { data, error } = await supabase.from('payments').insert(newPayments).select('id');
        if (error) throw error;
        if (selectedSantri.length === 1) loadPaymentHistory(selectedSantri[0].id);

        toast({ title: "Pembayaran Berhasil!", description: `Pembayaran untuk ${selectedSantri.length} santri telah lunas.` });

        let totalAmount = 0;
        for (const item of cart) { if (item.monthly) { totalAmount += (item.amount * item.months.length); } else { totalAmount += (item.amount * item.quantity); } }
        totalAmount = totalAmount * selectedSantri.length;
        const qrCodeLoginUrl = `${window.location.origin}/login`;
        setReceiptData({ items: cart, total: totalAmount, santri: selectedSantri, qrCodeUrl: qrCodeLoginUrl, timestamp: new Date(), method: paymentMethod, transactionId: transactionId, paymentId: data[0].id });
        setIsReceiptOpen(true);
        setCart([]);
    } catch (error) {
        toast({ title: "Pembayaran Gagal!", description: getPaymentErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteHistory = async () => {
    const { error } = await supabase.from('payments').delete().in('id', selectedHistory);
    if (error) { toast({ title: 'Gagal Menghapus', description: getPaymentErrorMessage(error), variant: 'destructive' }); }
    else {
        toast({ title: 'Riwayat Dihapus', description: `${selectedHistory.length} data pembayaran telah berhasil dihapus.` });
        if (selectedSantri.length === 1) loadPaymentHistory(selectedSantri[0].id);
        setSelectedHistory([]);
    }
  };

  const confirmDelete = () => { if (selectedHistory.length === 0) return; setDeleteConfirmOpen(true); }
  const handleSelectHistory = (id) => { setSelectedHistory(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };
  const handlePrint = () => window.print();

  const savePaymentProof = async () => {
    if (!receiptData || !receiptRef.current) return;
    setIsSaving(true);
    try {
      toast({ title: "Memproses...", description: "Sedang membuat gambar bukti pembayaran." });
      await waitForImagesToLoad(receiptRef.current);

      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        imagePlaceholder: '/logo-lpq-al-fath-maulana.webp',
      });

      const link = document.createElement('a');
      const santriName = receiptData.santri && receiptData.santri.length > 0 ? receiptData.santri[0].nama_lengkap.replace(/\s+/g, '_') : 'Santri';
      const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
      link.download = `Bukti_Pembayaran_${santriName}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();

      toast({ title: "Berhasil!", description: "Bukti pembayaran berhasil disimpan." });
    } catch (err) {
      toast({ title: "Gagal", description: `Gagal membuat gambar bukti pembayaran: ${err?.message || 'gambar tidak dapat diproses.'}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!receiptData || !receiptData.santri?.length) return;
    const santriWithPhone = receiptData.santri.find(s => String(s.no_hp_ortu || '').trim());
    if (!santriWithPhone) { toast({ title: "Gagal", description: "Tidak ada nomor HP wali murid yang ditemukan.", variant: "destructive" }); return; }
    let phoneNumber = santriWithPhone.no_hp_ortu.replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = '62' + phoneNumber.substring(1);
    else if (!phoneNumber.startsWith('62')) phoneNumber = '62' + phoneNumber;

    const itemsText = receiptData.items.map(item => {
        let name = item.name;
        let subTotal = 0;
        if (item.monthly) { name += ` (${item.months.join(', ')} ${item.year})`; subTotal = item.amount * item.months.length; }
        else { if(item.custom === 'item') name = item.name; else if (item.hasSubtypes) name = `${item.name} ${item.subtype}`; subTotal = item.amount * item.quantity; }
        return `- ${name}: Rp${subTotal.toLocaleString('id-ID')}`;
    }).join('\n');

    const santriNames = receiptData.santri.map(s => s.nama_lengkap).join(', ');
    const totalAmount = receiptData.total;
    const templates = await fetchWhatsAppTemplates();
    const message = renderWhatsAppTemplate(templates.paymentReceipt, {
      nama_santri: santriNames,
      nomor_induk: santriWithPhone.nomor_induk_qiroati || '-',
      rincian: itemsText,
      nominal: `Rp ${totalAmount.toLocaleString('id-ID')}`,
      tanggal: receiptData.timestamp.toLocaleDateString('id-ID'),
      periode: receiptData.items.filter((item) => item.monthly).flatMap((item) => item.months || []).join(', ') || '-',
      metode: receiptData.method,
      transaction_id: receiptData.transactionId || '-',
      status: 'LUNAS',
      nama_lembaga: 'LPQ Al-Fath Maulana',
    });
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const totalCart = cart.reduce((sum, item) => { if(item.monthly) return sum + (item.amount * item.months.length); return sum + ((item.amount || 0) * item.quantity); }, 0);

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #receipt-content, #receipt-content * { visibility: visible; } #receipt-content { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div className="space-y-6">
        <div className="admin-panel-header">
            <div className="flex items-center gap-3">
                <div className="admin-panel-header-icon">
                    <Wallet />
                </div>
                <div className="admin-panel-header-text">
                    <h2>Sistem Pembayaran</h2>
                    <p>Proses pembayaran santri dengan scan RFID atau pilih manual.</p>
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-1/3 space-y-6">
                 <div className="space-y-4">
                    <form onSubmit={handleRfidScan} className="relative">
                        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input ref={rfidInputRef} value={rfidScan} onChange={e => setRfidScan(e.target.value)} placeholder="Scan ID Card..." className="pl-10"/>
                    </form>
                    <Button onClick={() => setIsSantriSelectorOpen(true)} className="w-full justify-start" variant="outline"><Users className="mr-2 h-4 w-4"/> {selectedSantri.length > 0 ? `${selectedSantri.length} Santri Terpilih` : 'Pilih Santri Manual'}</Button>

                    {selectedSantri.length > 0 && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-56 overflow-y-auto">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold">Santri Terpilih:</h3>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setSelectedSantri([])}>
                                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedSantri.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 bg-white dark:bg-gray-700 p-1 rounded-full text-xs">
                                        <Avatar className="w-5 h-5"><AvatarImage src={s.foto_url}/><AvatarFallback>{s.nama_lengkap.charAt(0)}</AvatarFallback></Avatar>
                                        <span>{s.nama_panggilan}</span>
                                        <button onClick={() => handleSantriSelect(s)}><X className="w-3 h-3"/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div><h3 className="font-bold mb-2">Item Pembayaran</h3><div className="grid grid-cols-2 gap-2">{paymentItems.map(item => (<Button key={item.name} onClick={() => initiateAddToCart(item)} variant="outline" className="h-auto flex flex-col p-3 hover:border-primary hover:text-primary"><item.icon className="w-6 h-6 mb-1" /><span className="text-xs text-center">{item.name}</span></Button>))}</div></div>
                 </div>
            </div>

            <div className="w-full md:w-2/3 md:-mt-1">
                <Card className="border-none shadow-md bg-slate-50 dark:bg-slate-900/50">
                    <CardHeader className="pb-2"><CardTitle className="text-lg flex justify-between items-center"><span>Items ({cart.length})</span><ShoppingCart className="w-5 h-5 text-muted-foreground"/></CardTitle></CardHeader>
                    <CardContent className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {cart.map((item, index) => (
                            <div key={item.cartId} className="group relative bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
                                <div className="flex justify-between items-start mb-2"><div><h4 className="font-bold text-base text-slate-800 dark:text-slate-100">{item.name}</h4>{item.monthly && <p className="text-xs text-muted-foreground mt-0.5">Periode: {item.months.join(', ')} {item.year}</p>}{item.hasSubtypes && <p className="text-xs text-muted-foreground mt-0.5">{item.subtype}</p>}</div><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeFromCart(item.cartId)}><X className="w-4 h-4" /></Button></div>
                                <Separator className="my-3"/>
                                <div className="flex items-center justify-between">{item.monthly ? (<div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{item.months.length} Bulan</Badge><span>x Rp{item.amount.toLocaleString('id-ID')}</span><Button variant="ghost" size="icon" className="h-6 w-6 ml-1 hover:text-primary" onClick={() => editCartItem(item)}><Edit className="w-3 h-3 text-slate-400"/></Button></div>) : (<div className="flex items-center gap-3"><div className="flex items-center border rounded-lg overflow-hidden h-8"><button className="px-2 hover:bg-slate-100 h-full flex items-center" onClick={() => updateCartItem(item.cartId, { quantity: Math.max(1, (item.quantity || 1) - 1) })}><Minus className="w-3 h-3"/></button><span className="w-8 text-center text-sm font-medium border-x h-full flex items-center justify-center bg-slate-50">{item.quantity}</span><button className="px-2 hover:bg-slate-100 h-full flex items-center" onClick={() => updateCartItem(item.cartId, { quantity: (item.quantity || 1) + 1 })}><Plus className="w-3 h-3"/></button></div><span className="text-xs text-muted-foreground">x Rp{item.amount.toLocaleString('id-ID')}</span></div>)}<div className="text-right"><p className="font-bold text-lg text-primary">Rp {(item.monthly ? item.amount * item.months.length : item.amount * item.quantity).toLocaleString('id-ID')}</p></div></div>
                                {!item.monthly && item.custom === 'item' && (<div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-dashed"><Input placeholder="Nama Item" value={item.name} onChange={e => updateCartItem(item.cartId, { name: e.target.value })} className="h-8 text-xs"/><Input type="number" placeholder="Harga" value={item.amount || ''} onChange={e => updateCartItem(item.cartId, { amount: parseInt(e.target.value) || 0 })} className="h-8 text-xs"/></div>)}
                                {!item.monthly && item.hasSubtypes && (<div className="mt-2"><Select value={item.subtype} onValueChange={val => updateCartItem(item.cartId, { subtype: val })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih Jilid" /></SelectTrigger><SelectContent>{bookVolumes.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>)}
                            </div>
                        ))}
                        {cart.length === 0 && (<div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-slate-200 rounded-xl"><ShoppingCart className="w-12 h-12 mb-2 opacity-20"/><p>Keranjang kosong</p><p className="text-xs">Pilih item pembayaran di sebelah kiri</p></div>)}
                    </CardContent>
                    <CardFooter className="flex-col gap-4 pt-6 pb-6 bg-white dark:bg-slate-950 border-t rounded-b-xl">
                        <div className="w-full flex justify-between items-center px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="flex items-center gap-3"><div className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm"><Banknote className="w-5 h-5 text-green-600"/></div><div><p className="text-xs font-semibold text-muted-foreground uppercase">Total Tagihan</p><p className="text-xl font-black text-slate-800 dark:text-white">Rp {(totalCart * Math.max(1, selectedSantri.length)).toLocaleString('id-ID')}</p></div></div>
<Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Tunai">Tunai</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select>
                        </div>
                        <Button onClick={handlePayment} className="w-full h-12 text-lg font-bold shadow-lg hover:shadow-xl transition-all active:scale-[0.99]" size="lg" disabled={cart.length === 0 || selectedSantri.length === 0}>Proses Pembayaran {selectedSantri.length > 1 && `(${selectedSantri.length} Santri)`}</Button>
                    </CardFooter>
                </Card>

                {selectedSantri.length === 1 && (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-xl">Riwayat Bayar Santri</h3><div className="flex gap-2 items-center"><span className="text-xs font-medium mr-1">Filter Tagihan:</span><Select value={historyFilter.year.toString()} onValueChange={val => setHistoryFilter(f => ({...f, year: val === 'all' ? 'all' : Number(val)}))}><SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="Tahun" /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select><Select value={historyFilter.month.toString()} onValueChange={val => setHistoryFilter(f => ({...f, month: val === 'all' ? 'all' : Number(val)}))}><SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Bulan" /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem>{monthsList.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>{selectedHistory.length > 0 && <Button onClick={confirmDelete} variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2"/> Hapus ({selectedHistory.length})</Button>}</div></div>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {filteredHistory.length > 0 && (<div className="flex items-center px-2"><Checkbox id="selectAllHistory" checked={selectedHistory.length === filteredHistory.length && filteredHistory.length > 0} onCheckedChange={checked => checked ? setSelectedHistory(filteredHistory.map(p => p.id)) : setSelectedHistory([])} /><label htmlFor="selectAllHistory" className="ml-2 text-sm font-medium">Pilih Semua</label></div>)}
                    {filteredHistory.map(p => (<div key={p.id} className="flex items-center justify-between gap-2 p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"><div className="flex items-center gap-3 min-w-0 flex-1"><Checkbox id={`history-${p.id}`} checked={selectedHistory.includes(p.id)} onCheckedChange={() => handleSelectHistory(p.id)} className="flex-shrink-0" /><div className="flex-grow min-w-0"><p className="font-semibold truncate text-sm">{p.catatan}</p><div className="flex flex-wrap items-center gap-2 text-xs text-gray-500"><span>{new Date(p.tanggal_pembayaran).toLocaleString('id-ID')}</span>{p.bulan && <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px]">Tagihan: {monthNumberToName(p.bulan)} {p.tahun}</span>}</div></div><p className="font-bold whitespace-nowrap text-sm text-primary">Rp{Number(p.jumlah || 0).toLocaleString('id-ID')}</p></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40" onClick={() => setHistoryProofPayment(p)} title="Buka bukti pembayaran" aria-label="Buka bukti pembayaran"><FileText className="h-4 w-4" /></Button></div>))}
                    {filteredHistory.length === 0 && <p className="text-center text-gray-500 py-4">Tidak ada riwayat untuk periode ini.</p>}</div>
                </div>
                )}
            </div>
        </div>

        <SantriSelectorModal santriList={santriList} open={isSantriSelectorOpen} onOpenChange={setIsSantriSelectorOpen} onSelect={handleSantriSelect} selectedSantriIds={new Set(selectedSantri.map(s => s.id))} />
        <MonthSelectorDialog open={isConfigOpen} onOpenChange={setIsConfigOpen} item={configItem} onConfirm={(config) => { addToCart(configItem, config); }} initialYear={configItem?.year} initialMonths={configItem?.months} resetKey={resetKey} selectedSantri={selectedSantri} />
        <DuplicatePaymentDialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen} onResetMonth={() => { setResetKey(prev => prev + 1); setIsConfigOpen(true); }} />

        <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
          <DialogContent className="max-w-[400px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-2 border-b"><DialogTitle className="text-center">Bukti Pembayaran</DialogTitle></DialogHeader>
            {receiptData && (<>
              <div ref={receiptRef} className="p-4 bg-white text-slate-800 rounded-xl shadow-lg border border-slate-100 relative overflow-hidden" id="receipt-content">
                  <div className="text-center pb-2 mb-2 border-b border-dashed border-slate-300 relative z-10">
                       <img src={receiptLogoUrl} alt="Logo LPQ Al-Fath Maulana" className="w-12 h-12 mx-auto mb-2 object-contain"/>
                       <h3 className="font-bold text-lg text-primary tracking-tight font-poppins">LPQ AL-FATH MAULANA</h3>
                       <p className="text-[10px] text-slate-500 mt-1">{OFFICIAL_CONTACT.address}</p>
                       <p className="text-[10px] text-slate-500">{OFFICIAL_CONTACT.phone} · lpqalfathmaulana.id</p>
                  </div>

                  {/* Lunas Stamp - Centered */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none select-none">
                       <div className="border-4 border-red-500 text-red-500 rounded-lg px-6 py-2 text-3xl font-bold -rotate-12 opacity-15 whitespace-nowrap">
                           LUNAS
                       </div>
                  </div>

                  <div className="flex justify-between text-[10px] mb-3 text-slate-600 bg-slate-50 p-2 rounded-lg relative z-10">
                      <div className="space-y-0.5">
                         <p>Tgl: <span className="font-semibold text-slate-900">{receiptData.timestamp.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                         <p>Jam: <span className="font-semibold text-slate-900">{receiptData.timestamp.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span></p>
                      </div>
                      <div className="space-y-0.5 text-right">
                         <p>Metode: <span className="font-semibold text-slate-900 uppercase">{receiptData.method}</span></p>
                         <p>ID: <span className="font-mono">{receiptData.paymentId ? receiptData.paymentId.substring(0,8) : '-'}</span></p>
                      </div>
                  </div>

                  <div className="mb-3 relative z-10">
                      <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Diterima Dari:</p>
                      <p className="text-xs font-bold text-slate-900">{receiptData.santri.map(s => s.nama_lengkap).join(', ')}</p>
                  </div>

                  <div className="space-y-2 mb-3 relative z-10">
                    <div className="border-t border-slate-200 pt-2"></div>
                      {receiptData.items.map(item => {
                          if (item.monthly) {
                             return item.months.map(m => (
                                <div key={`${item.cartId}-${m}`} className="flex justify-between text-xs py-0.5">
                                    <span className="text-slate-700 flex-1">{item.name} <span className="text-[9px] text-slate-400">({m} {item.year})</span></span>
                                    <span className="font-semibold text-slate-900">Rp{item.amount.toLocaleString('id-ID')}</span>
                                </div>
                             ));
                          } else {
                             return (
                                <div key={item.cartId} className="flex justify-between text-xs py-0.5">
                                    <span className="text-slate-700 flex-1">
                                        {item.custom === 'item' ? item.name : (item.hasSubtypes ? `${item.name} ${item.subtype}` : item.name)}
                                        {item.quantity > 1 && <span className="text-[9px] text-slate-400 ml-1">x{item.quantity}</span>}
                                    </span>
                                    <span className="font-semibold text-slate-900">Rp{(item.amount * item.quantity).toLocaleString('id-ID')}</span>
                                </div>
                             );
                          }
                      })}
                     <div className="border-t border-slate-200 pt-2"></div>
                  </div>

                  <div className="flex justify-between items-center bg-green-50 p-2 rounded-lg border border-green-100 mb-4 relative z-10">
                      <span className="text-xs font-bold text-green-800">TOTAL BAYAR</span>
                      <span className="text-base font-black text-green-900">Rp{receiptData.total.toLocaleString('id-ID')}</span>
                  </div>

                  <div className="text-center relative z-10">
                      <div className="bg-white p-1 inline-block rounded-lg shadow-sm border border-slate-100 mb-2">
                        {qrCodeDataURL && <img src={qrCodeDataURL} alt="QR Code Status" className="w-16 h-16"/>}
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Terima Kasih</p>
                  </div>
              </div>

              <div className="flex justify-center flex-wrap gap-2 p-2">
                <Button variant="outline" size="sm" onClick={handleSendWhatsApp} className="bg-green-600 text-white hover:bg-green-700 border-0 shadow-sm text-xs h-8"><MessageSquare className="mr-2 h-3 w-3"/> WhatsApp</Button>
                <Button variant="outline" size="sm" onClick={savePaymentProof} disabled={isSaving} className="shadow-sm text-xs h-8">
                  {isSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <Download className="mr-2 h-3 w-3"/>}
                  {isSaving ? 'Menyimpan...' : 'Simpan Bukti'}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="shadow-sm text-xs h-8"><Printer className="mr-2 h-3 w-3"/> Cetak</Button>
              </div>
            </>)}
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} onConfirm={handleDeleteHistory} count={selectedHistory.length} />
        <PaymentProofModal
          isOpen={Boolean(historyProofPayment)}
          onClose={() => setHistoryProofPayment(null)}
          payment={historyProofPayment}
        />
      </div>
    </>
  );
};

export default PaymentSystem;
