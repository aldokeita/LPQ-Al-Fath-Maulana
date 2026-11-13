import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { AlertTriangle, Award, Download, Contact, Loader2, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { fetchSantriProfile, fetchSantriSnapshots, requestCardNote } from '@/lib/assistantAlertAdapters';
import { buildJilidCard, buildProfilCard, cardFileName, DEFAULT_PESAN } from '@/lib/santriCards';
import { CARD_H, CARD_W, JilidCard, ProfilCard } from '@/components/dashboard/assistant/SantriCards';

const JENIS = [
  { id: 'jilid', label: 'Apresiasi naik jilid', icon: Award },
  { id: 'profil', label: 'Profil kehadiran & hafalan', icon: Contact },
];

const AMIRI_HREF = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap';

// Font Arab hanya dimuat saat studio kartu dibuka.
const useArabicFont = () => {
  useEffect(() => {
    if (document.querySelector(`link[href="${AMIRI_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = AMIRI_HREF;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }, []);
};

// Pratinjau kartu ukuran tetap yang diperkecil mengikuti lebar layar.
const ScaledPreview = ({ children }) => {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / CARD_W));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={boxRef} className="w-full max-w-[540px]">
      <div style={{ width: CARD_W * scale, height: CARD_H * scale }} className="overflow-hidden rounded-[28px] shadow-xl shadow-slate-900/15">
        <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  );
};

const CardStudio = ({ roster, guruName, aiEnabled = true, focusSantriId }) => {
  useArabicFont();
  const [santriId, setSantriId] = useState(focusSantriId && roster.some((r) => r.id === focusSantriId) ? focusSantriId : '');
  const [jenis, setJenis] = useState('jilid');
  const [profile, setProfile] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pesan, setPesan] = useState(DEFAULT_PESAN.jilid);
  const [isWriting, setIsWriting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!santriId) return undefined;
    let active = true;
    setIsLoading(true);
    setError(null);
    Promise.all([fetchSantriProfile(santriId), fetchSantriSnapshots([santriId])])
      .then(([p, snaps]) => {
        if (!active) return;
        if (!p) throw new Error('Data santri tidak tersedia (mode senyap aktif atau akses ditolak).');
        setProfile(p);
        setSnapshot(snaps?.[0] || null);
      })
      .catch((err) => { if (active) { setProfile(null); setError(err.message); } })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [santriId]);

  useEffect(() => { setPesan(DEFAULT_PESAN[jenis]); }, [jenis, santriId]);

  const jilidData = profile ? buildJilidCard(profile) : null;
  const profilData = profile ? buildProfilCard(profile, snapshot) : null;
  const nama = profile?.nama_lengkap || '';

  const writeWithAi = async () => {
    setIsWriting(true);
    try {
      const res = await requestCardNote(santriId, jenis);
      setPesan(res.pesan);
    } catch (err) {
      toast({ title: 'AI belum bisa menulis pesan', description: err.message, variant: 'destructive' });
    } finally {
      setIsWriting(false);
    }
  };

  const renderBlob = async () => {
    await document.fonts?.ready;
    return toBlob(cardRef.current, { pixelRatio: 2, cacheBust: true, width: CARD_W, height: CARD_H, backgroundColor: 'transparent' });
  };

  const exportCard = async (mode) => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const blob = await renderBlob();
      if (!blob) throw new Error('Gambar kosong.');
      const fileName = cardFileName(jenis, nama);
      const file = new File([blob], fileName, { type: 'image/png' });
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: jenis === 'jilid' ? 'Kartu apresiasi naik jilid' : 'Profil perkembangan santri' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (mode === 'share') toast({ title: 'Kartu diunduh', description: 'Perangkat ini tidak mendukung bagikan langsung; kirim gambar dari galeri ke WhatsApp wali.' });
    } catch (err) {
      if (err?.name !== 'AbortError') toast({ title: 'Kartu gagal dibuat', description: err.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:items-start">
      <div className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="card-santri">Santri</Label>
          <Select value={santriId || undefined} onValueChange={setSantriId}>
            <SelectTrigger id="card-santri"><SelectValue placeholder="Pilih santri" /></SelectTrigger>
            <SelectContent>{roster.map((s) => <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Jenis kartu</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {JENIS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={jenis === id} onClick={() => setJenis(id)}
                className={cn('flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  jenis === id ? 'border-teal-500/60 bg-teal-500/10 text-foreground shadow-sm' : 'border-border bg-background/60 text-foreground/75 hover:bg-muted')}>
                <Icon className={cn('h-4 w-4 shrink-0', jenis === id ? 'text-teal-600 dark:text-teal-300' : '')} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </fieldset>

        {santriId && profile && (
          <div className="grid gap-1.5">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="card-pesan">Pesan di kartu</Label>
              {aiEnabled && (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={writeWithAi} disabled={isWriting}>
                  {isWriting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                  Tulis dengan AI
                </Button>
              )}
            </div>
            <Textarea id="card-pesan" rows={4} maxLength={240} value={pesan} onChange={(e) => setPesan(e.target.value)} className="text-sm leading-relaxed" />
            <p className="text-xs text-muted-foreground">{'{nama}'} diganti nama panggilan santri{jenis === 'jilid' ? ', {ke} diganti jilid baru' : ''}. Maksimal 240 karakter.</p>
          </div>
        )}

        {santriId && profile && (
          <div className="flex flex-wrap gap-2">
            {canShare && (
              <Button type="button" className="attention-action-primary" onClick={() => exportCard('share')} disabled={isExporting}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />} Bagikan
              </Button>
            )}
            <Button type="button" variant={canShare ? 'outline' : 'default'} className={canShare ? '' : 'attention-action-primary'} onClick={() => exportCard('download')} disabled={isExporting}>
              {isExporting && !canShare ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />} Unduh PNG
            </Button>
          </div>
        )}
        {jenis === 'jilid' && jilidData && !jilidData.adaRiwayat && (
          <p className="text-xs text-amber-700 dark:text-amber-300">Riwayat kenaikan jilid belum tercatat; kartu menampilkan jilid saat ini.</p>
        )}
      </div>

      <div className="flex min-h-[12rem] justify-center">
        {!santriId && (
          <p className="flex items-center gap-2 self-center rounded-2xl border border-dashed border-border p-5 text-sm text-foreground/75">
            <Contact className="h-6 w-6 shrink-0 text-teal-500" aria-hidden="true" />
            Pilih santri untuk membuat kartu apresiasi atau profil yang siap dibagikan ke wali.
          </p>
        )}
        {santriId && isLoading && (
          <p className="flex items-center gap-2 self-center text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menyiapkan kartu…</p>
        )}
        {santriId && !isLoading && error && (
          <p className="flex items-start gap-2 self-center rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
          </p>
        )}
        {santriId && !isLoading && profile && (
          <ScaledPreview>
            {jenis === 'jilid'
              ? <JilidCard ref={cardRef} data={jilidData} pesan={pesan} guru={guruName} />
              : <ProfilCard ref={cardRef} data={profilData} pesan={pesan} guru={guruName} />}
          </ScaledPreview>
        )}
      </div>
    </div>
  );
};

export default CardStudio;
