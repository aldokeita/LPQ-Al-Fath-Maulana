import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarOff, Fingerprint, Loader2, PhoneCall, RefreshCw, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/attendanceAdapters';
import { DEFAULT_SESSION_TIMES } from '@/utils/AttendanceStatusLogic';
import {
  buildChangedEntries,
  buildInitialDraft,
  CONFIRMATION_STATUSES,
  countDraftStatuses,
  FOLLOWUP_CHANNELS,
  FOLLOWUP_RESULTS,
  getTapSuggestion,
  KETERANGAN_MAX,
  validateConfirmationEntry,
  validateFollowup,
} from '@/lib/attendanceConfirmation';
import {
  fetchClassFollowups,
  fetchRollCall,
  getConfirmationErrorMessage,
  recordWaliFollowup,
  saveRollCall,
} from '@/lib/attendanceConfirmationAdapters';

const SESSION_OPTIONS = Object.keys(DEFAULT_SESSION_TIMES);

const STATUS_STYLES = {
  hadir: 'data-[on=true]:bg-emerald-600 data-[on=true]:text-white data-[on=true]:border-emerald-600',
  terlambat: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500',
  tidak_hadir: 'data-[on=true]:bg-rose-600 data-[on=true]:text-white data-[on=true]:border-rose-600',
};

const channelLabel = (value) => FOLLOWUP_CHANNELS.find((item) => item.value === value)?.label || value;
const resultLabel = (value) => FOLLOWUP_RESULTS.find((item) => item.value === value)?.label || value;

