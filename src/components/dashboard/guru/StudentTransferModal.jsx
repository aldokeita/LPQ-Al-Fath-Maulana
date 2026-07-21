import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ArrowRightLeft, School, User, Clock, CheckCircle } from 'lucide-react';
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

    useEffect(() => {
        if (isOpen) {
            fetchClasses();
            setSelectedClassId(null);
            setShowConfirmation(false);
        }
    }, [isOpen]);

    const fetchClasses = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('classes')
                .select('*, guru:id_guru(nama)')
                .eq('kategori', santri?.kategori || 'Anak') // Match category
                .order('nama_kelas', { ascending: true });

            if (error) throw error;
            setClasses(data || []);
        } catch (error) {
            toast({ title: 'Gagal memuat kelas', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!selectedClassId) return;
        setIsSubmitting(true);
        try {
            const targetClass = classes.find(c => c.id === selectedClassId);
            const { error } = await supabase.rpc('move_santri_to_class', {
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
    const currentClassData = classes.find(c => c.id === santri?.id_kelas);
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

    const getSessionColor = (sesi) => {
        switch(sesi) {
            case 'Pagi': return 'bg-sky-50 border-sky-200 text-sky-700 hover:border-sky-400';
            case 'Siang': return 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400';
            case 'Sore': return 'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-400';
            default: return 'bg-slate-50 border-slate-200 text-slate-700';
        }
    };

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
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600"><ArrowRightLeft className="w-6 h-6"/> Konfirmasi Transfer</DialogTitle>
                        <DialogDescription>Anda akan memindahkan santri ini.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border flex items-center gap-4">
                            <Avatar className="w-12 h-12"><AvatarImage src={santri.foto_url} /><AvatarFallback>{santri.nama_lengkap[0]}</AvatarFallback></Avatar>
                            <div><p className="font-bold">{santri.nama_lengkap}</p><p className="text-xs text-muted-foreground">{santri.jilid}</p></div>
                        </div>
                        <div className="flex items-center justify-between px-4">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">Dari Kelas</p>
                                <p className="font-bold text-red-500">{currentClassData?.nama_kelas || santri.class?.nama_kelas || 'Belum Masuk'}</p>
                            </div>
                            <ArrowRightLeft className="w-5 h-5 text-slate-400" />
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">Ke Kelas</p>
                                <p className="font-bold text-green-500">{selectedClassData?.nama_kelas}</p>
                                <Badge variant="outline" className="mt-1 text-[10px]">{selectedClassData?.sesi}</Badge>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmation(false)} disabled={isSubmitting}>Batal</Button>
                        <Button onClick={handleTransfer} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">{isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Ya, Pindahkan'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
                <div className="p-6 border-b bg-white dark:bg-slate-950 z-10">
                    <DialogTitle className="flex items-center gap-2 text-xl text-primary"><ArrowRightLeft className="w-6 h-6" /> Transfer Santri</DialogTitle>
                    <DialogDescription className="mt-1">Pilih kelas tujuan untuk <strong>{santri.nama_lengkap}</strong>.</DialogDescription>

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-lg text-sm border border-blue-100 dark:border-blue-800 shadow-sm">
                        <div className="flex items-center gap-2">
                            <School className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold uppercase text-blue-600/80">Kelas Saat Ini:</span>
                        </div>
                        <div className="flex-1 font-bold text-base">
                            {currentClassData ? (
                                <div className="flex items-center gap-2">
                                    {currentClassData.nama_kelas}
                                    <Badge variant="secondary" className="text-xs font-normal bg-white/50">{currentClassData.sesi}</Badge>
                                </div>
                            ) : (
                                <span className="text-muted-foreground italic font-normal">Belum Masuk Kelas</span>
                            )}
                        </div>
                        {currentClassData?.guru?.nama && (
                            <div className="flex items-center gap-1 text-xs opacity-80 bg-white/40 px-2 py-1 rounded">
                                <User className="w-3 h-3" /> {currentClassData.guru.nama}
                            </div>
                        )}
                    </div>
                </div>

                <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="p-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="w-10 h-10 animate-spin mb-2 text-primary" />
                                <p>Memuat daftar kelas...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedClasses.map(cls => {
                                    const isCurrent = cls.id === santri.id_kelas;
                                    const isSelected = cls.id === selectedClassId;
                                    const sessionColorClass = getSessionColor(cls.sesi);

                                    return (
                                        <div
                                            key={cls.id}
                                            onClick={() => !isCurrent && setSelectedClassId(cls.id)}
                                            className={cn(
                                                "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-3 group shadow-sm",
                                                isCurrent ? "opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 grayscale" :
                                                isSelected ? "ring-2 ring-primary border-primary shadow-lg transform scale-[1.02] z-10" :
                                                `${sessionColorClass} hover:shadow-md`
                                            )}
                                        >
                                            <div className="flex justify-between items-start">
                                                <Badge className={cn("text-[10px] px-2 py-0.5 pointer-events-none", getSessionBadgeColor(cls.sesi))}>
                                                    {cls.sesi}
                                                </Badge>
                                                {isSelected && <CheckCircle className="w-5 h-5 text-primary fill-white" />}
                                                {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                                            </div>

                                            <div>
                                                <h4 className="font-bold text-lg leading-tight mb-1">{cls.nama_kelas}</h4>
                                                <div className="flex items-center gap-1.5 text-xs opacity-80">
                                                    <User className="w-3 h-3" />
                                                    <span className="truncate max-w-[120px]">{cls.guru?.nama || 'Tanpa Guru'}</span>
                                                </div>
                                            </div>

                                            <div className="mt-auto pt-2 border-t border-black/5 flex justify-between text-xs opacity-70">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> Sesi {cls.sesi}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-white dark:bg-slate-950 flex justify-between items-center gap-4 z-10">
                    <div className="text-xs text-muted-foreground hidden sm:block">
                        <span className="font-medium text-foreground">Tip:</span> Pilih kelas tujuan lalu klik "Lanjut Transfer".
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" onClick={onClose}>Batal</Button>
                        <Button
                            onClick={() => setShowConfirmation(true)}
                            disabled={!selectedClassId}
                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] shadow-md"
                        >
                            Lanjut Transfer <ArrowRightLeft className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default StudentTransferModal;
