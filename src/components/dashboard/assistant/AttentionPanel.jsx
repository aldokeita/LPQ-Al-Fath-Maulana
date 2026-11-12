import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUpCircle, BellRing, BookOpen, CalendarX2, Check, CheckCircle2, ChevronDown, EyeOff, Loader2,
  MessageCircle, Mic, PhoneCall, RefreshCw, Sparkles, User, UserCheck, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/attendanceAdapters';
import { getAdjacentQiroatiJilid } from '@/lib/qiroatiJilid';
import { changeSantriJilid, getJilidChangeErrorMessage } from '@/lib/jilidChangeAdapters';
import { generateWhatsAppLink } from '@/utils/whatsappMessages';
import {
  AREA_LABELS, buildWaliMessage, describeHafalanAlerts, labelOf, latestWaliContact, countSantriByArea, FOLLOWUP_CHANNELS, FOLLOWUP_RESULTS, formatSchoolDate, getAbsentDates,
  groupAttentionByClass, groupAttentionBySantri, isAttendanceAlert, RULE_AREAS, RULE_LABELS, TINGKAT_LABELS, validateFollowup,
} from '@/lib/assistantAlerts';
import {
  decideAlert, fetchAttention, fetchSantriSnapshots, getAssistantErrorMessage, recordAlertFollowup, recordPresenceCorrections,
} from '@/lib/assistantAlertAdapters';
import JilidChangeModal from '@/components/dashboard/admin/JilidChangeModal';
import AttentionInsights from '@/components/dashboard/assistant/AttentionInsights';
import '@/styles/attention-panel.css';

const TINGKAT_STYLES = {
  tinggi: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30',
  sedang: 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-300/30',
  rendah: 'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-400/15 dark:text-slate-200 dark:ring-slate-400/30',
};

// Cincin avatar memberi tanda tingkat; teks label tetap ada agar tidak bergantung pada warna.
const AVATAR_RING = {
  tinggi: 'ring-rose-400/80 dark:ring-rose-400/60',
  sedang: 'ring-amber-400/80 dark:ring-amber-300/60',
  rendah: 'ring-slate-300 dark:ring-slate-500',
};

const AREA_STYLE = {
  kehadiran: { icon: CalendarX2, tone: 'text-rose-700 bg-rose-100/80 dark:text-rose-200 dark:bg-rose-500/15' },
  jilid: { icon: BookOpen, tone: 'text-amber-800 bg-amber-100/80 dark:text-amber-100 dark:bg-amber-400/15' },
  hafalan: { icon: Sparkles, tone: 'text-violet-700 bg-violet-100/80 dark:text-violet-200 dark:bg-violet-500/15' },
  murojaah: { icon: Mic, tone: 'text-sky-700 bg-sky-100/80 dark:text-sky-200 dark:bg-sky-500/15' },
};

