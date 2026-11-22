import test from 'node:test';
import assert from 'node:assert/strict';
import { moveHafalanItem } from '../src/lib/hafalanItemOrder.js';

const levels = ['1', '2'];
const items = [
  { id: 'a', jilid: '1', item_order: 1, item_name: 'A' },
  { id: 'b', jilid: '1', item_order: 2, item_name: 'B' },
  { id: 'c', jilid: '1', item_order: 3, item_name: 'C' },
  { id: 'd', jilid: '2', item_order: 4, item_name: 'D' },
];
const names = (list, jilid) => list.filter((i) => i.jilid === jilid).map((i) => i.id).join('');

test('reorders inside one column and only updates moved rows', () => {
  const result = moveHafalanItem({ items, levels, draggedId: 'c', targetJilid: '1', targetId: 'a', position: 'before' });
  assert.equal(names(result.items, '1'), 'cab');
  assert.deepEqual(result.updates, [
    { id: 'c', item_order: 1 },
    { id: 'a', item_order: 2 },
    { id: 'b', item_order: 3 },
  ]);
});

test('drops after a target item', () => {
  const result = moveHafalanItem({ items, levels, draggedId: 'a', targetJilid: '1', targetId: 'b', position: 'after' });
  assert.equal(names(result.items, '1'), 'bac');
});

test('moves to another column at a position and sets the jilid', () => {
  const result = moveHafalanItem({ items, levels, draggedId: 'b', targetJilid: '2', targetId: 'd', position: 'before' });
  assert.equal(names(result.items, '1'), 'ac');
  assert.equal(names(result.items, '2'), 'bd');
  assert.deepEqual(result.updates.find((u) => u.id === 'b'), { id: 'b', item_order: 3, jilid: '2' });
});

test('dropping on a column without a target appends to its end', () => {
  const result = moveHafalanItem({ items, levels, draggedId: 'a', targetJilid: '2' });
  assert.equal(names(result.items, '2'), 'da');
});

test('dropping an item on itself changes nothing', () => {
  const result = moveHafalanItem({ items, levels, draggedId: 'a', targetJilid: '1', targetId: 'a' });
  assert.deepEqual(result.updates, []);
});

test('items without a jilid stay in the first column', () => {
  const legacy = [{ id: 'x', jilid: '', item_order: 1 }, { id: 'y', jilid: '1', item_order: 2 }];
  const result = moveHafalanItem({ items: legacy, levels, draggedId: 'y', targetJilid: '1', targetId: 'x' });
  assert.deepEqual(result.items.map((i) => i.id), ['y', 'x']);
  assert.equal(result.updates.some((u) => 'jilid' in u && u.id === 'x'), false);
});
