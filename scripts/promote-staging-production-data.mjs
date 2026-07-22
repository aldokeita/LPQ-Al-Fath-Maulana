import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRef = process.env.LPQ_PRODUCTION_PROJECT_REF || '';
const expectedUrl = `https://${projectRef}.supabase.co`;
const root = path.resolve(import.meta.dirname, '..');
const privateRoot = path.join(root, '_private_reference');
const preparedPath = path.join(privateRoot, 'migration-work', 'prepared-production-data', 'prepared-data.json');
const assetResultPath = path.join(privateRoot, 'migration-work', 'assets', 'asset-download-result.json');
const assetsReadyRoot = path.join(privateRoot, 'migration-work', 'assets', 'ready');
const defaultCredentialPath = path.join(privateRoot, 'migration-work', 'production-initial-login-credentials.json');
const credentialPath = path.resolve(process.env.LPQ_PRODUCTION_CREDENTIAL_PATH || defaultCredentialPath);
const supabaseUrl = process.env.SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const execute = process.env.PRODUCTION_IMPORT_EXECUTE === 'true';
const resume = process.env.PRODUCTION_IMPORT_RESUME === 'true';
const confirmation = process.env.PRODUCTION_IMPORT_CONFIRMATION || '';
const bootstrapAdminEmail = (process.env.LPQ_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
const sourceBoundaryApproved = process.env.PRODUCTION_IMPORT_SOURCE_BOUNDARY_APPROVED === 'true';

const tableOrder = [
  'user_profiles',
  'guru',
  'classes',
  'santri',
  'auth_login_aliases',
  'class_memberships',
  'attendance',
  'payments',
  'expenses',
  'academic_calendar',
  'mmq_schedule',
  'mmq_attendance',
  'mmq_notulensi',
  'news',
  'announcements',
  'website_content',
  'whatsapp_group_links',
  'class_mutations',
  'jilid_history',
  'hafalan_progress',
  'murojaah_submissions',
  'santri_notes',
];

const assertTarget = () => {
  if (!/^[a-z0-9]{15,32}$/.test(projectRef)) throw new Error('Project Ref production baru wajib diisi.');
  if (supabaseUrl !== expectedUrl) throw new Error('Importer menolak target selain project LPQ yang disetujui.');
  if (!secretKey) throw new Error('Secret/service-role key tidak tersedia.');
  if (secretKey.startsWith('sbp_') || secretKey.startsWith('sb_publishable_')) {
    throw new Error('Jenis key tidak diizinkan untuk import backend.');
  }
  const isSecret = secretKey.startsWith('sb_secret_');
  const isLegacyJwt = /^eyJ[^.]+\.[^.]+\.[^.]+$/.test(secretKey);
  if (!isSecret && !isLegacyJwt) throw new Error('Format secret/service-role key tidak dikenali.');
  if (!execute || confirmation !== `IMPORT-PRODUCTION-${projectRef}`) {
    throw new Error('Konfirmasi import tidak cocok.');
  }
  for (const file of [preparedPath, assetResultPath]) {
    const relative = path.relative(privateRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file)) {
      throw new Error('Paket migrasi privat tidak lengkap.');
    }
  }
};

const headers = (contentType = 'application/json') => {
  const value = {
    apikey: secretKey,
    Accept: 'application/json',
    'User-Agent': 'LPQ-Production-Promotion/1.0',
  };
  if (contentType) value['Content-Type'] = contentType;
  if (!secretKey.startsWith('sb_secret_')) value.Authorization = `Bearer ${secretKey}`;
  return value;
};

const safeError = async (response, step) => {
  let message = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    message = [body.code, body.statusCode, body.error, body.message, body.details, body.hint]
      .filter(Boolean).join(' | ') || message;
  } catch {
    // Keep a status-only diagnostic.
  }
  throw new Error(`${step} failed: ${message}`);
};