const OPEN_KEY = (variant) => `lpq.attention.open.${variant}`;
// Panel guru tertutup secara default; admin terbuka. Pilihan pengguna diingat per perangkat.
const readOpen = (variant) => {
  const fallback = variant === 'admin';
  try {
    const stored = window.localStorage.getItem(OPEN_KEY(variant));
    return stored === null ? fallback : stored === '1';
  } catch { return fallback; }
};
const writeOpen = (variant, open) => {
  try { window.localStorage.setItem(OPEN_KEY(variant), open ? '1' : '0'); } catch { /* penyimpanan lokal tidak tersedia */ }
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

const IgnoreForm = ({ item, alertIds, onDone, onCancel }) => {
  const [alasan, setAlasan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!alasan.trim()) { setError('Tulis alasan singkat.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      for (const alertId of alertIds || [item.alert_id]) {
        await decideAlert({ alertId, keputusan: 'diabaikan', catatan: alasan });
      }
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

const IssueRow = ({ item, snapshot, actions, onPromote, onChanged }) => {
  const [mode, setMode] = useState(null);
  const done = () => { setMode(null); onChanged(); };
  const area = RULE_AREAS[item.rule] || 'kehadiran';
  const { icon: AreaIcon, tone } = AREA_STYLE[area];
  const nextJilid = item.rule === 'jilid_lama' ? getAdjacentQiroatiJilid(snapshot?.jilid || item.detail?.jilid, 'up') : null;

  return (
    <li className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone)} aria-hidden="true">
        <AreaIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground">
            {RULE_LABELS[item.rule] || item.rule}
            {item.tingkat === 'tinggi' && <span className="sr-only"> (tingkat tinggi)</span>}
          </p>
          {mode === null && (
            <div className="flex flex-wrap gap-1">
              {item.rule === 'jilid_lama' && nextJilid && (
                <Button type="button" size="sm" className="attention-action-primary h-8 px-2.5 text-xs" onClick={() => onPromote(nextJilid)}>
                  <ArrowUpCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Naikkan ke {nextJilid}
                </Button>
              )}
              {isAttendanceAlert(item) && (
                <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setMode('koreksi')}>
                  <UserCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Sebenarnya hadir
                </Button>
              )}
              {area === 'murojaah' && actions?.onOpenMurojaah && (
                <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => actions.onOpenMurojaah(item.santri_id)}>
                  <Mic className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Tinjau setoran
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
      </div>
    </li>
  );
};

const HAFALAN_CATEGORIES = [
  { value: 'Doa', label: 'Doa' },
  { value: 'Sholat', label: 'Sholat' },
  { value: 'Surat', label: 'Surat' },
];

// Hafalan macet dan hafalan wajib belum lulus ditampilkan sebagai satu perkara "Hafalan".
const HafalanRow = ({ items, actions, onChanged }) => {
  const [mode, setMode] = useState(null);
  const done = () => { setMode(null); onChanged(); };
  const { icon: AreaIcon, tone } = AREA_STYLE.hafalan;
  const santriId = items[0].santri_id;
  const isHigh = items.some((i) => i.tingkat === 'tinggi');

  return (
    <li className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone)} aria-hidden="true">
        <AreaIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground">
            Hafalan belum aman{isHigh && <span className="sr-only"> (tingkat tinggi)</span>}
          </p>
          {mode === null && (
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => setMode('abaikan')}
              aria-label="Abaikan perkara hafalan">
              <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Abaikan
            </Button>
          )}
        </div>
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {describeHafalanAlerts(items).map((line) => <li key={line}>{line}</li>)}
        </ul>
        {mode === null && actions?.onOpenHafalan && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Buka penilaian hafalan">
            <span className="text-xs text-muted-foreground">Nilai ulang:</span>
            {HAFALAN_CATEGORIES.map((cat) => (
              <Button key={cat.value} type="button" size="sm" variant="outline"
                className="h-8 border-violet-300 px-3 text-xs text-violet-800 hover:bg-violet-50 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
                onClick={() => actions.onOpenHafalan(santriId, cat.value)}>
                {cat.label}
              </Button>
            ))}
          </div>
        )}
        {mode === 'abaikan' && <IgnoreForm item={items[0]} alertIds={items.map((i) => i.alert_id)} onDone={done} onCancel={() => setMode(null)} />}
      </div>
    </li>
  );
};

const WaliContactNote = ({ contact }) => {
  if (!contact) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100" role="status">
      <PhoneCall className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Wali sudah dihubungi {formatSchoolDate(contact.tanggal)} lewat {labelOf(FOLLOWUP_CHANNELS, contact.saluran).toLowerCase()} · {labelOf(FOLLOWUP_RESULTS, contact.hasil).toLowerCase()}. Kartu tetap tampil sampai masalahnya selesai atau ditandai sudah ditangani.</span>
    </p>
  );
};

