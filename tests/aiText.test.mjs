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

const { appendTranscript, getSpeechRecognition, SPEECH_LANG } = await import('../src/lib/speechInput.js');

test('hasil dikte digabung dengan spasi dan huruf kapital di awal kalimat', () => {
  assert.equal(SPEECH_LANG, 'id-ID');
  assert.equal(appendTranscript('', ' hafalan bilal  sudah lancar '), 'Hafalan bilal sudah lancar');
  assert.equal(appendTranscript('Hafalan Bilal', 'sudah lancar'), 'Hafalan Bilal sudah lancar');
  assert.equal(appendTranscript('Sudah lancar.', 'apa langkah berikutnya'), 'Sudah lancar. Apa langkah berikutnya');
  assert.equal(appendTranscript('Baris satu\n', 'baris dua'), 'Baris satu\nBaris dua');
  assert.equal(appendTranscript('Tetap', '   '), 'Tetap');
});

test('pengenal suara hanya dipakai bila browser mendukung dan konteks aman', () => {
  function Rec() {}
  assert.equal(getSpeechRecognition({ webkitSpeechRecognition: Rec, isSecureContext: true }), Rec);
  assert.equal(getSpeechRecognition({ SpeechRecognition: Rec, isSecureContext: false }), null);
  assert.equal(getSpeechRecognition({ isSecureContext: true }), null);
});
