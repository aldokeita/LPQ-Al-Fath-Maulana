import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHafalanItemRename } from '../src/lib/hafalanItemName.js';

const items = [
  { id: 'a', item_name: 'Doa Sebelum Makan' },
  { id: 'b', item_name: 'Doa Sesudah Makan' },
];

test('accepts a new trimmed name', () => {
  assert.deepEqual(
    validateHafalanItemRename({ item: items[0], nextName: '  Doa  Hendak Makan ', items }),
    { name: 'Doa Hendak Makan' }
  );
});

test('rejects an empty name', () => {
  assert.ok(validateHafalanItemRename({ item: items[0], nextName: '   ', items }).error);
});

test('rejects a duplicate name in the same category, case-insensitively', () => {
  assert.ok(validateHafalanItemRename({ item: items[0], nextName: 'doa sesudah makan', items }).error);
});

test('treats the same name as unchanged', () => {
  assert.equal(validateHafalanItemRename({ item: items[0], nextName: 'Doa Sebelum Makan', items }).unchanged, true);
});
