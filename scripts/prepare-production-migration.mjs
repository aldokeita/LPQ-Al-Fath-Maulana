import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const privateRoot = path.join(root, '_private_reference');
const defaultJson = path.join(privateRoot, 'migration-source', 'backup-lpq-full-2026-07-21-230902.json');
const defaultLegacySql = path.join(privateRoot, 'migration-work', 'legacy-selected-data.sql');
const defaultOutput = path.join(privateRoot, 'migration-work', 'prepared-production-data');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const sourceJsonPath = path.resolve(getArg('--json', defaultJson));
const legacySqlPath = path.resolve(getArg('--legacy-sql', defaultLegacySql));
const outputDir = path.resolve(getArg('--output', defaultOutput));

const assertPrivatePath = (target, label) => {
  const relative = path.relative(privateRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} harus berada di dalam _private_reference.`);
  }
};

assertPrivatePath(sourceJsonPath, 'Backup JSON');
assertPrivatePath(legacySqlPath, 'Ekstrak backup PostgreSQL');
assertPrivatePath(outputDir, 'Folder output');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const norm = (value) => value == null ? '' : String(value).trim();
const normLower = (value) => norm(value).toLowerCase();
const isFilled = (value) => value !== null && value !== undefined && norm(value) !== '';
const asNumber = (value, fallback = null) => {
  if (!isFilled(value)) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === 't' || value === 'true' || value === '1') return true;
  if (value === 'f' || value === 'false' || value === '0') return false;
  return fallback;
};
const dateOnly = (value, fallback = null) => {
  if (!isFilled(value)) return fallback;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : fallback;
};
const timestamp = (value, fallback = null) => {
  if (!isFilled(value)) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};
const validUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(norm(value));
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(value));

const deterministicUuid = (namespace, value) => {
  const bytes = crypto.createHash('sha256').update(`${namespace}:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const decodeCopyValue = (value) => {
  if (value === '\\N') return null;
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      result += value[index];
      continue;
    }
    index += 1;
    const escaped = value[index];
    if (escaped === 'n') result += '\n';
    else if (escaped === 'r') result += '\r';
    else if (escaped === 't') result += '\t';
    else if (escaped === 'b') result += '\b';
    else if (escaped === 'f') result += '\f';
    else if (escaped === 'v') result += '\v';
    else result += escaped ?? '';
  }
  return result;
};

const parseCopySql = (file) => {
  if (!fs.existsSync(file)) return {};
  const sql = fs.readFileSync(file, 'utf8');
  const result = {};
  const copyPattern = /^COPY public\.([^\s(]+) \(([^)]*)\) FROM stdin;\r?\n([\s\S]*?)^\\\.\r?$/gm;
  let match;
  while ((match = copyPattern.exec(sql))) {
    const [, table, rawColumns, rawRows] = match;
    const columns = rawColumns.split(',').map((column) => column.trim());
    const rows = rawRows.split(/\r?\n/).filter(Boolean).map((line) => {
      const values = line.split('\t').map(decodeCopyValue);
      if (values.length !== columns.length) {
        throw new Error(`Jumlah kolom COPY tidak cocok untuk tabel ${table}.`);
      }
      return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
    });
    result[table] = rows;
  }
  return result;
};

const jsonSource = readJson(sourceJsonPath);
const legacySource = parseCopySql(legacySqlPath);
const sourceRows = (name) => Array.isArray(jsonSource[name]) ? jsonSource[name] : [];
const legacyRows = (name) => Array.isArray(legacySource[name]) ? legacySource[name] : [];

const operationalReferenceCounts = new Map();
const addReference = (id) => {
  const key = normLower(id);
  if (key) operationalReferenceCounts.set(key, (operationalReferenceCounts.get(key) || 0) + 1);
};
for (const row of sourceRows('attendance')) addReference(row.user_id);
for (const row of sourceRows('payments')) addReference(row.santri_id);
for (const row of sourceRows('classes')) addReference(row.id_guru);
for (const row of sourceRows('mmq_absensi')) addReference(row.guru_id);

const legacySantriIds = new Set(legacyRows('santri').map((row) => normLower(row.id)).filter(Boolean));
const santriInput = sourceRows('santri').map((row) => ({ ...row }));
const parent = new Map(santriInput.map((row) => [normLower(row.id), normLower(row.id)]));

