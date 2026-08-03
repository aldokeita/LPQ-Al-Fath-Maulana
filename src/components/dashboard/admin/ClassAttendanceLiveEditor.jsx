import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { AttendancePaperPreview } from './ClassAttendanceSheets';
import {
  fetchClassAttendanceAppearance,
  saveClassAttendancePrintConfig,
} from '@/lib/classAttendancePrintAdapters';
import {
  CLASS_ATTENDANCE_HEADER_FONTS,
  normalizeClassAttendancePrintConfig,
} from '@/lib/classAttendancePrintConfig';
import {
  getClassAttendanceDateSlots,
  getClassAttendanceMonthLabel,
} from '@/lib/classAttendanceSheet';

const EDITOR_PANELS = [
  { id: 'content', label: 'Konten', icon: FileText },
  { id: 'typography', label: 'Tipografi', icon: Type },
  { id: 'branding', label: 'Logo & Warna', icon: Palette },
];

const META_FIELDS = [
  ['teacherLabel', 'Label nama guru'],
  ['classLabel', 'Label kelas'],
  ['sessionLabel', 'Label sesi'],
  ['createdLabel', 'Label waktu dibuat'],
];

const COLUMN_FIELDS = [
  ['numberColumn', 'Nomor'],
  ['nameColumn', 'Nama santri'],
  ['levelColumn', 'Jilid'],
  ['phoneColumn', 'Nomor HP'],
  ['monthColumn', 'Bulan'],
  ['progressColumn', 'Jilid & halaman'],
  ['teacherAttendanceLabel', 'Absensi guru'],
];

const FOOTER_FIELDS = [
  ['notesLabel', 'Catatan'],
  ['absenceLabel', 'Absen'],
  ['substituteLabel', 'Menggantikan'],
  ['printButtonLabel', 'Tombol cetak'],
];

const WEIGHT_OPTIONS = [
  [400, 'Normal'],
  [500, 'Medium'],
  [600, 'Semi tebal'],
  [700, 'Tebal'],
  [800, 'Sangat tebal'],
  [900, 'Hitam'],
];

const sampleClass = {
  id: 'live-preview',
  nama_kelas: 'TPQ Sore · Jilid 2A',
  sesi: 'Sore',
  guru: { nama: 'Nabila' },
  roster: Array.from({ length: 15 }, (_, index) => ({
    id: `preview-${index + 1}`,
    nama_lengkap: `Santri Al-Fath ${index + 1}`,
    jilid: `${(index % 6) + 1}${index % 2 ? 'B' : 'A'}`,
    no_hp_ortu: `0812 3456 ${String(index + 1).padStart(4, '0')}`,
  })),
};

const LabeledSwitch = ({ checked, description, id, label, onCheckedChange }) => (
  <div className="attendance-editor-switch-row">
    <div>
      <Label htmlFor={id}>{label}</Label>
      {description && <p>{description}</p>}
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const RangeControl = ({ label, max, min, onChange, step = 1, unit = 'pt', value }) => (
  <div className="attendance-editor-range">
    <div><Label>{label}</Label><output>{value} {unit}</output></div>
    <Slider value={[Number(value)]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} />
  </div>
);

const ColorControl = ({ label, onChange, value }) => (
  <div className="attendance-editor-color">
    <Label>{label}</Label>
    <div>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${label}, pemilih warna`} />
      <Input value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${label}, kode warna`} maxLength={7} />
    </div>
  </div>
);

