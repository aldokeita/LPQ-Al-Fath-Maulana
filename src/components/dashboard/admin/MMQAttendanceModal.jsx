
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { calculateTimeDifference, determineAttendanceStatus } from '@/utils/AttendanceStatusLogic';

const MMQAttendanceModal = ({ isOpen, onClose, record, onSave, onDelete }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        status: 'Tidak Hadir',
        check_in_time: '',
        notes: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (record) {
            let initialTime = '';
            if (record.check_in_timestamp) {
                const date = new Date(record.check_in_timestamp);
                initialTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            }

            setFormData({
                status: record.status || 'Tidak Hadir',
                check_in_time: initialTime,
                notes: record.notes || ''
            });
        }
    }, [record]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let newTimestamp = null;
            let finalStatus = formData.status;

            if (formData.check_in_time) {
                const dateStr = record.attendance_date;
                newTimestamp = new Date(`${dateStr}T${formData.check_in_time}:00`).toISOString();

                // Recalculate status if time is provided
                if (record.schedule?.start_time) {
                    const scheduleStart = new Date(`${dateStr}T${record.schedule.start_time}`);
                    finalStatus = determineAttendanceStatus(newTimestamp, scheduleStart.toISOString());
                }
            } else {
                finalStatus = formData.status || 'Tidak Hadir';
            }

            // Build payload to send to the parent component (MMQManagement)
            // It will call saveMMQAttendance via the useMMQAttendance hook.
            const updatedData = {
                id: record.id,
                guru_id: record.guru_id,
                schedule_id: record.schedule_id,
                attendance_date: record.attendance_date,
                check_in_timestamp: newTimestamp,
                status: finalStatus,
                notes: formData.notes,
                updated_at: new Date().toISOString()
            };

            if (onSave) {
                await onSave(updatedData);
            }

            onClose();
        } catch (error) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Yakin ingin menghapus data absensi ini?')) {
            setIsDeleting(true);
            try {
                if (onDelete) await onDelete(record.id);
                onClose();
            } catch (error) {
                toast({
                    title: "Error",
                    description: error.message,
                    variant: "destructive"
                });
            } finally {
                setIsDeleting(false);
            }
        }
    };

    if (!record) return null;

    const timeDiff = formData.check_in_time && record.schedule?.start_time
        ? calculateTimeDifference(
            new Date(`${record.attendance_date}T${formData.check_in_time}:00`).toISOString(),
            new Date(`${record.attendance_date}T${record.schedule.start_time}`).toISOString()
          )
        : 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Absensi MMQ</DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg mb-4 border">
                    <Avatar className="w-12 h-12">
                        <AvatarImage src={record.guru?.foto_url} />
                        <AvatarFallback>{record.guru?.nama?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{record.guru?.nama}</p>
                        <p className="text-xs text-muted-foreground">
                            {new Date(record.attendance_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Status Kehadiran</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(val) => setFormData(p => ({ ...p, status: val }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Hadir"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Hadir</div></SelectItem>
                                <SelectItem value="Terlambat"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500"/> Terlambat</div></SelectItem>
                                <SelectItem value="Tidak Hadir"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500"/> Tidak Hadir</div></SelectItem>
                                <SelectItem value="Alpha"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-700"/> Alpha</div></SelectItem>
                                <SelectItem value="Izin"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500"/> Izin</div></SelectItem>
                                <SelectItem value="Sakit"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-600"/> Sakit</div></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Jam Datang (Opsional)</Label>
                        <Input
                            type="time"
                            value={formData.check_in_time}
                            onChange={(e) => setFormData(p => ({ ...p, check_in_time: e.target.value }))}
                        />
                        {timeDiff > 0 && formData.status !== 'Tidak Hadir' && formData.status !== 'Alpha' && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Terlambat {timeDiff} menit
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Catatan</Label>
                        <Textarea
                            placeholder="Alasan keterlambatan, izin, dll..."
                            value={formData.notes}
                            onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                        />
                    </div>
                </div>

                <DialogFooter className="mt-6 flex items-center justify-between sm:justify-between w-full">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting || isSaving || !record.id}
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus Record'}
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Batal</Button>
                        <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Simpan'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MMQAttendanceModal;
