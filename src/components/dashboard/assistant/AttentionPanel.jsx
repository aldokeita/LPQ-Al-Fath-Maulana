import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Check, CheckCircle2, EyeOff, Loader2, PhoneCall, RefreshCw, UserCheck, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/attendanceAdapters';
import {
  FOLLOWUP_CHANNELS, FOLLOWUP_RESULTS, formatSchoolDate, getAbsentDates,
  groupAttentionByClass, groupAttentionBySantri, isAttendanceAlert, RULE_LABELS, TINGKAT_LABELS, validateFollowup,
} from '@/lib/assistantAlerts';
import {
  decideAlert, fetchAttention, getAssistantErrorMessage, recordAlertFollowup, recordPresenceCorrections,
} from '@/lib/assistantAlertAdapters';

const TINGKAT_STYLES = {
  tinggi: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30',
  sedang: 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-300/30',
  rendah: 'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-400/15 dark:text-slate-200 dark:ring-slate-400/30',
};

// Tingkat dibaca dari label; hanya kartu prioritas tinggi diberi rona lembut agar tetap menonjol.
const CARD_TONE = {
  tinggi: 'border-rose-300/70 bg-rose-50/60 dark:border-rose-400/30 dark:bg-rose-500/[0.06]',
  sedang: 'border-border/70 bg-card',
  rendah: 'border-border/70 bg-card',
};

