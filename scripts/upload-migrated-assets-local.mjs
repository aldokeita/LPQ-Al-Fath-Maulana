import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const privateRoot = path.join(root, '_private_reference');
const assetsRoot = path.join(privateRoot, 'migration-work', 'assets');
const readyRoot = path.join(assetsRoot, 'ready');
const resultPath = path.join(assetsRoot, 'asset-download-result.json');
const preparedPath = path.join(privateRoot, 'migration-work', 'prepared-production-data', 'prepared-data.json');
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:55321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const assertLocalTarget = () => {
  const target = new URL(supabaseUrl);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(target.hostname) || target.port !== '55321') {
    throw new Error('Asset uploader menolak target non-local.');
  }
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY lokal tidak tersedia.');
};

const keyHeaders = () => {
  const headers = { apikey: serviceRoleKey, 'User-Agent': 'LPQ-Local-Asset-Migration/1.0' };
  if (!serviceRoleKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${serviceRoleKey}`;
  return headers;
};

const safeError = async (response) => {
  const text = await response.text();
  if (!text) return `HTTP ${response.status}`;
  try {
    const body = JSON.parse(text);
    return [body.statusCode, body.error, body.message].filter(Boolean).join(' | ') || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
};

const encodeObjectPath = (objectPath) => objectPath.split('/').map(encodeURIComponent).join('/');

const uploadEntry = async (entry) => {
  const file = path.resolve(readyRoot, entry.target_bucket, ...entry.target_path.split('/'));
  const relative = path.relative(readyRoot, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe asset path.');
  const bytes = fs.readFileSync(file);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(entry.target_bucket)}/${encodeObjectPath(entry.target_path)}`, {
    method: 'POST',
    headers: {
      ...keyHeaders(),
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!response.ok) throw new Error(`Storage upload failed: ${await safeError(response)}`);
  return entry;
};

const setJsonPath = (rootValue, pathParts, value) => {
  if (!pathParts.length) return value;
  let current = rootValue;
  for (let index = 0; index < pathParts.length - 1; index += 1) current = current[pathParts[index]];
  current[pathParts[pathParts.length - 1]] = value;
  return rootValue;
};

const rewriteWebsiteContent = async (entries) => {
  const prepared = JSON.parse(fs.readFileSync(preparedPath, 'utf8'));
  const rows = prepared.tables.website_content || [];
  const byId = new Map(rows.map((row) => [row.id, structuredClone(row)]));
  for (const entry of entries.filter((item) => item.kind === 'website_content')) {
    const row = byId.get(entry.record_id);
    if (!row) throw new Error('Website content row for migrated asset was not found.');
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/website-assets/${encodeObjectPath(entry.target_path)}`;
    row.content = setJsonPath(row.content, entry.json_path, publicUrl);
  }
  const changedRows = [...new Set(entries.filter((item) => item.kind === 'website_content').map((item) => item.record_id))]
    .map((id) => byId.get(id));
  const headers = {
    ...keyHeaders(),
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  const response = await fetch(`${supabaseUrl}/rest/v1/website_content?on_conflict=id`, {
    method: 'POST',
    headers,
    body: JSON.stringify(changedRows),
  });
  if (!response.ok) throw new Error(`Website content rewrite failed: ${await safeError(response)}`);
  return changedRows.length;
};

const verifyPublicWebsiteAssets = async (entries) => {
  let verified = 0;
  for (const entry of entries.filter((item) => item.kind === 'website_content')) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/public/website-assets/${encodeObjectPath(entry.target_path)}`);
    if (!response.ok) throw new Error(`Public website asset verification failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.output_sha256) {
      throw new Error('Public website asset checksum mismatch.');
    }
    verified += 1;
  }
  return verified;
};

const verifyAvatarsRemainPrivate = async (entries) => {
  const avatar = entries.find((entry) => entry.target_bucket === 'avatars');
  if (!avatar) return true;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/public/avatars/${encodeObjectPath(avatar.target_path)}`);
  return !response.ok;
};

const runWithConcurrency = async (entries, limit = 8) => {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, entries.length) }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor];
      cursor += 1;
      await uploadEntry(entry);
    }
  });
  await Promise.all(workers);
};

const main = async () => {
  assertLocalTarget();
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  if (result.failed !== 0) throw new Error('Asset download result still contains failures.');
  const entries = result.results.filter((entry) => entry.status === 'ready');
  await runWithConcurrency(entries);
  const rewrittenRows = await rewriteWebsiteContent(entries);
  const publicVerified = await verifyPublicWebsiteAssets(entries);
  const avatarsRemainPrivate = await verifyAvatarsRemainPrivate(entries);
  if (!avatarsRemainPrivate) throw new Error('Private avatar unexpectedly accessible through public Storage endpoint.');
  console.log('Local asset migration completed.');
  console.log(`Objects uploaded: ${entries.length}`);
  console.log(`Website content rows rewritten: ${rewrittenRows}`);
  console.log(`Public website assets verified: ${publicVerified}`);
  console.log('Private avatar public access denied: yes');
};

main().catch((error) => {
  console.error(`Local asset migration failed: ${error.message}`);
  process.exitCode = 1;
});
