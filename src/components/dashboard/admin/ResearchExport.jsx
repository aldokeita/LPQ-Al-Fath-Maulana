import React, { useState } from 'react';
import { AlertCircle, Download, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { getLocalDateString } from '@/lib/attendanceAdapters';
import { buildCsv, FOLLOWUP_COLUMNS, REKAP_COLUMNS } from '@/lib/attendanceConfirmation';
import { fetchCodedResearchExport, getConfirmationErrorMessage } from '@/lib/attendanceConfirmationAdapters';

const downloadCsv = (filename, content) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const firstDayOfMonth = (dateString) => `${dateString.slice(0, 8)}01`;

const ResearchExport = () => {
  const today = getLocalDateString();
  const [dari, setDari] = useState(firstDayOfMonth(today));
  const [sampai, setSampai] = useState(today);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLoad = async (event) => {
    event.preventDefault();
    if (!dari || !sampai || dari > sampai) { setError('Tanggal awal harus sebelum atau sama dengan tanggal akhir.'); return; }
    setIsLoading(true);
    setError(null);
    try {
      setResult(await fetchCodedResearchExport({ dari, sampai }));
    } catch (err) {
      setResult(null);
      setError(getConfirmationErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (kind) => {
    if (!result) return;
    const suffix = `${dari}_${sampai}`;
    if (kind === 'rekap') downloadCsv(`rekap-kehadiran-berkode_${suffix}.csv`, buildCsv(result.rekap, REKAP_COLUMNS));
    else downloadCsv(`tindak-lanjut-wali-berkode_${suffix}.csv`, buildCsv(result.tindakLanjut, FOLLOWUP_COLUMNS));
    toast({ title: 'Ekspor diunduh', description: 'Berkas berisi kode, tanpa nama, nomor induk, atau nomor HP.' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Ekspor Penelitian Berkode</CardTitle>
        <CardDescription>
          Rekap absen panggil guru dan tindak lanjut wali per santri. Santri, kelas, dan guru diganti kode tetap
          (K-001, Kelas-01, G-01) yang sama di setiap ekspor. Nama, nomor induk, nomor HP, dan catatan teks bebas tidak ikut.
          Hari libur di kalender akademik tidak dihitung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleLoad} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="research-export-from">Dari</Label>
            <Input id="research-export-from" type="date" value={dari} max={sampai || today} onChange={(e) => setDari(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="research-export-to">Sampai</Label>
            <Input id="research-export-to" type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)} required />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Siapkan data
          </Button>
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{error}</span>
          </div>
        )}

        {result && (
          <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-sm font-medium">Rekap per santri</p>
              <p className="mb-3 text-2xl font-semibold">{result.rekap.length} <span className="text-sm font-normal text-muted-foreground">baris</span></p>
              <Button type="button" variant="outline" size="sm" onClick={() => handleDownload('rekap')} disabled={!result.rekap.length}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Unduh CSV
              </Button>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-sm font-medium">Rincian tindak lanjut wali</p>
              <p className="mb-3 text-2xl font-semibold">{result.tindakLanjut.length} <span className="text-sm font-normal text-muted-foreground">baris</span></p>
              <Button type="button" variant="outline" size="sm" onClick={() => handleDownload('tindak-lanjut')} disabled={!result.tindakLanjut.length}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Unduh CSV
              </Button>
            </div>
            {!result.rekap.length && !result.tindakLanjut.length && (
              <p className="text-sm text-muted-foreground sm:col-span-2">Belum ada absen panggil atau tindak lanjut pada rentang ini.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResearchExport;