const requestWithRetry = async (url, options, step) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, options);
    if (response.ok || (response.status !== 429 && response.status < 500)) return response;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  throw new Error(`${step} failed after bounded retries.`);
};

const tableCount = async (table, key = 'id') => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(key)}&limit=0`, {
    method: 'HEAD',
    headers: { ...headers(), Prefer: 'count=exact' },
  });
  if (!response.ok) await safeError(response, `count ${table}`);
  const match = (response.headers.get('content-range') || '').match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const listAuthUsers = async () => {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=100`, { headers: headers() });
    if (!response.ok) await safeError(response, 'list Auth users');
    const body = await response.json();
    const batch = Array.isArray(body) ? body : (body.users || []);
    users.push(...batch);
    if (batch.length < 100) break;
  }
  return users;
};

const assertEmptyOrResume = async (prepared) => {
  const occupied = [];
  for (const table of ['user_profiles', 'guru', 'classes', 'santri', 'attendance', 'payments', 'website_content']) {
    const count = await tableCount(table);
    if (count) occupied.push(`${table}=${count}`);
  }
  const authUsers = await listAuthUsers();
  const authCount = authUsers.length;
  if (authCount) occupied.push(`auth_users=${authCount}`);
  if (occupied.length && !resume) {
    throw new Error(`Target tidak kosong. Gunakan mode Resume hanya untuk import parsial yang sama: ${occupied.join(', ')}`);
  }
  const preparedAuthIds = new Set(prepared.auth_user_specs.map((spec) => spec.id));
  const extraAuthUsers = authUsers.filter((user) => !preparedAuthIds.has(user.id));
  if (extraAuthUsers.length !== 1 || !bootstrapAdminEmail
      || String(extraAuthUsers[0].email || '').toLowerCase() !== bootstrapAdminEmail) {
    throw new Error('Target harus hanya memuat satu akun bootstrap admin yang disetujui di luar paket migrasi.');
  }
  const adminId = extraAuthUsers[0].id;
  const response = await fetch(`${supabaseUrl}/rest/v1/user_profiles?select=id,role,status&id=eq.${encodeURIComponent(adminId)}`, {
    headers: headers(),
  });
  if (!response.ok) await safeError(response, 'verify bootstrap admin profile');
  const profiles = await response.json();
  if (profiles.length !== 1 || profiles[0].role !== 'admin' || profiles[0].status !== 'active') {
    throw new Error('Profil bootstrap admin tidak valid.');
  }
  return { approvedExtraAuthUsers: 1, approvedExtraUserProfiles: 1 };
};

const randomPassword = () => `${crypto.randomBytes(24).toString('base64url')}aA1!`;