const find = (id) => {
  const current = parent.get(id);
  if (!current || current === id) return current || id;
  const rootId = find(current);
  parent.set(id, rootId);
  return rootId;
};
const union = (left, right) => {
  const leftRoot = find(left);
  const rightRoot = find(right);
  if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
};
const personFingerprint = (row) => [row.nama_lengkap, row.tanggal_lahir, row.jenis_kelamin].map(normLower).join('|');
const unionSafeDuplicates = (keySelector) => {
  const groups = new Map();
  for (const row of santriInput) {
    const key = keySelector(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    if (new Set(group.map(personFingerprint)).size !== 1) continue;
    for (const row of group.slice(1)) union(normLower(group[0].id), normLower(row.id));
  }
};

unionSafeDuplicates((row) => normLower(row.nomor_induk_qiroati).replace(/\s+/g, ''));
unionSafeDuplicates((row) => normLower(row.rfid_tag));

const groupedSantri = new Map();
for (const row of santriInput) {
  const rootId = find(normLower(row.id));
  if (!groupedSantri.has(rootId)) groupedSantri.set(rootId, []);
  groupedSantri.get(rootId).push(row);
}

const duplicateIdentityMap = new Map();
const santriDeduplication = [];
const chooseCanonicalSantri = (group) => [...group].sort((left, right) => {
  const leftLegacy = legacySantriIds.has(normLower(left.id)) ? 1 : 0;
  const rightLegacy = legacySantriIds.has(normLower(right.id)) ? 1 : 0;
  if (leftLegacy !== rightLegacy) return rightLegacy - leftLegacy;
  const leftRefs = operationalReferenceCounts.get(normLower(left.id)) || 0;
  const rightRefs = operationalReferenceCounts.get(normLower(right.id)) || 0;
  if (leftRefs !== rightRefs) return rightRefs - leftRefs;
  return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
})[0];

const mergedSantri = [];
for (const group of groupedSantri.values()) {
  const canonical = chooseCanonicalSantri(group);
  const merged = { ...canonical };
  for (const row of group) {
    duplicateIdentityMap.set(normLower(row.id), normLower(canonical.id));
    for (const [key, value] of Object.entries(row)) {
      if (!isFilled(merged[key]) && isFilled(value)) merged[key] = value;
      if (key.startsWith('berkas_') && asBoolean(value)) merged[key] = true;
    }
  }
  if (group.length > 1) {
    santriDeduplication.push({
      canonical_id: canonical.id,
      merged_ids: group.filter((row) => row.id !== canonical.id).map((row) => row.id),
      reason: 'same_identity_and_duplicate_nomor_induk_or_rfid',
    });
  }
  mergedSantri.push(merged);
}

const canonicalUserId = (value) => duplicateIdentityMap.get(normLower(value)) || normLower(value) || null;
const monthMap = new Map([
  ['januari', 1], ['februari', 2], ['maret', 3], ['april', 4], ['mei', 5], ['juni', 6],
  ['juli', 7], ['agustus', 8], ['september', 9], ['oktober', 10], ['november', 11], ['desember', 12],
]);
const normalizeMonth = (value) => {
  if (!isFilled(value)) return null;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  return monthMap.get(normLower(value)) ?? null;
};
const normalizeCategory = (value) => {
  const category = normLower(value);
  if (category === 'ptpt') return 'PTPT';
  if (category === 'dewasa') return 'Dewasa';
  return 'Anak';
};
const normalizeRole = (guru) => {
  const roles = Array.isArray(guru.roles) ? guru.roles.map(normLower) : [];
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('pentashih')) return 'pentashih';
  return 'guru';
};

const guruSource = sourceRows('guru').map((row) => ({ ...row }));
const classesSource = sourceRows('classes').map((row) => ({ ...row }));
const classIds = new Set(classesSource.map((row) => normLower(row.id)));
const guruIds = new Set(guruSource.map((row) => normLower(row.id)));
const santriIds = new Set(mergedSantri.map((row) => canonicalUserId(row.id)));

