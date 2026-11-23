import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getCardFontEmbedCSS } from '@/lib/cardFonts';
import { buildBirthdayWhatsappUrl } from '@/lib/birthdayUtils';
import {
  birthdayProfileFromSantri, buildUltahCard, cardFileName, defaultUltahUsia, DEFAULT_CAPTION, DEFAULT_PESAN, fillCaption, upcomingBirthday,
} from '@/lib/santriCards';
import { ULTAH_DESIGNS } from '@/components/dashboard/assistant/SantriCards';
import { copyText, loadAvatar, renderCardBlob, ScaledPreview, shareOrDownloadCard, useArabicFont } from '@/components/dashboard/assistant/cardExport';

const DESIGN_KEY = 'lpq.card.ultah-design';
const readDesign = () => {
  try {
    const stored = window.localStorage.getItem(DESIGN_KEY);
    return ULTAH_DESIGNS.some((d) => d.id === stored) ? stored : ULTAH_DESIGNS[0].id;
  } catch { return ULTAH_DESIGNS[0].id; }
};

const whenText = (next) => {
  if (!next) return '';
  if (next.hariLagi === 0) return 'hari ini';
  if (next.hariLagi === 1) return 'besok';
  return `${next.hariLagi} hari lagi`;
};

// Pembuat kartu ucapan ulang tahun di dalam modal "Ulang Tahun Santri Bulan Ini".
// Memakai data baris santri yang sudah dimuat, sehingga bisa dipakai admin maupun guru kapan saja.
const BirthdayCardMaker = ({ santri, senderName, onBack }) => {
  useArabicFont();
  useEffect(() => { getCardFontEmbedCSS(); }, []);
  const profile = useMemo(() => birthdayProfileFromSantri(santri), [santri]);
  const next = upcomingBirthday(profile);
  const [design, setDesign] = useState(readDesign);
  const [usiaInput, setUsiaInput] = useState('');
  const [pesan, setPesan] = useState(DEFAULT_PESAN.ultah);
  const [avatar, setAvatar] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    let active = true;
    setAvatar(null);
    loadAvatar(santri.id).then((url) => { if (active) setAvatar(url); }).catch(() => {});
    return () => { active = false; };
  }, [santri.id]);

  const chooseDesign = (id) => {
    setDesign(id);
    try { window.localStorage.setItem(DESIGN_KEY, id); } catch { /* penyimpanan lokal tidak tersedia */ }
  };

  const data = buildUltahCard(profile, { usia: usiaInput === '' ? undefined : Number(usiaInput) });
  const Card = (ULTAH_DESIGNS.find((d) => d.id === design) || ULTAH_DESIGNS[0]).Card;
  const caption = fillCaption(DEFAULT_CAPTION.ultah, { nama: data.panggilan, shalih: data.shalih });
  const whatsappUrl = buildBirthdayWhatsappUrl({ ...santri, age: data.usia, isBirthdayToday: next?.hariLagi === 0 }, 'santri');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const exportCard = async (mode) => {
    if (!cardRef.current) return;
    copyText(caption);
    setIsExporting(true);
    try {
      const blob = await renderCardBlob(cardRef.current);
      if (!blob) throw new Error('Gambar kosong.');
      const result = await shareOrDownloadCard({
        blob, fileName: cardFileName('ultah', profile.nama_lengkap), title: 'Kartu ucapan ulang tahun', text: caption, mode,
      });
      if (result === 'downloaded') {
        toast({
          title: 'Kartu diunduh',
          description: whatsappUrl ? 'Caption sudah disalin. Kirim gambar ke wali lewat tombol WhatsApp.' : 'Caption sudah disalin. Kirim gambar dari galeri ke wali.',
        });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast({ title: 'Kartu gagal dibuat', description: err.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative grid max-h-[72vh] grid-cols-1 gap-5 overflow-y-auto overflow-x-hidden px-6 py-5 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
      <div className="min-w-0 space-y-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-9" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Kembali ke daftar
        </Button>
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.nama_lengkap}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {next ? `Ulang tahun ke-${next.usia}: ${next.tanggal} (${whenText(next)}).` : 'Tanggal lahir belum diisi.'} Kartu bisa dikirim kapan saja.
          </p>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Desain kartu</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Desain kartu ulang tahun">
            {ULTAH_DESIGNS.map(({ id, label, swatch }) => (
              <button key={id} type="button" role="radio" aria-checked={design === id} onClick={() => chooseDesign(id)}
                className={cn('flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 text-left text-sm font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  design === id ? 'border-rose-400/70 bg-rose-500/10 text-foreground shadow-sm' : 'border-border bg-background/60 text-foreground/75 hover:bg-muted')}>
                <span aria-hidden="true" className={cn('h-5 w-5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background', design === id ? 'ring-rose-400' : 'ring-transparent')} style={{ background: swatch }} />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="birthday-card-usia">Usia di kartu</Label>
          <input id="birthday-card-usia" type="number" inputMode="numeric" min={1} max={99}
            value={usiaInput === '' ? (defaultUltahUsia(profile) ?? '') : usiaInput}
            onChange={(e) => setUsiaInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="birthday-card-pesan">Pesan di kartu</Label>
          <Textarea id="birthday-card-pesan" rows={4} maxLength={240} value={pesan} onChange={(e) => setPesan(e.target.value)} className="text-sm leading-relaxed" />
          <p className="text-xs text-muted-foreground">{'{nama}'} diganti nama panggilan, {'{usia}'} diganti usia. Maksimal 240 karakter.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canShare && (
            <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => exportCard('share')} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />} Bagikan kartu
            </Button>
          )}
          <Button type="button" variant={canShare ? 'outline' : 'default'} className={canShare ? '' : 'bg-emerald-600 text-white hover:bg-emerald-500'}
            onClick={() => exportCard('download')} disabled={isExporting}>
            {isExporting && !canShare ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />} Unduh PNG
          </Button>
          {whatsappUrl && (
            <Button type="button" variant="outline" onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}>
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" /> WhatsApp wali
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Caption ikut tersalin saat Bagikan atau Unduh. {whatsappUrl ? 'Tombol WhatsApp membuka chat wali dengan teks ucapan; lampirkan gambar kartu yang sudah diunduh.' : 'Nomor WhatsApp wali belum diisi.'}
          {!avatar ? ' Foto santri belum tersedia; kartu memakai inisial nama.' : ''}
        </p>
      </div>

      <div className="flex min-w-0 justify-center md:items-start">
        <ScaledPreview>
          <Card ref={cardRef} data={data} pesan={pesan} guru={senderName} avatar={avatar} />
        </ScaledPreview>
      </div>
    </div>
  );
};

export default BirthdayCardMaker;
