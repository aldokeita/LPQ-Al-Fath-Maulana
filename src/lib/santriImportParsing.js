import { QIROATI_JILID_OPTIONS } from './qiroatiJilid.js';
import { SESSION_MAP } from '../utils/sessionMapping.js';

export const IMPORT_FIELDS = Object.freeze([
  { key: 'nama_lengkap', label: 'Nama Lengkap', aliases: ['full name', 'nama santri'] },
  { key: 'nama_panggilan', label: 'Nama Panggilan', aliases: ['nickname', 'panggilan'] },
  { key: 'jilid', label: 'Jilid', aliases: ['kelas', 'target hafalan'] },
  { key: 'tempat_lahir', label: 'Tempat Lahir', aliases: [] },
  { key: 'tanggal_lahir', label: 'Tgl Lahir', aliases: ['tanggal lahir', 'tgl lahir', 'birth date'] },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin', aliases: ['gender', 'kelamin'] },
  { key: 'alamat', label: 'Alamat', aliases: ['alamat rumah'] },
  { key: 'sesi_mengaji', label: 'Sesi', aliases: ['sesi mengaji'] },
  { key: 'tanggal_pendaftaran', label: 'Tgl Masuk', aliases: ['tanggal masuk', 'tanggal pendaftaran', 'tanggal masuk pendaftaran'] },
  { key: 'nama_ibu', label: 'Nama Ibu', aliases: [] },
  { key: 'nama_ayah', label: 'Nama Ayah', aliases: [] },
  { key: 'no_hp_ortu', label: 'No HP Ortu', aliases: ['no wa', 'nomor wa', 'whatsapp', 'no hp orang tua', 'nomor hp orang tua'] },
  { key: 'no_kk', label: 'No KK', aliases: ['nomor kk'] },
  { key: 'no_nik', label: 'No NIK', aliases: ['nik', 'nomor nik'] },
  { key: 'nomor_induk_qiroati', label: 'No Induk Qiroati', aliases: ['nomor induk qiroati', 'niq'] },
  { key: 'rfid_tag', label: 'RFID', aliases: ['rfid tag', 'nomor kartu'] },
]);
export const normalizeImportHeader = (value) => String(value ?? '').normalize('NFKD')
  .replace(/\p{M}/gu, '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
const aliases = new Map(IMPORT_FIELDS.flatMap(({ key, label, aliases: names }) =>
  [key, label, ...names].map(name => [normalizeImportHeader(name), key])));
const nonempty = row => row.some(cell => String(cell ?? '').trim() !== '');

export const createImportSource = (rows, { mode = 'headers', sheetName = '', date1904 = false, formats = {}, startRow = 0 } = {}) => {
  const first = rows.findIndex(row => Array.isArray(row) && nonempty(row));
  if (first < 0) throw new Error('File atau teks tidak memiliki data.');
  const headers = mode === 'legacy' ? IMPORT_FIELDS.map(f => f.label) : rows[first].map(v => String(v ?? ''));
  const mapping = mode === 'legacy' ? IMPORT_FIELDS.map(f => f.key) : headers.map(h => aliases.get(normalizeImportHeader(h)) || '');
  const dataStart = mode === 'legacy' ? first : first + 1;
  const entries = rows.slice(dataStart).map((cells, i) => ({ cells, row: dataStart + i + startRow + 1 }))
    .filter(entry => nonempty(entry.cells));
  if (!entries.length) throw new Error('Tidak ada baris santri setelah header.');
  if (mode === 'legacy' && entries.some(entry => entry.cells.length !== IMPORT_FIELDS.length)) {
    throw new Error('Urutan template lama membutuhkan tepat 16 kolom, termasuk kolom kosong.');
  }
  return { headers, mapping, entries, mode, sheetName, date1904, formats };
};

export const readImportWorkbook = (workbook, XLSX) => {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.['!ref']) throw new Error('Sheet pertama kosong.');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true });
  const formats = {};
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell?.t === 'n') formats[`${r + 1}:${c - range.s.c}`] = { numeric: true, formatted: cell.w };
    }
  }
  return createImportSource(rows, { sheetName, date1904: Boolean(workbook.Workbook?.WBProps?.date1904), formats, startRow: range.s.r });
};

export const validateImportMapping = mapping => {
  const assigned = mapping.filter(Boolean);
  if (!assigned.includes('nama_lengkap')) throw new Error('Pilih satu kolom untuk Nama Lengkap.');
  if (assigned.some(key => !IMPORT_FIELDS.some(f => f.key === key))) throw new Error('Pemetaan kolom tidak dikenal.');
  const repeated = [...new Set(assigned.filter((key, i) => assigned.indexOf(key) !== i))];
  if (repeated.length) throw new Error(`Dua kolom mengisi field yang sama: ${repeated.map(key => IMPORT_FIELDS.find(f => f.key === key).label).join(', ')}. Pilih salah satu.`);
};

export const inferImportDateOrder = (source, mapping) => {
  const columns = mapping.map((field, i) => ['tanggal_lahir', 'tanggal_pendaftaran'].includes(field) ? i : -1).filter(i => i >= 0);
  const signals = new Set();
  let ambiguous = false;
  for (const column of columns) {
    const hint = source.headers[column] || '';
    if (/MM[-/]DD[-/]YYYY/i.test(hint)) signals.add('mdy');
    if (/DD[-/]MM[-/]YYYY/i.test(hint)) signals.add('dmy');
    for (const { cells } of source.entries) {
      const match = String(cells[column] ?? '').trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (!match) continue;
      const a = Number(match[1]), b = Number(match[2]);
      if (a > 12 && b <= 12) signals.add('dmy');
      else if (b > 12 && a <= 12) signals.add('mdy');
      else if (a !== b && a <= 12 && b <= 12) ambiguous = true;
    }
  }
  if (signals.size > 1) return { order: null, needsChoice: true, reason: 'Format tanggal bercampur. Pilih format yang benar atau perbaiki file.' };
  if (signals.size === 1) return { order: [...signals][0], needsChoice: false };
  return { order: null, needsChoice: ambiguous, reason: ambiguous ? 'Tanggal dapat berarti hari/bulan atau bulan/hari. Pilih formatnya.' : '' };
};

