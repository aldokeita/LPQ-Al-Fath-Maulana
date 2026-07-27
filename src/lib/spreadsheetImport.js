import * as XLSX from 'xlsx';

export const SPREADSHEET_LIMITS = {
  import: {
    maxBytes: 5 * 1024 * 1024,
    maxSheets: 1,
    maxRowsPerSheet: 2001,
    maxColumns: 64,
    maxCellCharacters: 5000,
  },
  restore: {
    maxBytes: 25 * 1024 * 1024,
    maxSheets: 12,
    maxRowsPerSheet: 10001,
    maxColumns: 128,
    maxCellCharacters: 20000,
    maxTotalRows: 50000,
  },
};

const MIME_TYPES = {
  xlsx: new Set([
    '',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ]),
  xls: new Set([
    '',
    'application/octet-stream',
    'application/vnd.ms-excel',
  ]),
  csv: new Set([
    '',
    'application/csv',
    'application/octet-stream',
    'text/comma-separated-values',
    'text/csv',
    'text/plain',
  ]),
};

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const getExtension = (fileName = '') => fileName.split('.').pop()?.toLowerCase() || '';

const hasZipSignature = (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4b;
const hasOleSignature = (bytes) =>
  bytes.length >= 8 &&
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value);

const assertFileSignature = (bytes, extension) => {
  if (extension === 'xlsx' && !hasZipSignature(bytes)) {
    throw new Error('Isi file tidak cocok dengan format XLSX.');
  }
  if (extension === 'xls' && !hasOleSignature(bytes)) {
    throw new Error('Isi file tidak cocok dengan format XLS.');
  }
  if (extension === 'csv') {
    const sample = bytes.slice(0, Math.min(bytes.length, 4096));
    if (sample.includes(0)) throw new Error('File CSV mengandung data biner yang tidak valid.');
  }
};

const normalizeCell = (value, maxCharacters) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Spreadsheet mengandung angka yang tidak valid.');
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') throw new Error('Spreadsheet mengandung tipe data yang tidak didukung.');

  const normalized = value.trim();
  if (normalized.length > maxCharacters) {
    throw new Error(`Isi satu sel melebihi batas ${maxCharacters.toLocaleString('id-ID')} karakter.`);
  }
  return normalized;
};

const normalizeRows = (worksheet, limits) => {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  if (rows.length > limits.maxRowsPerSheet) {
    throw new Error(`Jumlah baris melebihi batas ${limits.maxRowsPerSheet.toLocaleString('id-ID')} per sheet.`);
  }

  return rows.map((row) => {
    if (!Array.isArray(row)) throw new Error('Struktur baris spreadsheet tidak valid.');
    if (row.length > limits.maxColumns) {
      throw new Error(`Jumlah kolom melebihi batas ${limits.maxColumns} per sheet.`);
    }
    return row.map((cell) => normalizeCell(cell, limits.maxCellCharacters));
  });
};

const rowsToSafeRecords = (rows) => {
  if (rows.length === 0) return [];

  const headers = rows[0].map((value, index) => {
    const header = String(value ?? '').trim();
    if (!header) throw new Error(`Header kolom ke-${index + 1} kosong.`);
    if (header.length > 128) throw new Error(`Header kolom ke-${index + 1} terlalu panjang.`);
    if (FORBIDDEN_KEYS.has(header.toLowerCase())) throw new Error(`Header berbahaya ditolak: ${header}.`);
    return header;
  });

  if (new Set(headers).size !== headers.length) throw new Error('Spreadsheet memiliki header kolom duplikat.');

  return rows.slice(1).map((row) => {
    const record = Object.create(null);
    headers.forEach((header, index) => {
      record[header] = row[index] ?? null;
    });
    return record;
  });
};

export const validateSpreadsheetFile = (file, { allowedExtensions = ['xlsx', 'xls', 'csv'], maxBytes } = {}) => {
  if (!file) throw new Error('Pilih file spreadsheet terlebih dahulu.');

  const extension = getExtension(file.name);
  if (!allowedExtensions.includes(extension)) {
    throw new Error(`Format file tidak didukung. Gunakan ${allowedExtensions.map((item) => `.${item}`).join(', ')}.`);
  }

  const byteLimit = maxBytes ?? SPREADSHEET_LIMITS.import.maxBytes;
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('File kosong atau ukuran file tidak valid.');
  if (file.size > byteLimit) {
    throw new Error(`Ukuran file melebihi batas ${Math.floor(byteLimit / 1024 / 1024)} MB.`);
  }

  const mimeType = String(file.type || '').toLowerCase();
  if (!MIME_TYPES[extension]?.has(mimeType)) {
    throw new Error(`Tipe file ${mimeType || 'tidak dikenal'} tidak cocok dengan .${extension}.`);
  }

  return extension;
};

export const parseSpreadsheetArrayBuffer = (arrayBuffer, {
  extension,
  output = 'rows',
  limits = SPREADSHEET_LIMITS.import,
} = {}) => {
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength === 0) {
    throw new Error('Isi file spreadsheet kosong atau tidak valid.');
  }

  const bytes = new Uint8Array(arrayBuffer);
  assertFileSignature(bytes, extension);

  const workbook = XLSX.read(bytes, {
    type: 'array',
    dense: true,
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    bookDeps: false,
    bookFiles: false,
    bookProps: false,
    bookVBA: false,
    sheetRows: limits.maxRowsPerSheet + 1,
  });

  if (workbook.SheetNames.length === 0) throw new Error('Spreadsheet tidak memiliki sheet.');
  if (workbook.SheetNames.length > limits.maxSheets) {
    throw new Error(`Jumlah sheet melebihi batas ${limits.maxSheets}.`);
  }

  const selectedSheetNames = output === 'rows' ? workbook.SheetNames.slice(0, 1) : workbook.SheetNames;
  let totalRows = 0;
  const parsedSheets = Object.create(null);

  selectedSheetNames.forEach((sheetName) => {
    if (FORBIDDEN_KEYS.has(sheetName.toLowerCase())) throw new Error(`Nama sheet berbahaya ditolak: ${sheetName}.`);
    const rows = normalizeRows(workbook.Sheets[sheetName], limits);
    totalRows += rows.length;
    if (limits.maxTotalRows && totalRows > limits.maxTotalRows) {
      throw new Error(`Jumlah seluruh baris melebihi batas ${limits.maxTotalRows.toLocaleString('id-ID')}.`);
    }
    parsedSheets[sheetName] = output === 'records' ? rowsToSafeRecords(rows) : rows;
  });

  return output === 'rows' ? parsedSheets[selectedSheetNames[0]] : parsedSheets;
};

export const parseSpreadsheetFile = async (file, options = {}) => {
  const extension = validateSpreadsheetFile(file, options);
  const arrayBuffer = await file.arrayBuffer();
  return parseSpreadsheetArrayBuffer(arrayBuffer, { ...options, extension });
};
