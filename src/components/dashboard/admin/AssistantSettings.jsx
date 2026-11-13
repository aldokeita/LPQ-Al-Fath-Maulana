import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Play, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

const NumberField = ({ id, label, hint, value, onChange, min, max, suffix }) => (
  <div className="grid content-start gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex items-center gap-2">
      <Input id={id} type="number" inputMode="numeric" min={min} max={max} className="w-24"
        value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const Section = ({ title, description, children }) => (
  <fieldset className="rounded-xl border border-border/70 p-4">
    <legend className="px-1 text-sm font-semibold">{title}</legend>
    {description && <p className="mb-3 text-xs text-muted-foreground">{description}</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  </fieldset>
);

const AssistantSettings = () => {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Asisten</CardTitle>
          <CardDescription>
            Standar yang dipakai untuk menentukan santri TPQ anak yang perlu perhatian. Pemeriksaan berjalan otomatis setiap hari pukul 23.30 WIB.
            Setiap perubahan disimpan sebagai versi baru.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat pengaturan…</p>}
          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
            </p>
          )}
          {draft && (
            <>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-sky-300/70 bg-sky-50/60 p-4 dark:border-sky-400/30 dark:bg-sky-400/10">
                <div>
                  <Label htmlFor="assistant-silent" className="text-sm font-semibold">Mode senyap</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saat aktif, peringatan tetap dihitung dan disimpan untuk pengukuran masa &quot;sebelum&quot;, tetapi tidak ditampilkan ke guru.
                    Matikan saat asisten mulai dipakai.
                  </p>
                </div>
                <Switch id="assistant-silent" className="data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600" checked={draft.silent_mode} onCheckedChange={(v) => set('silent_mode', v)} />
              </div>

              <fieldset className="rounded-xl border border-border/70 p-4">
                <legend className="px-1 text-sm font-semibold">Hari mengaji</legend>
                <p className="mb-3 text-xs text-muted-foreground">Hari libur diatur di menu Kalender dan otomatis tidak dihitung.</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const on = draft.school_days.includes(day.value);
                    return (
                      <button key={day.value} type="button" aria-pressed={on} onClick={() => toggleDay(day.value)}
                        className={cn('min-h-[40px] rounded-lg border px-3 text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted')}>
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <Section title="Kehadiran">
                <NumberField id="att-n" label="Peringatan setelah" suffix="sesi beruntun" min={2} max={20}
                  value={draft.attendance.consecutive_sessions} onChange={(v) => set('attendance.consecutive_sessions', v)} />
                <NumberField id="att-rep" label="Ingatkan ulang tiap" suffix="sesi" min={1} max={20}
                  value={draft.attendance.repeat_every_sessions} onChange={(v) => set('attendance.repeat_every_sessions', v)} />
                <NumberField id="att-high" label="Tingkat tinggi mulai" suffix="sesi beruntun" min={2} max={40}
                  value={draft.attendance.high_consecutive_sessions} onChange={(v) => set('attendance.high_consecutive_sessions', v)} />
                <NumberField id="att-pct" label="Kehadiran minimal 4 pekan" suffix="%" min={1} max={100}
                  value={draft.attendance.monthly_min_percent} onChange={(v) => set('attendance.monthly_min_percent', v)} />
              </Section>

              <Section title="Kenaikan jilid">
                <NumberField id="jil-def" label="Batas di satu jilid" suffix="hari" min={7} max={730}
                  hint="Berlaku untuk jilid yang tidak diatur khusus di bawah."
                  value={draft.jilid.default_days} onChange={(v) => set('jilid.default_days', v)} />
                <NumberField id="jil-rep" label="Ingatkan ulang tiap" suffix="hari" min={1} max={90}
                  value={draft.jilid.repeat_every_days} onChange={(v) => set('jilid.repeat_every_days', v)} />
              </Section>

              <details className="rounded-xl border border-border/70 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Batas khusus per jilid ({Object.keys(draft.jilid.per_jilid || {}).length} diatur)</summary>
                <p className="mt-2 text-xs text-muted-foreground">Kosongkan untuk memakai batas umum ({draft.jilid.default_days} hari).</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {QIROATI_JILID_OPTIONS.map((jilid, index) => (
                    <div key={jilid} className="grid gap-1">
                      <Label htmlFor={`jl-${index}`} className="text-xs">{jilid}</Label>
                      <Input id={`jl-${index}`} type="number" inputMode="numeric" min={7} max={730} placeholder={String(draft.jilid.default_days)}
                        value={draft.jilid.per_jilid?.[jilid] ?? ''} onChange={(e) => setJilidLimit(jilid, e.target.value)} />
                    </div>
                  ))}
                </div>
              </details>

              <Section title="Hafalan dan muroja'ah">
                <NumberField id="haf-proses" label="Item proses/ulang terlalu lama" suffix="hari" min={3} max={365}
                  value={draft.hafalan.proses_max_days} onChange={(v) => set('hafalan.proses_max_days', v)} />
                <NumberField id="haf-wajib" label="Cek hafalan wajib setelah" suffix="% batas jilid" min={10} max={100}
                  value={draft.hafalan.required_items_after_percent} onChange={(v) => set('hafalan.required_items_after_percent', v)} />
                <NumberField id="haf-muro" label="Setoran belum ditinjau" suffix="hari" min={1} max={60}
                  value={draft.hafalan.murojaah_review_max_days} onChange={(v) => set('hafalan.murojaah_review_max_days', v)} />
              </Section>

              <fieldset className="rounded-xl border border-border/70 p-4">
                <legend className="px-1 text-sm font-semibold">Notifikasi Telegram</legend>
                <p className="mb-3 text-xs text-muted-foreground">
                  Guru menerima ringkasan harian kelasnya; guru dan admin menerima peringatan prioritas tinggi. Isi pesan hanya nama depan santri,
                  kelas, dan alasan singkat. Tidak ada pesan selama mode senyap atau pada pukul 21.00–06.00 WIB.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="tg-enabled" className="text-sm">Kirim lewat Telegram</Label>
                    <Switch id="tg-enabled" className="data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600"
                      checked={Boolean(draft.notifications?.telegram_enabled)} onCheckedChange={(v) => set('notifications.telegram_enabled', v)} />
                  </div>
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor="tg-bot">Nama pengguna bot</Label>
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
              </fieldset>

              {draft.ai && <AiSettings ai={draft.ai} savedAi={saved.ai} onChange={set} />}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={handleRun} disabled={isRunning || hasChanges}
                  title={hasChanges ? 'Simpan perubahan dulu' : undefined}>
                  {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
                  Jalankan pemeriksaan sekarang
                </Button>
                <div className="flex gap-2">
                  {hasChanges && <Button type="button" variant="ghost" onClick={() => setDraft(saved)} disabled={isSaving}>Batalkan</Button>}
                  <Button type="button" onClick={handleSave} disabled={!hasChanges || isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
                    Simpan pengaturan
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AttentionPanel variant="admin" refreshKey={refreshKey} />
      <AiWorkspace key={`ai-${refreshKey}`} />
      <AiKnowledge />
      <AiEvaluation />
    </div>
  );
};

export default AssistantSettings;