const authUserSpecs = [];
const userProfiles = [];
const guru = guruSource.map((row) => {
  if (!validUuid(row.id)) throw new Error('Ditemukan ID guru yang bukan UUID valid.');
  const role = normalizeRole(row);
  const technicalEmail = validEmail(row.email) ? normLower(row.email) : `guru+${row.id}@auth.lpqalfathmaulana.local`;
  authUserSpecs.push({ id: row.id, role, email: technicalEmail, display_name: row.nama });
  userProfiles.push({
    id: row.id,
    role,
    display_name: row.nama,
    email: validEmail(row.email) ? normLower(row.email) : null,
    phone: isFilled(row.no_hp) ? norm(row.no_hp) : null,
    status: 'active',
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    created_by: null,
    updated_by: null,
  });
  return {
    id: row.id,
    nama: norm(row.nama),
    email: validEmail(row.email) ? normLower(row.email) : null,
    no_hp: isFilled(row.no_hp) ? norm(row.no_hp) : null,
    alamat: isFilled(row.alamat) ? row.alamat : null,
    foto_url: null,
    avatar_path: isFilled(row.foto_url) ? `guru/${row.id}/profile.webp` : null,
    rfid_tag: isFilled(row.rfid_tag) ? norm(row.rfid_tag) : null,
    jabatan: isFilled(row.jabatan) ? row.jabatan : null,
    roles: Array.isArray(row.roles) ? row.roles : [],
    is_notulen: asBoolean(row.is_notulen),
    jenis_kelamin: isFilled(row.jenis_kelamin) ? row.jenis_kelamin : null,
    tanggal_lahir: dateOnly(row.tanggal_lahir),
    status_guru: isFilled(row.status_guru) ? row.status_guru : null,
    status: 'active',
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    deleted_at: null,
    created_by: null,
    updated_by: null,
  };
});

const authLoginAliases = [];
const assetManifest = [];
const santri = mergedSantri.map((row) => {
  const id = canonicalUserId(row.id);
  if (!validUuid(id)) throw new Error('Ditemukan ID santri yang bukan UUID valid.');
  const nomorInduk = norm(row.nomor_induk_qiroati).replace(/\s+/g, '');
  const internalEmail = `santri+${id}@auth.lpqalfathmaulana.local`;
  authUserSpecs.push({ id, role: 'santri', email: internalEmail, display_name: row.nama_lengkap });
  userProfiles.push({
    id,
    role: 'santri',
    display_name: row.nama_lengkap,
    email: null,
    phone: null,
    status: 'active',
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    created_by: null,
    updated_by: null,
  });
  if (nomorInduk) {
    authLoginAliases.push({
      id: deterministicUuid('auth-login-alias', id),
      auth_user_id: id,
      alias_type: 'nomor_induk_qiroati',
      alias_value: nomorInduk,
      normalized_alias: nomorInduk,
      internal_email: internalEmail,
      is_active: true,
      created_at: timestamp(row.created_at),
      updated_at: timestamp(row.updated_at),
    });
  }
  if (isFilled(row.foto_url)) {
    assetManifest.push({
      owner_type: 'santri',
      owner_id: id,
      source_url: row.foto_url,
      target_bucket: 'avatars',
      target_path: `santri/${id}/profile.webp`,
      conversion_required: true,
    });
  }
  const currentClassId = classIds.has(normLower(row.id_kelas)) ? normLower(row.id_kelas) : null;
  return {
    id,
    nomor_induk_qiroati: nomorInduk || null,
    nama_lengkap: norm(row.nama_lengkap),
    nama_panggilan: isFilled(row.nama_panggilan) ? row.nama_panggilan : null,
    kategori: normalizeCategory(row.kategori),
    jenis_kelamin: isFilled(row.jenis_kelamin) ? row.jenis_kelamin : null,
    tanggal_lahir: dateOnly(row.tanggal_lahir),
    tempat_lahir: isFilled(row.tempat_lahir) ? row.tempat_lahir : null,
    alamat: isFilled(row.alamat) ? row.alamat : null,
    no_hp_ortu: isFilled(row.no_hp_ortu) ? norm(row.no_hp_ortu) : null,
    email: validEmail(row.email) ? normLower(row.email) : null,
    foto_url: null,
    avatar_path: isFilled(row.foto_url) ? `santri/${id}/profile.webp` : null,
    rfid_tag: isFilled(row.rfid_tag) ? norm(row.rfid_tag) : null,
    current_class_id: currentClassId,
    sesi_mengaji: isFilled(row.sesi_mengaji) ? row.sesi_mengaji : null,
    jilid: isFilled(row.jilid) ? row.jilid : null,
    status: isFilled(row.status) ? row.status : 'Aktif',
    points: Math.max(0, asNumber(row.points, 0)),
    order_in_class: asNumber(row.order_in_class),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    deleted_at: null,
    created_by: null,
    updated_by: null,
    nama_ayah: isFilled(row.nama_ayah) ? row.nama_ayah : null,
    nama_ibu: isFilled(row.nama_ibu) ? row.nama_ibu : null,
    tanggal_pendaftaran: dateOnly(row.tanggal_pendaftaran),
    no_kk: isFilled(row.no_kk) ? norm(row.no_kk) : null,
    no_nik: isFilled(row.no_nik) ? norm(row.no_nik) : null,
    berkas_foto: asBoolean(row.berkas_foto),
    berkas_akta: asBoolean(row.berkas_akta),
    berkas_kk: asBoolean(row.berkas_kk),
    berkas_form: asBoolean(row.berkas_form),
    link_qiroati: isFilled(row.link_qiroati) ? row.link_qiroati : null,
    default_spp_amount: null,
    archive_reason: null,
    archived_by: null,
  };
});

