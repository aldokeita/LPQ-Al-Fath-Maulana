import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, PlugZap, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS } from '@/lib/assistantAlerts';
import { fetchAiStatus, testAiConnection } from '@/lib/assistantAlertAdapters';

const usd = (value) => `$${Number(value || 0).toFixed(Number(value || 0) < 1 ? 4 : 2)}`;

const DecimalField = ({ id, label, hint, value, onChange, max }) => (
  <div className="grid content-start gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">$</span>
      <Input id={id} type="number" inputMode="decimal" min={0} max={max} step="0.01" className="w-28"
        value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
    </div>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

// Pengaturan rekomendasi AI. Kunci API tidak pernah diisi di sini: admin memasangnya sebagai secret
// Edge Function lewat scripts/setup-ai-asisten.sh. Bagian ini hanya menampilkan apakah kunci sudah ada.
const AiSettings = ({ ai, savedAi, onChange }) => {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const provider = AI_PROVIDERS.find((p) => p.id === ai.provider) || AI_PROVIDERS[0];
  const unsaved = JSON.stringify(ai) !== JSON.stringify(savedAi);

  const loadStatus = useCallback(async () => {
    setStatusError(null);
    try {
      setStatus(await fetchAiStatus());
    } catch (err) {
      setStatusError(err.message);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus, savedAi]);

  const keyInfo = status?.providers?.[ai.provider];
  const usage = status?.usage;
  const budget = Number(savedAi?.monthly_budget_usd || 0);
  const usedPct = budget > 0 ? Math.min(100, Math.round((Number(usage?.biaya_usd || 0) / budget) * 100)) : 0;

  const runTest = async () => {
    setIsTesting(true);
    try {
      const result = await testAiConnection();
      toast({ title: 'Koneksi AI berhasil', description: `${result.model} menjawab dalam ${(result.ms / 1000).toFixed(1)} detik.` });
      loadStatus();
    } catch (err) {
      toast({ title: 'Koneksi AI gagal', description: err.message, variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <fieldset className="rounded-xl border border-border/70 p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" /> Rekomendasi AI</legend>
      <p className="mb-3 text-xs text-muted-foreground">
        Guru dapat meminta saran tindak lanjut dan draf pesan wali di kartu santri. Nama, kelas, dan nomor HP tidak dikirim ke penyedia AI.
        Saran yang sama dipakai ulang tanpa biaya sampai data santri berubah.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
          <Label htmlFor="ai-enabled" className="text-sm">Aktifkan saran AI</Label>
          <Switch id="ai-enabled" className="data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600"
            checked={Boolean(ai.enabled)} onCheckedChange={(v) => onChange('ai.enabled', v)} />
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="ai-provider">Penyedia</Label>
          <Select value={ai.provider} onValueChange={(v) => { onChange('ai.provider', v); onChange('ai.model', ''); }}>
            <SelectTrigger id="ai-provider"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="ai-model">Model</Label>
          <Input id="ai-model" autoComplete="off" spellCheck={false} maxLength={100}
            placeholder={provider.model || 'wajib diisi'} value={ai.model || ''}
            onChange={(e) => onChange('ai.model', e.target.value.trim())} />
          <p className="text-xs text-muted-foreground">{provider.model ? `Kosongkan untuk memakai ${provider.model}.` : 'Tulis nama model persis seperti di dokumentasi penyedia.'}</p>
        </div>
        {ai.provider === 'custom' && (
          <div className="grid content-start gap-1.5">
            <Label htmlFor="ai-base">Alamat API</Label>
            <Input id="ai-base" type="url" autoComplete="off" spellCheck={false} placeholder="https://contoh.ai/v1"
              value={ai.base_url || ''} onChange={(e) => onChange('ai.base_url', e.target.value.trim())} />
            <p className="text-xs text-muted-foreground">Endpoint bergaya OpenAI, tanpa /chat/completions.</p>
          </div>
        )}
        <DecimalField id="ai-budget" label="Anggaran per bulan" max={1000} value={ai.monthly_budget_usd}
          hint="Saran AI berhenti otomatis bila tercapai." onChange={(v) => onChange('ai.monthly_budget_usd', v)} />
        <div className="grid content-start gap-1.5">
          <Label htmlFor="ai-daily">Batas per guru</Label>
          <div className="flex items-center gap-2">
            <Input id="ai-daily" type="number" inputMode="numeric" min={1} max={500} className="w-24"
              value={ai.daily_limit_per_user ?? ''} onChange={(e) => onChange('ai.daily_limit_per_user', e.target.value === '' ? '' : Number(e.target.value))} />
            <span className="text-sm text-muted-foreground">saran/hari</span>
          </div>
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-border/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">Harga per 1 juta token (untuk menghitung anggaran)</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Biarkan 0 untuk memakai harga bawaan{status?.active?.price ? ` (saat ini input ${usd(status.active.price.input)}, output ${usd(status.active.price.output)})` : ''}.
          Isi sesuai halaman harga penyedia bila memakai model lain.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <DecimalField id="ai-price-in" label="Input" max={1000} value={ai.price_input_per_mtok} onChange={(v) => onChange('ai.price_input_per_mtok', v)} />
          <DecimalField id="ai-price-out" label="Output" max={1000} value={ai.price_output_per_mtok} onChange={(v) => onChange('ai.price_output_per_mtok', v)} />
        </div>
      </details>

      <div className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-2">
          {statusError && <p className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Status AI tidak dapat dimuat: {statusError}</p>}
          {!status && !statusError && <p className="flex items-center gap-2 text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memeriksa kunci API…</p>}
          {keyInfo && (
            <p className="flex items-center gap-2">
              {keyInfo.configured
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                : <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />}
              <span>
                {keyInfo.keyEnv
                  ? <>Kunci <code className="rounded bg-background px-1 text-xs">{keyInfo.keyEnv}</code> {keyInfo.configured ? 'terpasang.' : 'belum terpasang. Jalankan scripts/setup-ai-asisten.sh.'}</>
                  : 'Mode tiruan tidak memerlukan kunci dan tidak menghubungi penyedia mana pun.'}
              </span>
            </p>
          )}
          {usage && (
            <div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Bulan {usage.bulan}: {usd(usage.biaya_usd)} dari {usd(budget)} · {usage.permintaan} permintaan · {usage.dari_cache} dari simpanan · {usage.gagal} gagal
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-label="Pemakaian anggaran AI" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn('h-full rounded-full', usedPct >= 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-500 to-sky-500')} style={{ width: `${usedPct}%` }} />
              </div>
            </div>
          )}
        </div>
        <Button type="button" variant="outline" onClick={runTest} disabled={isTesting || unsaved} title={unsaved ? 'Simpan pengaturan dulu' : undefined}>
          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <PlugZap className="mr-2 h-4 w-4" aria-hidden="true" />} Uji koneksi
        </Button>
      </div>
    </fieldset>
  );
};

export default AiSettings;
