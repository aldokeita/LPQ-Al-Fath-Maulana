import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Award, Cake, Check, Copy, Download, Contact, Loader2, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { fetchSantriMonthAttendance, fetchSantriProfile, fetchSantriSnapshots, requestCardCaption, requestCardNote } from '@/lib/assistantAlertAdapters';
import { getCardFontEmbedCSS } from '@/lib/cardFonts';
import { copyText, loadAvatar, renderCardBlob, ScaledPreview, useArabicFont } from '@/components/dashboard/assistant/cardExport';
import { buildJilidCard, buildProfilCard, buildUltahCard, cardFileName, defaultUltahUsia, upcomingBirthday, DEFAULT_CAPTION, DEFAULT_PESAN, fillCaption } from '@/lib/santriCards';
import { JILID_DESIGNS, ProfilCard, ULTAH_DESIGNS } from '@/components/dashboard/assistant/SantriCards';

const JENIS = [
  { id: 'jilid', label: 'Apresiasi naik jilid', icon: Award },
  { id: 'profil', label: 'Profil kehadiran & hafalan', icon: Contact },
  { id: 'ultah', label: 'Ucapan ulang tahun', icon: Cake },
];

// Jenis kartu yang punya beberapa desain; pilihan desain diingat per jenis di perangkat ini.
const DESIGN_SETS = {
  jilid: { key: 'lpq.card.jilid-design', list: JILID_DESIGNS, label: 'Desain kartu naik jilid' },
  ultah: { key: 'lpq.card.ultah-design', list: ULTAH_DESIGNS, label: 'Desain kartu ulang tahun' },
};
const readDesign = (jenis) => {
  const set = DESIGN_SETS[jenis];
  try {
    const stored = window.localStorage.getItem(set.key);
    return set.list.some((d) => d.id === stored) ? stored : set.list[0].id;
  } catch { return set.list[0].id; }
};
// Keterangan di bawah kolom usia: kapan ulang tahun berikutnya. Kartu tetap bisa dibuat kapan saja.
const ultahHint = (profile) => {
  const next = upcomingBirthday(profile);
  const usia = defaultUltahUsia(profile);
  if (!usia) return 'Tanggal lahir belum diisi; isi usia secara manual atau kosongkan.';
  if (!next) return `Terisi dari tanggal lahir (${usia} tahun).`;
  const kapan = next.hariLagi === 0 ? 'hari ini' : next.hariLagi === 1 ? 'besok' : `${next.hariLagi} hari lagi`;
  return `Ulang tahun ke-${next.usia ?? usia}: ${next.tanggal} (${kapan}). Kartu bisa dibuat dan dikirim kapan saja; ubah usia bila perlu.`;
};

const SHARE_TITLE = { jilid: 'Kartu apresiasi naik jilid', profil: 'Profil perkembangan santri', ultah: 'Kartu ucapan ulang tahun' };