for (const row of guruSource) {
  if (!isFilled(row.foto_url)) continue;
  assetManifest.push({
    owner_type: 'guru',
    owner_id: row.id,
    source_url: row.foto_url,
    target_bucket: 'avatars',
    target_path: `guru/${row.id}/profile.webp`,
    conversion_required: true,
  });
}

const classes = classesSource.map((row) => ({
  id: row.id,
  nama_kelas: norm(row.nama_kelas),
  id_guru: guruIds.has(normLower(row.id_guru)) ? normLower(row.id_guru) : null,
  sesi: isFilled(row.sesi) ? row.sesi : null,
  kategori: normalizeCategory(row.kategori),
  sort_order: asNumber(row.order),
  is_active: true,
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at),
  deleted_at: null,
  created_by: null,
  updated_by: null,
}));

const classMemberships = santri.filter((row) => row.current_class_id).map((row) => ({
  id: deterministicUuid('class-membership', `${row.id}:${row.current_class_id}`),
  santri_id: row.id,
  class_id: row.current_class_id,
  start_date: row.tanggal_pendaftaran || dateOnly(row.created_at) || '2000-01-01',
  end_date: null,
  status: 'active',
  order_in_class: row.order_in_class,
  created_at: row.created_at,
  updated_at: row.updated_at,
  created_by: null,
  updated_by: null,
}));

const classMutations = sourceRows('class_mutations').map((row) => ({
  id: row.id,
  santri_id: canonicalUserId(row.santri_id),
  from_class_id: classIds.has(normLower(row.from_class_id)) ? normLower(row.from_class_id) : null,
  to_class_id: classIds.has(normLower(row.to_class_id)) ? normLower(row.to_class_id) : null,
  mutation_date: dateOnly(row.mutation_date) || dateOnly(row.created_at) || '2000-01-01',
  reason: [row.from_jilid, row.to_jilid].some(isFilled)
    ? `Migrasi riwayat jilid: ${norm(row.from_jilid) || '-'} -> ${norm(row.to_jilid) || '-'}`
    : null,
  created_at: timestamp(row.created_at) || timestamp(row.mutation_date),
  created_by: null,
}));

const jilidHistory = sourceRows('jilid_history').map((row) => {
  const changedBy = normLower(row.changed_by);
  return {
    id: row.id,
    santri_id: canonicalUserId(row.santri_id),
    from_jilid: isFilled(row.from_jilid) ? norm(row.from_jilid) : null,
    to_jilid: norm(row.to_jilid),
    changed_at: timestamp(row.changed_at) || new Date(0).toISOString(),
    changed_by: guruIds.has(changedBy) || santriIds.has(changedBy) ? changedBy : null,
  };
});

const attendance = sourceRows('attendance').map((row) => ({
  id: row.id,
  user_id: canonicalUserId(row.user_id),
  role: normLower(row.role),
  attendance_date: dateOnly(row.attendance_date),
  check_in_time: isFilled(row.check_in_time) ? row.check_in_time : null,
  check_in_timestamp: timestamp(row.check_in_timestamp),
  class_id: classIds.has(normLower(row.class_id)) ? normLower(row.class_id) : null,
  sesi: isFilled(row.sesi) ? row.sesi : null,
  status: isFilled(row.status) ? row.status : 'Hadir',
  source: 'import',
  correction_reason: null,
  corrected_by: null,
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at),
  created_by: null,
  updated_by: null,
}));

const paymentTransactionConflicts = [];
const paymentRows = sourceRows('payments').map((row) => ({ ...row, santri_id: canonicalUserId(row.santri_id) }));
const paymentsByTransaction = new Map();
for (const row of paymentRows) {
  const key = normLower(row.transaction_id);
  if (!key) continue;
  if (!paymentsByTransaction.has(key)) paymentsByTransaction.set(key, []);
  paymentsByTransaction.get(key).push(row);
}
for (const [transactionId, group] of paymentsByTransaction) {
  if (group.length < 2) continue;
  const ordered = [...group].sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')));
  for (const row of ordered.slice(1)) {
    paymentTransactionConflicts.push({ payment_id: row.id, original_transaction_id: row.transaction_id, resolution: 'set_null_pending_manual_review' });
    row.transaction_id = null;
  }
  if (!transactionId) throw new Error('Invalid empty transaction conflict key.');
}

