import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BellOff, BookOpenCheck, CalendarDays, FlaskConical, Layers, Loader2, Play, Save, Send,
  SlidersHorizontal, Sparkles, UserCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { QIROATI_JILID_OPTIONS } from '@/lib/qiroatiJilid';
import { buildSettingsPatch, updateSetting, validateSettings, WEEKDAYS } from '@/lib/assistantAlerts';
import {
  fetchAssistantSettings, getAssistantErrorMessage, runAssistantRulesNow, saveAssistantSettings,
} from '@/lib/assistantAlertAdapters';
import AttentionPanel from '@/components/dashboard/assistant/AttentionPanel';
import TelegramConnect from '@/components/dashboard/assistant/TelegramConnect';
import AiSettings from '@/components/dashboard/admin/AiSettings';
import AiWorkspace from '@/components/dashboard/assistant/AiWorkspace';
import AiKnowledge from '@/components/dashboard/admin/AiKnowledge';
import AiEvaluation from '@/components/dashboard/admin/AiEvaluation';
import ResearchData from '@/components/dashboard/admin/ResearchData';

const SUBTABS = [
  { value: 'pantauan', label: 'Pantauan', icon: Activity },
  { value: 'pengaturan', label: 'Standar', icon: SlidersHorizontal },
  { value: 'ai', label: 'AI & Materi', icon: Sparkles },
  { value: 'evaluasi', label: 'Evaluasi', icon: FlaskConical },
];
const SUBTAB_KEY = 'lpq-asisten-subtab';

const readSubtab = () => {
  try {
    const v = window.sessionStorage.getItem(SUBTAB_KEY);
    return SUBTABS.some((t) => t.value === v) ? v : 'pantauan';
  } catch {
    return 'pantauan';
  }
};

const switchClass = 'data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600';

const NumberField = ({ id, label, hint, value, onChange, min, max, suffix }) => (
  <div className="grid content-start gap-1.5">
    <Label htmlFor={id} className="text-sm">{label}</Label>
    <div className="flex items-center gap-2">
      <Input id={id} type="number" inputMode="numeric" min={min} max={max} className="w-24 tabular-nums"
        value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
    {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
  </div>
);

const TONES = {
  teal: 'bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300',
  sky: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  amber: 'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300',
};

// Kartu satu kelompok pengaturan: ikon, judul, keterangan singkat, lalu isian.
const SettingCard = ({ icon: Icon, tone = 'teal', title, description, action, className, children }) => {
  const headingId = useId();
  return (
    <Card role="group" aria-labelledby={headingId} className={cn('flex flex-col p-5 sm:p-6', className)}>
      <div className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', TONES[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <h3 id={headingId} className="text-base font-semibold leading-tight text-foreground">{title}</h3>
            {action}
          </div>
          {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="mt-5 flex-1">{children}</div>
    </Card>
  );
};

const StatusChip = ({ on, onLabel, offLabel, icon: Icon }) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
    on ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
      : 'border-border bg-muted/50 text-muted-foreground')}>
    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    {on ? onLabel : offLabel}
  </span>
);

