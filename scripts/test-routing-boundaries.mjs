import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, notFoundPage] = await Promise.all([
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/NotFoundPage.jsx', import.meta.url), 'utf8'),
]);

assert.match(app, /import NotFoundPage from ['"]@\/pages\/NotFoundPage['"]/);
assert.match(app, /<Route path="\*" element=\{<NotFoundPage \/>\} \/>/);
assert.match(app, /const DashboardPage = lazy\(\(\) => import\(['"]@\/pages\/DashboardPage['"]\)\)/);
assert.match(app, /<Suspense fallback=\{<RouteLoadingPage \/>\}>/);
assert.match(notFoundPage, /Halaman tidak ditemukan/);
assert.match(notFoundPage, /<Link to="\/">/);

console.log('routing boundary checks passed');
