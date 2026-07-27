import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [classManagement, santriDetailModal] = await Promise.all([
  readFile(new URL('../src/components/dashboard/admin/ClassManagement.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/shared/SantriDetailModal.jsx', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(classManagement, /\.select\([^\n]*nama_wali/);
assert.doesNotMatch(santriDetailModal, /\.select\([^\n]*nama_wali/);
assert.match(classManagement, /nama_ibu, nama_ayah, kategori/);
assert.match(santriDetailModal, /nama_ibu, nama_ayah, no_hp_ortu/);

console.log('class management guardian query checks passed');
