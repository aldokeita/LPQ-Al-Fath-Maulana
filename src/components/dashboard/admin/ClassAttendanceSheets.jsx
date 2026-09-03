import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Files,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminEmptyState from '@/components/dashboard/shared/AdminEmptyState';
import AdminErrorState from '@/components/dashboard/shared/AdminErrorState';
import { toast } from '@/components/ui/use-toast';
import { fetchClassAttendanceSource } from '@/lib/classAttendanceAdapters';
import { fetchClassAttendanceAppearance } from '@/lib/classAttendancePrintAdapters';
import {
  getClassAttendanceHeaderFontStack,
  normalizeClassAttendancePrintConfig,
} from '@/lib/classAttendancePrintConfig';
import {
  buildClassAttendanceBundleHtml,
  buildClassAttendanceHtml,
  createClassAttendancePages,
  getClassAttendanceDateSlots,
  getClassAttendanceMonthLabel,
  formatClassAttendanceTeacherName,
  INDONESIAN_MONTHS,
  slugifyClassAttendanceFilename,
} from '@/lib/classAttendanceSheet';

const SESSION_ORDER = ['Pagi', 'Siang', 'Sore', 'Malam'];

const embeddedAssetPromises = new Map();

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Gagal membaca logo.'));
  reader.readAsDataURL(blob);
});

const getEmbeddedAsset = async (url) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;

  if (!embeddedAssetPromises.has(url)) {
    embeddedAssetPromises.set(url, fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Aset logo tidak dapat dimuat.');
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch((error) => {
        embeddedAssetPromises.delete(url);
        throw error;
      }));
  }

  return embeddedAssetPromises.get(url);
};

