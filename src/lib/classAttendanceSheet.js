import {
  getClassAttendanceHeaderFontStack,
  normalizeClassAttendancePrintConfig,
} from './classAttendancePrintConfig.js';

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const CLASS_ATTENDANCE_MIN_ROWS = 15;
export const CLASS_ATTENDANCE_MAX_ROWS = 20;
export const CLASS_ATTENDANCE_DATE_SLOTS = 23;

const padNumber = (value) => String(value).padStart(2, '0');

export const escapeAttendanceHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const formatClassAttendanceTeacherName = (value) => {
  const name = String(value || '').trim();
  if (!name) return 'Belum ditentukan';
  return name.replace(/^(?:ustadzah|ustadz|usth?\.?)(?:\s+|$)/i, '').trim() || name;
};

const renderMultilineLabel = (value) => escapeAttendanceHtml(value).replaceAll('\n', '<br />');

export const getClassAttendanceMonthLabel = (monthIndex, year) => (
  `${INDONESIAN_MONTHS[monthIndex] || INDONESIAN_MONTHS[0]} ${year}`
);

export const getClassAttendanceDateSlots = ({ year, monthIndex, holidays = [] }) => {
  const holidaySet = holidays instanceof Set ? holidays : new Set(holidays);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dates = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    const dayOfWeek = date.getUTCDay();
    const dateKey = `${year}-${padNumber(monthIndex + 1)}-${padNumber(day)}`;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWeekday && !holidaySet.has(dateKey)) {
      dates.push({ day, dateKey });
    }
  }

  return Array.from({ length: CLASS_ATTENDANCE_DATE_SLOTS }, (_, index) => dates[index] || null);
};

const createBlankRosterRow = (index) => ({
  id: `blank-${index}`,
  nama_lengkap: '',
  jilid: '',
  no_hp_ortu: '',
  isBlank: true,
});

export const createClassAttendancePages = (roster = []) => {
  const safeRoster = Array.isArray(roster) ? roster : [];
  const sourceChunks = [];

  if (safeRoster.length === 0) {
    sourceChunks.push([]);
  } else {
    for (let index = 0; index < safeRoster.length; index += CLASS_ATTENDANCE_MAX_ROWS) {
      sourceChunks.push(safeRoster.slice(index, index + CLASS_ATTENDANCE_MAX_ROWS));
    }
  }

  return sourceChunks.map((chunk, pageIndex) => {
    const minimumRows = Math.max(CLASS_ATTENDANCE_MIN_ROWS, chunk.length);
    const rows = [...chunk];

    while (rows.length < minimumRows) {
      rows.push(createBlankRosterRow(`${pageIndex}-${rows.length}`));
    }

    return {
      pageNumber: pageIndex + 1,
      rows,
      rosterOffset: pageIndex * CLASS_ATTENDANCE_MAX_ROWS,
    };
  });
};

export const slugifyClassAttendanceFilename = (value) => String(value || 'kelas')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase() || 'kelas';

const renderDateHeaders = (dateSlots) => dateSlots.map((slot) => (
  `<th class="date-column" scope="col">${slot ? slot.day : ''}</th>`
)).join('');

const renderRosterRows = ({ page, dateSlots }) => page.rows.map((santri, rowIndex) => {
  const number = santri.isBlank ? '' : page.rosterOffset + rowIndex + 1;
  const jilid = santri.isBlank ? '' : (santri.jilid || '—');
  const parentPhone = santri.isBlank ? '' : (santri.no_hp_ortu || '—');
  const attendanceCells = dateSlots.map(() => '<td class="attendance-cell"></td>').join('');

  return `
    <tr>
      <td class="number-cell">${number}</td>
      <td class="name-cell">${escapeAttendanceHtml(santri.nama_lengkap)}</td>
      <td class="jilid-cell">${escapeAttendanceHtml(jilid)}</td>
      <td class="phone-cell">${escapeAttendanceHtml(parentPhone)}</td>
      ${attendanceCells}
      <td class="progress-cell"></td>
    </tr>`;
}).join('');

