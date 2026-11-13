import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Download, Loader2, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fetchAiEvaluation } from '@/lib/assistantAlertAdapters';

const FITUR_LABELS = {
  rekomendasi: 'Saran per santri', kelas: 'Gambaran kelas', kelas_pekanan: 'Ringkasan pekanan', chat: 'Tanya asisten',
  rapor: 'Rapor wali', uji: 'Uji koneksi',
};
const JENIS_LABELS = { rekomendasi: 'Saran per santri', kelas: 'Gambaran kelas', chat: 'Jawaban chat', rapor: 'Rapor wali' };
const PRESETS = [{ days: 30, label: '30 hari' }, { days: 90, label: '90 hari' }, { days: 180, label: '6 bulan' }];

const isoDate = (d) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n) => isoDate(new Date(Date.now() - n * 86400000));
const usd = (v) => `$${Number(v || 0).toFixed(Number(v || 0) < 1 ? 4 : 2)}`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const Tile = ({ label, value, hint }) => (
  <div className="rounded-xl border border-border/60 bg-background/60 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const toCsv = (data, from, to) => {
  const rows = [['bagian', 'kunci', 'nilai_1', 'nilai_2', 'nilai_3', 'nilai_4', 'nilai_5']];
  rows.push(['periode', `${from} s.d. ${to}`]);
  (data.pemakaian || []).forEach((r) => rows.push(['pemakaian (ok, cache, gagal, biaya_usd, pengguna)', r.fitur, r.ok, r.cache, r.gagal, r.biaya_usd, r.pengguna]));
  (data.biaya_bulanan || []).forEach((r) => rows.push(['biaya_bulanan (biaya_usd, permintaan)', r.bulan, r.biaya_usd, r.permintaan]));
  (data.umpan_balik || []).forEach((r) => rows.push(['umpan_balik (suka, tidak_suka)', r.jenis, r.suka, r.tidak_suka]));
  (data.peringatan || []).forEach((r) => rows.push(['peringatan (jumlah, ditindaklanjuti, median_hari)', r.kelompok, r.jumlah, r.ditindaklanjuti, r.median_hari ?? '']));
  rows.push(['ringkasan', 'kontak_wali', data.kontak_wali], ['ringkasan', 'santri_dapat_saran', data.saran_santri], ['ringkasan', 'pertanyaan_chat', data.percakapan]);
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
};

