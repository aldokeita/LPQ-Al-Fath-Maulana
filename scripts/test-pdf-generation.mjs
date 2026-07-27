import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const [reportUtils, paymentNotes] = await Promise.all([
  readFile(new URL('../src/utils/reportUtils.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/admin/PaymentNotes.jsx', import.meta.url), 'utf8'),
]);

for (const source of [reportUtils, paymentNotes]) {
  assert.match(source, /import \{ jsPDF \} from ['"]jspdf['"]/);
  assert.match(source, /import \{ autoTable \} from ['"]jspdf-autotable['"]/);
  assert.doesNotMatch(source, /doc\.autoTable\(/);
}

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
doc.setFont('helvetica', 'bold');
doc.text('LPQ Al-Fath Maulana - Verifikasi PDF', 14, 16);
autoTable(doc, {
  startY: 22,
  head: [['Nama Santri', 'Periode', 'Status']],
  body: Array.from({ length: 80 }, (_, index) => [
    `Santri Uji ${index + 1}`,
    'Juli 2026',
    index % 2 === 0 ? 'Lunas' : 'Belum Lunas',
  ]),
});

assert.ok(doc.getNumberOfPages() > 1, 'Tabel panjang harus menghasilkan PDF multi-halaman.');
assert.ok(doc.lastAutoTable?.finalY > 0, 'Metadata posisi akhir AutoTable harus tersedia.');

const bytes = new Uint8Array(doc.output('arraybuffer'));
assert.ok(bytes.length > 10_000, 'PDF yang dihasilkan terlalu kecil.');
assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');

console.log(`PDF generation checks passed (${doc.getNumberOfPages()} pages, ${bytes.length} bytes).`);