const renderPrintPage = ({
  classData,
  config,
  dateSlots,
  generatedAtLabel,
  lpqLogoDataUrl,
  monthLabel,
  page,
  qiroatiLogoDataUrl,
}) => {
  const { branding, content } = config;
  const lpqLogo = branding.showLpqLogo && lpqLogoDataUrl
    ? `<img class="institution-logo institution-logo--lpq" src="${escapeAttendanceHtml(lpqLogoDataUrl)}" alt="Logo LPQ Al-Fath Maulana" />`
    : '';
  const qiroatiLogo = branding.showQiroatiLogo && qiroatiLogoDataUrl
    ? `<img class="institution-logo institution-logo--qiroati" src="${escapeAttendanceHtml(qiroatiLogoDataUrl)}" alt="Logo Qiroati" />`
    : '';

  return `
  <section class="attendance-page ${page.rows.length >= 18 ? 'is-compact' : ''}">
    <header class="institution-header">
      <div class="institution-logo-slot institution-logo-slot--left">${lpqLogo}</div>
      <div class="institution-copy">
        <p>${escapeAttendanceHtml(content.institutionEyebrow)}</p>
        <h1>${escapeAttendanceHtml(content.institutionName)}</h1>
        <span>${escapeAttendanceHtml(content.address)}</span>
      </div>
      <div class="institution-brand-right">
        ${qiroatiLogo}
      </div>
    </header>

    <dl class="class-meta">
      <div><dt>${escapeAttendanceHtml(content.teacherLabel)}</dt><dd>: ${escapeAttendanceHtml(formatClassAttendanceTeacherName(classData.guru?.nama))}</dd></div>
      <div><dt>${escapeAttendanceHtml(content.classLabel)}</dt><dd>: ${escapeAttendanceHtml(classData.nama_kelas || 'Tanpa nama')}</dd></div>
      <div><dt>${escapeAttendanceHtml(content.sessionLabel)}</dt><dd>: ${escapeAttendanceHtml(classData.sesi || 'Belum ditentukan')}</dd></div>
      <div><dt>${escapeAttendanceHtml(content.createdLabel)}</dt><dd>: ${escapeAttendanceHtml(generatedAtLabel)}</dd></div>
    </dl>

    <table class="attendance-table">
      <colgroup>
        <col class="col-number" />
        <col class="col-name" />
        <col class="col-jilid" />
        <col class="col-phone" />
        ${dateSlots.map(() => '<col class="col-date" />').join('')}
        <col class="col-progress" />
      </colgroup>
      <thead>
        <tr class="month-row">
          <th rowspan="2" scope="col">${renderMultilineLabel(content.numberColumn)}</th>
          <th rowspan="2" scope="col">${renderMultilineLabel(content.nameColumn)}</th>
          <th rowspan="2" scope="col">${renderMultilineLabel(content.levelColumn)}</th>
          <th rowspan="2" scope="col">${renderMultilineLabel(content.phoneColumn)}</th>
          <th colspan="${CLASS_ATTENDANCE_DATE_SLOTS}" scope="colgroup">${escapeAttendanceHtml(content.monthColumn)}: ${escapeAttendanceHtml(monthLabel)}</th>
          <th rowspan="2" scope="col">${renderMultilineLabel(content.progressColumn)}</th>
        </tr>
        <tr class="date-row">${renderDateHeaders(dateSlots)}</tr>
      </thead>
      <tbody>${renderRosterRows({ page, dateSlots })}</tbody>
      <tfoot>
        <tr>
          <th colspan="4" scope="row">${renderMultilineLabel(content.teacherAttendanceLabel)}</th>
          ${dateSlots.map(() => '<td></td>').join('')}
          <td></td>
        </tr>
      </tfoot>
    </table>

    <footer class="attendance-notes">
      <div><strong>${escapeAttendanceHtml(content.notesLabel)}</strong><span></span></div>
      <div><strong>${escapeAttendanceHtml(content.absenceLabel)}</strong><span></span></div>
      <div><strong>${escapeAttendanceHtml(content.substituteLabel)}</strong><span></span></div>
    </footer>
  </section>`;
};