const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const SantriCard = ({ group, snapshot, actions, guruName, showClass, onChanged }) => {
  const [mode, setMode] = useState(null);
  const [isMarking, setIsMarking] = useState(false);
  const [jilidChange, setJilidChange] = useState(null);
  const [isSavingJilid, setIsSavingJilid] = useState(false);
  const phone = snapshot?.no_hp_wali;
  const waLink = useMemo(() => (phone ? generateWhatsAppLink(phone, buildWaliMessage(group, { guruName })) : null), [phone, group, guruName]);
  const titleId = `attention-santri-${group.santriId}`;
  const hafalanItems = group.items.filter((i) => RULE_AREAS[i.rule] === 'hafalan');
  const otherItems = group.items.filter((i) => RULE_AREAS[i.rule] !== 'hafalan');
  const perkaraCount = otherItems.length + (hafalanItems.length ? 1 : 0);
  const waliContact = latestWaliContact(group.items);

  const markHandled = async () => {
    setIsMarking(true);
    try {
      for (const item of group.items) {
        await decideAlert({ alertId: item.alert_id, keputusan: 'ditangani' });
      }
      toast({ title: 'Ditandai sudah ditangani', description: group.nama });
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: getAssistantErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsMarking(false);
      onChanged();
    }
  };

  const startPromote = (nextJilid) => setJilidChange({
    santri: { id: group.santriId, nama_lengkap: group.nama, no_hp_ortu: phone || null },
    direction: 'up',
    currentJilid: snapshot?.jilid || group.items.find((i) => i.rule === 'jilid_lama')?.detail?.jilid,
    nextJilid,
  });

  const confirmPromote = async () => {
    if (!jilidChange) return;
    setIsSavingJilid(true);
    try {
      const saved = await changeSantriJilid({ santriId: group.santriId, currentJilid: jilidChange.currentJilid, nextJilid: jilidChange.nextJilid });
      toast({ title: 'Jilid dinaikkan', description: `${group.nama} kini di ${saved.to_jilid}. Peringatan jilid tertutup otomatis.` });
      actions?.onJilidChanged?.(group.santriId, saved.to_jilid);
      setJilidChange(null);
      onChanged();
    } catch (err) {
      toast({ title: 'Gagal menaikkan jilid', description: getJilidChangeErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsSavingJilid(false);
    }
  };

  return (
    <li className={cn('attention-card rounded-2xl p-4', group.tingkat === 'tinggi' && 'attention-card--high')} aria-labelledby={titleId}>
      <header className="mb-3 flex items-start gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-600 text-sm font-bold text-white ring-[3px] ring-offset-2 ring-offset-card', AVATAR_RING[group.tingkat])} aria-hidden="true">
          {initials(group.nama)}
        </span>
        <div className="min-w-0 flex-1">
          <h4 id={titleId} className="truncate text-base font-semibold leading-tight text-foreground">{group.nama}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showClass && <>{group.namaKelas} · </>}{perkaraCount} perkara{snapshot?.jilid && <> · {snapshot.jilid}</>}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', TINGKAT_STYLES[group.tingkat])}>
          {TINGKAT_LABELS[group.tingkat]}
        </span>
      </header>

      <AttentionInsights snapshot={snapshot} />

      <ul className="mt-3 divide-y divide-border/60">
        {otherItems.map((item) => (
          <IssueRow key={item.alert_id} item={item} snapshot={snapshot} actions={actions} onPromote={startPromote} onChanged={onChanged} />
        ))}
        {hafalanItems.length > 0 && <HafalanRow items={hafalanItems} actions={actions} onChanged={onChanged} />}
      </ul>

      <WaliContactNote contact={waliContact} />

      {mode === null && (
        <footer className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {waLink && (
            <Button asChild size="sm" variant="outline" className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" /> Kirim pesan ke wali<span className="sr-only"> (membuka WhatsApp)</span>
              </a>
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setMode('wali')}>
            <PhoneCall className="mr-2 h-4 w-4" aria-hidden="true" /> {waliContact ? 'Catat kontak lagi' : 'Catat kontak wali'}
          </Button>
          {actions?.onOpenDetail && (
            <Button type="button" size="sm" variant="ghost" onClick={() => actions.onOpenDetail(group.santriId)}>
              <User className="mr-2 h-4 w-4" aria-hidden="true" /> Detail santri
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" className="sm:ml-auto" onClick={markHandled} disabled={isMarking}>
            {isMarking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />} Sudah ditangani
          </Button>
        </footer>
      )}
      {mode === 'wali' && <FollowupForm group={group} onDone={() => { setMode(null); onChanged(); }} onCancel={() => setMode(null)} />}

      {jilidChange && (
        <JilidChangeModal isOpen onClose={() => !isSavingJilid && setJilidChange(null)} onConfirm={confirmPromote} isSaving={isSavingJilid}
          kategori="Anak" {...jilidChange} />
      )}
    </li>
  );
};

const AreaChip = ({ area, count }) => {
  const { icon: Icon, tone } = AREA_STYLE[area];
  return (
    <li className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', tone, count === 0 && 'opacity-50')}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{AREA_LABELS[area]}</span>
      <span className="font-bold tabular-nums">{count}</span>
    </li>
  );
};

// variant="guru": hanya kelas guru; disembunyikan sepenuhnya selama mode senyap.
// variant="admin": semua kelas, dikelompokkan per kelas, menampilkan jumlah peringatan senyap.
// actions (opsional, dari dasbor guru): onOpenDetail, onOpenHafalan, onOpenMurojaah, onJilidChanged.
const AttentionPanel = ({ variant = 'guru', refreshKey = 0, actions = null, guruName = '' }) => {
  const [data, setData] = useState(null);
  const [snapshots, setSnapshots] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(() => readOpen(variant));
  const isAdmin = variant === 'admin';
  const contentId = `attention-content-${variant}`;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchAttention(null);
      setData(next);
      const ids = [...new Set((next?.items || []).map((item) => item.santri_id))];
      try {
        const rows = await fetchSantriSnapshots(ids);
        setSnapshots(Object.fromEntries(rows.map((row) => [row.santri_id, row])));
      } catch {
        // Infografik bersifat pelengkap; daftar perkara tetap tampil bila ringkasan gagal dimuat.
        setSnapshots({});
      }
    } catch (err) {
      setError(getAssistantErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const toggle = () => setOpen((prev) => { writeOpen(variant, !prev); return !prev; });

  const items = useMemo(() => data?.items || [], [data]);
  const santriGroups = useMemo(() => groupAttentionBySantri(items), [items]);
  const highCount = santriGroups.filter((g) => g.tingkat === 'tinggi').length;
  const areaCounts = useMemo(() => countSantriByArea(items), [items]);
  const classGroups = useMemo(() => groupAttentionByClass(items), [items]);

  // Guru tidak melihat apa pun selama mode senyap (masa pengukuran "sebelum"), juga tidak kilasan memuat.
  if (!isAdmin && !error && (!data || data.mode_senyap)) return null;

  return (
    <section className="attention-shell mb-8 rounded-3xl" aria-labelledby={`attention-title-${variant}`}>
      <div className="attention-aurora" aria-hidden="true" />
      <header className="relative flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={contentId}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <span className="attention-bell relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
            <BellRing className="h-5 w-5" aria-hidden="true" />
            {highCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-background">{highCount}</span>}
          </span>
          <span className="min-w-0">
            <span id={`attention-title-${variant}`} className="block text-lg font-semibold leading-tight text-foreground">Perlu Perhatian</span>
            <span className="block text-sm text-foreground/75" aria-live="polite">
              {items.length === 0
                ? (isAdmin ? 'Santri TPQ anak di semua kelas.' : 'Santri di kelas Anda yang perlu ditindaklanjuti.')
                : <>{santriGroups.length} santri · {items.length} perkara{highCount > 0 && <> · <span className="font-semibold text-rose-700 dark:text-rose-300">{highCount} prioritas tinggi</span></>}</>}
            </span>
          </span>
          <ChevronDown className={cn('ml-auto h-5 w-5 shrink-0 text-foreground/70 transition-transform duration-300 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
          <span className="sr-only">{open ? 'Sembunyikan panel' : 'Tampilkan panel'}</span>
        </button>
        <Button type="button" size="icon" variant="ghost" className="shrink-0 rounded-xl" onClick={load} disabled={isLoading} aria-label="Muat ulang daftar perlu perhatian">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
        </Button>
        {items.length > 0 && (
          <ul className="flex w-full flex-wrap gap-1.5" aria-label="Jumlah santri per bidang">
            {Object.keys(AREA_STYLE).map((area) => <AreaChip key={area} area={area} count={areaCounts[area]} />)}
          </ul>
        )}
      </header>

      <div id={contentId} className="attention-collapse relative" data-open={open} {...(!open && { inert: '' })}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-5 px-4 pb-5 sm:px-5">
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
              <p className="flex items-center gap-2 rounded-2xl bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> Semua santri dalam kondisi baik. Tidak ada yang perlu perhatian saat ini.
              </p>
            )}
            {classGroups.map((cls) => (
              <section key={cls.classId} aria-label={`Kelas ${cls.namaKelas}`}>
                {(isAdmin || classGroups.length > 1) && <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{cls.namaKelas}</h3>}
                <ul className="grid gap-3 xl:grid-cols-2">
                  {groupAttentionBySantri(cls.items).map((santri) => (
                    <SantriCard key={santri.santriId} group={santri} snapshot={snapshots[santri.santriId]} actions={actions}
                      guruName={guruName} showClass={false} onChanged={load} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AttentionPanel;