const payments = paymentRows.map((row) => ({
  id: row.id,
  santri_id: row.santri_id,
  bulan: normalizeMonth(row.bulan),
  tahun: asNumber(row.tahun),
  jumlah: asNumber(row.jumlah, 0),
  tanggal_pembayaran: dateOnly(row.tanggal_pembayaran),
  metode_pembayaran: isFilled(row.metode_pembayaran) ? row.metode_pembayaran : null,
  status: 'paid',
  catatan: isFilled(row.catatan) ? row.catatan : null,
  transaction_id: isFilled(row.transaction_id) ? row.transaction_id : null,
  deleted_at: null,
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at),
  created_by: null,
  updated_by: null,
}));

const expenses = sourceRows('expenses').map((row) => ({
  id: row.id,
  tanggal_pengeluaran: dateOnly(row.tanggal_pengeluaran),
  kategori: isFilled(row.kategori) ? row.kategori : null,
  deskripsi: [row.nama_pengeluaran, row.catatan].filter(isFilled).join(' - ') || null,
  jumlah: asNumber(row.jumlah, 0),
  bukti_url: isFilled(row.bukti_url) ? row.bukti_url : null,
  deleted_at: null,
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at),
  created_by: null,
  updated_by: null,
}));

const mmqSourceRows = sourceRows('mmq_absensi');
const syntheticMmqScheduleCreated = sourceRows('mmq_schedule').length === 0 && mmqSourceRows.length > 0;
const mmqScheduleInput = syntheticMmqScheduleCreated
  ? [{ id: deterministicUuid('mmq-schedule', 'legacy-unmapped'), is_active: false }]
  : sourceRows('mmq_schedule');
const mmqSchedule = mmqScheduleInput.map((row) => ({
  id: row.id,
  day_of_week: asNumber(row.day_of_week),
  start_time: isFilled(row.start_time) ? row.start_time : null,
  end_time: isFilled(row.end_time) ? row.end_time : null,
  location: isFilled(row.location) ? row.location : null,
  is_active: asBoolean(row.is_active, true),
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at),
  created_by: null,
  updated_by: null,
}));
const soleScheduleId = mmqSchedule.length === 1 ? mmqSchedule[0].id : null;
const mmqAttendanceCandidates = mmqSourceRows.map((row) => {
  if (!soleScheduleId) throw new Error('MMQ legacy memerlukan tepat satu jadwal untuk konversi otomatis.');
  return {
    id: deterministicUuid('mmq-attendance', `${row.id}:${row.guru_id}:${row.tanggal_absensi}`),
    schedule_id: soleScheduleId,
    guru_id: row.guru_id,
    attendance_date: dateOnly(row.tanggal_absensi),
    check_in_timestamp: timestamp(row.check_in_timestamp),
    status: isFilled(row.status) ? row.status : 'Hadir',
    notes: null,
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.created_at),
    created_by: null,
    updated_by: null,
  };
});
const mmqAttendanceGroups = new Map();
for (const row of mmqAttendanceCandidates) {
  const key = `${row.schedule_id}|${row.guru_id}|${row.attendance_date}`;
  if (!mmqAttendanceGroups.has(key)) mmqAttendanceGroups.set(key, []);
  mmqAttendanceGroups.get(key).push(row);
}
const mmqAttendanceDeduplication = [];
const mmqAttendance = [];
for (const group of mmqAttendanceGroups.values()) {
  const ordered = [...group].sort((left, right) => String(left.check_in_timestamp || '').localeCompare(String(right.check_in_timestamp || '')));
  mmqAttendance.push(ordered[0]);
  if (ordered.length > 1) {
    mmqAttendanceDeduplication.push({
      kept_id: ordered[0].id,
      removed_ids: ordered.slice(1).map((row) => row.id),
      reason: 'duplicate_schedule_guru_date_keep_first_check_in',
    });
  }
}

const academicCalendarSource = legacyRows('academic_calendar').length
  ? legacyRows('academic_calendar')
  : sourceRows('academic_calendar');
