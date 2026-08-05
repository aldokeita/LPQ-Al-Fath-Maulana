import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const guruSource = await readFile(new URL('../src/components/dashboard/GuruDashboard.jsx', import.meta.url), 'utf8');
const adapterSource = await readFile(new URL('../src/lib/jilidChangeAdapters.js', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../supabase/migrations/20260805000100_change_santri_jilid_rpc.sql', import.meta.url), 'utf8');

assert.match(guruSource, /await changeSantriJilid\(/, 'Guru harus menunggu konfirmasi persistence dari adapter');
assert.doesNotMatch(
  guruSource,
  /from\(['"]santri['"]\)\.update\(\{\s*jilid:/,
  'Guru tidak boleh lagi melakukan update jilid langsung yang dapat menghasilkan sukses palsu',
);
assert.match(adapterSource, /supabase\.rpc\(['"]change_santri_jilid['"]/, 'Adapter harus menggunakan RPC atomik');
assert.match(adapterSource, /result\.to_jilid !== nextJilid/, 'Adapter harus memverifikasi row hasil mutation');

assert.match(migrationSource, /security definer/i);
assert.match(migrationSource, /public\.guru_has_santri_access\(p_santri_id\)/);
assert.match(migrationSource, /for update/i, 'RPC harus mengunci row santri selama perubahan');
assert.match(migrationSource, /update public\.santri[\s\S]*set jilid = v_to_jilid/i);
assert.match(migrationSource, /insert into public\.jilid_history/i);
assert.match(migrationSource, /grant execute on function public\.change_santri_jilid\(uuid, text, text\) to authenticated/i);

console.log('Guru jilid persistence contract tests passed.');
