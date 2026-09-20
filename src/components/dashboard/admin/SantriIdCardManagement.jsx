import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CreditCard,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import AdminEmptyState from '@/components/dashboard/shared/AdminEmptyState';
import AdminErrorState from '@/components/dashboard/shared/AdminErrorState';
import SantriIdCardLiveEditor from '@/components/dashboard/admin/SantriIdCardLiveEditor';
import { getAllSessions, getSessionName } from '@/utils/sessionMapping';
import { fetchSantriForIdCards } from '@/lib/santriIdCardAdapters';
import { fetchClassAttendanceAppearance } from '@/lib/classAttendancePrintAdapters';
import {
  buildIdCardPrintHtml,
  DEFAULT_ID_CARD_DESIGN,
  getIdCardPaperConfig,
  ID_CARD_PAPER_OPTIONS,
  normalizeIdCardDesign,
} from '@/lib/santriIdCardPrint';
import '@/styles/santri-id-card.css';

const getInitial = (name) => String(name || 'S').trim().charAt(0).toUpperCase() || 'S';

const normalizeEntryDate = (value) => String(value || '').slice(0, 10);

const getEntryDateTimestamp = (value) => {
  const normalized = normalizeEntryDate(value);
  if (!normalized) return null;

  const timestamp = Date.parse(`${normalized}T00:00:00`);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const formatEntryDate = (value) => {
  const normalized = normalizeEntryDate(value);
  if (!normalized) return 'Tanggal masuk belum diatur';

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Tanggal masuk belum diatur';

  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SantriIdCardManagement = () => {
  const { role } = useAuth();
  const [santri, setSantri] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [filters, setFilters] = useState({ search: '', kategori: 'all', tanggalMasuk: 'newest', sesi: 'all' });
  const [paperSize, setPaperSize] = useState('A4');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lpqLogoUrl, setLpqLogoUrl] = useState('/logo-lpq-al-fath-maulana.webp');
  const [design, setDesign] = useState(() => {
    try {
      const saved = window.localStorage.getItem('lpq_santri_id_card_design');
      return normalizeIdCardDesign(saved ? JSON.parse(saved) : DEFAULT_ID_CARD_DESIGN);
    } catch {
      return normalizeIdCardDesign(DEFAULT_ID_CARD_DESIGN);
    }
  });
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);

  const loadSantri = useCallback(async () => {
    if (role !== 'admin') return;
    setIsLoading(true);
    setError('');
    try {
      const [data, appearance] = await Promise.all([
        fetchSantriForIdCards(),
        fetchClassAttendanceAppearance().catch((appearanceError) => {
          console.warn('Logo LPQ tidak dapat dimuat:', appearanceError);
          return null;
        }),
      ]);
      setSantri(data || []);
      setLpqLogoUrl(appearance?.lpqLogoUrl || '/logo-lpq-al-fath-maulana.webp');
      setDesign((current) => normalizeIdCardDesign({
        ...current,
        logoUrl: current.logoUrl || appearance?.lpqLogoUrl || '/logo-lpq-al-fath-maulana.webp',
      }));
      setSelectedIds(new Set());
    } catch (loadError) {
      console.error('Failed to load santri for ID cards:', loadError);
      setSantri([]);
      setError(loadError.message || 'Gagal memuat data santri untuk ID Card.');
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadSantri();
  }, [loadSantri]);

  const filteredSantri = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const matchingSantri = santri.filter((item) => {
      const session = getSessionName(item.sesi_mengaji);
      const searchMatches = !query || [item.nama_lengkap, item.nama_panggilan, item.nomor_induk_qiroati]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const categoryMatches = filters.kategori === 'all' || String(item.kategori || '').toLowerCase() === filters.kategori.toLowerCase();
      const sessionMatches = filters.sesi === 'all' || session === filters.sesi;
      return searchMatches && categoryMatches && sessionMatches;
    });

    if (!['newest', 'oldest'].includes(filters.tanggalMasuk)) return matchingSantri;

    return [...matchingSantri].sort((left, right) => {
      const leftTimestamp = getEntryDateTimestamp(left.tanggal_pendaftaran);
      const rightTimestamp = getEntryDateTimestamp(right.tanggal_pendaftaran);

      if (leftTimestamp === null && rightTimestamp === null) return 0;
      if (leftTimestamp === null) return 1;
      if (rightTimestamp === null) return -1;

      return filters.tanggalMasuk === 'oldest'
        ? leftTimestamp - rightTimestamp
        : rightTimestamp - leftTimestamp;
    });
  }, [filters, santri]);

  const selectedSantri = useMemo(
    () => santri.filter((item) => selectedIds.has(item.id)),
    [santri, selectedIds],
  );

  const paperConfig = getIdCardPaperConfig(paperSize);
  const allFilteredSelected = filteredSantri.length > 0 && filteredSantri.every((item) => selectedIds.has(item.id));
  const designForRender = useMemo(() => {
    const next = {
      ...design,
      logoUrl: design.logoUrl || lpqLogoUrl,
    };
    if (next.backgroundUrl && typeof window !== 'undefined' && !/^(?:https?:|data:image\/)/i.test(next.backgroundUrl)) {
      try {
        next.backgroundUrl = new URL(next.backgroundUrl, window.location.origin).href;
      } catch {
        // Keep the original path; the print renderer will show its fallback.
      }
    }
    return next;
  }, [design, lpqLogoUrl]);

  useEffect(() => {
    let cancelled = false;
    const qrDesign = designForRender;

    if (selectedSantri.length === 0) {
      setQrDataUrls({});
      setIsGeneratingQr(false);
      return undefined;
    }

    setIsGeneratingQr(true);
    Promise.all(selectedSantri.map(async (item) => {
      if (!item.nomor_induk_qiroati) return [item.id, ''];
      try {
        const dataUrl = await QRCode.toDataURL(String(item.nomor_induk_qiroati), {
          width: 160,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: qrDesign.qrColor,
            light: qrDesign.qrBackgroundColor,
          },
        });
        return [item.id, dataUrl];
      } catch (qrError) {
        console.warn('QR ID Card could not be generated:', qrError);
        return [item.id, ''];
      }
    })).then((entries) => {
      if (!cancelled) setQrDataUrls(Object.fromEntries(entries));
    }).finally(() => {
      if (!cancelled) setIsGeneratingQr(false);
    });

    return () => { cancelled = true; };
  }, [designForRender.qrBackgroundColor, designForRender.qrColor, selectedSantri]);

  const toggleSantri = (santriId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(santriId)) next.delete(santriId);
      else next.add(santriId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredSantri.forEach((item) => next.delete(item.id));
      else filteredSantri.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handlePrint = () => {
    if (selectedSantri.length === 0 || isGeneratingQr) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Jendela cetak diblokir', description: 'Izinkan pop-up untuk membuka pratinjau cetak.', variant: 'destructive' });
      return;
    }

    const html = buildIdCardPrintHtml({
      cards: selectedSantri,
      designConfig: designForRender,
      logoUrl: designForRender.logoUrl,
      paperSize,
      qrDataUrls,
    });
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted || printWindow.closed) return;
      hasPrinted = true;
      window.setTimeout(() => printWindow.print(), 240);
    };
    printWindow.addEventListener('load', triggerPrint, { once: true });
    window.setTimeout(triggerPrint, 700);
  };

  const saveDesign = () => {
    try {
      window.localStorage.setItem('lpq_santri_id_card_design', JSON.stringify(design));
      toast({ title: 'Pengaturan disimpan', description: 'Kustomisasi ID Card tersimpan di browser ini.' });
    } catch {
      toast({ title: 'Gagal menyimpan', description: 'Browser tidak mengizinkan penyimpanan pengaturan.', variant: 'destructive' });
    }
  };

  const resetDesign = () => {
    setDesign(normalizeIdCardDesign({ ...DEFAULT_ID_CARD_DESIGN, logoUrl: lpqLogoUrl }));
    try { window.localStorage.removeItem('lpq_santri_id_card_design'); } catch { /* storage may be unavailable */ }
  };

  if (role !== 'admin') {
    return <AdminErrorState message="ID Card Santri hanya dapat diakses oleh administrator." />;
  }

  return (
    <section className="santri-id-card" aria-labelledby="santri-id-card-title">
      <header className="santri-id-card__hero">
        <div className="santri-id-card__hero-copy">
          <span className="santri-id-card__hero-icon"><CreditCard aria-hidden="true" /></span>
          <div>
            <p className="santri-id-card__eyebrow">Administrasi · Identitas santri</p>
            <h2 id="santri-id-card-title">ID Card Santri</h2>
            <p>Pilih satu atau beberapa santri untuk membuat kartu identitas yang siap dicetak.</p>
          </div>
        </div>
        <div className="santri-id-card__privacy"><ShieldCheck aria-hidden="true" /><span>Data aktual<br /><strong>Tidak disimpan ulang</strong></span></div>
      </header>

      {error && <AdminErrorState message={error} onRetry={loadSantri} className="mb-5" />}

      <div className="santri-id-card__toolbar" aria-label="Filter santri untuk ID Card">
        <div className="santri-id-card__search">
          <Search aria-hidden="true" />
          <Input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Cari nama atau nomor induk…"
            aria-label="Cari santri untuk ID Card"
          />
        </div>
        <Select value={filters.kategori} onValueChange={(value) => setFilters((current) => ({ ...current, kategori: value }))}>
          <SelectTrigger aria-label="Filter kategori santri"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            <SelectItem value="Anak">Santri TPQ</SelectItem>
            <SelectItem value="PTPT">Santri PTPT</SelectItem>
            <SelectItem value="Dewasa">Santri Dewasa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.tanggalMasuk} onValueChange={(value) => setFilters((current) => ({ ...current, tanggalMasuk: value }))}>
          <SelectTrigger aria-label="Urutan tanggal masuk"><SelectValue placeholder="Tanggal masuk" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Masuk terbaru</SelectItem>
            <SelectItem value="oldest">Masuk terlama</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.sesi} onValueChange={(value) => setFilters((current) => ({ ...current, sesi: value }))}>
          <SelectTrigger aria-label="Filter sesi mengaji"><SelectValue placeholder="Sesi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua sesi</SelectItem>
            {getAllSessions().map((session) => <SelectItem key={session.id} value={session.name}>{session.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="santri-id-card__workspace">
        <div className="santri-id-card__preview-panel">
          <div className="santri-id-card__preview-header">
            <div className="santri-id-card__preview-heading">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSelectionOpen(true)}
                className="santri-id-card__selection-trigger"
                aria-haspopup="dialog"
                aria-expanded={isSelectionOpen}
              >
                <Users aria-hidden="true" />
                <span>Seleksi Santri</span>
                <strong aria-live="polite">{selectedSantri.length}</strong>
              </Button>
              <div><p>Preview & cetak</p><h3>{selectedSantri.length === 0 ? 'Belum ada kartu dipilih' : `${selectedSantri.length} ID Card siap dibuat`}</h3></div>
            </div>
            <div className="santri-id-card__paper-controls">
              <Select value={paperSize} onValueChange={setPaperSize}>
                <SelectTrigger aria-label="Pilih ukuran kertas"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ID_CARD_PAPER_OPTIONS).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" onClick={handlePrint} disabled={selectedSantri.length === 0 || isGeneratingQr} className="santri-id-card__print-button" aria-label={`Cetak ${selectedSantri.length} ID Card`}><Printer aria-hidden="true" />{isGeneratingQr ? 'Menyiapkan QR…' : 'Cetak'}</Button>
            </div>
          </div>
          <div className="santri-id-card__print-status" role="status">
            <span><CreditCard aria-hidden="true" /><strong>{paperConfig.label} · {paperConfig.orientation}</strong></span>
            <span>{paperConfig.cardsPerPage} kartu per halaman · ukuran kartu 53,8 × 86 mm</span>
          </div>
          <SantriIdCardLiveEditor design={design} onChange={setDesign} onReset={resetDesign} onSave={saveDesign} />
          {selectedSantri.length === 0 ? (
            <AdminEmptyState icon={CreditCard} title="Pilih santri untuk melihat preview" description="ID Card dapat dibuat untuk satu santri atau seluruh hasil filter." />
          ) : (
            <iframe
              title="Preview ID Card santri"
              className="santri-id-card__preview-frame"
              srcDoc={buildIdCardPrintHtml({ cards: selectedSantri, designConfig: designForRender, logoUrl: designForRender.logoUrl, paperSize, qrDataUrls })}
            />
          )}
        </div>
      </div>

      <Dialog open={isSelectionOpen} onOpenChange={setIsSelectionOpen}>
        <DialogContent className="santri-id-card__selection-dialog">
          <DialogHeader>
            <DialogTitle className="santri-id-card__selection-dialog-title"><Users aria-hidden="true" /> Seleksi Santri</DialogTitle>
            <DialogDescription>{filteredSantri.length} hasil sesuai filter · {selectedSantri.length} santri dipilih</DialogDescription>
          </DialogHeader>

          <div className="santri-id-card__selection-actions">
            <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllFiltered} disabled={filteredSantri.length === 0}>
              {allFilteredSelected ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}
              {allFilteredSelected ? 'Batalkan hasil' : 'Pilih semua hasil'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection} disabled={selectedSantri.length === 0}>Deselect all</Button>
          </div>

          {isLoading ? (
            <div className="santri-id-card__loading" role="status" aria-live="polite"><RefreshCw className="animate-spin" aria-hidden="true" /> Memuat data santri…</div>
          ) : filteredSantri.length === 0 ? (
            <AdminEmptyState icon={Users} title="Santri tidak ditemukan" description="Coba ubah pencarian atau filter yang digunakan." />
          ) : (
            <div className="santri-id-card__list santri-id-card__selection-list">
              {filteredSantri.map((item) => (
                <label key={item.id} className={`santri-id-card__student ${selectedIds.has(item.id) ? 'is-selected' : ''}`}>
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSantri(item.id)} aria-label={`Pilih ${item.nama_lengkap}`} />
                  <span className="santri-id-card__student-avatar">
                    {item.foto_url ? <img src={item.foto_url} alt="" loading="lazy" /> : <span aria-hidden="true">{getInitial(item.nama_lengkap)}</span>}
                  </span>
                  <span className="santri-id-card__student-copy"><strong>{item.nama_lengkap || 'Tanpa nama'}</strong><small>{item.nomor_induk_qiroati || 'Nomor induk belum tersedia'} · {getSessionName(item.sesi_mengaji) || 'Sesi belum diatur'} · Masuk {formatEntryDate(item.tanggal_pendaftaran)}</small></span>
                </label>
              ))}
            </div>
          )}

          <DialogFooter className="santri-id-card__selection-dialog-footer">
            <Button type="button" onClick={() => setIsSelectionOpen(false)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default SantriIdCardManagement;