const academicCalendar = academicCalendarSource.map((row) => ({
  id: row.id,
  date: dateOnly(row.date),
  title: isFilled(row.title) ? row.title : row.description,
  description: isFilled(row.title) && isFilled(row.description) ? row.description : null,
  is_holiday: asBoolean(row.is_holiday),
  is_public: true,
  created_at: null,
  updated_at: null,
  created_by: null,
  updated_by: null,
}));

const normalizeHafalanStatus = (value) => {
  const status = normLower(value);
  if (['hafal', 'lancar', 'lulus'].includes(status)) return 'lulus';
  if (['belum', 'belum hafal'].includes(status)) return 'belum';
  if (['ulang', 'perlu diulang'].includes(status)) return 'ulang';
  return 'proses';
};
const hafalanProgress = sourceRows('hafalan_progress').map((row) => ({
  id: row.id,
  santri_id: canonicalUserId(row.santri_id),
  item_id: null,
  category: isFilled(row.category) ? norm(row.category) : (isFilled(row.jenis_hafalan) ? norm(row.jenis_hafalan) : null),
  item_name: isFilled(row.item_name) ? norm(row.item_name) : null,
  status: normalizeHafalanStatus(row.status ?? row.hafal),
  nilai: isFilled(row.status) ? norm(row.status) : null,
  catatan: null,
  assessed_by: guruIds.has(normLower(row.teacher_id)) ? normLower(row.teacher_id) : null,
  assessed_at: timestamp(row.updated_at) || timestamp(row.created_at),
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at),
  created_by: null,
  updated_by: null,
}));

const murojaahSubmissions = sourceRows('murojaah_submissions').map((row) => {
  const reviewed = normLower(row.status) === 'dinilai';
  const migratedId = validUuid(row.id)
    ? normLower(row.id)
    : deterministicUuid('murojaah-submission', `${row.id}:${row.santri_id}:${row.created_at}`);
  return {
    id: migratedId,
    santri_id: canonicalUserId(row.santri_id),
    target_guru_id: guruIds.has(normLower(row.target_guru_id)) ? normLower(row.target_guru_id) : null,
    type: isFilled(row.category) ? norm(row.category) : null,
    content: isFilled(row.item_name) ? norm(row.item_name) : null,
    recording_path: null,
    status: reviewed ? 'direview' : 'menunggu',
    feedback: isFilled(row.feedback) ? row.feedback : null,
    submitted_at: timestamp(row.created_at) || new Date(0).toISOString(),
    reviewed_at: reviewed ? timestamp(row.created_at) : null,
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.created_at),
    created_by: null,
    updated_by: null,
  };
});

const whatsappGroupLinks = sourceRows('whatsapp_group_links').map((row) => ({
  id: row.id,
  jilid: norm(row.jilid),
  group_name: isFilled(row.group_name) ? norm(row.group_name) : null,
  whatsapp_link: norm(row.whatsapp_link),
  is_active: true,
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at) || timestamp(row.created_at),
  created_by: null,
  updated_by: null,
}));

const websiteContent = sourceRows('website_content').map((row) => ({
  id: deterministicUuid('website-content', row.key),
  key: norm(row.key),
  content: row.content ?? {},
  is_public: true,
  created_at: timestamp(row.created_at),
  updated_at: timestamp(row.updated_at),
  created_by: null,
  updated_by: null,
}));

const emptyTargetTables = {
  santri_notes: [],
  mmq_notulensi: [],
  news: [],
  announcements: [],
};

const tables = {
  user_profiles: userProfiles,
  guru,
  classes,
  santri,
  auth_login_aliases: authLoginAliases,
  class_memberships: classMemberships,
  attendance,
  payments,
  expenses,
  academic_calendar: academicCalendar,
  mmq_schedule: mmqSchedule,
  mmq_attendance: mmqAttendance,
  website_content: websiteContent,
  whatsapp_group_links: whatsappGroupLinks,
  class_mutations: classMutations,
  jilid_history: jilidHistory,
  hafalan_progress: hafalanProgress,
  murojaah_submissions: murojaahSubmissions,
  ...emptyTargetTables,
};

