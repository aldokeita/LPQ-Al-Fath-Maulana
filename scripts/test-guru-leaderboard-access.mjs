import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [adapter, panel, guruDashboard, topScore, rls] = await Promise.all([
  readFile(new URL('../src/lib/leaderboardAdapters.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/guru/GuruLeaderboardPanel.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/GuruDashboard.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/TopScorePage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260624001600_rls_policies.sql', import.meta.url), 'utf8'),
]);

assert.match(adapter, /canReadLeaderboard\s*=\s*\(role\)\s*=>\s*\['admin', 'guru'\]/);
assert.match(adapter, /canManageLeaderboard\s*=\s*\(role\)\s*=>\s*role === 'admin'/);
assert.match(adapter, /\.order\('points',\s*\{ ascending: false, nullsFirst: false \}\)/);
assert.match(adapter, /\.order\('nama_lengkap',\s*\{ ascending: true \}\)/);
assert.doesNotMatch(adapter, /\.(insert|update|upsert|delete)\s*\(/);

assert.match(panel, /fetchLeaderboardPage\(\{ page: 1, pageSize: PREVIEW_PAGE_SIZE \}\)/);
assert.match(panel, /Mode baca saja/);
assert.match(panel, /role="alert"/);
assert.match(panel, /Belum ada santri yang dapat ditampilkan/);
assert.doesNotMatch(panel, /\.(insert|update|upsert|delete)\s*\(/);
assert.match(guruDashboard, /GuruLeaderboardPanel/);

assert.match(topScore, /canManageLeaderboard\(role\)/);
assert.match(topScore, /if \(!canScanAttendance\) return;/);
assert.match(topScore, /canScanAttendance &&/);
assert.match(topScore, /fetchLeaderboardPage/);
assert.match(topScore, /page:\s*currentPage/);

assert.match(rls, /create policy santri_admin_all[\s\S]*for all to authenticated[\s\S]*using \(public\.is_admin\(\)\)/i);
assert.match(rls, /create policy santri_select_scope[\s\S]*for select to authenticated[\s\S]*public\.guru_has_santri_access\(id\)/i);
const santriPolicySection = rls.slice(
  rls.indexOf('create policy santri_admin_all'),
  rls.indexOf('-- Classes and memberships.'),
);
assert.doesNotMatch(santriPolicySection, /for (?:insert|update|delete) to authenticated/i);

console.log('guru leaderboard read-only access checks passed');