const loadOrCreateCredentials = (prepared) => {
  if (fs.existsSync(credentialPath)) {
    const existing = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    if (existing.project_ref !== projectRef || existing.accounts?.length !== prepared.auth_user_specs.length) {
      throw new Error('File kredensial privat existing tidak cocok dengan paket migrasi.');
    }
    return existing;
  }

  const santriById = new Map((prepared.tables?.santri || []).map((row) => [row.id, row]));
  const accounts = prepared.auth_user_specs.map((spec) => {
    const santri = santriById.get(spec.id);
    if (spec.role === 'santri' && !santri?.nomor_induk_qiroati) {
      throw new Error('Nomor Induk Qiroati akun santri tidak tersedia.');
    }
    return {
      id: spec.id,
      role: spec.role,
      login: spec.role === 'santri' ? santri.nomor_induk_qiroati : spec.email,
      auth_email: spec.email,
      initial_password: randomPassword(),
    };
  });
  const document = {
    project_ref: projectRef,
    generated_at: new Date().toISOString(),
    warning: 'PRIVATE: distribute securely, rotate passwords after first login, never commit this file.',
    accounts,
  };
  fs.writeFileSync(credentialPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return document;
};

const createMissingAuthUsers = async (prepared, credentialDocument) => {
  const existing = await listAuthUsers();
  const byId = new Map(existing.map((user) => [user.id, user]));
  const credentials = new Map(credentialDocument.accounts.map((entry) => [entry.id, entry]));
  let created = 0;
  let reused = 0;

  for (const spec of prepared.auth_user_specs) {
    const found = byId.get(spec.id);
    if (found) {
      if (String(found.email || '').toLowerCase() !== String(spec.email || '').toLowerCase()) {
        throw new Error('Akun Auth existing memiliki email berbeda untuk UUID migrasi.');
      }
      reused += 1;
      continue;
    }
    const credential = credentials.get(spec.id);
    if (!credential) throw new Error('Kredensial awal privat tidak lengkap.');
    const response = await requestWithRetry(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        id: spec.id,
        email: spec.email,
        password: credential.initial_password,
        email_confirm: true,
        user_metadata: { role: spec.role, display_name: spec.display_name },
        app_metadata: { role: spec.role, provider: 'email', providers: ['email'] },
      }),
    }, 'create Auth user');
    if (!response.ok) await safeError(response, 'create Auth user');
    const user = await response.json();
    if (user.id !== spec.id) throw new Error('Auth mengembalikan UUID yang berbeda.');
    created += 1;
    if ((created + reused) % 50 === 0) console.log(`Auth progress: ${created + reused}/${prepared.auth_user_specs.length}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return { created, reused };
};

const cleanRow = (row) => {
  const result = { ...row };
  for (const field of ['created_at', 'updated_at']) {
    if (result[field] === null || result[field] === undefined) delete result[field];
  }
  return result;
};

const upsertRows = async (table, rows, batchSize = 100) => {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize).map(cleanRow);
    const response = await requestWithRetry(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?on_conflict=id`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    }, `import ${table}`);
    if (!response.ok) await safeError(response, `import ${table}`);
  }
  return rows.length;
};

const encodeObjectPath = (objectPath) => objectPath.split('/').map(encodeURIComponent).join('/');

const uploadEntry = async (entry) => {
  const file = path.resolve(assetsReadyRoot, entry.target_bucket, ...entry.target_path.split('/'));
  const relative = path.relative(assetsReadyRoot, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file)) {
    throw new Error('Asset path tidak aman atau file tidak tersedia.');
  }
  const response = await requestWithRetry(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(entry.target_bucket)}/${encodeObjectPath(entry.target_path)}`,
    {
      method: 'POST',
      headers: { ...headers('image/webp'), 'x-upsert': 'true' },
      body: fs.readFileSync(file),
    },
    `upload ${entry.target_bucket}`,
  );
  if (!response.ok) await safeError(response, `upload ${entry.target_bucket}`);
};

const runUploads = async (entries, concurrency = 4) => {
  let cursor = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor];
      cursor += 1;
      await uploadEntry(entry);
      completed += 1;
      if (completed % 50 === 0 || completed === entries.length) {
        console.log(`Storage progress: ${completed}/${entries.length}`);
      }
    }
  });
  await Promise.all(workers);
};

const setJsonPath = (rootValue, pathParts, value) => {
  if (!pathParts.length) return value;
  let current = rootValue;
  for (let index = 0; index < pathParts.length - 1; index += 1) current = current[pathParts[index]];
  current[pathParts[pathParts.length - 1]] = value;
  return rootValue;
};

const rewriteWebsiteContent = async (prepared, entries) => {
  const rows = prepared.tables.website_content || [];
  const byId = new Map(rows.map((row) => [row.id, structuredClone(row)]));
  for (const entry of entries.filter((item) => item.kind === 'website_content')) {
    const row = byId.get(entry.record_id);
    if (!row) throw new Error('Record website_content untuk asset tidak ditemukan.');
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/website-assets/${encodeObjectPath(entry.target_path)}`;
    row.content = setJsonPath(row.content, entry.json_path, publicUrl);
  }
  const ids = [...new Set(entries.filter((item) => item.kind === 'website_content').map((item) => item.record_id))];
  await upsertRows('website_content', ids.map((id) => byId.get(id)));
  return ids.length;
};

