import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const privateRoot = path.join(root, '_private_reference');
const defaultInput = path.join(privateRoot, 'migration-work', 'prepared-production-data', 'prepared-data.json');
const inputPath = path.resolve(process.argv[2] || defaultInput);
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:55321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const assertLocalTarget = () => {
  const url = new URL(supabaseUrl);
  const localHost = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'http:' || !localHost || url.port !== '55321') {
    throw new Error('Importer menolak target non-local. Gunakan http://127.0.0.1:55321.');
  }
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY lokal tidak tersedia.');
  const relative = path.relative(privateRoot, inputPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('File input harus berada di dalam _private_reference.');
  }
};

const parseSafeError = async (response) => {
  const text = await response.text();
  if (!text) return `HTTP ${response.status}`;
  try {
    const body = JSON.parse(text);
    return [body.code, body.message, body.details, body.hint].filter(Boolean).join(' | ') || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
};

const authHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  'User-Agent': 'LPQ-Local-Migration-Rehearsal/1.0',
};

const randomLocalPassword = () => `${crypto.randomBytes(32).toString('base64url')}Aa1!`;

const listAuthUsers = async () => {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=100`, { headers: authHeaders });
    if (!response.ok) throw new Error(`Gagal membaca Auth lokal: ${await parseSafeError(response)}`);
    const body = await response.json();
    const pageUsers = Array.isArray(body) ? body : body.users || [];
    users.push(...pageUsers);
    if (pageUsers.length < 100) break;
  }
  return users;
};

const createMissingAuthUsers = async (specs) => {
  const existing = await listAuthUsers();
  const byId = new Map(existing.map((user) => [user.id, user]));
  let created = 0;
  let reused = 0;
  for (const spec of specs) {
    const found = byId.get(spec.id);
    if (found) {
      if (String(found.email || '').toLowerCase() !== String(spec.email || '').toLowerCase()) {
        throw new Error('Akun Auth lokal existing memiliki email yang tidak sesuai untuk ID migrasi.');
      }
      reused += 1;
      continue;
    }
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: spec.id,
        email: spec.email,
        password: randomLocalPassword(),
        email_confirm: true,
        user_metadata: { role: spec.role, display_name: spec.display_name },
        app_metadata: { role: spec.role, provider: 'email', providers: ['email'] },
      }),
    });
    if (!response.ok) throw new Error(`Gagal membuat akun Auth lokal: ${await parseSafeError(response)}`);
    const createdUser = await response.json();
    if (createdUser.id !== spec.id) throw new Error('Auth lokal mengembalikan UUID yang berbeda dari rencana migrasi.');
    created += 1;
  }
  return { created, reused };
};

const restHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
  'User-Agent': 'LPQ-Local-Migration-Rehearsal/1.0',
};

const cleanRow = (row) => {
  const result = { ...row };
  for (const field of ['created_at', 'updated_at']) {
    if (result[field] === null || result[field] === undefined) delete result[field];
  }
  return result;
};

const upsertRows = async (table, rows, batchSize = 100) => {
  if (!rows.length) return 0;
  let written = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize).map(cleanRow);
    const response = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?on_conflict=id`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(batch),
    });
    if (!response.ok) throw new Error(`Import ${table} gagal: ${await parseSafeError(response)}`);
    written += batch.length;
  }
  return written;
};

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

const main = async () => {
  assertLocalTarget();
  const prepared = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (prepared.format_version !== 1) throw new Error('Versi format migrasi tidak didukung.');
  if ((prepared.preflight?.unresolved_required_nomor_induk || 0) > 0) {
    throw new Error('Import ditolak: Nomor Induk wajib masih belum lengkap.');
  }
  if ((prepared.preflight?.unresolved_santri_login_identifiers || 0) > 0) {
    throw new Error('Import ditolak: identifier login santri masih belum lengkap.');
  }
  if ((prepared.preflight?.source_tables_at_page_boundary || []).length > 0) {
    throw new Error('Import ditolak: kelengkapan tabel sumber pada batas 1000 baris belum diverifikasi.');
  }

  const authResult = await createMissingAuthUsers(prepared.auth_user_specs || []);
  const tableResults = {};
  for (const table of tableOrder) {
    const rows = prepared.tables?.[table] || [];
    tableResults[table] = await upsertRows(table, rows);
  }

  console.log('Local migration import completed.');
  console.log(`Auth created: ${authResult.created}`);
  console.log(`Auth reused: ${authResult.reused}`);
  for (const table of tableOrder) console.log(`${table}: ${tableResults[table]}`);
};

main().catch((error) => {
  console.error(`Local migration import failed: ${error.message}`);
  process.exitCode = 1;
});
