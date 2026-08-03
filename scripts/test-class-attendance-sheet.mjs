import assert from 'node:assert/strict';
import {
  buildClassAttendanceHtml,
  createClassAttendancePages,
  getClassAttendanceDateSlots,
} from '../src/lib/classAttendanceSheet.js';
import {
  DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG,
  normalizeClassAttendancePrintConfig,
} from '../src/lib/classAttendancePrintConfig.js';

const juneSlots = getClassAttendanceDateSlots({ year: 2026, monthIndex: 5 });
assert.equal(juneSlots.length, 23);
assert.equal(juneSlots.filter(Boolean).length, 22);
assert.equal(juneSlots[0].day, 1);

const juneWithHoliday = getClassAttendanceDateSlots({
  year: 2026,
  monthIndex: 5,
  holidays: new Set(['2026-06-01']),
});
assert.equal(juneWithHoliday.filter(Boolean).length, 21);
assert.equal(juneWithHoliday[0].day, 2);

const smallRoster = Array.from({ length: 6 }, (_, index) => ({
  id: index,
  jilid: '1A',
  nama_lengkap: `Santri ${index + 1}`,
  no_hp_ortu: '081234567890',
}));
const nineteenRoster = Array.from({ length: 19 }, (_, index) => ({ id: index, nama_lengkap: `Santri ${index + 1}` }));
const twentyOneRoster = Array.from({ length: 21 }, (_, index) => ({ id: index, nama_lengkap: `Santri ${index + 1}` }));

assert.deepEqual(createClassAttendancePages(smallRoster).map((page) => page.rows.length), [15]);
assert.deepEqual(createClassAttendancePages(nineteenRoster).map((page) => page.rows.length), [19]);
assert.deepEqual(createClassAttendancePages(twentyOneRoster).map((page) => page.rows.length), [20, 15]);
assert.equal(createClassAttendancePages(twentyOneRoster).flatMap((page) => page.rows).filter((row) => !row.isBlank).length, 21);

const html = buildClassAttendanceHtml({
  classData: {
    nama_kelas: 'Kelas <Utama>',
    sesi: 'Pagi',
    guru: { nama: 'Ustadz & Ustadzah' },
    roster: nineteenRoster,
  },
  dateSlots: juneSlots,
  generatedAt: new Date('2026-06-01T08:00:00+07:00'),
  logoDataUrl: 'data:image/webp;base64,AAAA',
  monthIndex: 5,
  printConfig: {
    content: {
      institutionName: 'LPQ <Pilihan>',
      documentCategory: 'DAFTAR HADIR',
      nameColumn: 'NAMA SANTRI',
    },
    typography: {
      headerFont: 'rounded',
      titleItalic: true,
      titleSize: 22,
    },
    branding: {
      tableHeaderBackground: '#123456',
    },
  },
  qiroatiLogoDataUrl: 'data:image/png;base64,QIROATI',
  year: 2026,
});

assert.match(html, /@page \{ size: A4 landscape;/);
assert.match(html, /window\.print\(\)/);
assert.match(html, /Kelas &lt;Utama&gt;/);
assert.match(html, /Ustadz &amp; Ustadzah/);
assert.match(html, /LPQ &lt;Pilihan&gt;/);
assert.match(html, /DAFTAR HADIR/);
assert.match(html, /NAMA SANTRI/);
assert.match(html, /Logo Qiroati/);
assert.match(html, /--attendance-title-size: 22pt/);
assert.match(html, /--attendance-table-head: #123456/);
assert.doesNotMatch(html, /https?:\/\//);

const normalizedConfig = normalizeClassAttendancePrintConfig({
  content: { address: '  ', documentCategory: 'Rekap Harian' },
  typography: { headerFont: 'remote-font', titleSize: 200, bodyWeight: 750 },
  branding: { accentColor: 'url(javascript:alert(1))', qiroatiLogoSize: 2 },
});
assert.equal(normalizedConfig.content.address, DEFAULT_CLASS_ATTENDANCE_PRINT_CONFIG.content.address);
assert.equal(normalizedConfig.content.documentCategory, 'Rekap Harian');
assert.equal(normalizedConfig.typography.headerFont, 'serif');
assert.equal(normalizedConfig.typography.titleSize, 30);
assert.equal(normalizedConfig.typography.bodyWeight, 800);
assert.equal(normalizedConfig.branding.accentColor, '#0369a1');
assert.equal(normalizedConfig.branding.qiroatiLogoSize, 12);

const smallHtml = buildClassAttendanceHtml({
  classData: { nama_kelas: 'Kelas Kecil', roster: smallRoster },
  dateSlots: juneSlots,
  generatedAt: new Date('2026-06-01T08:00:00+07:00'),
  logoDataUrl: 'data:image/webp;base64,AAAA',
  monthIndex: 5,
  year: 2026,
});
assert.doesNotMatch(smallHtml, />—</);

console.log('Class attendance sheet tests passed.');
