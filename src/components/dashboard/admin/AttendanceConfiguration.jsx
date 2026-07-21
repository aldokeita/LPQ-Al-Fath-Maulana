import React, { useEffect, useState } from 'react';
import { Clock3, Loader2, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  DEFAULT_ATTENDANCE_CONFIGURATION,
  fetchAttendanceConfiguration,
  normalizeAttendanceConfiguration,
  saveAttendanceConfiguration,
} from '@/lib/attendanceConfiguration';

const TIME_FIELDS = [
  { key: 'open', label: 'Absensi dibuka' },
  { key: 'start', label: 'Sesi dimulai' },
  { key: 'onTimeUntil', label: 'Tepat waktu sampai' },
  { key: 'end', label: 'Sesi berakhir' },
];

const cloneDefaults = () => normalizeAttendanceConfiguration(DEFAULT_ATTENDANCE_CONFIGURATION);

const AttendanceConfiguration = () => {
  const [configuration, setConfiguration] = useState(cloneDefaults);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAttendanceConfiguration()
      .then(value => {
        if (active) setConfiguration(value);
      })
      .catch(error => {
        if (active) {
          toast({
            title: 'Menggunakan waktu bawaan',
            description: error?.message || 'Konfigurasi tersimpan belum dapat dimuat.',
            variant: 'destructive',
          });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateSession = (sessionName, field, value) => {
    setConfiguration(current => ({
      ...current,
      sessions: {
        ...current.sessions,
        [sessionName]: {
          ...current.sessions[sessionName],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await saveAttendanceConfiguration(configuration);
      setConfiguration(saved);
      toast({
        title: 'Konfigurasi tersimpan',
        description: 'Waktu absensi digital akan memakai pengaturan terbaru.',
      });
    } catch (error) {
      toast({
        title: 'Gagal menyimpan konfigurasi',
        description: error?.message || 'Periksa kembali urutan waktu setiap sesi.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfiguration(cloneDefaults());
    toast({
      title: 'Waktu bawaan dipulihkan',
      description: 'Tekan Simpan Pengaturan untuk menerapkannya.',
    });
  };

  if (isLoading) {
    return (
      <div className="game-config-panel flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="game-config-panel space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
            <Clock3 className="h-5 w-5 text-cyan-600" />
            Waktu Absensi Digital
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur jendela kehadiran dan batas tepat waktu untuk setiap sesi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Waktu Bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving} className="game-config-save">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-5 rounded-lg border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/70 dark:bg-cyan-950/25">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" />
          <div>
            <Label htmlFor="enforce-session-end" className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tutup absensi otomatis setelah sesi berakhir
            </Label>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Jika dinonaktifkan, scan setelah jam akhir tetap diterima dan dicatat sebagai Terlambat.
            </p>
          </div>
        </div>
        <Switch
          id="enforce-session-end"
          checked={configuration.enforceSessionEnd}
          onCheckedChange={checked => setConfiguration(current => ({ ...current, enforceSessionEnd: checked }))}
          aria-label="Tutup absensi otomatis setelah sesi berakhir"
        />
      </div>

      <div className="space-y-3">
        {Object.entries(configuration.sessions).map(([sessionName, session]) => (
          <section
            key={sessionName}
            className="grid gap-4 rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/45 lg:grid-cols-[150px_repeat(4,minmax(120px,1fr))] lg:items-end"
          >
            <div className="self-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sesi</p>
              <h4 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">{sessionName}</h4>
            </div>
            {TIME_FIELDS.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`${sessionName}-${field.key}`} className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {field.label}
                </Label>
                <Input
                  id={`${sessionName}-${field.key}`}
                  type="time"
                  value={session[field.key]}
                  onChange={event => updateSession(sessionName, field.key, event.target.value)}
                  className="h-10 bg-white font-mono tabular-nums dark:bg-slate-950"
                />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};

export default AttendanceConfiguration;
