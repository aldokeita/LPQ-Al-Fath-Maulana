import { pickSantriProfileFields } from './dataMasterAdapters.js';

export const fetchSantriImportIdentities = async (fetchPage, pageSize = 500) => {
  const identities = [];
  for (let from = 0; ;) {
    const response = await fetchPage(from, from + pageSize - 1);
    if (response.error) throw new Error('Pemeriksaan data santri gagal. Coba lagi sebelum impor.');
    if (!Array.isArray(response.data)) throw new Error('Hasil pemeriksaan data santri tidak valid.');
    identities.push(...response.data);
    if (response.data.length === 0) {
      if (response.count != null && identities.length < response.count) throw new Error('Pemeriksaan data santri belum lengkap. Coba lagi sebelum impor.');
      return identities;
    }
    if (response.count != null && identities.length >= response.count) return identities;
    from += response.data.length;
  }
};
const text = value => String(value ?? '').trim();
export const santriPersonKey = record => record.tanggal_lahir
  ? `${text(record.nama_lengkap).toLowerCase().replace(/\s+/g, ' ')}|${record.tanggal_lahir}` : null;
const countBy = (rows, keyFn) => rows.reduce((map, row) => {
  const key = keyFn(row); if (key) map.set(key, (map.get(key) || 0) + 1); return map;
}, new Map());
export const allocateImportNiq = (used, { year = new Date().getFullYear(), random = Math.random } = {}) => {
  for (let attempt = 0; attempt < 500; attempt++) {
    const candidate = `${String(year).slice(-2)}${Math.floor(10000 + random() * 90000)}`;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
  throw new Error('Tidak dapat membuat nomor induk unik. Coba validasi kembali.');
};

export const validateSantriImport = (parsed, identities, { niqCache = new Map(), decisions = {}, generateNiq = allocateImportNiq } = {}) => {
  const errors = [...parsed.errors], ready = [], review = [], skipped = [], reviewCandidates = [];
  const existingNiq = countBy(identities, r => text(r.nomor_induk_qiroati));
  const existingRfid = countBy(identities, r => text(r.rfid_tag));
  const existingPeople = countBy(identities, santriPersonKey);
  const fileNiq = countBy(parsed.records, r => text(r.nomor_induk_qiroati));
  const fileRfid = countBy(parsed.records, r => text(r.rfid_tag));
  const filePeople = countBy(parsed.records, santriPersonKey);
  const used = new Set([...existingNiq.keys(), ...fileNiq.keys()]);
  for (const original of parsed.records) {
    const record = { ...original };
    try {
      const niq = text(record.nomor_induk_qiroati), rfid = text(record.rfid_tag);
      if (niq && (existingNiq.has(niq) || fileNiq.get(niq) > 1)) throw new Error('Nomor Induk Qiroati sudah digunakan atau berulang dalam file.');
      if (rfid && (existingRfid.has(rfid) || fileRfid.get(rfid) > 1)) throw new Error('RFID sudah digunakan atau berulang dalam file.');
      if (!niq) {
        let candidate = niqCache.get(record.__importRow);
        if (!candidate || used.has(candidate)) candidate = generateNiq(used);
        else used.add(candidate);
        niqCache.set(record.__importRow, candidate);
        record.nomor_induk_qiroati = candidate;
        record.is_auto_niq = true;
      }
      const person = santriPersonKey(record);
      const needsReview = person && (existingPeople.has(person) || filePeople.get(person) > 1);
      if (needsReview) reviewCandidates.push({ ...record, reason: 'Nama lengkap dan tanggal lahir sama dengan santri lain di database/file. Pastikan ini orang berbeda.' });
      if (needsReview && decisions[record.__importRow] === 'skip') skipped.push(record);
      else if (needsReview && decisions[record.__importRow] !== 'new') review.push({ ...record, reason: 'Nama lengkap dan tanggal lahir sama dengan santri lain di database/file. Pastikan ini orang berbeda.' });
      else ready.push(record);
    } catch (error) { errors.push({ row: record.__importRow, name: record.nama_lengkap, reason: error.message }); }
  }
  return { ready, review, reviewCandidates, skipped, errors, warnings: parsed.warnings, ignoredColumns: parsed.ignoredColumns };
};
export const buildSantriImportPayload = record => ({
  action: 'create', role: 'santri', profile: pickSantriProfileFields(record),
  initial_password: record.password || record.nomor_induk_qiroati || record.nama_panggilan || '1234',
});
export const submitSantriImport = async (records, { createRecord, onProgress } = {}) => {
  const failures = [], successes = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    try {
      const response = await createRecord(buildSantriImportPayload(record));
      if (!response?.ok || !response?.data?.user_id) throw new Error(response?.error?.message || 'Akun baru tidak terkonfirmasi. Periksa kembali sebelum mencoba ulang.');
      successes.push(record);
    } catch (error) {
      failures.push({ row: record.__importRow, name: record.nama_lengkap, niq: record.nomor_induk_qiroati, reason: error.message, record });
      if (['UNAUTHORIZED', 'FORBIDDEN'].includes(error.code)) {
        for (const pending of records.slice(index + 1)) failures.push({ row: pending.__importRow, name: pending.nama_lengkap, niq: pending.nomor_induk_qiroati, reason: 'Belum diproses karena sesi login atau izin akses tidak valid.', record: pending });
        onProgress?.({ completed: index + 1, total: records.length, successCount: successes.length, failureCount: index + 1 - successes.length });
        break;
      }
    }
    onProgress?.({ completed: successes.length + failures.length, total: records.length, successCount: successes.length, failureCount: failures.length });
  }
  return { successCount: successes.length, successes, failures };
};