const duplicateCount = (rows, keySelector) => {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const key = keySelector(row);
    if (!key) continue;
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates;
};
const validation = {
  duplicate_auth_ids: duplicateCount(authUserSpecs, (row) => normLower(row.id)),
  duplicate_auth_emails: duplicateCount(authUserSpecs, (row) => normLower(row.email)),
  duplicate_nomor_induk: duplicateCount(santri, (row) => normLower(row.nomor_induk_qiroati)),
  duplicate_santri_rfid: duplicateCount(santri, (row) => normLower(row.rfid_tag)),
  duplicate_guru_rfid: duplicateCount(guru, (row) => normLower(row.rfid_tag)),
  duplicate_payment_transaction_id: duplicateCount(payments, (row) => normLower(row.transaction_id)),
  duplicate_payment_period: duplicateCount(payments.filter((row) => row.bulan && row.tahun), (row) => `${row.santri_id}|${row.bulan}|${row.tahun}`),
  duplicate_attendance: duplicateCount(attendance, (row) => `${row.user_id}|${row.attendance_date}|${normLower(row.sesi)}`),
  duplicate_mmq_attendance: duplicateCount(mmqAttendance, (row) => `${row.schedule_id}|${row.guru_id}|${row.attendance_date}`),
  duplicate_active_membership: duplicateCount(classMemberships, (row) => row.santri_id),
  duplicate_whatsapp_jilid: duplicateCount(whatsappGroupLinks, (row) => normLower(row.jilid)),
  missing_payment_santri: payments.filter((row) => !santriIds.has(normLower(row.santri_id))).length,
  missing_attendance_user: attendance.filter((row) => !santriIds.has(normLower(row.user_id)) && !guruIds.has(normLower(row.user_id))).length,
  missing_attendance_class: attendance.filter((row) => row.class_id && !classIds.has(normLower(row.class_id))).length,
  missing_membership_santri: classMemberships.filter((row) => !santriIds.has(normLower(row.santri_id))).length,
  missing_membership_class: classMemberships.filter((row) => !classIds.has(normLower(row.class_id))).length,
  missing_mmq_guru: mmqAttendance.filter((row) => !guruIds.has(normLower(row.guru_id))).length,
  missing_class_mutation_santri: classMutations.filter((row) => !santriIds.has(normLower(row.santri_id))).length,
  missing_jilid_history_santri: jilidHistory.filter((row) => !santriIds.has(normLower(row.santri_id))).length,
  missing_hafalan_santri: hafalanProgress.filter((row) => !santriIds.has(normLower(row.santri_id))).length,
  missing_murojaah_santri: murojaahSubmissions.filter((row) => !santriIds.has(normLower(row.santri_id))).length,
  invalid_whatsapp_link: whatsappGroupLinks.filter((row) => !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/i.test(row.whatsapp_link)).length,
  missing_santri_login_identifier: santri.filter((row) => !row.nomor_induk_qiroati).length,
  missing_required_nomor_induk: santri.filter((row) => row.kategori !== 'Dewasa' && !row.nomor_induk_qiroati).length,
};

const reviewOnlyValidationKeys = new Set(['missing_required_nomor_induk', 'missing_santri_login_identifier']);
const failedChecks = Object.entries(validation)
  .filter(([name, count]) => count !== 0 && !reviewOnlyValidationKeys.has(name));
if (failedChecks.length) {
  throw new Error(`Hasil konversi gagal validasi: ${failedChecks.map(([name, count]) => `${name}=${count}`).join(', ')}`);
}