const downloadHtmlFile = ({ filename, html }) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const formatSnapshotTime = (date) => {
  if (!(date instanceof Date)) return 'Belum disinkronkan';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getClassReadiness = (classItem) => {
  if (classItem.mismatchCount > 0) {
    return { label: 'Periksa membership', tone: 'warning', icon: AlertTriangle };
  }
  if (classItem.warnings.length > 0) {
    return { label: 'Perlu dilengkapi', tone: 'attention', icon: AlertTriangle };
  }
  return { label: 'Siap dicetak', tone: 'ready', icon: CheckCircle2 };
};

const MultilineText = ({ value }) => String(value || '').split('\n').map((part, index) => (
  <React.Fragment key={`${part}-${index}`}>{index > 0 && <br />}{part}</React.Fragment>
));

export const AttendancePaperPreview = ({
  appearance,
  classItem,
  dateSlots,
  monthLabel,
}) => {
  const [firstPage] = createClassAttendancePages(classItem.roster);
  const config = normalizeClassAttendancePrintConfig(appearance?.config);
  const { branding, content, typography } = config;
  const previewStyle = {
    '--attendance-preview-header-font': getClassAttendanceHeaderFontStack(typography.headerFont),
    '--attendance-preview-title-size': `${typography.titleSize}pt`,
    '--attendance-preview-title-weight': typography.titleWeight,
    '--attendance-preview-header-offset-y': `${typography.headerOffsetY}mm`,
    '--attendance-preview-address-offset-y': `${typography.addressOffsetY}mm`,
    '--attendance-preview-title-style': typography.titleItalic ? 'italic' : 'normal',
    '--attendance-preview-title-transform': typography.titleUppercase ? 'uppercase' : 'none',
    '--attendance-preview-eyebrow-size': `${typography.eyebrowSize}pt`,
    '--attendance-preview-address-size': `${typography.addressSize}pt`,
    '--attendance-preview-category-size': `${typography.categorySize}pt`,
    '--attendance-preview-table-header-size': `${typography.tableHeaderSize}pt`,
    '--attendance-preview-table-header-weight': typography.tableHeaderWeight,
    '--attendance-preview-table-header-style': typography.tableHeaderItalic ? 'italic' : 'normal',
    '--attendance-preview-table-header-transform': typography.tableHeaderUppercase ? 'uppercase' : 'none',
    '--attendance-preview-body-size': `${typography.bodySize}pt`,
    '--attendance-preview-body-weight': typography.bodyWeight,
    '--attendance-preview-header-color': branding.headerColor,
    '--attendance-preview-header-text-color': branding.headerTextColor,
    '--attendance-preview-accent': branding.accentColor,
    '--attendance-preview-table-head': branding.tableHeaderBackground,
    '--attendance-preview-table-head-text': branding.tableHeaderText,
    '--attendance-preview-lpq-logo-size': `${branding.lpqLogoSize}mm`,
    '--attendance-preview-qiroati-logo-size': `${branding.qiroatiLogoSize}mm`,
  };

  return (
    <div className="class-attendance-preview-scroll" tabIndex="0" aria-label="Pratinjau lembar absensi, dapat digulir secara horizontal">
      <article className={`class-attendance-paper ${firstPage.rows.length >= 18 ? 'is-compact' : ''}`} style={previewStyle}>
        <header className="class-attendance-paper__header">
          <div className="class-attendance-paper__logo-slot class-attendance-paper__logo-slot--left">
            {branding.showLpqLogo && appearance?.lpqLogoUrl && <img className="is-lpq" src={appearance.lpqLogoUrl} alt="Logo LPQ Al-Fath Maulana" />}
          </div>
          <div className="class-attendance-paper__institution-copy">
            <p>{content.institutionEyebrow}</p>
            <h3>{content.institutionName}</h3>
            <span>{content.address}</span>
          </div>
          <div className="class-attendance-paper__brand-right">
            {branding.showQiroatiLogo && appearance?.qiroatiLogoUrl && <img className="is-qiroati" src={appearance.qiroatiLogoUrl} alt="Logo Qiroati" />}
          </div>
        </header>

        <dl className="class-attendance-paper__meta">
          <div><dt>{content.teacherLabel}</dt><dd>: {formatClassAttendanceTeacherName(classItem.guru?.nama)}</dd></div>
          <div><dt>{content.classLabel}</dt><dd>: {classItem.nama_kelas}</dd></div>
          <div><dt>{content.sessionLabel}</dt><dd>: {classItem.sesi || 'Belum ditentukan'}</dd></div>
          <div><dt>{content.createdLabel}</dt><dd>: Pratinjau</dd></div>
        </dl>

        <table>
          <thead>
            <tr>
              <th rowSpan="2"><MultilineText value={content.numberColumn} /></th>
              <th rowSpan="2" className="name-column"><MultilineText value={content.nameColumn} /></th>
              <th rowSpan="2"><MultilineText value={content.levelColumn} /></th>
              <th rowSpan="2" className="phone-column"><MultilineText value={content.phoneColumn} /></th>
              <th colSpan="23">{content.monthColumn}: {monthLabel}</th>
              <th rowSpan="2" className="progress-column"><MultilineText value={content.progressColumn} /></th>
            </tr>
            <tr>
              {dateSlots.map((slot, index) => <th key={`${slot?.dateKey || 'blank'}-${index}`} className="date-column">{slot?.day || ''}</th>)}
            </tr>
          </thead>
          <tbody>
            {firstPage.rows.map((santri, index) => (
              <tr key={santri.id}>
                <td>{santri.isBlank ? '' : index + 1}</td>
                <td className="student-name">{santri.nama_lengkap}</td>
                <td>{santri.isBlank ? '' : santri.jilid || '—'}</td>
                <td>{santri.isBlank ? '' : santri.no_hp_ortu || '—'}</td>
                {dateSlots.map((slot, dateIndex) => <td key={`${slot?.dateKey || 'blank'}-${dateIndex}`} />)}
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th colSpan="4"><MultilineText value={content.teacherAttendanceLabel} /></th>{dateSlots.map((_, index) => <td key={index} />)}<td /></tr>
          </tfoot>
        </table>

        <footer>
          <span><strong>{content.notesLabel}</strong></span>
          <span><strong>{content.absenceLabel}</strong></span>
          <span><strong>{content.substituteLabel}</strong></span>
        </footer>
      </article>
    </div>
  );
};

const ClassAttendanceSheets = ({
  appearanceLoader = fetchClassAttendanceAppearance,
  sourceLoader = fetchClassAttendanceSource,
}) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [source, setSource] = useState({ classes: [], holidays: new Set(), fetchedAt: null });
  const [appearance, setAppearance] = useState(() => ({
    config: normalizeClassAttendancePrintConfig(),
    lpqLogoUrl: '/logo-lpq-al-fath-maulana.webp',
    qiroatiLogoUrl: '',
  }));
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [downloadMode, setDownloadMode] = useState('');
  const [error, setError] = useState('');

  const isDownloading = Boolean(downloadMode);
  const isDownloadingSelected = downloadMode === 'selected';
  const isDownloadingAll = downloadMode === 'all';

  const loadSource = useCallback(async ({ preserveSelection = true } = {}) => {
    setIsLoading(true);
    setError('');

    try {
      const [nextSource, nextAppearance] = await Promise.all([
        sourceLoader({ year: selectedYear }),
        appearanceLoader().catch((appearanceError) => {
          console.warn('Class attendance appearance could not be loaded:', appearanceError);
          return null;
        }),
      ]);
      setSource(nextSource);
      if (nextAppearance) setAppearance(nextAppearance);
      setSelectedClassId((currentId) => {
        if (preserveSelection && nextSource.classes.some((item) => item.id === currentId)) return currentId;
        return nextSource.classes[0]?.id || '';
      });
      return nextSource;
    } catch (loadError) {
      console.error('Failed to load class attendance source:', loadError);
      setError(loadError.message || 'Gagal memuat data absensi kelas.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [appearanceLoader, selectedYear, sourceLoader]);

  useEffect(() => {
    loadSource({ preserveSelection: true });
  }, [loadSource]);

  const selectedClass = useMemo(
    () => source.classes.find((classItem) => classItem.id === selectedClassId) || null,
    [selectedClassId, source.classes],
  );

  const dateSlots = useMemo(() => getClassAttendanceDateSlots({
    year: selectedYear,
    monthIndex: selectedMonth,
    holidays: source.holidays,
  }), [selectedMonth, selectedYear, source.holidays]);

  const monthLabel = getClassAttendanceMonthLabel(selectedMonth, selectedYear);
  const activeDateCount = dateSlots.filter(Boolean).length;

  const groupedClasses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = source.classes.filter((classItem) => {
      if (!query) return true;
      return [classItem.nama_kelas, classItem.sesi, classItem.guru?.nama]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });

    const groups = new Map();
    filtered.forEach((classItem) => {
      const session = classItem.sesi || 'Lainnya';
      if (!groups.has(session)) groups.set(session, []);
      groups.get(session).push(classItem);
    });

    return Array.from(groups.entries()).sort(([left], [right]) => {
      const leftIndex = SESSION_ORDER.indexOf(left);
      const rightIndex = SESSION_ORDER.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, 'id');
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
  }, [searchTerm, source.classes]);

  const summary = useMemo(() => ({
    totalClasses: source.classes.length,
    totalStudents: source.classes.reduce((total, classItem) => total + classItem.roster.length, 0),
    readyClasses: source.classes.filter((classItem) => classItem.warnings.length === 0).length,
  }), [source.classes]);

  const loadLatestDownloadContext = async () => {
    const [latestSource, nextAppearance] = await Promise.all([
      sourceLoader({ year: selectedYear }),
      appearanceLoader().catch((appearanceError) => {
        console.warn('Latest class attendance appearance could not be loaded:', appearanceError);
        return appearance;
      }),
    ]);
    const latestAppearance = nextAppearance || appearance;
    const latestDateSlots = getClassAttendanceDateSlots({
      year: selectedYear,
      monthIndex: selectedMonth,
      holidays: latestSource.holidays,
    });
    const [lpqLogoDataUrl, qiroatiLogoDataUrl] = await Promise.all([
      latestAppearance.config.branding.showLpqLogo
        ? getEmbeddedAsset(latestAppearance.lpqLogoUrl)
          .catch(() => getEmbeddedAsset('/logo-lpq-al-fath-maulana.webp'))
        : Promise.resolve(''),
      latestAppearance.config.branding.showQiroatiLogo
        ? getEmbeddedAsset(latestAppearance.qiroatiLogoUrl).catch((logoError) => {
          console.warn('Qiroati logo could not be embedded:', logoError);
          return '';
        })
        : Promise.resolve(''),
    ]);

    return {
      latestAppearance,
      latestDateSlots,
      latestSource,
      lpqLogoDataUrl,
      qiroatiLogoDataUrl,
    };
  };

  const handleDownload = async () => {
    if (!selectedClass) return;

    setDownloadMode('selected');
    try {
      const {
        latestAppearance,
        latestDateSlots,
        latestSource,
        lpqLogoDataUrl,
        qiroatiLogoDataUrl,
      } = await loadLatestDownloadContext();
      const latestClass = latestSource.classes.find((classItem) => classItem.id === selectedClass.id);

      if (!latestClass) {
        throw new Error('Kelas sudah tidak aktif atau tidak ditemukan. Muat ulang daftar kelas.');
      }
      const html = buildClassAttendanceHtml({
        classData: latestClass,
        dateSlots: latestDateSlots,
        generatedAt: latestSource.fetchedAt,
        lpqLogoDataUrl,
        monthIndex: selectedMonth,
        printConfig: latestAppearance.config,
        qiroatiLogoDataUrl,
        year: selectedYear,
      });
      const filename = `absensi-${slugifyClassAttendanceFilename(latestClass.nama_kelas)}-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}.html`;

      setSource(latestSource);
      setAppearance(latestAppearance);
      downloadHtmlFile({ filename, html });
      toast({
        title: 'HTML absensi siap',
        description: `${latestClass.nama_kelas} memakai snapshot terbaru berisi ${latestClass.roster.length} santri.`,
      });
    } catch (downloadError) {
      console.error('Failed to download class attendance HTML:', downloadError);
      toast({
        title: 'Unduhan gagal',
        description: downloadError.message || 'Gagal membuat HTML absensi kelas.',
        variant: 'destructive',
      });
    } finally {
      setDownloadMode('');
    }
  };

  const handleDownloadAll = async () => {
    if (source.classes.length === 0) return;

    setDownloadMode('all');
    try {
      const {
        latestAppearance,
        latestDateSlots,
        latestSource,
        lpqLogoDataUrl,
        qiroatiLogoDataUrl,
      } = await loadLatestDownloadContext();

      if (latestSource.classes.length === 0) {
        throw new Error('Belum ada kelas aktif untuk diunduh. Muat ulang daftar kelas.');
      }

      const html = buildClassAttendanceBundleHtml({
        classDataList: latestSource.classes,
        dateSlots: latestDateSlots,
        generatedAt: latestSource.fetchedAt,
        lpqLogoDataUrl,
        monthIndex: selectedMonth,
        printConfig: latestAppearance.config,
        qiroatiLogoDataUrl,
        year: selectedYear,
      });
      const filename = `absensi-semua-kelas-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}.html`;

      setSource(latestSource);
      setAppearance(latestAppearance);
      downloadHtmlFile({ filename, html });
      toast({
        title: 'Semua absensi siap dicetak',
        description: `Satu file HTML berisi ${latestSource.classes.length} kelas dan siap dicetak sekaligus.`,
      });
    } catch (downloadError) {
      console.error('Failed to download all class attendance HTML:', downloadError);
      toast({
        title: 'Unduhan gagal',
        description: downloadError.message || 'Gagal membuat HTML seluruh absensi kelas.',
        variant: 'destructive',
      });
    } finally {
      setDownloadMode('');
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, index) => now.getFullYear() - 2 + index);

  if (isLoading && source.classes.length === 0) {
    return (
      <div className="class-attendance-loading" role="status" aria-live="polite">
        <span className="class-attendance-loading__orb"><FileSpreadsheet aria-hidden="true" /></span>
        <div><strong>Menyiapkan lembar kelas</strong><p>Menyinkronkan urutan santri dan kalender akademik…</p></div>
      </div>
    );
  }

  return (
    <section className="class-attendance" aria-labelledby="class-attendance-title">
      <header className="class-attendance-hero">
        <div className="class-attendance-hero__glow" aria-hidden="true" />
        <div className="class-attendance-hero__copy">
          <span className="class-attendance-hero__icon"><FileSpreadsheet aria-hidden="true" /></span>
          <div>
            <p className="class-attendance-eyebrow">Akademik · Dokumen kelas</p>
            <h2 id="class-attendance-title">Absensi Kelas</h2>
            <p>Buat lembar absensi A4 dari susunan terbaru Manajemen Kelas, lalu unduh sebagai HTML mandiri.</p>
          </div>
        </div>
        <div className="class-attendance-hero__privacy">
          <ShieldCheck aria-hidden="true" />
          <span><strong>Snapshot privat</strong>File dibuat langsung di perangkat admin.</span>
        </div>
      </header>

      {error && <AdminErrorState message={error} onRetry={() => loadSource({ preserveSelection: true })} className="mb-5" />}

      <div className="class-attendance-toolbar" aria-label="Filter absensi kelas">
        <div className="class-attendance-toolbar__period">
          <CalendarDays aria-hidden="true" />
          <div><span>Periode cetak</span><strong>{monthLabel}</strong></div>
        </div>
        <div className="class-attendance-toolbar__controls">
          <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
            <SelectTrigger aria-label="Pilih bulan" className="class-attendance-select"><SelectValue /></SelectTrigger>
            <SelectContent>{INDONESIAN_MONTHS.map((month, index) => <SelectItem key={month} value={String(index)}>{month}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
            <SelectTrigger aria-label="Pilih tahun" className="class-attendance-select class-attendance-select--year"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => loadSource({ preserveSelection: true })} disabled={isLoading} aria-label="Sinkronkan ulang data kelas" className="class-attendance-refresh">
            <RefreshCw className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="class-attendance-summary" aria-label="Ringkasan data absensi kelas">
        <div><FileCheck2 aria-hidden="true" /><span><strong>{summary.totalClasses}</strong>Kelas aktif</span></div>
        <div><Users aria-hidden="true" /><span><strong>{summary.totalStudents}</strong>Santri terdaftar</span></div>
        <div><CheckCircle2 aria-hidden="true" /><span><strong>{summary.readyClasses}</strong>Kelas siap cetak</span></div>
        <div><Clock3 aria-hidden="true" /><span><strong>{activeDateCount}</strong>Hari belajar</span></div>
      </div>

      {source.classes.length > 0 && (
        <div className="class-attendance-bulk-action" role="group" aria-label="Unduh semua absensi kelas">
          <span className="class-attendance-bulk-action__icon"><Files aria-hidden="true" /></span>
          <div className="class-attendance-bulk-action__copy">
            <strong>Unduh semua absensi</strong>
            <span>Gabungkan {summary.totalClasses} kelas dalam satu HTML yang siap dicetak sekaligus.</span>
          </div>
          <Button
            variant="outline"
            onClick={handleDownloadAll}
            disabled={isDownloading || isLoading}
            className="class-attendance-download-all"
          >
            {isDownloadingAll ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Files aria-hidden="true" />}
            {isDownloadingAll ? 'Menyiapkan…' : 'Unduh semua'}
          </Button>
        </div>
      )}

      {source.classes.length === 0 ? (
        <AdminEmptyState
          icon={FileSpreadsheet}
          title="Belum ada kelas aktif"
          description="Tambahkan atau aktifkan kelas melalui Manajemen Kelas sebelum membuat lembar absensi."
        />
      ) : (
        <div className="class-attendance-workspace">
          <aside className="class-attendance-browser" aria-label="Daftar kelas">
            <div className="class-attendance-browser__header">
              <div><span>Pilih kelas</span><small>Urutan mengikuti Manajemen Kelas</small></div>
              <span className="class-attendance-browser__count">{source.classes.length}</span>
            </div>
            <div className="class-attendance-search">
              <Search aria-hidden="true" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari kelas atau guru…" aria-label="Cari kelas atau guru" />
            </div>
            <div className="class-attendance-class-list">
              {groupedClasses.length === 0 ? (
                <p className="class-attendance-no-result">Tidak ada kelas yang cocok dengan pencarian.</p>
              ) : groupedClasses.map(([session, classItems]) => (
                <div key={session} className="class-attendance-session-group">
                  <div className="class-attendance-session-label"><span>{session}</span><em>{classItems.length} kelas</em></div>
                  {classItems.map((classItem) => {
                    const readiness = getClassReadiness(classItem);
                    const StatusIcon = readiness.icon;
                    const isSelected = classItem.id === selectedClassId;
                    return (
                      <button
                        type="button"
                        key={classItem.id}
                        className={`class-attendance-class-card ${isSelected ? 'is-selected' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedClassId(classItem.id)}
                      >
                        <span className="class-attendance-class-card__icon"><User aria-hidden="true" /></span>
                        <span className="class-attendance-class-card__copy">
                          <strong>{classItem.nama_kelas}</strong>
                          <small>{classItem.guru?.nama || 'Guru belum ditentukan'} · {classItem.roster.length} santri</small>
                          <em data-tone={readiness.tone}><StatusIcon aria-hidden="true" />{readiness.label}</em>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>

          <div className="class-attendance-preview-panel">
            {selectedClass ? (
              <>
                <div className="class-attendance-preview-panel__header">
                  <div>
                    <p>Pratinjau A4 landscape</p>
                    <h3>{selectedClass.nama_kelas}</h3>
                    <span>{selectedClass.roster.length} santri · {activeDateCount} hari belajar · disinkronkan {formatSnapshotTime(source.fetchedAt)}</span>
                  </div>
                  <Button onClick={handleDownload} disabled={isDownloading} className="class-attendance-download">
                    {isDownloadingSelected ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                    {isDownloadingSelected ? 'Menyinkronkan…' : 'Unduh HTML'}
                  </Button>
                </div>

                {selectedClass.warnings.length > 0 && (
                  <div className="class-attendance-warning" role="status">
                    <AlertTriangle aria-hidden="true" />
                    <div><strong>Dokumen tetap dapat dibuat</strong><span>{selectedClass.warnings.join(' · ')}. Data kosong akan ditampilkan sebagai tanda pisah.</span></div>
                  </div>
                )}

                <AttendancePaperPreview appearance={appearance} classItem={selectedClass} dateSlots={dateSlots} monthLabel={monthLabel} />
                <p className="class-attendance-preview-note"><ShieldCheck aria-hidden="true" />HTML akan mengambil snapshot terbaru sekali lagi sebelum diunduh dan dapat dicetak tanpa koneksi internet.</p>
              </>
            ) : (
              <AdminEmptyState icon={FileSpreadsheet} title="Pilih kelas" description="Pilih salah satu kelas untuk melihat pratinjau lembar absensi." />
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default ClassAttendanceSheets;
