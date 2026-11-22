import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, FlaskConical, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { fetchResearchAlerts, fetchResearchMetrics } from '@/lib/assistantAlertAdapters';
import { KEPUTUSAN_LABELS, MASA_LABELS, researchAlertsCsv, researchSummaryCsv, ruleLabel } from '@/lib/researchData';

const PRESETS = [{ days: 30, label: '30 hari' }, { days: 90, label: '90 hari' }, { days: 180, label: '6 bulan' }, { days: 365, label: '1 tahun' }];
const isoDate = (d) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n) => isoDate(new Date(Date.now() - n * 86400000));
const fmt = (v, suffix = '') => (v === null || v === undefined || v === '' ? '—' : `${String(v).replace('.', ',')}${suffix}`);

const Tile = ({ label, value, hint }) => (
  <div className="rounded-xl border border-border/60 bg-background/60 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const saveCsv = (text, name) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Data penelitian (bahan Bab 4 tesis) untuk admin: masa sebelum (mode senyap) vs sesudah, ketepatan
// peringatan, waktu tanggap guru, dan perubahan kehadiran setelah peringatan. Hanya membaca.
const ResearchData = () => {
  const [from, setFrom] = useState(daysAgo(89));
  const [to, setTo] = useState(isoDate(new Date()));
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchResearchMetrics(from, to));
    } catch (err) {
      setError(String(err.message || '').includes('INVALID_RANGE') ? 'Rentang tanggal tidak valid (maksimal sekitar 13 bulan).' : err.message);
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const exportAlerts = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchResearchAlerts(from, to);
      saveCsv(researchAlertsCsv(rows || []), `data-penelitian-peringatan_${from}_${to}.csv`);
    } catch (err) {
      toast({ title: 'Data per peringatan gagal diunduh', description: err.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const masa = Object.fromEntries((data?.masa || []).map((m) => [m.masa, m]));
  const dampak = Object.fromEntries((data?.dampak || []).map((d) => [d.masa, d]));
  const k = data?.ketepatan || {};
  const t = data?.tanggap || {};
  const aturanList = [...new Set([...Object.keys(masa.sebelum?.per_aturan || {}), ...Object.keys(masa.sesudah?.per_aturan || {})])];

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><FlaskConical className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden="true" /> Data penelitian</CardTitle>
          <CardDescription>
            Perbandingan masa sebelum (mode senyap) dan sesudah asisten aktif, ketepatan peringatan, waktu tanggap guru, dan kehadiran santri setelah peringatan. Data per peringatan diekspor dengan kode samaran.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {PRESETS.map((p) => (
            <Button key={p.days} type="button" size="sm" variant={from === daysAgo(p.days - 1) && to === isoDate(new Date()) ? 'secondary' : 'outline'}
              onClick={() => { setFrom(daysAgo(p.days - 1)); setTo(isoDate(new Date())); }}>{p.label}</Button>
          ))}
          <div className="grid gap-1">
            <Label htmlFor="riset-from" className="text-xs">Dari</Label>
            <Input id="riset-from" type="date" className="h-9 w-40" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="riset-to" className="text-xs">Sampai</Label>
            <Input id="riset-to" type="date" className="h-9 w-40" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={load} disabled={isLoading} aria-label="Muat ulang data penelitian">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
          </Button>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => saveCsv(researchSummaryCsv(data), `ringkasan-penelitian_${from}_${to}.csv`)}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> Ringkasan (CSV)
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={exportAlerts} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />} Data per peringatan (CSV)
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-5" aria-busy={isLoading}>
        {isLoading && !data && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menghitung…</p>}
        {error && <p className="flex items-center gap-2 text-sm text-destructive" role="alert"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {error}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Ketepatan peringatan" value={fmt(k.presisi_persen, '%')}
                hint={k.dinilai ? `${k.dinilai} dinilai guru · ${k.keliru} keliru (${k.koreksi_hadir} koreksi hadir)` : 'Belum ada peringatan yang dinilai'} />
              <Tile label="Waktu tanggap (median)" value={fmt(t.median_jam, ' jam')} hint={t.p75_jam != null ? `75% ditanggapi ≤ ${fmt(t.p75_jam)} jam` : 'Belum ada tanggapan'} />
              <Tile label="Ditanggapi" value={fmt(t.persen_diputuskan, '%')}
                hint={`${t.diputuskan ?? 0} dari ${t.peringatan ?? 0} · ${t.dalam_24_jam ?? 0} dalam 24 jam · ${t.dalam_72_jam ?? 0} dalam 72 jam`} />
              <Tile label="Wali dihubungi" value={t.wali_dihubungi ?? 0} hint="Kontak wali tercatat dari peringatan" />
            </div>

            <section aria-labelledby="riset-masa">
              <h4 id="riset-masa" className="mb-1 text-sm font-semibold text-foreground">Masa sebelum vs sesudah</h4>
              <p className="mb-2 text-xs text-muted-foreground">
                Masa sebelum = peringatan yang tercatat selama mode senyap (tidak tampil ke guru).
                {(data.masa_senyap || []).length > 0 && <> Riwayat mode senyap: {(data.masa_senyap || []).map((s) => `${s.mulai} ${s.senyap ? 'senyap' : 'aktif'}`).join(' → ')}.</>}
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="p-2.5 font-medium">Indikator</th>
                      <th scope="col" className="p-2.5 font-medium">{MASA_LABELS.sebelum}</th>
                      <th scope="col" className="p-2.5 font-medium">{MASA_LABELS.sesudah}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {[['peringatan', 'Peringatan'], ['episode', 'Episode (kasus)'], ['santri', 'Santri terlibat']].map(([key, label]) => (
                      <tr key={key}>
                        <th scope="row" className="p-2.5 text-left font-medium text-foreground">{label}</th>
                        <td className="p-2.5 tabular-nums">{masa.sebelum?.[key] ?? 0}</td>
                        <td className="p-2.5 tabular-nums">{masa.sesudah?.[key] ?? 0}</td>
                      </tr>
                    ))}
                    {aturanList.map((rule) => (
                      <tr key={rule}>
                        <th scope="row" className="p-2.5 pl-5 text-left font-normal text-foreground/80">{ruleLabel(rule)}</th>
                        <td className="p-2.5 tabular-nums">{masa.sebelum?.per_aturan?.[rule] ?? 0}</td>
                        <td className="p-2.5 tabular-nums">{masa.sesudah?.per_aturan?.[rule] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="riset-dampak">
              <h4 id="riset-dampak" className="mb-1 text-sm font-semibold text-foreground">Kehadiran sebelum dan sesudah peringatan</h4>
              <p className="mb-2 text-xs text-muted-foreground">
                Rata-rata kehadiran 20 sesi sebelum dan 20 sesi sesudah peringatan kehadiran (episode pertama, minimal 5 sesi sesudah).
                Masa sebelum menjadi pembanding karena guru tidak melihat peringatannya.
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="p-2.5 font-medium">Masa</th>
                      <th scope="col" className="p-2.5 font-medium">Episode (ada data)</th>
                      <th scope="col" className="p-2.5 font-medium">Sebelum</th>
                      <th scope="col" className="p-2.5 font-medium">Sesudah</th>
                      <th scope="col" className="p-2.5 font-medium">Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {['sebelum', 'sesudah'].map((m) => {
                      const d = dampak[m];
                      return (
                        <tr key={m}>
                          <th scope="row" className="p-2.5 text-left font-medium text-foreground">{MASA_LABELS[m]}</th>
                          <td className="p-2.5 tabular-nums">{d ? `${d.episode} (${d.dengan_data})` : '0'}</td>
                          <td className="p-2.5 tabular-nums">{fmt(d?.rata_sebelum_persen, '%')}</td>
                          <td className="p-2.5 tabular-nums">{fmt(d?.rata_sesudah_persen, '%')}</td>
                          <td className={cn('p-2.5 tabular-nums font-medium', d?.selisih_poin > 0 && 'text-emerald-700 dark:text-emerald-300', d?.selisih_poin < 0 && 'text-rose-700 dark:text-rose-300')}>
                            {d?.selisih_poin != null ? `${d.selisih_poin > 0 ? '+' : ''}${fmt(d.selisih_poin)} poin` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {Object.keys(t.per_keputusan || {}).length > 0 && (
              <section aria-labelledby="riset-keputusan">
                <h4 id="riset-keputusan" className="mb-2 text-sm font-semibold text-foreground">Keputusan pertama guru</h4>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(t.per_keputusan).map(([key, n]) => (
                    <li key={key} className="rounded-lg bg-muted/50 px-2.5 py-1.5 tabular-nums">{KEPUTUSAN_LABELS[key] || key}: {n}</li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-xs text-muted-foreground">
              Metode: hari sekolah dan libur mengikuti pengaturan saat ini. Ketepatan = 1 − (keliru ÷ dinilai); keliru = ditandai “peringatan keliru” atau dikoreksi “sebenarnya hadir”.
              Pemakaian, biaya, dan penilaian AI ada di panel Evaluasi asisten AI.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ResearchData;
