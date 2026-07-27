import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [legacyPolicyMigration, jilidPolicyMigration, hardeningMigration] = await Promise.all([
  readFile(new URL('../supabase/migrations/20260725000100_pentashih_full_read_access_rls.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260725000200_jilid_history_pentashih_rls.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260727000100_harden_pentashih_role_check.sql', import.meta.url), 'utf8'),
]);

assert.match(legacyPolicyMigration, /using \(public\.is_pentashih_user\(\)\)/);
assert.match(jilidPolicyMigration, /using \(public\.is_pentashih_user\(\)\)/);
assert.match(hardeningMigration, /create or replace function public\.is_pentashih_user\(\)/);
assert.match(hardeningMigration, /select public\.is_pentashih\(\)/);
assert.doesNotMatch(hardeningMigration, /auth\.jwt|user_metadata|guru\s+g/);

console.log('pentashih role boundary checks passed');
