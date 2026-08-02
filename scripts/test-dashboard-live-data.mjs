import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  academicAdapters,
  guruDashboard,
  santriDashboard,
  publicAdapters,
  homePage,
  heroSection,
  classmatesMigration,
  homepageStatsMigration,
] = await Promise.all([
  read('../src/lib/academicAdapters.js'),
  read('../src/components/dashboard/GuruDashboard.jsx'),
  read('../src/components/dashboard/SantriDashboard.jsx'),
  read('../src/lib/publicContentAdapters.js'),
  read('../src/pages/HomePage.jsx'),
  read('../src/components/public/home/HeroSection.jsx'),
  read('../supabase/migrations/20260803000100_santri_classmates_today.sql'),
  read('../supabase/migrations/20260803000200_public_homepage_stats.sql'),
]);

assert.match(
  academicAdapters,
  /santri:santri_id\([^)]*\bpoints\b[^)]*\)/,
  'Teacher class query must fetch persisted santri points.',
);
assert.match(guruDashboard, /<th[^>]*>Poin<\/th>/);
assert.match(guruDashboard, /Number\(santri\.points \|\| 0\)\.toLocaleString\('id-ID'\)/);

assert.match(academicAdapters, /export const fetchMyClassmatesToday = async/);
assert.match(academicAdapters, /supabase\.rpc\('get_my_classmates_today'/);
assert.match(santriDashboard, /fetchMyClassmatesToday/);
assert.match(santriDashboard, /friend\.attendance_status/);
assert.doesNotMatch(
  santriDashboard,
  /from\('class_memberships'\)[\s\S]{0,500}from\('attendance'\)/,
  'Santri dashboard must not assemble peer data with direct table reads.',
);

assert.match(classmatesMigration, /create or replace function public\.get_my_classmates_today\(\)/i);
assert.match(classmatesMigration, /security definer/i);
assert.match(classmatesMigration, /auth\.uid\(\)/i);
assert.match(classmatesMigration, /cm_self\.santri_id = auth\.uid\(\)/i);
assert.match(classmatesMigration, /cm_peer\.class_id = mc\.class_id/i);
assert.match(classmatesMigration, /cm_peer\.santri_id <> auth\.uid\(\)/i);
assert.match(classmatesMigration, /s\.status = 'Aktif'/i);
assert.match(classmatesMigration, /attendance_row\.attendance_date = \(now\(\) at time zone 'Asia\/Jakarta'\)::date/i);
assert.match(classmatesMigration, /grant execute[\s\S]*to authenticated/i);
assert.match(classmatesMigration, /revoke all[\s\S]*from anon/i);

assert.match(publicAdapters, /export const fetchPublicHomepageStats = async/);
assert.match(publicAdapters, /supabase\.rpc\('get_public_homepage_stats'/);
assert.match(homePage, /fetchPublicHomepageStats/);
assert.match(heroSection, /stats\.sessions/);
assert.doesNotMatch(homePage, /from\('santri'\).*count: 'exact'/);
assert.doesNotMatch(homePage, /from\('guru'\).*count: 'exact'/);

assert.match(homepageStatsMigration, /create or replace function public\.get_public_homepage_stats\(\)/i);
assert.match(homepageStatsMigration, /count\(\*\)[\s\S]*from public\.santri[\s\S]*status = 'Aktif'/i);
assert.match(homepageStatsMigration, /count\(\*\)[\s\S]*from public\.guru[\s\S]*status = 'active'/i);
assert.match(homepageStatsMigration, /count\(distinct[\s\S]*sesi[\s\S]*from public\.classes/i);
assert.match(homepageStatsMigration, /grant execute[\s\S]*to anon, authenticated/i);

console.log('dashboard live-data regression checks passed');
