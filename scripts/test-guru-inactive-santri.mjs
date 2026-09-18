import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isActiveSantriRecord } from '../src/lib/santriStatus.js';

const adapterSource = await readFile(new URL('../src/lib/academicAdapters.js', import.meta.url), 'utf8');

assert.equal(isActiveSantriRecord({ id: 'active-1', status: 'Aktif', deleted_at: null }), true);
assert.equal(isActiveSantriRecord({ id: 'active-2', status: 'active', deleted_at: null }), true);
assert.equal(isActiveSantriRecord({ id: 'active-3', status: null, deleted_at: null }), true);
assert.equal(isActiveSantriRecord({ id: 'inactive-1', status: 'Nonaktif', deleted_at: null }), false);
assert.equal(isActiveSantriRecord({ id: 'inactive-2', status: 'Aktif', deleted_at: '2026-09-18T00:00:00Z' }), false);
assert.equal(isActiveSantriRecord({ id: null, status: 'Aktif', deleted_at: null }), false);

assert.match(adapterSource, /deleted_at/);
assert.match(adapterSource, /isActiveSantriRecord/);
assert.match(adapterSource, /\.filter\(isActiveSantriRecord\)/);

console.log('guru inactive santri checks passed');
