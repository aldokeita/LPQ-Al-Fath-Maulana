import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const guruSource = await readFile(new URL('../src/components/dashboard/GuruDashboard.jsx', import.meta.url), 'utf8');
const classManagementSource = await readFile(new URL('../src/components/dashboard/admin/ClassManagement.jsx', import.meta.url), 'utf8');
const adultClassManagementSource = await readFile(new URL('../src/components/dashboard/admin/AdultClassManagement.jsx', import.meta.url), 'utf8');
const adapterSource = await readFile(new URL('../src/lib/jilidChangeAdapters.js', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../supabase/migrations/20260810000200_change_santri_jilid_v2.sql', import.meta.url), 'utf8');

assert.match(guruSource, /await changeSantriJilid\(/, 'Guru harus menunggu konfirmasi persistence dari adapter');
assert.match(classManagementSource, /await changeSantriJilid\(/, 'Admin TPQ harus memakai adapter jilid v2');
assert.match(adultClassManagementSource, /await changeSantriJilid\(/, 'Admin dewasa harus memakai adapter jilid v2');
assert.doesNotMatch(
  guruSource,
  /from\(['"]santri['"]\)\.update\(\{\s*jilid:/,
  'Guru tidak boleh lagi melakukan update jilid langsung yang dapat menghasilkan sukses palsu',
);
assert.doesNotMatch(classManagementSource, /supabase\.rpc\(['"]change_santri_jilid['"]/, 'Admin TPQ tidak boleh memanggil RPC legacy langsung');
assert.doesNotMatch(adultClassManagementSource, /supabase\.rpc\(['"]change_santri_jilid['"]/, 'Admin dewasa tidak boleh memanggil RPC legacy langsung');
assert.match(adapterSource, /supabase\.rpc\(['"]change_santri_jilid_v2['"]/, 'Adapter harus menggunakan RPC v2 atomik');
assert.match(adapterSource, /result\.to_jilid !== nextJilid/, 'Adapter harus memverifikasi row hasil mutation');

assert.match(migrationSource, /security definer/i);
assert.match(migrationSource, /public\.guru_has_santri_access\(p_santri_id\)/);
assert.match(migrationSource, /for update/i, 'RPC harus mengunci row santri selama perubahan');
assert.match(migrationSource, /change_santri_jilid_v2/i, 'Migration harus menggunakan nama RPC versi baru');
assert.match(migrationSource, /returns table/i, 'RPC v2 harus mengembalikan detail perubahan');
assert.match(migrationSource, /40001/, 'RPC harus menolak perubahan berdasarkan data jilid yang sudah kedaluwarsa');
assert.match(migrationSource, /update public\.santri[\s\S]*set jilid = v_to_jilid/i);
assert.match(migrationSource, /insert into public\.jilid_history/i);
assert.match(migrationSource, /grant execute on function public\.change_santri_jilid_v2\(uuid, text, text\) to authenticated/i);

console.log('Guru jilid persistence contract tests passed.');