const calendarDate = (year, month, day) => {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (year < 1 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Tanggal tidak sah dalam kalender.');
  }
  return date.toISOString().slice(0, 10);
};
export const parseImportDate = (value, order, date1904 = false) => {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || (!date1904 && Math.floor(value) === 60) || value > 2958465) throw new Error('Tanggal Excel tidak valid.');
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, value < 60 ? 31 : 30);
    const date = new Date(epoch + Math.floor(value) * 86400000);
    return calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) return calendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) throw new Error('Gunakan tanggal Excel, YYYY-MM-DD, DD/MM/YYYY, atau MM/DD/YYYY.');
  const a = Number(match[1]), b = Number(match[2]);
  if (!order && a !== b) throw new Error('Pilih format tanggal sebelum validasi.');
  return calendarDate(Number(match[3]), order === 'dmy' ? b : a, order === 'dmy' ? a : b);
};

export const normalizeImportGender = value => {
  const key = normalizeImportHeader(value);
  if (!key) return null;
  if (['l', 'laki', 'lakilaki', 'pria'].includes(key)) return 'Laki-laki';
  if (['p', 'pr', 'perempuan', 'wanita'].includes(key)) return 'Perempuan';
  throw new Error('Jenis kelamin tidak dikenal. Gunakan Laki-laki/Pria/L atau Perempuan/Wanita/P.');
};
export const normalizeImportJilid = (value, category = 'Anak') => {
  const key = normalizeImportHeader(value);
  if (!key) return null;
  const options = category === 'PTPT' ? ['Juz 1', 'Juz 2', 'Juz 28', 'Juz 29', 'Juz 30'] : QIROATI_JILID_OPTIONS;
  const result = options.find(option => {
    const canonical = normalizeImportHeader(option);
    return canonical === key || canonical.replace(/^jilid/, '') === key;
  });
  if (!result) throw new Error(`Jilid/target tidak dikenal: ${String(value)}.`);
  return result;
};
export const normalizeImportSession = value => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (Object.hasOwn(SESSION_MAP, text)) return text;
  const match = Object.entries(SESSION_MAP).find(([, name]) => name.toLowerCase() === text.toLowerCase());
  if (!match) throw new Error('Sesi tidak dikenal. Pilih Pagi, Pagi 2, Siang, Sore, atau Malam.');
  return match[0];
};

export const parseSantriImport = (source, { mapping = source.mapping, dateOrder = 'auto', category = 'Anak' } = {}) => {
  validateImportMapping(mapping);
  const detected = inferImportDateOrder(source, mapping);
  if (dateOrder === 'auto' && detected.needsChoice) throw new Error(detected.reason);
  const order = dateOrder === 'auto' ? detected.order : dateOrder;
  const records = [], errors = [], warnings = [];
  const identityFields = new Set(['nomor_induk_qiroati', 'no_nik', 'no_kk', 'no_hp_ortu', 'rfid_tag']);
  for (const entry of source.entries) {
    let name = String(entry.cells[mapping.indexOf('nama_lengkap')] ?? '').trim() || 'Tanpa nama';
    try {
      const record = { kategori: category, status: 'Aktif', points: 0, current_class_id: null, __importRow: entry.row };
      mapping.forEach((field, column) => {
        if (!field) return;
        const raw = entry.cells[column] ?? '';
        const format = source.formats?.[`${entry.row}:${column}`];
        if (identityFields.has(field) && typeof raw === 'number') {
          if (!Number.isSafeInteger(raw) || raw < 0 || raw >= 1e15) throw new Error(`${IMPORT_FIELDS.find(f => f.key === field).label}: angka panjang/tidak valid berisiko kehilangan digit. Ubah sel menjadi teks dari data asli.`);
          warnings.push({ row: entry.row, reason: `${IMPORT_FIELDS.find(f => f.key === field).label} disimpan sebagai angka Excel. Pastikan digit/angka nol awal pada preview benar; digit yang hilang tidak ditebak.` });
        }
        if (['tanggal_lahir', 'tanggal_pendaftaran'].includes(field)) record[field] = parseImportDate(raw, order, source.date1904);
        else record[field] = String(identityFields.has(field) && /^\d+$/.test(format?.formatted || '') ? format.formatted : raw).trim() || null;
      });
      name = record.nama_lengkap || name;
      if (!record.nama_lengkap) throw new Error('Nama Lengkap wajib diisi.');
      record.nama_panggilan ||= record.nama_lengkap.split(/\s+/)[0];
      record.jenis_kelamin = normalizeImportGender(record.jenis_kelamin);
      record.jilid = normalizeImportJilid(record.jilid, category);
      record.sesi_mengaji = normalizeImportSession(record.sesi_mengaji);
      if (record.nomor_induk_qiroati && /\s/.test(record.nomor_induk_qiroati)) throw new Error('Nomor Induk Qiroati tidak boleh mengandung spasi.');
      records.push(record);
    } catch (error) { errors.push({ row: entry.row, name, reason: error.message }); }
  }
  return { records, errors, warnings, ignoredColumns: source.headers.filter((_, i) => !mapping[i]) };
};
