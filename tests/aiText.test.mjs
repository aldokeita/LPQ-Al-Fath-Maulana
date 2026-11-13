import test from 'node:test';
import assert from 'node:assert/strict';

const { parseAiInline, cleanAiLine } = await import('../src/lib/aiText.js');

test('teks tebal markdown menjadi segmen tebal tanpa tanda bintang', () => {
  assert.deepEqual(parseAiInline('1. **Mulai dari yang aman.** Ajak *pelan* dengan `lembut`.'), [
    { bold: false, text: '1. ' },
    { bold: true, text: 'Mulai dari yang aman.' },
    { bold: false, text: ' Ajak pelan dengan lembut.' },
  ]);
  assert.deepEqual(parseAiInline('5 * 3 = 15'), [{ bold: false, text: '5 * 3 = 15' }]);
  assert.equal(cleanAiLine('### Judul'), 'Judul');
  assert.equal(cleanAiLine('* butir'), '• butir');
});
