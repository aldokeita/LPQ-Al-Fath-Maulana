import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, migration] = await Promise.all([
  readFile(new URL('../src/pages/RandomNamePage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260820000100_guru_global_random_name_access.sql', import.meta.url), 'utf8'),
]);
const legacyOverloadMigration = await readFile(
  new URL('../supabase/migrations/20260820000200_remove_legacy_numeric_points_rpc.sql', import.meta.url),
  'utf8',
);
const normalizedTypesMigration = await readFile(
  new URL('../supabase/migrations/20260820000300_normalize_global_points_rpc_types.sql', import.meta.url),
  'utf8',
);

assert.match(page, /const \{ data: santriData, error: santriError \} = await supabase\s*\.rpc\('list_random_name_santri'\)/);
assert.doesNotMatch(page, /\.from\('santri'\)\s*\.select\('id, nama_lengkap, foto_url, avatar_path, points, jilid, jenis_kelamin'\)/);

assert.match(migration, /create or replace function public\.list_random_name_santri\(\)/i);
assert.match(migration, /returns table\s*\([\s\S]*nama_lengkap text[\s\S]*points integer[\s\S]*jenis_kelamin text/i);
assert.match(migration, /v_role\s+public\.app_role/i);
assert.match(migration, /'admin'::public\.app_role[\s\S]*'guru'::public\.app_role/i);
assert.match(migration, /lower\(coalesce\(s\.status, ''\)\) in \('aktif', 'active'\)/i);
assert.match(migration, /lower\(coalesce\(s\.kategori, ''\)\) = 'anak'/i);
assert.match(migration, /grant execute on function public\.list_random_name_santri\(\) to authenticated/i);

const incrementFunction = migration.match(
  /create or replace function public\.increment_santri_points\([\s\S]*?grant execute on function public\.increment_santri_points\(uuid, integer\) to authenticated;/i,
)?.[0];
assert.ok(incrementFunction, 'global point adjustment function definition is present');
assert.match(incrementFunction, /public\.is_admin\(\)\s+or public\.is_guru\(\)/i);
assert.doesNotMatch(incrementFunction, /guru_has_santri_access/i);
assert.match(incrementFunction, /points = greatest\(0, points \+ p_amount\)/i);
assert.match(incrementFunction, /return v_points/i);
assert.match(incrementFunction, /grant execute[\s\S]*to authenticated/i);
assert.match(legacyOverloadMigration, /drop function if exists public\.increment_santri_points\(uuid, numeric\)/i);
assert.match(normalizedTypesMigration, /returns table\s*\([\s\S]*points numeric[\s\S]*jenis_kelamin text/i);
assert.match(normalizedTypesMigration, /p_amount numeric/i);
assert.match(normalizedTypesMigration, /p_amount <> trunc\(p_amount\)/i);
assert.match(normalizedTypesMigration, /returns numeric/i);
assert.match(normalizedTypesMigration, /public\.is_admin\(\)\s+or public\.is_guru\(\)/i);
assert.match(normalizedTypesMigration, /grant execute on function public\.increment_santri_points\(uuid, numeric\) to authenticated/i);

console.log('guru global random-name access checks passed');
