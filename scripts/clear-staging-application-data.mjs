import process from 'node:process';

const projectRef = process.env.LPQ_STAGING_PROJECT_REF || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const execute = process.env.STAGING_CLEANUP_EXECUTE === 'true';
const confirmation = process.env.STAGING_CLEANUP_CONFIRMATION || '';

const tablePlan = [
  ['login_logs', 'id'],
  ['notifications', 'id'],
  ['feedbacks', 'id'],
  ['media_player_settings', 'id'],
  ['music_files', 'id'],
  ['santri_behavior_records', 'id'],
  ['santri_character_strengths', 'santri_id'],
  ['santri_character_scores', 'id'],
  ['santri_notes', 'id'],
  ['murojaah_submissions', 'id'],
  ['hafalan_progress', 'id'],
  ['jilid_history', 'id'],
  ['attendance', 'id'],
  ['payments', 'id'],
  ['expenses', 'id'],
  ['mmq_notulensi', 'id'],
  ['mmq_attendance', 'id'],
  ['pentashih_class_assignments', 'id'],
  ['class_mutations', 'id'],
  ['class_memberships', 'id'],
  ['news', 'id'],
  ['announcements', 'id'],
  ['website_content', 'id'],
  ['academic_calendar', 'id'],
  ['auth_login_aliases', 'id'],
  ['auth_rate_limits', 'id'],
  ['santri', 'id'],
  ['classes', 'id'],
  ['mmq_schedule', 'id'],
  ['guru', 'id'],
  ['user_profiles', 'id'],
];

const storageBuckets = ['avatars', 'website-assets', 'murojaah-recordings', 'music-files'];

const assertTarget = () => {
  if (!/^[a-z0-9]{15,32}$/.test(projectRef)) {
    throw new Error('Project Ref staging baru wajib diisi.');
  }
  const target = new URL(supabaseUrl);
  if (target.protocol !== 'https:' || target.hostname !== `${projectRef}.supabase.co`) {
    throw new Error('Cleanup menolak target selain staging LPQ yang disetujui.');
  }
  if (!secretKey) throw new Error('Secret/service-role key staging tidak tersedia.');
  if (secretKey.startsWith('sbp_') || secretKey.startsWith('sb_publishable_')) {
    throw new Error('Jenis key tidak diizinkan untuk cleanup backend.');
  }
  const isSecret = secretKey.startsWith('sb_secret_');
  const isLegacyJwt = /^eyJ[^.]+\.[^.]+\.[^.]+$/.test(secretKey);
  if (!isSecret && !isLegacyJwt) throw new Error('Format secret/service-role key tidak dikenali.');
  if (execute && confirmation !== `DELETE-DUMMY-${projectRef}`) {
    throw new Error('Konfirmasi cleanup staging tidak cocok.');
  }
};

const headers = () => {
  const value = {
    apikey: secretKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'LPQ-Staging-Cleanup/1.0',
  };
  if (!secretKey.startsWith('sb_secret_')) value.Authorization = `Bearer ${secretKey}`;
  return value;
};

const safeError = async (response, step) => {
  let message = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    message = [body.code, body.message, body.details, body.hint].filter(Boolean).join(' | ') || message;
  } catch {
    // Keep the status-only diagnostic.
  }
  throw new Error(`${step} failed: ${message}`);
};

const tableCount = async (table, key) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${key}&limit=0`, {
    method: 'HEAD',
    headers: { ...headers(), Prefer: 'count=exact' },
  });
  if (!response.ok) await safeError(response, `count ${table}`);
  const contentRange = response.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const deleteAllRows = async (table, key) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${key}=not.is.null`, {
    method: 'DELETE',
    headers: { ...headers(), Prefer: 'return=minimal' },
  });
  if (!response.ok) await safeError(response, `delete ${table}`);
};

const deleteBootstrapHafalanItem = async () => {
  const response = await fetch(`${supabaseUrl}/rest/v1/hafalan_items?id=eq.b2fa7a20-0000-0000-0000-000000000104`, {
    method: 'DELETE',
    headers: { ...headers(), Prefer: 'return=minimal' },
  });
  if (!response.ok) await safeError(response, 'delete bootstrap hafalan item');
};

const listAuthUsers = async () => {
  const users = [];
  let page = 1;
  while (true) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=100`, { headers: headers() });
    if (!response.ok) await safeError(response, 'list Auth users');
    const body = await response.json();
    const batch = Array.isArray(body) ? body : (body.users || []);
    users.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return users;
};

const deleteAuthUsers = async () => {
  let deleted = 0;
  while (true) {
    const users = await listAuthUsers();
    if (!users.length) break;
    for (const user of users) {
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!response.ok) await safeError(response, 'delete Auth user');
      deleted += 1;
    }
  }
  return deleted;
};

const listStorageFolder = async (bucket, prefix = '') => {
  const paths = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        prefix,
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!response.ok) await safeError(response, `list Storage bucket ${bucket}`);

    const entries = await response.json();
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        paths.push(path);
      } else {
        paths.push(...await listStorageFolder(bucket, path));
      }
    }

    if (entries.length < limit) break;
    offset += limit;
  }

  return paths;
};

const deleteStorageObjects = async (bucket, paths) => {
  for (let index = 0; index < paths.length; index += 100) {
    const prefixes = paths.slice(index, index + 100);
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ prefixes }),
    });
    if (!response.ok) await safeError(response, `delete Storage objects from ${bucket}`);
  }
};

const main = async () => {
  assertTarget();
  const before = {};
  for (const [table, key] of tablePlan) before[table] = await tableCount(table, key);
  const authBefore = (await listAuthUsers()).length;
  const storageBefore = {};
  for (const bucket of storageBuckets) storageBefore[bucket] = await listStorageFolder(bucket);

  console.log('Staging cleanup inventory (aggregate only):');
  for (const [table] of tablePlan) console.log(`${table}: ${before[table]}`);
  console.log(`auth_users: ${authBefore}`);
  for (const bucket of storageBuckets) console.log(`storage_${bucket}: ${storageBefore[bucket].length}`);

  if (!execute) {
    console.log('DRY RUN ONLY: no remote data changed.');
    return;
  }

  for (const [table, key] of tablePlan) await deleteAllRows(table, key);
  await deleteBootstrapHafalanItem();
  const authDeleted = await deleteAuthUsers();
  for (const bucket of storageBuckets) await deleteStorageObjects(bucket, storageBefore[bucket]);

  const failures = [];
  for (const [table, key] of tablePlan) {
    const count = await tableCount(table, key);
    if (count !== 0) failures.push(`${table}=${count}`);
  }
  const authRemaining = (await listAuthUsers()).length;
  if (authRemaining !== 0) failures.push(`auth_users=${authRemaining}`);
  for (const bucket of storageBuckets) {
    const paths = await listStorageFolder(bucket);
    if (paths.length !== 0) failures.push(`storage_${bucket}=${paths.length}`);
  }
  if (failures.length) throw new Error(`Cleanup verification failed: ${failures.join(', ')}`);

  console.log(`Staging application cleanup complete. Auth users deleted: ${authDeleted}`);
};

main().catch((error) => {
  console.error(`Staging cleanup failed: ${error.message}`);
  process.exitCode = 1;
});
