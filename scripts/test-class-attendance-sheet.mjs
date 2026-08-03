import assert from 'node:assert/strict';
import {
  buildClassAttendanceHtml,
  createClassAttendancePages,
  getClassAttendanceDateSlots,
} from '../src/lib/classAttendanceSheet.js';

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
  year: 2026,
});

assert.match(html, /@page \{ size: A4 landscape;/);
assert.match(html, /window\.print\(\)/);
assert.match(html, /Kelas &lt;Utama&gt;/);
assert.match(html, /Ustadz &amp; Ustadzah/);
assert.doesNotMatch(html, /https?:\/\//);

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
