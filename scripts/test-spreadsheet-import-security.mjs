import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import {
  parseSpreadsheetArrayBuffer,
  SPREADSHEET_LIMITS,
  validateSpreadsheetFile,
} from '../src/lib/spreadsheetImport.js';

const workbookBuffer = (sheets) => {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const normalBuffer = workbookBuffer({ santri: [['nama', 'points'], ['  Ahmad  ', 10]] });
const normalRows = parseSpreadsheetArrayBuffer(normalBuffer, {
  extension: 'xlsx',
  output: 'rows',
  limits: SPREADSHEET_LIMITS.import,
});
assert.deepEqual(normalRows, [['nama', 'points'], ['Ahmad', 10]]);

const records = parseSpreadsheetArrayBuffer(normalBuffer, {
  extension: 'xlsx',
  output: 'records',
  limits: SPREADSHEET_LIMITS.restore,
});
assert.equal(Object.getPrototypeOf(records.santri[0]), null);
assert.equal(records.santri[0].nama, 'Ahmad');
assert.equal(records.santri[0].points, 10);

assert.throws(() => parseSpreadsheetArrayBuffer(workbookBuffer({ one: [['a']], two: [['b']] }), {
  extension: 'xlsx',
  output: 'records',
  limits: { ...SPREADSHEET_LIMITS.restore, maxSheets: 1 },
}), /Jumlah sheet melebihi batas/);

assert.throws(() => parseSpreadsheetArrayBuffer(workbookBuffer({ santri: [['a', 'b', 'c']] }), {
  extension: 'xlsx',
  output: 'rows',
  limits: { ...SPREADSHEET_LIMITS.import, maxColumns: 2 },
}), /Jumlah kolom melebihi batas/);

assert.throws(() => parseSpreadsheetArrayBuffer(workbookBuffer({ santri: [['a'], ['1'], ['2']] }), {
  extension: 'xlsx',
  output: 'rows',
  limits: { ...SPREADSHEET_LIMITS.import, maxRowsPerSheet: 2 },
}), /Jumlah baris melebihi batas/);

assert.throws(() => parseSpreadsheetArrayBuffer(workbookBuffer({ santri: [['__proto__'], ['polluted']] }), {
  extension: 'xlsx',
  output: 'records',
  limits: SPREADSHEET_LIMITS.restore,
}), /Header berbahaya ditolak/);

assert.throws(() => parseSpreadsheetArrayBuffer(workbookBuffer({ santri: [['nama'], ['terlalu panjang']] }), {
  extension: 'xlsx',
  output: 'rows',
  limits: { ...SPREADSHEET_LIMITS.import, maxCellCharacters: 5 },
}), /Isi satu sel melebihi batas/);

assert.throws(() => parseSpreadsheetArrayBuffer(new TextEncoder().encode('not an xlsx').buffer, {
  extension: 'xlsx',
  output: 'rows',
  limits: SPREADSHEET_LIMITS.import,
}), /Isi file tidak cocok dengan format XLSX/);

assert.throws(() => parseSpreadsheetArrayBuffer(new Uint8Array([0, 1, 2, 3]).buffer, {
  extension: 'csv',
  output: 'rows',
  limits: SPREADSHEET_LIMITS.import,
}), /data biner/);

assert.throws(() => validateSpreadsheetFile({
  name: 'santri.xlsx',
  type: 'text/html',
  size: 100,
}), /Tipe file/);

assert.throws(() => validateSpreadsheetFile({
  name: 'santri.exe',
  type: 'application/octet-stream',
  size: 100,
}), /Format file tidak didukung/);

assert.throws(() => validateSpreadsheetFile({
  name: 'santri.xlsx',
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size: SPREADSHEET_LIMITS.import.maxBytes + 1,
}), /Ukuran file melebihi batas/);

const componentPaths = [
  '../src/components/dashboard/admin/SantriManagement.jsx',
  '../src/components/dashboard/admin/SantriDewasaManagement.jsx',
  '../src/components/dashboard/admin/BackupRestoreManagement.jsx',
];
const components = await Promise.all(componentPaths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
for (const source of components) {
  assert.match(source, /spreadsheetImport/);
  assert.doesNotMatch(source, /XLSX\.read\(/);
  assert.doesNotMatch(source, /readAsBinaryString/);
}

console.log('spreadsheet import security checks passed');
