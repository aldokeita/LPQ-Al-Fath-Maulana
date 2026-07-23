import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ArrowRightLeft, School, User, Clock, CheckCircle, AlertCircle, RefreshCw, Sparkles, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const StudentTransferModal = ({ isOpen, onClose, santri, onTransferSuccess }) => {
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchClasses();
            setSelectedClassId(null);
            setShowConfirmation(false);
            setLoadError(null);
        }
    }, [isOpen, santri?.id]);

    const fetchClasses = async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const { data, error } = await supabase.rpc('list_guru_transfer_destinations', {
                p_santri_id: santri.id,
            });

            if (error) throw error;
            setClasses((data || []).map((item) => ({
                ...item,
                guru: item.guru_nama ? { nama: item.guru_nama } : null,
            })));
        } catch (error) {
            const backendNotReady = error?.code === 'PGRST202'
                || error?.message?.includes('list_guru_transfer_destinations');
            setClasses([]);
            setLoadError({
                title: backendNotReady ? 'Fitur transfer belum diaktifkan' : 'Daftar kelas belum dapat dimuat',
                description: backendNotReady
                    ? 'Pembaruan database untuk transfer kelas belum diterapkan. Hubungi admin untuk mengaktifkannya.'
                    : 'Periksa koneksi Anda, lalu coba muat kembali daftar kelas.',
            });
            toast({
                title: backendNotReady ? 'Transfer belum aktif' : 'Gagal memuat kelas',
                description: backendNotReady ? 'Pembaruan database masih diperlukan.' : 'Silakan coba kembali.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!selectedClassId) return;
        setIsSubmitting(true);
        try {
            const targetClass = classes.find(c => c.id === selectedClassId);
            const { error } = await supabase.rpc('move_santri_to_class_by_guru', {
                p_santri_id: santri.id,
                p_to_class_id: selectedClassId,
                p_reason: `Mutasi kelas ke ${targetClass?.nama_kelas || 'kelas tujuan'}`
            });

            if (error) throw error;

            toast({ title: 'Transfer Berhasil', description: `${santri.nama_lengkap} berhasil dipindahkan ke kelas ${targetClass?.nama_kelas}.` });
            onTransferSuccess();
            onClose();
        } catch (error) {
            toast({ title: 'Transfer Gagal', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Find current class name from the fetched classes list to ensure accuracy
    const currentClassId = santri?.id_kelas || santri?.current_class_id || santri?.class?.id;
    const currentClassData = classes.find(c => c.id === currentClassId) || santri?.class || null;
    const selectedClassData = classes.find(c => c.id === selectedClassId);

    // Group and sort classes
    const sessionOrder = { 'Pagi': 1, 'Siang': 2, 'Sore': 3 };
    const getSessionOrder = (sesi) => sessionOrder[sesi] || 99;

    const sortedClasses = [...classes].sort((a, b) => {
        const orderA = getSessionOrder(a.sesi);
        const orderB = getSessionOrder(b.sesi);
        if (orderA !== orderB) return orderA - orderB;
        return a.nama_kelas.localeCompare(b.nama_kelas);
    });

    const getSessionBadgeColor = (sesi) => {
        switch(sesi) {
            case 'Pagi': return 'bg-sky-100 text-sky-800';
            case 'Siang': return 'bg-amber-100 text-amber-800';
            case 'Sore': return 'bg-orange-100 text-orange-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    if (!santri) return null;

    if (showConfirmation) {
        return (
            <Dialog open={isOpen} onOpenChange={() => { if(!isSubmitting) setShowConfirmation(false); }}>
                <DialogContent className="guru-transfer-dialog guru-transfer-dialog--confirm max-w-xl overflow-hidden p-0">
                    <div className="guru-transfer-aurora" aria-hidden="true" />
                    <div className="relative p-6 sm:p-8">
                        <DialogHeader className="text-left">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-200/70 bg-teal-50/80 text-teal-700 shadow-sm dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-200">
                                <ArrowRightLeft className="h-5 w-5" />
                            </div>
                            <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Pastikan perpindahan kelas</DialogTitle>
                            <DialogDescription className="max-w-md text-sm leading-relaxed">Periksa kelas asal dan tujuan sebelum menyimpan perubahan untuk <strong className="font-bold text-foreground">{santri.nama_lengkap}</strong>.</DialogDescription>
                        </DialogHeader>

                        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/55 p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/35">
                            <Avatar className="h-12 w-12 border-2 border-white shadow-md dark:border-slate-700"><AvatarImage src={santri.foto_url} className="object-cover" /><AvatarFallback>{santri.nama_lengkap[0]}</AvatarFallback></Avatar>
                            <div className="min-w-0"><p className="truncate font-bold text-foreground">{santri.nama_lengkap}</p><p className="text-xs font-medium text-muted-foreground">{santri.jilid || 'Jilid belum diatur'}</p></div>
                        </div>

                        <div className="guru-transfer-route mt-5">
                            <div className="guru-transfer-route__stop">
                                <span className="guru-transfer-route__label">Kelas asal</span>
                                <strong>{currentClassData?.nama_kelas || 'Kelas saat ini'}</strong>
                                <span>{currentClassData?.sesi || santri.sesi_mengaji || 'Sesi belum diatur'}</span>
                            </div>
                            <div className="guru-transfer-route__arrow" aria-hidden="true"><ChevronRight className="h-5 w-5" /></div>
                            <div className="guru-transfer-route__stop guru-transfer-route__stop--target">
                                <span className="guru-transfer-route__label">Kelas tujuan</span>
                                <strong>{selectedClassData?.nama_kelas}</strong>
                                <span>{selectedClassData?.sesi || 'Sesi belum diatur'}</span>
                            </div>
                        </div>

                        <DialogFooter className="mt-7 gap-2 sm:gap-2">
                            <Button variant="outline" onClick={() => setShowConfirmation(false)} disabled={isSubmitting} className="h-11 rounded-xl border-white/70 bg-white/45 px-5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5">Kembali</Button>
                            <Button onClick={handleTransfer} disabled={isSubmitting} className="guru-transfer-primary h-11 min-w-[170px] rounded-xl px-5 text-white">
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memindahkan...</> : <><ArrowRightLeft className="mr-2 h-4 w-4" />Pindahkan santri</>}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="guru-transfer-dialog flex h-[min(88vh,760px)] max-w-4xl flex-col overflow-hidden p-0">
                <div className="guru-transfer-aurora" aria-hidden="true" />

                <div className="guru-transfer-header relative z-10 px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
                    <DialogHeader className="text-left">
                        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-teal-200/70 bg-teal-50/70 shadow-sm dark:border-teal-400/20 dark:bg-teal-400/10"><Sparkles className="h-4 w-4" /></span>
                            Mutasi kelas
                        </div>
                        <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">Transfer santri</DialogTitle>
                        <DialogDescription className="mt-1 max-w-xl text-sm leading-relaxed">Pilih kelas tujuan yang paling tepat untuk perjalanan belajar <strong className="font-bold text-foreground">{santri.nama_lengkap}</strong>.</DialogDescription>
                    </DialogHeader>

                    <div className="guru-transfer-student mt-5">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-lg dark:border-slate-700 sm:h-14 sm:w-14"><AvatarImage src={santri.foto_url} className="object-cover" /><AvatarFallback>{santri.nama_lengkap[0]}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-900 dark:text-white sm:text-base">{santri.nama_lengkap}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5"><School className="h-3.5 w-3.5 text-teal-600" />{currentClassData?.nama_kelas || 'Kelas saat ini'}</span>
                                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-sky-600" />{currentClassData?.sesi || santri.sesi_mengaji || 'Sesi belum diatur'}</span>
                            </div>
                        </div>
                        <Badge variant="outline" className="hidden border-white/70 bg-white/55 px-3 py-1 text-xs font-bold shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:inline-flex">{santri.jilid || 'Jilid belum diatur'}</Badge>
                    </div>
                </div>

                <ScrollArea className="relative z-10 min-h-0 flex-1 border-y border-white/50 bg-white/20 dark:border-white/10 dark:bg-slate-950/15">
                    <div className="p-5 sm:p-7">
                        <div className="mb-4 flex items-end justify-between gap-4">
                            <div><h3 className="font-black text-slate-900 dark:text-white">Pilih kelas tujuan</h3><p className="mt-0.5 text-xs text-muted-foreground">Kelas saat ini tidak dapat dipilih kembali.</p></div>
                            {!isLoading && !loadError && <span className="text-xs font-bold text-teal-700 dark:text-teal-200">{Math.max(sortedClasses.length - 1, 0)} pilihan</span>}
                        </div>

                        {isLoading && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Memuat daftar kelas">
                                {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="guru-transfer-skeleton h-36 rounded-2xl" />)}
                            </div>
                        )}

                        {!isLoading && loadError && (
                            <div className="guru-transfer-state guru-transfer-state--error" role="alert">
                                <span className="guru-transfer-state__icon"><AlertCircle className="h-6 w-6" /></span>
                                <h4>{loadError.title}</h4>
                                <p>{loadError.description}</p>
                                <Button type="button" variant="outline" onClick={fetchClasses} className="mt-5 h-10 rounded-xl border-rose-200/70 bg-white/60 px-4 text-rose-700 shadow-sm hover:bg-white dark:border-rose-400/20 dark:bg-white/5 dark:text-rose-200 dark:hover:bg-white/10"><RefreshCw className="mr-2 h-4 w-4" />Coba lagi</Button>
                            </div>
                        )}

                        {!isLoading && !loadError && sortedClasses.length > 0 && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {sortedClasses.map(cls => {
                                    const isCurrent = cls.id === currentClassId;
                                    const isSelected = cls.id === selectedClassId;
                                    return (
                                        <button
                                            type="button"
                                            key={cls.id}
                                            onClick={() => setSelectedClassId(cls.id)}
                                            disabled={isCurrent}
                                            aria-pressed={isSelected}
                                            className={cn('guru-transfer-class group', isCurrent && 'guru-transfer-class--current', isSelected && 'guru-transfer-class--selected')}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <Badge className={cn('pointer-events-none border-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider', getSessionBadgeColor(cls.sesi))}>{cls.sesi || 'Tanpa sesi'}</Badge>
                                                {isSelected ? <CheckCircle className="h-5 w-5 text-teal-600 dark:text-teal-300" /> : isCurrent ? <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Saat ini</span> : <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />}
                                            </div>
                                            <div className="mt-5 text-left">
                                                <h4 className="text-lg font-black leading-tight text-slate-900 dark:text-white">{cls.nama_kelas}</h4>
                                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><User className="h-3.5 w-3.5" /><span className="truncate">{cls.guru?.nama || 'Guru belum ditentukan'}</span></p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {!isLoading && !loadError && sortedClasses.length === 0 && (
                            <div className="guru-transfer-state">
                                <span className="guru-transfer-state__icon"><School className="h-6 w-6" /></span>
                                <h4>Belum ada kelas tujuan</h4>
                                <p>Admin perlu menambahkan kelas aktif dengan kategori yang sama terlebih dahulu.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="guru-transfer-footer relative z-10 flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <div className="min-w-0 text-xs text-muted-foreground">
                        {selectedClassData ? <span>Tujuan dipilih: <strong className="font-black text-foreground">{selectedClassData.nama_kelas}</strong> · {selectedClassData.sesi}</span> : <span>Pilih satu kelas untuk melanjutkan.</span>}
                    </div>
                    <div className="flex gap-2 sm:shrink-0">
                        <Button variant="outline" onClick={onClose} className="h-11 flex-1 rounded-xl border-white/70 bg-white/45 px-5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:flex-none">Batal</Button>
                        <Button onClick={() => setShowConfirmation(true)} disabled={!selectedClassId || Boolean(loadError)} className="guru-transfer-primary h-11 flex-1 rounded-xl px-5 text-white sm:min-w-[170px] sm:flex-none">Lanjutkan <ChevronRight className="ml-2 h-4 w-4" /></Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default StudentTransferModal;