const verify = async (prepared, entries, baseline) => {
  const failures = [];
  for (const table of tableOrder) {
    const expected = (prepared.tables?.[table] || []).length
      + (table === 'user_profiles' ? baseline.approvedExtraUserProfiles : 0);
    const actual = await tableCount(table);
    if (actual !== expected) failures.push(`${table}: expected ${expected}, got ${actual}`);
  }
  const authCount = (await listAuthUsers()).length;
  const expectedAuthCount = prepared.auth_user_specs.length + baseline.approvedExtraAuthUsers;
  if (authCount !== expectedAuthCount) failures.push(`auth_users: expected ${expectedAuthCount}, got ${authCount}`);

  for (const entry of entries.filter((item) => item.kind === 'website_content')) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/public/website-assets/${encodeObjectPath(entry.target_path)}`);
    if (!response.ok) failures.push('website asset public read failed');
    else {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.output_sha256) {
        failures.push('website asset checksum mismatch');
      }
    }
  }
  const avatar = entries.find((entry) => entry.target_bucket === 'avatars');
  if (avatar) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/public/avatars/${encodeObjectPath(avatar.target_path)}`);
    if (response.ok) failures.push('private avatar unexpectedly public');
  }
  if (failures.length) throw new Error(`Post-import verification failed: ${[...new Set(failures)].join('; ')}`);
};

const main = async () => {
  assertTarget();
  const prepared = JSON.parse(fs.readFileSync(preparedPath, 'utf8'));
  const assetResult = JSON.parse(fs.readFileSync(assetResultPath, 'utf8'));
  if (prepared.format_version !== 1 || assetResult.failed !== 0) throw new Error('Paket migrasi belum siap.');
  if ((prepared.preflight?.unresolved_required_nomor_induk || 0) > 0) {
    throw new Error('Import production ditolak: Nomor Induk wajib masih belum lengkap.');
  }
  if ((prepared.preflight?.unresolved_santri_login_identifiers || 0) > 0) {
    throw new Error('Import production ditolak: identifier login santri masih belum lengkap.');
  }
  if ((prepared.preflight?.source_tables_at_page_boundary || []).length > 0 && !sourceBoundaryApproved) {
    throw new Error('Import production ditolak: kelengkapan tabel sumber pada batas 1000 baris belum diverifikasi.');
  }
  const entries = assetResult.results.filter((entry) => entry.status === 'ready');
  const baseline = await assertEmptyOrResume(prepared);
  const credentialDocument = loadOrCreateCredentials(prepared);
  const authResult = await createMissingAuthUsers(prepared, credentialDocument);
  const tableResults = {};
  for (const table of tableOrder) {
    tableResults[table] = await upsertRows(table, prepared.tables?.[table] || []);
    console.log(`Table applied: ${table} (${tableResults[table]})`);
  }
  await runUploads(entries);
  const rewrittenRows = await rewriteWebsiteContent(prepared, entries);
  await verify(prepared, entries, baseline);

  console.log('Production data promotion completed and verified.');
  console.log(`Auth created: ${authResult.created}`);
  console.log(`Auth reused: ${authResult.reused}`);
  console.log(`Application records applied: ${Object.values(tableResults).reduce((sum, value) => sum + value, 0)}`);
  console.log(`Storage objects uploaded: ${entries.length}`);
  console.log(`Website content rows rewritten: ${rewrittenRows}`);
  console.log(`Initial credentials saved privately: ${path.relative(root, credentialPath)}`);
};

main().catch((error) => {
  console.error(`Production data promotion failed: ${error.message}`);
  process.exitCode = 1;
});