const FollowupForm = ({ santri, classId, defaultWarningDate, today, onSaved, onCancel }) => {
  const [form, setForm] = useState({
    tanggal_peringatan: defaultWarningDate || '',
    tanggal_kontak: today,
    saluran: 'whatsapp',
    hasil: 'terhubung',
    catatan: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateFollowup(form, today);
    if (validation) { setError(validation); return; }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await recordWaliFollowup({ form, santriId: santri.santri_id, classId });
      toast({ title: 'Tindak lanjut dicatat', description: `Kontak wali ${santri.nama} tersimpan.` });
      onSaved(saved);
    } catch (err) {
      setError(getConfirmationErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const idPrefix = `fu-${santri.santri_id}`;
  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 sm:grid-cols-2" aria-label={`Catat kontak wali ${santri.nama}`}>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-kontak`}>Tanggal kontak</Label>
        <Input id={`${idPrefix}-kontak`} type="date" max={today} value={form.tanggal_kontak} onChange={(e) => update('tanggal_kontak', e.target.value)} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-peringatan`}>Tanggal peringatan (opsional)</Label>
        <Input id={`${idPrefix}-peringatan`} type="date" max={today} value={form.tanggal_peringatan} onChange={(e) => update('tanggal_peringatan', e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-saluran`}>Saluran</Label>
        <Select value={form.saluran} onValueChange={(value) => update('saluran', value)}>
          <SelectTrigger id={`${idPrefix}-saluran`}><SelectValue /></SelectTrigger>
          <SelectContent>{FOLLOWUP_CHANNELS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-hasil`}>Hasil</Label>
        <Select value={form.hasil} onValueChange={(value) => update('hasil', value)}>
          <SelectTrigger id={`${idPrefix}-hasil`}><SelectValue /></SelectTrigger>
          <SelectContent>{FOLLOWUP_RESULTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-catatan`}>Catatan singkat (opsional)</Label>
        <Textarea id={`${idPrefix}-catatan`} rows={2} maxLength={500} value={form.catatan} onChange={(e) => update('catatan', e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>Batal</Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <PhoneCall className="mr-2 h-4 w-4" aria-hidden="true" />}
          Simpan kontak
        </Button>
      </div>
    </form>
  );
};

const AttendanceRollCallDialog = ({ open, onOpenChange, kelas }) => {
  const today = getLocalDateString();
  const [tanggal, setTanggal] = useState(today);
  const [sesi, setSesi] = useState(kelas?.sesi || SESSION_OPTIONS[0]);
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [followups, setFollowups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [openFollowup, setOpenFollowup] = useState(null);

  const sessionOptions = useMemo(
    () => (kelas?.sesi && !SESSION_OPTIONS.includes(kelas.sesi) ? [kelas.sesi, ...SESSION_OPTIONS] : SESSION_OPTIONS),
    [kelas?.sesi],
  );

  useEffect(() => {
    if (open) { setTanggal(today); setSesi(kelas?.sesi || SESSION_OPTIONS[0]); setOpenFollowup(null); }
  }, [open, kelas?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!kelas?.id || !tanggal || !sesi) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [rollCall, classFollowups] = await Promise.all([
        fetchRollCall({ classId: kelas.id, tanggal, sesi }),
        fetchClassFollowups(kelas.id),
      ]);
      setData(rollCall);
      setDraft(buildInitialDraft(rollCall.santri || [], sesi));
      setFollowups(classFollowups);
    } catch (err) {
      setLoadError(getConfirmationErrorMessage(err));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [kelas?.id, tanggal, sesi]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const rows = useMemo(() => data?.santri || [], [data]);
  const changed = useMemo(() => buildChangedEntries(rows, draft), [rows, draft]);
  const counts = useMemo(() => countDraftStatuses(rows, draft), [rows, draft]);
  const lastFollowup = useMemo(() => {
    const map = {};
    followups.forEach((item) => { if (!map[item.santri_id]) map[item.santri_id] = item; });
    return map;
  }, [followups]);

  const setEntry = (santriId, patch) => setDraft((prev) => ({ ...prev, [santriId]: { ...prev[santriId], ...patch } }));

  const handleSave = async () => {
    const invalid = changed.map(validateConfirmationEntry).find(Boolean);
    if (invalid) { toast({ title: 'Periksa isian', description: invalid, variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const result = await saveRollCall({ classId: kelas.id, tanggal, sesi, rows, draft });
      if (result) {
        toast({ title: 'Absen panggil tersimpan', description: `${result.baru} baru, ${result.diubah} diubah.` });
      }
      await load();
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: getConfirmationErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const holiday = data?.libur;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Absen Panggil — {kelas?.nama_kelas}</DialogTitle>
          <DialogDescription>
            Tetapkan kehadiran setiap santri. Tap RFID/wajah hanya saran awal; status yang Anda simpan menjadi catatan resmi.
            Perubahan berikutnya tersimpan sebagai riwayat, bukan menimpa catatan lama.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="roll-call-date">Tanggal</Label>
            <Input id="roll-call-date" type="date" max={today} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="roll-call-session">Sesi</Label>
            <Select value={sesi} onValueChange={setSesi}>
              <SelectTrigger id="roll-call-session"><SelectValue /></SelectTrigger>
              <SelectContent>{sessionOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={load} disabled={isLoading} aria-label="Muat ulang daftar">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
          </Button>
        </div>

        {holiday && (
          <div className={cn('flex items-start gap-2 rounded-xl border p-3 text-sm', holiday.is_holiday ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100' : 'border-border bg-muted/40')} role="status">
            <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{holiday.is_holiday ? 'Hari libur di kalender akademik' : 'Agenda kalender'}: <strong>{holiday.title}</strong>{holiday.is_holiday && '. Sesi ini tidak dihitung dalam rekap kehadiran.'}</span>
          </div>
        )}

        {isLoading && !data && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat daftar santri…</div>
        )}

        {loadError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        )}

        {data && rows.length === 0 && !isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada santri aktif di kelas ini.</p>
        )}

        {rows.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Hadir {counts.hadir} · Terlambat {counts.terlambat} · Tidak Hadir {counts.tidak_hadir}
              {counts.kosong > 0 && <> · <strong className="text-foreground">{counts.kosong} belum ditetapkan</strong></>}
            </p>
            <ol className="grid gap-2">
              {rows.map((row, index) => {
                const entry = draft[row.santri_id] || { status: '', keterangan: '' };
                const suggestion = getTapSuggestion(row, sesi);
                const isSaved = Boolean(row.status);
                const isDirty = changed.some((item) => item.santri_id === row.santri_id);
                const last = lastFollowup[row.santri_id];
                const needsNote = entry.status && entry.status !== 'hadir';
                return (
                  <li key={row.santri_id} className={cn('rounded-xl border bg-card p-3 transition-colors', isDirty ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border/70')}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground"><span className="mr-1 text-muted-foreground">{index + 1}.</span>{row.nama}</p>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Fingerprint className="h-3 w-3" aria-hidden="true" />{suggestion ? suggestion.label : 'belum ada tap'}</span>
                          {isSaved && <span>· dikonfirmasi{row.jumlah_perubahan > 0 ? `, diubah ${row.jumlah_perubahan}×` : ''}</span>}
                          {!isSaved && entry.status && <span className="text-primary">· saran, belum disimpan</span>}
                          {last && <span>· wali dihubungi {last.tanggal_kontak} ({channelLabel(last.saluran)}, {resultLabel(last.hasil)})</span>}
                        </p>
                      </div>
                      <div role="radiogroup" aria-label={`Status ${row.nama}`} className="flex shrink-0 gap-1">
                        {CONFIRMATION_STATUSES.map((item) => {
                          const isOn = entry.status === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              role="radio"
                              aria-checked={isOn}
                              data-on={isOn}
                              onClick={() => setEntry(row.santri_id, { status: item.value })}
                              className={cn('min-h-[40px] min-w-[64px] rounded-lg border border-border bg-background px-2 text-sm font-medium text-foreground transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', STATUS_STYLES[item.value])}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {needsNote && (
                      <div className="mt-2">
                        <Label htmlFor={`ket-${row.santri_id}`} className="sr-only">Keterangan {row.nama}</Label>
                        <Input id={`ket-${row.santri_id}`} placeholder="Keterangan (opsional)" maxLength={KETERANGAN_MAX} value={entry.keterangan || ''} onChange={(e) => setEntry(row.santri_id, { keterangan: e.target.value })} />
                      </div>
                    )}
                    <div className="mt-2 flex justify-end">
                      {openFollowup !== row.santri_id && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setOpenFollowup(row.santri_id)}>
                          <PhoneCall className="mr-2 h-4 w-4" aria-hidden="true" /> Wali dihubungi
                        </Button>
                      )}
                    </div>
                    {openFollowup === row.santri_id && (
                      <FollowupForm
                        santri={row}
                        classId={kelas.id}
                        today={today}
                        defaultWarningDate={row.status === 'tidak_hadir' || entry.status === 'tidak_hadir' ? tanggal : ''}
                        onCancel={() => setOpenFollowup(null)}
                        onSaved={(saved) => { setFollowups((prev) => [saved, ...prev]); setOpenFollowup(null); }}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-col gap-2 border-t border-border bg-background/95 px-6 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">{changed.length ? `${changed.length} perubahan siap disimpan` : 'Tidak ada perubahan'}</p>
              <Button type="button" onClick={handleSave} disabled={isSaving || changed.length === 0}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
                Simpan absen panggil
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceRollCallDialog;