// Evaluasi asisten AI untuk admin (bahan tesis): pemakaian, biaya, penilaian guru, dan perbandingan
// tindak lanjut peringatan yang mendapat saran AI dengan yang tidak.
const AiEvaluation = () => {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDate(new Date()));
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchAiEvaluation(from, to));
    } catch (err) {
      setError(String(err.message || '').includes('INVALID_RANGE') ? 'Rentang tanggal tidak valid (maksimal sekitar 13 bulan).' : err.message);
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const download = () => {
    const blob = new Blob([`﻿${toCsv(data, from, to)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluasi-asisten-ai_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pemakaian = data?.pemakaian || [];
  const totalOk = pemakaian.reduce((s, r) => s + Number(r.ok || 0), 0);
  const totalCache = pemakaian.reduce((s, r) => s + Number(r.cache || 0), 0);
  const totalBiaya = pemakaian.reduce((s, r) => s + Number(r.biaya_usd || 0), 0);
  const maxFitur = Math.max(1, ...pemakaian.map((r) => Number(r.ok || 0) + Number(r.cache || 0)));
  const umpan = data?.umpan_balik || [];
  const suka = umpan.reduce((s, r) => s + Number(r.suka || 0), 0);
  const tidak = umpan.reduce((s, r) => s + Number(r.tidak_suka || 0), 0);
  const peringatan = Object.fromEntries((data?.peringatan || []).map((r) => [r.kelompok, r]));

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-sky-600 dark:text-sky-300" aria-hidden="true" /> Evaluasi asisten AI</CardTitle>
          <CardDescription>Pemakaian, biaya, penilaian guru, dan dampak saran AI pada tindak lanjut santri yang perlu perhatian.</CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {PRESETS.map((p) => (
            <Button key={p.days} type="button" size="sm" variant={from === daysAgo(p.days - 1) && to === isoDate(new Date()) ? 'secondary' : 'outline'}
              onClick={() => { setFrom(daysAgo(p.days - 1)); setTo(isoDate(new Date())); }}>{p.label}</Button>
          ))}
          <div className="grid gap-1">
            <Label htmlFor="eval-from" className="text-xs">Dari</Label>
            <Input id="eval-from" type="date" className="h-9 w-40" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="eval-to" className="text-xs">Sampai</Label>
            <Input id="eval-to" type="date" className="h-9 w-40" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={load} disabled={isLoading} aria-label="Muat ulang evaluasi">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
          </Button>
          {data && <Button type="button" size="sm" variant="outline" onClick={download}><Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> Unduh CSV</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5" aria-busy={isLoading}>
        {isLoading && !data && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menghitung…</p>}
        {error && <p className="flex items-center gap-2 text-sm text-destructive" role="alert"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {error}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Permintaan AI" value={totalOk} hint={`${totalCache} dipakai ulang dari simpanan`} />
              <Tile label="Biaya" value={usd(totalBiaya)} hint="Perkiraan dari jumlah token" />
              <Tile label="Santri mendapat saran" value={data.saran_santri ?? 0} hint={`${data.percakapan ?? 0} pertanyaan chat`} />
              <Tile label="Penilaian guru" value={suka + tidak ? `${pct(suka, suka + tidak)}%` : '—'} hint={suka + tidak ? `${suka} bermanfaat · ${tidak} kurang tepat` : 'Belum ada penilaian'} />
            </div>

            <section aria-labelledby="eval-fitur">
              <h4 id="eval-fitur" className="mb-2 text-sm font-semibold text-foreground">Pemakaian per fitur</h4>
              {pemakaian.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pemakaian pada periode ini.</p> : (
                <ul className="space-y-2">
                  {pemakaian.map((r) => {
                    const total = Number(r.ok || 0) + Number(r.cache || 0);
                    return (
                      <li key={r.fitur} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_auto]">
                        <span className="truncate text-foreground/80">{FITUR_LABELS[r.fitur] || r.fitur}</span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span className="block h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500" style={{ width: `${pct(total, maxFitur)}%` }} />
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">{r.ok} baru · {r.cache} simpanan{r.gagal ? ` · ${r.gagal} gagal` : ''} · {usd(r.biaya_usd)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="eval-dampak">
              <h4 id="eval-dampak" className="mb-1 text-sm font-semibold text-foreground">Tindak lanjut santri yang perlu perhatian</h4>
              <p className="mb-2 text-xs text-muted-foreground">
                Ditindaklanjuti = ditandai sudah ditangani atau wali dihubungi. Median dihitung dari munculnya peringatan sampai tindakan pertama. {data.kontak_wali ?? 0} kontak wali tercatat.
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr><th scope="col" className="p-2.5 font-medium">Kelompok</th><th scope="col" className="p-2.5 font-medium">Peringatan</th><th scope="col" className="p-2.5 font-medium">Ditindaklanjuti</th><th scope="col" className="p-2.5 font-medium">Median waktu</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {[['dengan_saran_ai', 'Dengan saran AI'], ['tanpa_saran_ai', 'Tanpa saran AI']].map(([key, label]) => {
                      const r = peringatan[key];
                      return (
                        <tr key={key}>
                          <th scope="row" className="p-2.5 text-left font-medium text-foreground">{label}</th>
                          <td className="p-2.5 tabular-nums">{r?.jumlah ?? 0}</td>
                          <td className="p-2.5 tabular-nums">{r ? `${r.ditindaklanjuti} (${pct(r.ditindaklanjuti, r.jumlah)}%)` : '—'}</td>
                          <td className="p-2.5 tabular-nums">{r?.median_hari != null ? `${r.median_hari} hari` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {umpan.length > 0 && (
              <section aria-labelledby="eval-umpan">
                <h4 id="eval-umpan" className="mb-2 text-sm font-semibold text-foreground">Penilaian guru per fitur</h4>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {umpan.map((r) => (
                    <li key={r.jenis} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{JENIS_LABELS[r.jenis] || r.jenis}</span>
                      <span className="flex items-center gap-1 tabular-nums text-emerald-700 dark:text-emerald-300"><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{r.suka}<span className="sr-only"> bermanfaat</span></span>
                      <span className="flex items-center gap-1 tabular-nums text-rose-700 dark:text-rose-300"><ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />{r.tidak_suka}<span className="sr-only"> kurang tepat</span></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(data.biaya_bulanan || []).length > 1 && (
              <section aria-labelledby="eval-bulanan">
                <h4 id="eval-bulanan" className="mb-2 text-sm font-semibold text-foreground">Biaya per bulan</h4>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {data.biaya_bulanan.map((b) => (
                    <li key={b.bulan} className="rounded-lg bg-muted/50 px-2.5 py-1.5 tabular-nums">{b.bulan}: {usd(b.biaya_usd)} · {b.permintaan} permintaan</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AiEvaluation;
