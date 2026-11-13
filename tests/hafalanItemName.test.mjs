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

import { formatHafalanItemName, toHafalanTitleCase } from '../src/lib/hafalanItemName.js';

test('title-cases Doa and Sholat names and spells Doa as Do\'a', () => {
  const cases = {
    'Doa sebelum makan': "Do'a Sebelum Makan",
    'Doa memohon ampun untuk kedua orang tua': "Do'a Memohon Ampun untuk Kedua Orang Tua",
    'Istighfar / doa memohon ampun': "Istighfar / Do'a Memohon Ampun",
    'Doa masuk kamar kecil / WC': "Do'a Masuk Kamar Kecil / WC",
    'Ucapan ketika berjanji: Insyaallah': 'Ucapan Ketika Berjanji: Insyaallah',
    'Bacaan i‘tidal': 'Bacaan I‘tidal',
    'Bacaan Al-Fatihah': 'Bacaan Al-Fatihah',
    'Ta’awwudz / Isti’adzah': 'Ta’awwudz / Isti’adzah',
    'Doa ketika mengalami, melihat, atau mendengar musibah': "Do'a Ketika Mengalami, Melihat, atau Mendengar Musibah",
    "Do'a qunut": "Do'a Qunut",
    'doa agar tetap istiqamah dalam agama dan kebenaran': "Do'a agar Tetap Istiqamah dalam Agama dan Kebenaran",
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(toHafalanTitleCase(input), expected, input);
  }
});

test('does not touch words that only contain "doa" inside them', () => {
  assert.equal(toHafalanTitleCase('mendoakan orang tua'), 'Mendoakan Orang Tua');
});

test('only TPQ Doa and Sholat are formatted; Surat keeps its casing', () => {
  assert.equal(formatHafalanItemName('doa iftitah', { category: 'Sholat' }), "Do'a Iftitah");
  assert.equal(formatHafalanItemName('Al-‘Ashr', { category: 'Surat' }), 'Al-‘Ashr');
  assert.equal(formatHafalanItemName('doa harian', { category: 'Doa', programScope: 'PTPT' }), 'doa harian');
});