const ClassAttendanceLiveEditor = ({
  appearanceLoader = fetchClassAttendanceAppearance,
  configSaver = saveClassAttendancePrintConfig,
}) => {
  const [appearance, setAppearance] = useState(() => ({
    config: normalizeClassAttendancePrintConfig(),
    lpqLogoUrl: '/logo-lpq-al-fath-maulana.webp',
    qiroatiLogoUrl: '',
  }));
  const [activePanel, setActivePanel] = useState('content');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    appearanceLoader()
      .then((nextAppearance) => {
        if (active) setAppearance(nextAppearance);
      })
      .catch((error) => {
        if (active) toast({
          title: 'Konfigurasi bawaan digunakan',
          description: error?.message || 'Live Editor belum dapat memuat konfigurasi tersimpan.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appearanceLoader]);

  const now = useMemo(() => new Date(), []);
  const dateSlots = useMemo(() => getClassAttendanceDateSlots({
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  }), [now]);
  const monthLabel = getClassAttendanceMonthLabel(now.getMonth(), now.getFullYear());
  const config = appearance.config;

  const updateSection = (section, key, value) => {
    setAppearance((current) => ({
      ...current,
      config: {
        ...current.config,
        [section]: {
          ...current.config[section],
          [key]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await configSaver(config);
      setAppearance((current) => ({ ...current, config: saved }));
      toast({
        title: 'Desain absensi tersimpan',
        description: 'Pratinjau dan unduhan berikutnya akan memakai konfigurasi terbaru.',
      });
    } catch (error) {
      toast({
        title: 'Gagal menyimpan desain absensi',
        description: error?.message || 'Periksa kembali nilai pada Live Editor.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setAppearance((current) => ({ ...current, config: normalizeClassAttendancePrintConfig() }));
    toast({
      title: 'Desain bawaan dipulihkan',
      description: 'Pratinjau sudah diperbarui. Tekan Simpan Desain untuk menerapkannya.',
    });
  };

  if (isLoading) {
    return (
      <div className="game-config-panel attendance-live-editor-loading" role="status">
        <Loader2 className="animate-spin" aria-hidden="true" />
        <span>Memuat Live Editor Absensi…</span>
      </div>
    );
  }

  return (
    <section className="attendance-live-editor" aria-labelledby="attendance-live-editor-title">
      <header className="attendance-live-editor__hero">
        <div className="attendance-live-editor__hero-copy">
          <span><Eye aria-hidden="true" /></span>
          <div>
            <p>Dokumen A4 · Pratinjau langsung</p>
            <h3 id="attendance-live-editor-title">Live Editor Absensi</h3>
            <small>Ubah teks, tipografi, logo, dan warna tanpa mengubah data atau struktur absensi kelas.</small>
          </div>
        </div>
        <div className="attendance-live-editor__actions">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw aria-hidden="true" /> Desain Bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving} className="game-config-save">
            {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {isSaving ? 'Menyimpan…' : 'Simpan Desain'}
          </Button>
        </div>
      </header>

      <div className="attendance-live-editor__notice">
        <ShieldCheck aria-hidden="true" />
        <span><strong>Aman untuk data kelas.</strong> Editor hanya menyimpan gaya dan teks statis; roster, urutan santri, tanggal belajar, dan pagination tetap berasal dari sistem.</span>
      </div>

      <div className="attendance-live-editor__workspace">
        <aside className="attendance-live-editor__controls" aria-label="Kontrol Live Editor Absensi">
          <div className="attendance-live-editor__tabs" role="tablist" aria-label="Bagian konfigurasi absensi">
            {EDITOR_PANELS.map((panel) => {
              const Icon = panel.icon;
              return (
                <button
                  type="button"
                  key={panel.id}
                  role="tab"
                  aria-selected={activePanel === panel.id}
                  onClick={() => setActivePanel(panel.id)}
                  className={activePanel === panel.id ? 'is-active' : ''}
                >
                  <Icon aria-hidden="true" />{panel.label}
                </button>
              );
            })}
          </div>

          {activePanel === 'content' && (
            <div className="attendance-live-editor__panel" role="tabpanel">
              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><FileText aria-hidden="true" /><div><strong>Header dokumen</strong><span>Identitas utama yang tampil di atas lembar.</span></div></div>
                <Label htmlFor="attendance-eyebrow">Nama kategori lembaga</Label>
                <Input id="attendance-eyebrow" value={config.content.institutionEyebrow} onChange={(event) => updateSection('content', 'institutionEyebrow', event.target.value)} />
                <Label htmlFor="attendance-title">Header absensi</Label>
                <Input id="attendance-title" value={config.content.institutionName} onChange={(event) => updateSection('content', 'institutionName', event.target.value)} />
                <Label htmlFor="attendance-address">Alamat</Label>
                <Textarea id="attendance-address" rows={3} value={config.content.address} onChange={(event) => updateSection('content', 'address', event.target.value)} />
                <Label htmlFor="attendance-category">Nama dokumen</Label>
                <Input id="attendance-category" value={config.content.documentCategory} onChange={(event) => updateSection('content', 'documentCategory', event.target.value)} />
              </div>

              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><FileText aria-hidden="true" /><div><strong>Label informasi kelas</strong><span>Label di atas tabel absensi.</span></div></div>
                <div className="attendance-editor-field-grid">
                  {META_FIELDS.map(([key, label]) => <div key={key}><Label htmlFor={`meta-${key}`}>{label}</Label><Input id={`meta-${key}`} value={config.content[key]} onChange={(event) => updateSection('content', key, event.target.value)} /></div>)}
                </div>
              </div>

              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><FileText aria-hidden="true" /><div><strong>Header kolom</strong><span>Gunakan Enter untuk membuat baris baru.</span></div></div>
                <div className="attendance-editor-field-grid">
                  {COLUMN_FIELDS.map(([key, label]) => <div key={key}><Label htmlFor={`column-${key}`}>{label}</Label><Input id={`column-${key}`} value={config.content[key]} onChange={(event) => updateSection('content', key, event.target.value)} /></div>)}
                </div>
              </div>

              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><FileText aria-hidden="true" /><div><strong>Footer & tindakan</strong><span>Teks pada bagian bawah dan halaman HTML.</span></div></div>
                <div className="attendance-editor-field-grid">
                  {FOOTER_FIELDS.map(([key, label]) => <div key={key}><Label htmlFor={`footer-${key}`}>{label}</Label><Input id={`footer-${key}`} value={config.content[key]} onChange={(event) => updateSection('content', key, event.target.value)} /></div>)}
                </div>
                <Label htmlFor="attendance-privacy">Pemberitahuan privasi</Label>
                <Textarea id="attendance-privacy" rows={3} value={config.content.privacyNotice} onChange={(event) => updateSection('content', 'privacyNotice', event.target.value)} />
              </div>
            </div>
          )}

          {activePanel === 'typography' && (
            <div className="attendance-live-editor__panel" role="tabpanel">
              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><Type aria-hidden="true" /><div><strong>Tipografi header</strong><span>Font sistem menjaga HTML tetap dapat dicetak offline.</span></div></div>
                <Label htmlFor="attendance-header-font">Jenis font header</Label>
                <Select value={config.typography.headerFont} onValueChange={(value) => updateSection('typography', 'headerFont', value)}>
                  <SelectTrigger id="attendance-header-font"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CLASS_ATTENDANCE_HEADER_FONTS).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <RangeControl label="Ukuran judul utama" value={config.typography.titleSize} min={12} max={30} onChange={(value) => updateSection('typography', 'titleSize', value)} />
                <Label htmlFor="attendance-title-weight">Ketebalan judul</Label>
                <Select value={String(config.typography.titleWeight)} onValueChange={(value) => updateSection('typography', 'titleWeight', Number(value))}>
                  <SelectTrigger id="attendance-title-weight"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEIGHT_OPTIONS.map(([value, label]) => <SelectItem key={value} value={String(value)}>{label} · {value}</SelectItem>)}</SelectContent>
                </Select>
                <LabeledSwitch id="attendance-title-italic" label="Judul miring" checked={config.typography.titleItalic} onCheckedChange={(value) => updateSection('typography', 'titleItalic', value)} />
                <LabeledSwitch id="attendance-title-uppercase" label="Judul huruf kapital" checked={config.typography.titleUppercase} onCheckedChange={(value) => updateSection('typography', 'titleUppercase', value)} />
                <RangeControl label="Posisi vertikal teks header" value={config.typography.headerOffsetY} min={-12} max={12} unit="mm" onChange={(value) => updateSection('typography', 'headerOffsetY', value)} />
                <RangeControl label="Posisi vertikal alamat" value={config.typography.addressOffsetY} min={-8} max={8} unit="mm" onChange={(value) => updateSection('typography', 'addressOffsetY', value)} />
                <ColorControl label="Warna teks header" value={config.branding.headerTextColor} onChange={(value) => updateSection('branding', 'headerTextColor', value)} />
                <RangeControl label="Ukuran kategori lembaga" value={config.typography.eyebrowSize} min={5} max={14} step={0.5} onChange={(value) => updateSection('typography', 'eyebrowSize', value)} />
                <RangeControl label="Ukuran alamat" value={config.typography.addressSize} min={5} max={12} step={0.5} onChange={(value) => updateSection('typography', 'addressSize', value)} />
                <RangeControl label="Ukuran nama dokumen" value={config.typography.categorySize} min={5} max={14} step={0.5} onChange={(value) => updateSection('typography', 'categorySize', value)} />
              </div>

              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><Type aria-hidden="true" /><div><strong>Tipografi tabel</strong><span>Atur header kolom dan isi data secara terpisah.</span></div></div>
                <RangeControl label="Ukuran header kolom" value={config.typography.tableHeaderSize} min={5} max={10} step={0.5} onChange={(value) => updateSection('typography', 'tableHeaderSize', value)} />
                <Label htmlFor="attendance-table-weight">Ketebalan header kolom</Label>
                <Select value={String(config.typography.tableHeaderWeight)} onValueChange={(value) => updateSection('typography', 'tableHeaderWeight', Number(value))}>
                  <SelectTrigger id="attendance-table-weight"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEIGHT_OPTIONS.map(([value, label]) => <SelectItem key={value} value={String(value)}>{label} · {value}</SelectItem>)}</SelectContent>
                </Select>
                <LabeledSwitch id="attendance-table-italic" label="Header kolom miring" checked={config.typography.tableHeaderItalic} onCheckedChange={(value) => updateSection('typography', 'tableHeaderItalic', value)} />
                <LabeledSwitch id="attendance-table-uppercase" label="Header kolom kapital" checked={config.typography.tableHeaderUppercase} onCheckedChange={(value) => updateSection('typography', 'tableHeaderUppercase', value)} />
                <RangeControl label="Ukuran isi tabel" value={config.typography.bodySize} min={5} max={10} step={0.5} onChange={(value) => updateSection('typography', 'bodySize', value)} />
                <Label htmlFor="attendance-body-weight">Ketebalan isi tabel</Label>
                <Select value={String(config.typography.bodyWeight)} onValueChange={(value) => updateSection('typography', 'bodyWeight', Number(value))}>
                  <SelectTrigger id="attendance-body-weight"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEIGHT_OPTIONS.map(([value, label]) => <SelectItem key={value} value={String(value)}>{label} · {value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {activePanel === 'branding' && (
            <div className="attendance-live-editor__panel" role="tabpanel">
              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><ImageIcon aria-hidden="true" /><div><strong>Logo dokumen</strong><span>File logo dikelola melalui Konten → Halaman Depan.</span></div></div>
                <LabeledSwitch id="attendance-show-lpq" label="Tampilkan logo LPQ" description="Posisi kiri atas." checked={config.branding.showLpqLogo} onCheckedChange={(value) => updateSection('branding', 'showLpqLogo', value)} />
                <RangeControl label="Ukuran logo LPQ" value={config.branding.lpqLogoSize} min={12} max={25} unit="mm" onChange={(value) => updateSection('branding', 'lpqLogoSize', value)} />
                <div className="attendance-editor-logo-preview">
                  <span>{appearance.lpqLogoUrl ? <img src={appearance.lpqLogoUrl} alt="Logo LPQ saat ini" /> : 'Belum tersedia'}</span>
                  <div><strong>Logo LPQ saat ini</strong><small>Unggah pengganti melalui tab Konten.</small></div>
                </div>
                <LabeledSwitch id="attendance-show-qiroati" label="Tampilkan logo Qiroati" description="Posisi kanan atas." checked={config.branding.showQiroatiLogo} onCheckedChange={(value) => updateSection('branding', 'showQiroatiLogo', value)} />
                <RangeControl label="Ukuran logo Qiroati" value={config.branding.qiroatiLogoSize} min={12} max={25} unit="mm" onChange={(value) => updateSection('branding', 'qiroatiLogoSize', value)} />
                <div className="attendance-editor-logo-preview">
                  <span>{appearance.qiroatiLogoUrl ? <img src={appearance.qiroatiLogoUrl} alt="Logo Qiroati saat ini" /> : 'Belum diunggah'}</span>
                  <div><strong>Logo Qiroati saat ini</strong><small>Unggah melalui Konten → Halaman Depan.</small></div>
                </div>
              </div>

              <div className="attendance-editor-section">
                <div className="attendance-editor-section__title"><Palette aria-hidden="true" /><div><strong>Warna dokumen</strong><span>Warna aman dicetak dan tetap terbaca.</span></div></div>
                <div className="attendance-editor-field-grid">
                  <ColorControl label="Garis header & teks metadata" value={config.branding.headerColor} onChange={(value) => updateSection('branding', 'headerColor', value)} />
                  <ColorControl label="Aksen kategori" value={config.branding.accentColor} onChange={(value) => updateSection('branding', 'accentColor', value)} />
                  <ColorControl label="Latar header kolom" value={config.branding.tableHeaderBackground} onChange={(value) => updateSection('branding', 'tableHeaderBackground', value)} />
                  <ColorControl label="Teks header kolom" value={config.branding.tableHeaderText} onChange={(value) => updateSection('branding', 'tableHeaderText', value)} />
                </div>
              </div>
            </div>
          )}
        </aside>

        <div className="attendance-live-editor__preview">
          <div className="attendance-live-editor__preview-heading">
            <div><Eye aria-hidden="true" /><span><strong>Pratinjau langsung</strong><small>Contoh data · A4 landscape</small></span></div>
            <em>Perubahan belum tersimpan</em>
          </div>
          <AttendancePaperPreview appearance={appearance} classItem={sampleClass} dateSlots={dateSlots} monthLabel={monthLabel} />
        </div>
      </div>
    </section>
  );
};

export default ClassAttendanceLiveEditor;