const AssistantSettings = () => {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState(readSubtab);

  const changeTab = (value) => {
    setTab(value);
    try { window.sessionStorage.setItem(SUBTAB_KEY, value); } catch { /* penyimpanan sesi tidak tersedia */ }
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settings = await fetchAssistantSettings();
      setSaved(settings);
      setDraft(settings);
    } catch (err) {
      setError(getAssistantErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = useMemo(() => (saved && draft ? buildSettingsPatch(saved, draft) : {}), [saved, draft]);
  const hasChanges = Object.keys(patch).length > 0;
  const set = (path, value) => setDraft((prev) => updateSetting(prev, path, value));

  const toggleDay = (day) => setDraft((prev) => {
    const days = prev.school_days.includes(day) ? prev.school_days.filter((d) => d !== day) : [...prev.school_days, day];
    return { ...prev, school_days: days.sort((a, b) => a - b) };
  });

  const setJilidLimit = (jilid, value) => setDraft((prev) => {
    const perJilid = { ...(prev.jilid.per_jilid || {}) };
    if (value === '' || Number(value) === Number(prev.jilid.default_days)) delete perJilid[jilid];
    else perJilid[jilid] = Number(value);
    return { ...prev, jilid: { ...prev.jilid, per_jilid: perJilid } };
  });

  const handleSave = async () => {
    const invalid = validateSettings(draft);
    if (invalid) { toast({ title: 'Periksa pengaturan', description: invalid, variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const next = await saveAssistantSettings(patch);
      setSaved(next);
      setDraft(next);
      setRefreshKey((k) => k + 1);
      toast({ title: 'Pengaturan tersimpan', description: 'Berlaku untuk pemeriksaan berikutnya. Versi lama tetap tercatat.' });
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: getAssistantErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const result = await runAssistantRulesNow();
      toast({ title: 'Pemeriksaan selesai', description: `${result.santri_diperiksa} santri diperiksa, ${result.peringatan_baru} peringatan baru${result.senyap ? ' (senyap)' : ''}.` });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast({ title: 'Pemeriksaan gagal', description: getAssistantErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  };

  const loadState = (
    <>
      {isLoading && (
        <Card className="flex items-center gap-2 p-5 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat pengaturan…
        </Card>
      )}
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={load}>Coba lagi</Button>
        </div>
      )}
    </>
  );

  const jilidCustom = draft ? Object.keys(draft.jilid.per_jilid || {}).length : 0;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-5 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-teal-400/25 via-sky-400/20 to-violet-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[min(100%,18rem)] flex-1 basis-80">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Asisten santri</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Memantau kehadiran, kenaikan jilid, dan hafalan santri TPQ anak. Pemeriksaan berjalan otomatis setiap hari pukul 23.30 WIB.
            </p>
          </div>
          {saved && (
            <div className="flex flex-wrap gap-2" aria-label="Status asisten">
              <StatusChip on={!saved.silent_mode} icon={BellOff} onLabel="Peringatan tampil" offLabel="Mode senyap" />
              <StatusChip on={Boolean(saved.notifications?.telegram_enabled)} icon={Send} onLabel="Telegram aktif" offLabel="Telegram mati" />
              <StatusChip on={Boolean(saved.ai?.enabled)} icon={Sparkles} onLabel="AI aktif" offLabel="AI mati" />
            </div>
          )}
        </div>
      </Card>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList aria-label="Bagian asisten" className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
          {SUBTABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="min-h-[44px] w-full px-2">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
              {hasChanges && (value === 'pengaturan' || value === 'ai') && (
                <><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" /><span className="sr-only"> (belum disimpan)</span></>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pantauan" className="mt-5 space-y-5">
          <Card className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', TONES.teal)}>
              <Play className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="min-w-[min(100%,14rem)] flex-1 basis-56 text-sm text-muted-foreground">
              <span className="block font-medium text-foreground">Pemeriksaan manual</span>
              Jalankan bila baru mengubah standar atau mengoreksi kehadiran, tanpa menunggu jadwal malam.
            </p>
            <Button type="button" variant="outline" onClick={handleRun} disabled={isRunning || hasChanges || !saved}
              title={hasChanges ? 'Simpan perubahan dulu' : undefined} className="w-full sm:w-auto">
              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
              Jalankan sekarang
            </Button>
          </Card>
          <AttentionPanel variant="admin" refreshKey={refreshKey} />
          <AiWorkspace key={`ai-${refreshKey}`} />
        </TabsContent>

        <TabsContent value="pengaturan" className="mt-5 space-y-5">
          {loadState}
          {draft && (
            <>
              <Card className={cn('flex items-start gap-3 p-5 sm:p-6',
                draft.silent_mode && 'border-sky-300/70 bg-sky-50/70 dark:border-sky-400/30 dark:bg-sky-400/10')}>
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', TONES.sky)}>
                  <BellOff className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-h-10 items-center justify-between gap-3">
                    <Label htmlFor="assistant-silent" className="text-base font-semibold">Mode senyap</Label>
                    <Switch id="assistant-silent" className={switchClass} checked={draft.silent_mode} onCheckedChange={(v) => set('silent_mode', v)} />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Peringatan tetap dihitung dan disimpan untuk pengukuran masa &quot;sebelum&quot;, tetapi tidak ditampilkan ke guru.
                    Matikan saat asisten mulai dipakai.
                  </p>
                </div>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <SettingCard icon={CalendarDays} tone="teal" title="Hari mengaji"
                  description="Sesi hanya dihitung pada hari ini. Hari libur diatur di menu Kalender.">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4 xl:grid-cols-7">
                    {WEEKDAYS.map((day) => {
                      const on = draft.school_days.includes(day.value);
                      return (
                        <button key={day.value} type="button" aria-pressed={on} onClick={() => toggleDay(day.value)}
                          className={cn('min-h-[44px] rounded-xl border px-2 text-sm font-medium transition-[transform,background-color,color] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                            on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background/70 text-foreground hover:bg-muted')}>
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </SettingCard>

                <SettingCard icon={UserCheck} tone="blue" title="Kehadiran"
                  description="Kapan santri yang sering tidak hadir masuk daftar perlu perhatian.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField id="att-n" label="Peringatan setelah" suffix="sesi beruntun" min={2} max={20}
                      value={draft.attendance.consecutive_sessions} onChange={(v) => set('attendance.consecutive_sessions', v)} />
                    <NumberField id="att-rep" label="Ingatkan ulang tiap" suffix="sesi" min={1} max={20}
                      value={draft.attendance.repeat_every_sessions} onChange={(v) => set('attendance.repeat_every_sessions', v)} />
                    <NumberField id="att-high" label="Tingkat tinggi mulai" suffix="sesi beruntun" min={2} max={40}
                      value={draft.attendance.high_consecutive_sessions} onChange={(v) => set('attendance.high_consecutive_sessions', v)} />
                    <NumberField id="att-pct" label="Kehadiran minimal 4 pekan" suffix="%" min={1} max={100}
                      value={draft.attendance.monthly_min_percent} onChange={(v) => set('attendance.monthly_min_percent', v)} />
                  </div>
                </SettingCard>

                <SettingCard icon={Layers} tone="violet" title="Kenaikan jilid"
                  description="Batas lama santri berada di satu jilid sebelum diingatkan.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField id="jil-def" label="Batas di satu jilid" suffix="hari" min={7} max={730}
                      hint="Untuk jilid tanpa batas khusus."
                      value={draft.jilid.default_days} onChange={(v) => set('jilid.default_days', v)} />
                    <NumberField id="jil-rep" label="Ingatkan ulang tiap" suffix="hari" min={1} max={90}
                      value={draft.jilid.repeat_every_days} onChange={(v) => set('jilid.repeat_every_days', v)} />
                  </div>
                  <details className="group mt-4 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
                    <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
                      Batas khusus per jilid <span className="text-muted-foreground">({jilidCustom} diatur)</span>
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">Kosongkan untuk memakai batas umum ({draft.jilid.default_days} hari).</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {QIROATI_JILID_OPTIONS.map((jilid, index) => (
                        <div key={jilid} className="grid gap-1">
                          <Label htmlFor={`jl-${index}`} className="text-xs">{jilid}</Label>
                          <Input id={`jl-${index}`} type="number" inputMode="numeric" min={7} max={730} placeholder={String(draft.jilid.default_days)}
                            className="tabular-nums" value={draft.jilid.per_jilid?.[jilid] ?? ''} onChange={(e) => setJilidLimit(jilid, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </details>
                </SettingCard>

                <SettingCard icon={BookOpenCheck} tone="amber" title="Hafalan dan muroja'ah"
                  description="Mengingatkan hafalan yang macet dan setoran yang belum ditinjau guru.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField id="haf-proses" label="Item proses/ulang terlalu lama" suffix="hari" min={3} max={365}
                      value={draft.hafalan.proses_max_days} onChange={(v) => set('hafalan.proses_max_days', v)} />
                    <NumberField id="haf-wajib" label="Cek hafalan wajib setelah" suffix="% batas jilid" min={10} max={100}
                      value={draft.hafalan.required_items_after_percent} onChange={(v) => set('hafalan.required_items_after_percent', v)} />
                    <NumberField id="haf-muro" label="Setoran belum ditinjau" suffix="hari" min={1} max={60}
                      value={draft.hafalan.murojaah_review_max_days} onChange={(v) => set('hafalan.murojaah_review_max_days', v)} />
                  </div>
                </SettingCard>

                <SettingCard icon={Send} tone="sky" title="Notifikasi Telegram" className="lg:col-span-2"
                  description="Guru menerima ringkasan harian kelasnya; guru dan admin menerima peringatan prioritas tinggi. Isi pesan hanya nama depan santri, kelas, dan alasan singkat. Tidak ada pesan selama mode senyap atau pukul 21.00–06.00 WIB."
                  action={<Switch id="tg-enabled" aria-label="Kirim lewat Telegram" className={switchClass}
                    checked={Boolean(draft.notifications?.telegram_enabled)} onCheckedChange={(v) => set('notifications.telegram_enabled', v)} />}>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,20rem)_auto]">
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor="tg-bot" className="text-sm">Nama pengguna bot</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">@</span>
                        <Input id="tg-bot" autoComplete="off" spellCheck={false} placeholder="LpqAlFathBot" maxLength={32}
                          value={draft.notifications?.bot_username || ''} onChange={(e) => set('notifications.bot_username', e.target.value.replace(/^@/, '').trim())} />
                      </div>
                    </div>
                    <NumberField id="tg-hour" label="Jam ringkasan harian" suffix="WIB" min={6} max={20}
                      value={draft.notifications?.summary_hour} onChange={(v) => set('notifications.summary_hour', v)} />
                  </div>
                  <TelegramConnect className="mt-4" showWhenDisabled />
                </SettingCard>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-5 space-y-5">
          {loadState}
          {draft?.ai && (
            <SettingCard icon={Sparkles} tone="violet" title="Rekomendasi AI"
              description="Guru dapat meminta saran tindak lanjut dan draf pesan wali di kartu santri. Nama, kelas, dan nomor HP tidak dikirim ke penyedia AI. Saran yang sama dipakai ulang tanpa biaya sampai data santri berubah.">
              <AiSettings ai={draft.ai} savedAi={saved.ai} onChange={set} />
            </SettingCard>
          )}
          <AiKnowledge />
        </TabsContent>

        <TabsContent value="evaluasi" className="mt-5 space-y-5">
          <AiEvaluation />
          <ResearchData />
        </TabsContent>
      </Tabs>

      {hasChanges && (tab === 'pengaturan' || tab === 'ai') && (
        <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/40 bg-background/85 p-3 shadow-lg shadow-black/10 backdrop-blur-xl sm:px-4" role="region" aria-label="Perubahan belum disimpan">
          <p className="min-w-[min(100%,12rem)] flex-1 basis-48 text-sm">
            <span className="font-medium text-foreground">Ada perubahan belum disimpan.</span>{' '}
            <span className="text-muted-foreground">Versi lama tetap tercatat.</span>
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setDraft(saved)} disabled={isSaving}>Batalkan</Button>
            <Button type="button" className="flex-1 sm:flex-none" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              Simpan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantSettings;
