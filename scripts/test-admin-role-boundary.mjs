import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getOperationalRoleFromGuruForm, pickGuruProfileFields } from '../src/lib/dataMasterAdapters.js';

const guruInput = { nama: 'Guru Uji', roles: ['Pengajar', 'Admin'] };
assert.equal(getOperationalRoleFromGuruForm(guruInput), 'guru');
assert.deepEqual(pickGuruProfileFields(guruInput, 'guru').roles, ['Pengajar']);

const pentashihInput = { nama: 'Pentashih Uji', roles: ['Admin', 'Pentashih'] };
assert.deepEqual(pickGuruProfileFields(pentashihInput, 'pentashih').roles, ['Pentashih']);

const [management, edgeFunction, migration, migrationBuilder] = await Promise.all([
  readFile(new URL('../src/components/dashboard/admin/GuruManagement.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/manage-user/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260722000100_restrict_admin_to_official_email.sql', import.meta.url), 'utf8'),
  readFile(new URL('./prepare-production-migration.mjs', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(management, /AVAILABLE_ROLES\s*=\s*\[[^\]]*['"]Admin['"]/);
assert.match(management, /action:\s*['"]update['"]/);
assert.match(edgeFunction, /OFFICIAL_ADMIN_EMAIL\s*=\s*['"]admin@lpqalfathmaulana\.id['"]/);
assert.match(edgeFunction, /AUTH_ROLE_UPDATE_FAILED/);
assert.match(edgeFunction, /PROFILE_ROLE_UPDATE_FAILED/);
assert.match(migration, /user_profiles_admin_email_check/);
assert.match(migration, /user_profiles_single_admin_idx/);
assert.match(migration, /join auth\.users au on au\.id = up\.id/);
assert.doesNotMatch(migrationBuilder, /roles\.includes\(['"]admin['"]\)\) return ['"]admin['"]/);

console.log('admin role boundary checks passed');