export const buildClassAttendanceHtml = ({
  classData,
  dateSlots,
  generatedAt = new Date(),
  logoDataUrl,
  lpqLogoDataUrl = logoDataUrl,
  monthIndex,
  printConfig,
  qiroatiLogoDataUrl = '',
  year,
}) => {
  const config = normalizeClassAttendancePrintConfig(printConfig);
  const monthLabel = getClassAttendanceMonthLabel(monthIndex, year);
  const generatedAtLabel = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt);
  const pages = createClassAttendancePages(classData.roster);
  const pageMarkup = pages.map((page) => renderPrintPage({
    classData,
    config,
    dateSlots,
    generatedAtLabel,
    lpqLogoDataUrl,
    monthLabel,
    page,
    qiroatiLogoDataUrl,
  })).join('');

  const { branding, content, typography } = config;
  const headerFont = getClassAttendanceHeaderFontStack(typography.headerFont);
  const titleTransform = typography.titleUppercase ? 'uppercase' : 'none';
  const tableHeaderTransform = typography.tableHeaderUppercase ? 'uppercase' : 'none';

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeAttendanceHtml(content.documentCategory)} ${escapeAttendanceHtml(classData.nama_kelas)} — ${escapeAttendanceHtml(monthLabel)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      color: ${branding.headerColor};
      background: #e5e7eb;
      --attendance-header-font: ${headerFont};
      --attendance-title-size: ${typography.titleSize}pt;
      --attendance-title-weight: ${typography.titleWeight};
      --attendance-header-offset-y: ${typography.headerOffsetY}mm;
      --attendance-address-offset-y: ${typography.addressOffsetY}mm;
      --attendance-eyebrow-size: ${typography.eyebrowSize}pt;
      --attendance-address-size: ${typography.addressSize}pt;
      --attendance-category-size: ${typography.categorySize}pt;
      --attendance-table-header-size: ${typography.tableHeaderSize}pt;
      --attendance-table-header-weight: ${typography.tableHeaderWeight};
      --attendance-body-size: ${typography.bodySize}pt;
      --attendance-body-weight: ${typography.bodyWeight};
      --attendance-accent: ${branding.accentColor};
      --attendance-header-text: ${branding.headerTextColor};
      --attendance-table-head: ${branding.tableHeaderBackground};
      --attendance-table-head-text: ${branding.tableHeaderText};
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; }
    .print-toolbar { position: sticky; z-index: 10; top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 285mm; margin: 0 auto 16px; padding: 12px 14px; border: 1px solid #bae6fd; border-radius: 14px; background: rgba(255,255,255,.94); box-shadow: 0 12px 30px rgba(15,23,42,.16); backdrop-filter: blur(16px); }
    .print-toolbar strong { display: block; color: #0f172a; font-size: 14px; }
    .print-toolbar span { color: #475569; font-size: 12px; }
    .print-toolbar button { min-height: 40px; padding: 0 18px; border: 0; border-radius: 999px; color: white; background: linear-gradient(135deg,#0d9488,#2563eb); font-weight: 700; cursor: pointer; }
    .privacy-note { max-width: 285mm; margin: 0 auto 14px; color: #475569; font-size: 11px; text-align: center; }
    .attendance-page { width: 285mm; min-height: 198mm; margin: 0 auto 18px; padding: 4mm 5mm; overflow: hidden; background: #fff; box-shadow: 0 20px 50px rgba(15,23,42,.18); break-after: page; page-break-after: always; }
    .attendance-page:last-child { break-after: auto; page-break-after: auto; }
    .institution-header { display: grid; grid-template-columns: 27mm 1fr 27mm; align-items: center; min-height: 26mm; border-bottom: 1.5px solid ${branding.headerColor}; }
    .institution-logo-slot { display: flex; align-items: center; min-height: 23mm; }
    .institution-logo-slot--left { justify-content: flex-start; }
    .institution-logo { display: block; object-fit: contain; }
    .institution-logo--lpq { width: ${branding.lpqLogoSize}mm; height: ${branding.lpqLogoSize}mm; }
    .institution-logo--qiroati { width: ${branding.qiroatiLogoSize}mm; height: ${branding.qiroatiLogoSize}mm; }
    .institution-brand-right { display: flex; min-height: 23mm; flex-direction: column; align-items: flex-end; justify-content: center; gap: .7mm; }
    .institution-copy { color: var(--attendance-header-text); text-align: center; transform: translateY(var(--attendance-header-offset-y)); }
    .institution-copy p { margin: 0; font-family: var(--attendance-header-font); font-size: var(--attendance-eyebrow-size); font-weight: 800; letter-spacing: .08em; }
    .institution-copy h1 { margin: .4mm 0; font-family: var(--attendance-header-font); font-size: var(--attendance-title-size); font-weight: var(--attendance-title-weight); font-style: ${typography.titleItalic ? 'italic' : 'normal'}; line-height: 1; letter-spacing: -.03em; text-transform: ${titleTransform}; }
    .institution-copy span { display: block; font-size: var(--attendance-address-size); transform: translateY(var(--attendance-address-offset-y)); }
    .class-meta { display: grid; grid-template-columns: 1.3fr 1.2fr; gap: 1mm 8mm; margin: 2.5mm 0; font-size: 7pt; }
    .class-meta div { display: grid; grid-template-columns: 24mm 1fr; }
    .class-meta dt { font-weight: 800; }
    .class-meta dd { margin: 0; font-weight: 600; }
    .attendance-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: var(--attendance-body-size); font-weight: var(--attendance-body-weight); }
    .attendance-table th, .attendance-table td { height: 6.6mm; padding: .6mm 1mm; border: .25mm solid #111827; vertical-align: middle; }
    .attendance-page.is-compact .attendance-table th, .attendance-page.is-compact .attendance-table td { height: 5.7mm; }
    .attendance-table thead th { color: var(--attendance-table-head-text); background: var(--attendance-table-head); text-align: center; font-size: var(--attendance-table-header-size); font-weight: var(--attendance-table-header-weight); font-style: ${typography.tableHeaderItalic ? 'italic' : 'normal'}; text-transform: ${tableHeaderTransform}; }
    .attendance-table .month-row th { height: 5.5mm; }
    .attendance-table .date-row th { height: 5mm; padding: 0; }
    .attendance-table tfoot th, .attendance-table tfoot td { height: 5.5mm; background: #f8fafc; }
    .number-cell, .jilid-cell, .phone-cell, .attendance-cell { text-align: center; }
    .name-cell { padding-left: 1.5mm !important; font-weight: 600; }
    .col-number { width: 7mm; }
    .col-name { width: 41mm; }
    .col-jilid { width: 14mm; }
    .col-phone { width: 26mm; }
    .col-date { width: 5mm; }
    .col-progress { width: 40mm; }
    .attendance-notes { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 5mm; margin-top: 3mm; font-size: 7pt; }
    .attendance-notes div { display: flex; gap: 2mm; align-items: flex-end; min-height: 9mm; }
    .attendance-notes span { flex: 1; border-bottom: .25mm solid #64748b; }
    @page { size: A4 landscape; margin: 6mm; }
    @media print {
      html, body { width: auto; min-height: auto; background: #fff; }
      body { padding: 0; }
      .print-toolbar, .privacy-note { display: none !important; }
      .attendance-page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
      .attendance-table thead th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
    @media (max-width: 900px) {
      body { padding: 10px; overflow-x: auto; }
      .print-toolbar, .privacy-note { min-width: 900px; }
      .attendance-page { margin-left: 0; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div><strong>${escapeAttendanceHtml(content.documentCategory)} ${escapeAttendanceHtml(classData.nama_kelas)}</strong><span>${escapeAttendanceHtml(monthLabel)} · ${classData.roster.length} santri</span></div>
    <button type="button" onclick="window.print()">${escapeAttendanceHtml(content.printButtonLabel)}</button>
  </div>
  <p class="privacy-note">${escapeAttendanceHtml(content.privacyNotice)}</p>
  ${pageMarkup}
</body>
</html>`;
};

export { INDONESIAN_MONTHS };
