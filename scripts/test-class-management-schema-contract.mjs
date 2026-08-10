import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'src/components/dashboard/admin/ClassManagement.jsx',
  'src/components/dashboard/shared/SantriDetailModal.jsx',
];

for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const santriSelects = [...source.matchAll(/\.from\(['"]santri['"]\)[\s\S]{0,160}?\.select\(['"]([^'"]+)['"]\)/g)]
    .map((match) => match[1]);

  assert.ok(santriSelects.length > 0, `${file} harus memiliki query santri eksplisit`);
  santriSelects.forEach((columns) => {
    assert.doesNotMatch(columns, /(?:^|,\s*)nama_wali(?:\s*,|$)/, `${file} meminta kolom santri.nama_wali yang tidak tersedia`);
  });
}

console.log('Class management schema contract tests passed.');
