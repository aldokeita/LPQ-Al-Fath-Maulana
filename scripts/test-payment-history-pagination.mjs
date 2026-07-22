import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/components/dashboard/admin/PaymentHistory.jsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(source, /Total Records Fetched/i, 'The legacy fetched-record label must be removed.');
assert.match(source, /const PAGE_SIZE = 50;/);
assert.match(source, /select\([\s\S]*\{ count: 'exact' \}\)/);
assert.match(source, /query\.range\(from, to\)/);
assert.match(source, /setTotalPayments\(count \|\| 0\)/);
assert.match(source, /<DataPagination[\s\S]*totalItems=\{totalPayments\}/);
assert.match(source, /const BACKUP_PAGE_SIZE = 1000;/);
assert.match(source, /allPayments\.push\(\.\.\.\(data \|\| \[\]\)\)/);
assert.match(source, /XLSX\.writeFile\(workbook, `Backup_Riwayat_Pembayaran_/);
assert.match(source, /Total \{totalPayments\.toLocaleString\('id-ID'\)\} riwayat pembayaran/);

console.log('Payment history pagination and backup regression checks passed.');
