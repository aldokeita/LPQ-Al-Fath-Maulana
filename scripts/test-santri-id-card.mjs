import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildIdCardPrintHtml,
  chunkIdCardRecords,
  escapeIdCardHtml,
  getIdCardPaperConfig,
  ID_CARD_HEIGHT_MM,
  ID_CARD_WIDTH_MM,
} from '../src/lib/santriIdCardPrint.js';

const [component, dashboard, adapter] = await Promise.all([
  readFile(new URL('../src/components/dashboard/admin/SantriIdCardManagement.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/AdminDashboard.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/santriIdCardAdapters.js', import.meta.url), 'utf8'),
]);

assert.equal(getIdCardPaperConfig('A4').widthMm, 210);
assert.equal(getIdCardPaperConfig('F4').heightMm, 330.2);
assert.equal(getIdCardPaperConfig('A4').cardsPerPage, 9);
assert.equal(ID_CARD_WIDTH_MM, 53.8);
assert.equal(ID_CARD_HEIGHT_MM, 86);
assert.deepEqual(chunkIdCardRecords(Array.from({ length: 10 }, (_, id) => ({ id }))).map((page) => page.length), [9, 1]);
assert.equal(escapeIdCardHtml('<Nama & "Khusus">'), '&lt;Nama &amp; &quot;Khusus&quot;&gt;');

const html = buildIdCardPrintHtml({
  cards: [{
    id: 'santri-1',
    nama_lengkap: 'Aisyah <Utama>',
    nomor_induk_qiroati: 'NIQ-001',
    foto_url: '',
    jilid: 'Jilid 2A',
    sesi_label: 'Pagi',
  }],
  logoUrl: '/logo-lpq-al-fath-maulana.webp',
  paperSize: 'A4',
  qrDataUrls: { 'santri-1': 'data:image/png;base64,QR' },
});
assert.match(html, /@page \{ size: 210mm 297mm; margin: 0; \}/);
assert.match(html, /kartu-murid-abstrak-5\.jpeg/);
assert.match(html, /--id-card-width: 53\.8mm/);
assert.match(html, /--id-card-height: 86mm/);
assert.match(html, /page-break-inside: avoid/);
assert.match(html, /Aisyah &lt;Utama&gt;/);
assert.match(html, /NIQ-001/);
assert.match(html, /data:image\/png;base64,QR/);
assert.match(html, /id-card__photo-fallback/);
assert.doesNotMatch(html, /id-card::after/);
assert.match(html, /id-card__photo-frame[^}]*border: 0;/);
assert.doesNotMatch(html, /Aisyah <Utama>/);
assert.doesNotMatch(html, /Nomor Induk Qiroati|Kartu Santri|Jilid 2A|Pagi/);

const f4Html = buildIdCardPrintHtml({ cards: Array.from({ length: 10 }, (_, id) => ({ id, nama_lengkap: `Santri ${id}` })), paperSize: 'F4' });
assert.match(f4Html, /@page \{ size: 215\.9mm 330\.2mm; margin: 0; \}/);
assert.equal((f4Html.match(/class="id-card"/g) || []).length, 10);

assert.match(component, /role !== 'admin'/);
assert.match(component, /Pilih semua hasil/);
assert.match(component, /Deselect all/);
assert.match(component, /Cetak \$\{selectedSantri\.length/);
assert.match(component, /ID_CARD_PAPER_OPTIONS/);
assert.match(dashboard, /value: 'id-card', label: 'ID Card Santri'/);
assert.match(dashboard, /TabsContent value="id-card"/);
assert.match(adapter, /\.is\('deleted_at', null\)/);
assert.match(adapter, /\.range\(offset, offset \+ BATCH_SIZE - 1\)/);
assert.doesNotMatch(adapter, /\.(insert|update|upsert|delete)\s*\(/);

console.log('santri ID card selection and print contract tests passed');
