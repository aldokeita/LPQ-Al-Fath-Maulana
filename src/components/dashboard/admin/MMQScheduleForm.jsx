import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Clock, MapPin, CalendarDays, Loader2 } from 'lucide-react';

const DAYS = [
    { value: '1', label: 'Senin' },
    { value: '2', label: 'Selasa' },
    { value: '3', label: 'Rabu' },
    { value: '4', label: 'Kamis' },
    { value: '5', label: 'Jumat' },
    { value: '6', label: 'Sabtu' },
    { value: '0', label: 'Minggu' }
];

const MMQScheduleForm = ({ initialData, onSave, onCancel, isSaving }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        day_of_week: '5',
        start_time: '10:00',
        end_time: '11:00',
        location: 'LPQ Al-Fath Maulana',
        is_active: true
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                id: initialData.id,
                day_of_week: String(initialData.day_of_week),
                start_time: initialData.start_time?.substring(0, 5) || '10:00',
                end_time: initialData.end_time?.substring(0, 5) || '',
                location: initialData.location || '',
                is_active: initialData.is_active ?? true
            });
        }
    }, [initialData]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.start_time || !formData.location || formData.day_of_week === '') {
            toast({
                title: "Validasi Gagal",
                description: "Mohon lengkapi hari, waktu, dan lokasi.",
                variant: "destructive"
            });
            return;
        }

        const submitData = {
            ...formData,
            day_of_week: parseInt(formData.day_of_week, 10),
            start_time: formData.start_time.length === 5 ? `${formData.start_time}:00` : formData.start_time,
            end_time: formData.end_time
                ? (formData.end_time.length === 5 ? `${formData.end_time}:00` : formData.end_time)
                : null
        };

        onSave(submitData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-500" /> Hari
                </Label>
                <Select
                    value={formData.day_of_week}
                    onValueChange={(val) => handleChange('day_of_week', val)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih Hari" />
                    </SelectTrigger>
                    <SelectContent>
                        {DAYS.map(day => (
                            <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" /> Jam Mulai
                </Label>
                <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleChange('start_time', e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" /> Jam Selesai
                </Label>
                <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleChange('end_time', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-500" /> Lokasi
                </Label>
                <Input
                    placeholder="Contoh: Gedung Utama LPQ"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    required
                />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                        Batal
                    </Button>
                )}
                <Button type="submit" className="bg-primary" disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Simpan Jadwal
                </Button>
            </div>
        </form>
    );
};

export default MMQScheduleForm;