const CardStudio = ({ roster, guruName, aiEnabled = true, focusSantriId }) => {
  useArabicFont();
  // Siapkan font tertanam sejak studio dibuka agar ekspor pertama tidak menunggu.
  useEffect(() => { getCardFontEmbedCSS(); }, []);
  const [santriId, setSantriId] = useState(focusSantriId && roster.some((r) => r.id === focusSantriId) ? focusSantriId : '');
  const [jenis, setJenis] = useState('jilid');
  const [designs, setDesigns] = useState(() => ({ jilid: readDesign('jilid'), ultah: readDesign('ultah') }));
  const designSet = DESIGN_SETS[jenis] || null;
  const design = designSet ? designs[jenis] : null;
  const chooseDesign = (id) => {
    setDesigns((current) => ({ ...current, [jenis]: id }));
    try { window.localStorage.setItem(designSet.key, id); } catch { /* penyimpanan lokal tidak tersedia */ }
  };
  const DesignCard = designSet ? (designSet.list.find((d) => d.id === design) || designSet.list[0]).Card : null;
  const [usiaInput, setUsiaInput] = useState('');
  const [profile, setProfile] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [bulanan, setBulanan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pesan, setPesan] = useState(DEFAULT_PESAN.jilid);
  const [isWriting, setIsWriting] = useState(false);
  const [caption, setCaption] = useState('');
  const [isWritingCaption, setIsWritingCaption] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!santriId) return undefined;
    let active = true;
    setIsLoading(true);
    setError(null);
    setAvatar(null);
    setBulanan(null);
    Promise.all([
      fetchSantriProfile(santriId),
      fetchSantriSnapshots([santriId]),
      loadAvatar(santriId).catch(() => null),
      fetchSantriMonthAttendance(santriId).catch(() => null),
    ])
      .then(([p, snaps, foto, bulan]) => {
        if (!active) return;
        if (!p) throw new Error('Data santri tidak tersedia (mode senyap aktif atau akses ditolak).');
        setProfile(p);
        setSnapshot(snaps?.[0] || null);
        setAvatar(foto);
        setBulanan(bulan || null);
      })
      .catch((err) => { if (active) { setProfile(null); setError(err.message); } })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [santriId]);

  useEffect(() => { setPesan(DEFAULT_PESAN[jenis]); }, [jenis, santriId]);
  useEffect(() => { setUsiaInput(''); }, [santriId]);

  const jilidData = profile ? buildJilidCard(profile) : null;
  const profilData = profile ? buildProfilCard(profile, snapshot, { bulanan }) : null;
  const ultahData = profile ? buildUltahCard(profile, { usia: usiaInput === '' ? undefined : Number(usiaInput) }) : null;
  const captionVars = { nama: jilidData?.panggilan, ke: jilidData?.ke, bulan: profilData?.bulan, shalih: ultahData?.shalih };
  const cardData = { jilid: jilidData, ultah: ultahData }[jenis];
  // AI penulis pesan/caption belum mengenal kartu ulang tahun.
  const canUseAi = aiEnabled && jenis !== 'ultah';

  // Caption bawaan diisi ulang saat santri, jenis kartu, atau data berganti.
  useEffect(() => {
    if (!profile) { setCaption(''); return; }
    setCaption(fillCaption(DEFAULT_CAPTION[jenis], captionVars));
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenis, profile, bulanan]);

  const writeCaptionWithAi = async () => {
    setIsWritingCaption(true);
    try {
      const res = await requestCardCaption(santriId, jenis);
      setCaption(fillCaption(res.caption, captionVars));
      setCopied(false);
    } catch (err) {
      toast({ title: 'AI belum bisa menulis caption', description: err.message, variant: 'destructive' });
    } finally {
      setIsWritingCaption(false);
    }
  };

  const copyCaption = async () => {
    const done = await copyText(caption);
    setCopied(done);
    toast(done
      ? { title: 'Caption disalin', description: 'Tempel di Instagram atau WhatsApp saat memposting kartu.' }
      : { title: 'Caption belum tersalin', description: 'Pilih teks caption lalu salin secara manual.', variant: 'destructive' });
  };
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

  const exportCard = async (mode) => {
    if (!cardRef.current) return;
    // Salin caption lebih dulu, selagi masih dalam ketukan pengguna (syarat papan klip di Safari).
    if (caption.trim()) copyText(caption).then((done) => setCopied(done));
    setIsExporting(true);
    try {
      const blob = await renderCardBlob(cardRef.current);
      if (!blob) throw new Error('Gambar kosong.');
      const fileName = cardFileName(jenis, nama);
      const file = new File([blob], fileName, { type: 'image/png' });
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: caption || undefined, title: SHARE_TITLE[jenis] });
          return;
        } catch (err) {
          // Safari menolak bagikan bila jeda sejak ketukan terlalu lama; jatuh ke unduhan.
          if (err?.name !== 'NotAllowedError') throw err;
        }
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

        {designSet && (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Desain kartu</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={designSet.label}>
              {designSet.list.map(({ id, label, swatch }) => (
                <button key={id} type="button" role="radio" aria-checked={design === id} onClick={() => chooseDesign(id)}
                  className={cn('flex min-h-[48px] items-center gap-2 rounded-xl border px-2.5 text-left text-sm font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    design === id ? 'border-teal-500/60 bg-teal-500/10 text-foreground shadow-sm' : 'border-border bg-background/60 text-foreground/75 hover:bg-muted')}>
                  <span aria-hidden="true" className={cn('h-6 w-6 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background', design === id ? 'ring-teal-500' : 'ring-transparent')} style={{ background: swatch }} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {jenis === 'ultah' && santriId && profile && (
          <div className="grid gap-1.5">
            <Label htmlFor="card-usia">Usia di kartu</Label>
            <input id="card-usia" type="number" inputMode="numeric" min={1} max={99}
              value={usiaInput === '' ? (defaultUltahUsia(profile) ?? '') : usiaInput}
              onChange={(e) => setUsiaInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <p className="text-xs text-muted-foreground">
              {ultahHint(profile)}
            </p>
          </div>
        )}

        {santriId && profile && (
          <div className="grid gap-1.5">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="card-pesan">Pesan di kartu</Label>
              {canUseAi && (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={writeWithAi} disabled={isWriting}>
                  {isWriting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                  Tulis dengan AI
                </Button>
              )}
            </div>
            <Textarea id="card-pesan" rows={4} maxLength={240} value={pesan} onChange={(e) => setPesan(e.target.value)} className="text-sm leading-relaxed" />
            <p className="text-xs text-muted-foreground">{'{nama}'} diganti nama panggilan santri{jenis === 'jilid' ? ', {ke} diganti jilid baru' : ''}{jenis === 'ultah' ? ', {usia} diganti usia' : ''}. Maksimal 240 karakter.</p>
          </div>
        )}

        {santriId && profile && (
          <div className="grid gap-1.5">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="card-caption">Caption untuk posting</Label>
              <div className="flex gap-2">
                {canUseAi && (
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={writeCaptionWithAi} disabled={isWritingCaption}>
                    {isWritingCaption ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                    Tulis dengan AI
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={copyCaption} disabled={!caption.trim()}>
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-teal-600 dark:text-teal-300" aria-hidden="true" /> : <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                  {copied ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
            </div>
            <Textarea id="card-caption" rows={6} maxLength={1200} value={caption}
              onChange={(e) => { setCaption(e.target.value); setCopied(false); }} className="text-sm leading-relaxed" />
            <p className="text-xs text-muted-foreground">Caption ikut tersalin saat menekan Bagikan atau Unduh; tinggal tempel di Instagram atau WhatsApp. Nama memakai panggilan santri.</p>
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
        {profile && !avatar && (
          <p className="text-xs text-muted-foreground">Foto santri belum diunggah; kartu memakai inisial nama.</p>
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
            {DesignCard
              ? <DesignCard ref={cardRef} data={cardData} pesan={pesan} guru={guruName} avatar={avatar} />
              : <ProfilCard ref={cardRef} data={profilData} pesan={pesan} guru={guruName} avatar={avatar} />}
          </ScaledPreview>
        )}
      </div>
    </div>
  );
};

export default CardStudio;