const forbiddenKeyPattern = /^(password|passwd|secret|service_role|access_token|refresh_token)$/i;
const assertNoForbiddenKeys = (value, currentPath = 'root') => {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoForbiddenKeys(item, `${currentPath}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeyPattern.test(key)) throw new Error(`Field terlarang ditemukan pada output: ${currentPath}.${key}`);
    assertNoForbiddenKeys(child, `${currentPath}.${key}`);
  }
};

const sourceTablesAtPageBoundary = Object.entries(jsonSource)
  .filter(([, rows]) => Array.isArray(rows) && rows.length > 0 && rows.length % 1000 === 0)
  .map(([table]) => table)
  .sort();

const prepared = {
  format_version: 1,
  generated_at: new Date().toISOString(),
  source: {
    json_sha256: hashValue(fs.readFileSync(sourceJsonPath)),
    legacy_sql_sha256: fs.existsSync(legacySqlPath) ? hashValue(fs.readFileSync(legacySqlPath)) : null,
  },
  preflight: {
    unresolved_required_nomor_induk: validation.missing_required_nomor_induk,
    unresolved_santri_login_identifiers: validation.missing_santri_login_identifier,
    source_tables_at_page_boundary: sourceTablesAtPageBoundary,
    source_has_backup_metadata: Boolean(jsonSource._backup_meta),
  },
  auth_user_specs: authUserSpecs,
  tables,
};
assertNoForbiddenKeys(prepared);

const privateConflicts = {
  santri_deduplication: santriDeduplication,
  missing_required_nomor_induk: santri
    .filter((row) => !row.nomor_induk_qiroati)
    .map((row) => ({
      santri_id: row.id,
      required_for_schema: row.kategori !== 'Dewasa',
      resolution: row.kategori !== 'Dewasa'
        ? 'supply_official_nomor_induk_before_import'
        : 'define_adult_login_credential_before_import',
    })),
  mmq_attendance_deduplication: mmqAttendanceDeduplication,
  payment_transaction_conflicts: paymentTransactionConflicts,
  unmapped_fields: {
    santri: ['berkas_ktp', 'juz_hafalan', 'notes'],
    guru: ['kelas_diampu', 'nomor_induk_qiroati'],
    classes: ['notes'],
    mmq_absensi: ['dikirim_oleh'],
    murojaah_submissions: ['recording_url', 'session_id'],
  },
};
const sourceRecordingAssets = sourceRows('murojaah_submissions').filter((row) => isFilled(row.recording_url)).length;
const safeSummary = {
  format_version: prepared.format_version,
  generated_at: prepared.generated_at,
  source_counts: {
    json_records: Object.values(jsonSource).filter(Array.isArray).reduce((sum, rows) => sum + rows.length, 0),
    legacy_selected_records: Object.values(legacySource).filter(Array.isArray).reduce((sum, rows) => sum + rows.length, 0),
    has_backup_metadata: Boolean(jsonSource._backup_meta),
    tables_at_1000_row_boundary: sourceTablesAtPageBoundary,
  },
  target_counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
  auth_users_to_create: authUserSpecs.length,
  assets_to_migrate: assetManifest.length,
  automatic_resolutions: {
    duplicate_santri_profiles_merged: santriDeduplication.reduce((sum, item) => sum + item.merged_ids.length, 0),
    duplicate_mmq_attendance_merged: mmqAttendanceDeduplication.reduce((sum, item) => sum + item.removed_ids.length, 0),
    payment_transaction_ids_set_null_for_review: paymentTransactionConflicts.length,
  },
  excluded: {
    plaintext_passwords: sourceRows('santri').filter((row) => isFilled(row.password)).length + sourceRows('guru').filter((row) => isFilled(row.password)).length,
    feedbacks: sourceRows('feedbacks').length,
    forum_topics: sourceRows('forum_topics').length,
    forum_replies: sourceRows('forum_replies').length,
    login_logs: legacyRows('login_logs').length,
    visitor_stats: legacyRows('visitor_stats').length,
    journey_posts: sourceRows('journey_posts').length,
    journey_comments: sourceRows('journey_comments').length,
    music_files: sourceRows('music_files').length,
    recording_assets_pending: sourceRecordingAssets,
  },
  validation,
  production_blockers: [
    paymentTransactionConflicts.length ? 'review_duplicate_legacy_transaction_id' : null,
    assetManifest.length ? 'migrate_avatar_assets_before_cutover' : null,
    sourceRecordingAssets ? 'migrate_murojaah_recordings_before_cutover' : null,
    syntheticMmqScheduleCreated ? 'review_synthetic_inactive_mmq_schedule' : null,
    sourceTablesAtPageBoundary.length ? 'verify_source_pagination_for_1000_row_tables' : null,
    !jsonSource._backup_meta ? 'verify_backup_origin_and_completeness_metadata' : null,
    validation.missing_required_nomor_induk ? 'complete_missing_required_nomor_induk_before_import' : null,
    validation.missing_santri_login_identifier ? 'define_all_santri_initial_login_credentials' : null,
    'create_auth_accounts_with_new_initial_passwords',
    'obtain_final_admin_approval_before_production_write',
  ].filter(Boolean),
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'prepared-data.json'), `${JSON.stringify(prepared, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'asset-manifest.json'), `${JSON.stringify(assetManifest, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'private-conflicts.json'), `${JSON.stringify(privateConflicts, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'safe-summary.json'), `${JSON.stringify(safeSummary, null, 2)}\n`);

console.log('Production migration preparation completed.');
console.log(`Auth users: ${safeSummary.auth_users_to_create}`);
for (const [table, count] of Object.entries(safeSummary.target_counts)) console.log(`${table}: ${count}`);
console.log(`Assets queued: ${safeSummary.assets_to_migrate}`);
console.log(`Production blockers: ${safeSummary.production_blockers.length}`);