const CorrectionForm = ({ item, onDone, onCancel }) => {
  const dates = getAbsentDates(item);
  const [selected, setSelected] = useState([]);
  const [keterangan, setKeterangan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const toggle = (date) => setSelected((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));

  const submit = async (event) => {
    event.preventDefault();
    if (!selected.length) { setError('Pilih tanggal saat santri sebenarnya hadir.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      const result = await recordPresenceCorrections({ alertId: item.alert_id, dates: selected, keterangan });
      toast({
        title: 'Koreksi tersimpan',
        description: result?.ditutup ? 'Peringatan ditutup karena santri sebenarnya hadir.' : `Masih ${result?.sisa_absen} sesi tanpa kehadiran.`,
      });
      onDone();
    } catch (err) {
      setError(getAssistantErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-border/70 bg-muted/40 p-3">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tanggal santri sebenarnya hadir (lupa tap / kartu hilang)</legend>
        <div className="flex flex-wrap gap-2">
          {dates.map((date) => {
            const on = selected.includes(date);
            return (
              <button key={date} type="button" aria-pressed={on} onClick={() => toggle(date)}
                className={cn('min-h-[40px] rounded-lg border px-3 text-sm transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-background text-foreground hover:bg-muted')}>
                {on && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}{formatSchoolDate(date)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={`kor-${item.alert_id}`}>Keterangan (opsional)</Label>
        <Input id={`kor-${item.alert_id}`} maxLength={300} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Contoh: kartu tertinggal di rumah" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>Batal</Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
          Simpan koreksi
        </Button>
      </div>
    </form>
  );
};

const FollowupForm = ({ group, onDone, onCancel }) => {
  const today = getLocalDateString();
  const [form, setForm] = useState({ tanggal_kontak: today, saluran: 'whatsapp', hasil: 'terhubung', catatan: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const id = `fu-${group.santriId}`;

  const submit = async (event) => {
    event.preventDefault();
    const invalid = validateFollowup(form, today);
    if (invalid) { setError(invalid); return; }
    setIsSaving(true);
    setError(null);
    try {
      await recordAlertFollowup({ alertIds: group.items.map((item) => item.alert_id), form });
      toast({ title: 'Tindak lanjut dicatat', description: `Kontak wali ${group.nama} tersimpan.` });
      onDone();
    } catch (err) {
      setError(getAssistantErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 sm:grid-cols-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-tgl`}>Tanggal kontak</Label>
        <Input id={`${id}-tgl`} type="date" max={today} value={form.tanggal_kontak} onChange={(e) => update('tanggal_kontak', e.target.value)} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-sal`}>Saluran</Label>
        <Select value={form.saluran} onValueChange={(v) => update('saluran', v)}>
          <SelectTrigger id={`${id}-sal`}><SelectValue /></SelectTrigger>
          <SelectContent>{FOLLOWUP_CHANNELS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-has`}>Hasil</Label>
        <Select value={form.hasil} onValueChange={(v) => update('hasil', v)}>
          <SelectTrigger id={`${id}-has`}><SelectValue /></SelectTrigger>
          <SelectContent>{FOLLOWUP_RESULTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5 sm:col-span-3">
        <Label htmlFor={`${id}-cat`}>Catatan singkat (opsional)</Label>
        <Textarea id={`${id}-cat`} rows={2} maxLength={500} value={form.catatan} onChange={(e) => update('catatan', e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>Batal</Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <PhoneCall className="mr-2 h-4 w-4" aria-hidden="true" />}
          Simpan kontak
        </Button>
      </div>
    </form>
  );
};

const IgnoreForm = ({ item, onDone, onCancel }) => {
  const [alasan, setAlasan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!alasan.trim()) { setError('Tulis alasan singkat.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      await decideAlert({ alertId: item.alert_id, keputusan: 'diabaikan', catatan: alasan });
      toast({ title: 'Peringatan diabaikan', description: 'Alasan Anda tercatat.' });
      onDone();
    } catch (err) {
      setError(getAssistantErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-border/70 bg-muted/40 p-3">
      <Label htmlFor={`ab-${item.alert_id}`}>Alasan mengabaikan</Label>
      <Input id={`ab-${item.alert_id}`} maxLength={500} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: santri sedang sakit, wali sudah memberi tahu" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>Batal</Button>
        <Button type="submit" size="sm" variant="secondary" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Abaikan
        </Button>
      </div>
    </form>
  );
};

const IssueRow = ({ item, onChanged }) => {
  const [mode, setMode] = useState(null);
  const done = () => { setMode(null); onChanged(); };

  return (
    <li className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-foreground">
          {RULE_LABELS[item.rule] || item.rule}
          {item.tingkat === 'tinggi' && <span className="sr-only"> (tingkat tinggi)</span>}
        </p>
        {mode === null && (
          <div className="flex gap-1">
            {isAttendanceAlert(item) && (
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setMode('koreksi')}>
                <UserCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Sebenarnya hadir
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => setMode('abaikan')}
              aria-label={`Abaikan perkara ${RULE_LABELS[item.rule]}`}>
              <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Abaikan
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{item.alasan}</p>
      {item.jumlah_pengingat > 1 && (
        <p className="text-xs text-muted-foreground">Pengingat ke-{item.jumlah_pengingat}; pertama muncul {new Date(item.first_alert_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}.</p>
      )}
      {mode === 'koreksi' && <CorrectionForm item={item} onDone={done} onCancel={() => setMode(null)} />}
      {mode === 'abaikan' && <IgnoreForm item={item} onDone={done} onCancel={() => setMode(null)} />}
    </li>
  );
};

const SantriCard = ({ group, onChanged }) => {
  const [mode, setMode] = useState(null);
  const [isMarking, setIsMarking] = useState(false);

  const markHandled = async () => {
    setIsMarking(true);
    try {
      for (const item of group.items) {
        await decideAlert({ alertId: item.alert_id, keputusan: 'ditangani' });
      }
      toast({ title: 'Ditandai sudah ditangani', description: group.nama });
      onChanged();
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: getAssistantErrorMessage(err), variant: 'destructive' });
      onChanged();
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <li className={cn('rounded-xl border p-3 shadow-sm', CARD_TONE[group.tingkat])}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground">{group.nama}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1', TINGKAT_STYLES[group.tingkat])}>
          {TINGKAT_LABELS[group.tingkat]}
        </span>
      </div>
      <ul className="space-y-2">
        {group.items.map((item) => <IssueRow key={item.alert_id} item={item} onChanged={onChanged} />)}
      </ul>
      {mode === null && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => setMode('wali')}>
            <PhoneCall className="mr-2 h-4 w-4" aria-hidden="true" /> Wali dihubungi
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={markHandled} disabled={isMarking}>
            {isMarking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />} Sudah ditangani
          </Button>
        </div>
      )}
      {mode === 'wali' && <FollowupForm group={group} onDone={() => { setMode(null); onChanged(); }} onCancel={() => setMode(null)} />}
    </li>
  );
};

// variant="guru": hanya kelas guru; disembunyikan sepenuhnya selama mode senyap.
// variant="admin": semua kelas, dikelompokkan per kelas, menampilkan jumlah peringatan senyap.
const AttentionPanel = ({ variant = 'guru', refreshKey = 0 }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchAttention(null));
    } catch (err) {
      setError(getAssistantErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const items = useMemo(() => data?.items || [], [data]);
  const santriCount = useMemo(() => new Set(items.map((item) => item.santri_id)).size, [items]);
  const highCount = useMemo(() => groupAttentionBySantri(items).filter((g) => g.tingkat === 'tinggi').length, [items]);
  const groups = useMemo(() => groupAttentionByClass(items), [items]);
  const isAdmin = variant === 'admin';

  // Guru tidak melihat apa pun selama mode senyap (masa pengukuran "sebelum"), juga tidak kilasan memuat.
  if (!isAdmin && !error && (!data || data.mode_senyap)) return null;

  return (
    <Card className="mb-8 border-border/60 shadow-lg" aria-labelledby={`attention-title-${variant}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-4">
        <div>
          <CardTitle id={`attention-title-${variant}`} className="flex items-center gap-2 text-lg">
            <BellRing className="h-5 w-5 text-primary" aria-hidden="true" /> Perlu Perhatian
          </CardTitle>
          <CardDescription>
            {isAdmin ? 'Santri TPQ anak di semua kelas yang perlu ditindaklanjuti.' : 'Santri di kelas Anda yang perlu ditindaklanjuti. Data dari absensi digital dan catatan hafalan.'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {highCount > 0 && <span className="font-semibold text-rose-600 dark:text-rose-300">{highCount} prioritas tinggi · </span>}
              {santriCount} santri, {items.length} perkara
            </p>
          )}
          <Button type="button" size="icon" variant="ghost" onClick={load} disabled={isLoading} aria-label="Muat ulang daftar perlu perhatian">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        {isAdmin && data?.mode_senyap && (
          <div className="flex items-start gap-2 rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100" role="status">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Mode senyap aktif. {data.senyap_tersimpan} perkara tersimpan untuk pengukuran dan tidak ditampilkan ke guru.</span>
          </div>
        )}
        {isLoading && !data && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat…</p>
        )}
        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
          </p>
        )}
        {data && !error && items.length === 0 && (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Tidak ada santri yang perlu perhatian saat ini.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.classId} aria-label={`Kelas ${group.namaKelas}`}>
            {(isAdmin || groups.length > 1) && <h3 className="mb-2 text-sm font-semibold text-foreground/80">{group.namaKelas}</h3>}
            <ul className="grid gap-3 lg:grid-cols-2">
              {groupAttentionBySantri(group.items).map((santri) => (
                <SantriCard key={santri.santriId} group={santri} onChanged={load} />
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
};

export default AttentionPanel;
