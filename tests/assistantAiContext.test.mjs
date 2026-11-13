import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildNameMasker, buildProfileContext, buildClassContext, buildChatMessages, parseClassInsight, buildRecommendationInput,
} = await import('../supabase/functions/_shared/aiContext.js');
const { generate, resolveProvider } = await import('../supabase/functions/_shared/aiProviders.js');

const ROSTER = [
  { santri_id: 'b', nama_lengkap: 'Muhammad Bilal Ramadhan', nama_panggilan: 'Bilal', usia: 8, poin: 12.5, karakter_rata: 3.1, kekuatan: ['Jujur'], perilaku_90_hari: 0 },
  { santri_id: 'a', nama_lengkap: 'Aisyah Putri', nama_panggilan: 'Aisyah', usia: 7, poin: 30, karakter_rata: 3.8, kekuatan: [], perilaku_90_hari: 1 },
  { santri_id: 'c', nama_lengkap: 'Muhammad Citra', nama_panggilan: null, usia: null, poin: 0, karakter_rata: null, kekuatan: [], perilaku_90_hari: 0 },
];

test('masker: kode urut nama, nama lengkap/panggilan/kata unik disamarkan, kata bersama jadi [nama]', () => {
  const m = buildNameMasker(ROSTER);
  assert.equal(m.codeOf('a'), 'S1');
  assert.equal(m.codeOf('b'), 'S2');
  assert.equal(m.codeOf('c'), 'S3');
  assert.equal(m.mask('Bagaimana Muhammad Bilal Ramadhan dan bilal? Lalu Citra, juga Muhammad.'),
    'Bagaimana S2 dan S2? Lalu S3, juga [nama].');
  assert.equal(m.mask('Aisyah kemarin'), 'S1 kemarin');
  assert.equal(m.mask('Bilalisme tetap'), 'Bilalisme tetap');
  assert.equal(m.unmask('S2 perlu didampingi, S1 diapresiasi, S3 juga.'), 'Bilal perlu didampingi, Aisyah diapresiasi, Citra juga.');
});

test('profil tersamar: hafalan per kategori, catatan bebas disamarkan, tanpa nama/id', () => {
  const m = buildNameMasker(ROSTER);
  const profile = {
    santri_id: 'b', nama_lengkap: 'Muhammad Bilal Ramadhan', nama_panggilan: 'Bilal', usia: 8, poin: 12.5,
    riwayat_jilid: [{ dari: 'Jilid 1A', ke: 'Jilid 2A', hari_lalu: 50 }],
    hafalan: [
      { kategori: 'Doa', materi: 'Doa makan', skor: 4, hari_sejak_dinilai: 3 },
      { kategori: 'Doa', materi: 'Doa tidur', skor: 2, hari_sejak_dinilai: 40 },
      { kategori: 'Surat', materi: 'An-Nas', skor: 3, hari_sejak_dinilai: 5 },
    ],
    karakter: [{ indikator: 'Mengucapkan salam', skor: 4 }],
    kekuatan: ['Jujur'],
    perilaku: [{ tingkat: 'Ringan', perilaku: 'Bilal bercanda dengan Aisyah', tindak_lanjut: 'Dinasihati', hari_lalu: 10 }],
    catatan_guru: [{ catatan: 'Ramadhan semangat', hari_lalu: 2 }],
  };
  const ctx = buildProfileContext(profile, m);
  const text = JSON.stringify(ctx);
  assert.equal(/Bilal|Aisyah|Ramadhan|"b"/.test(text), false);
  assert.deepEqual(ctx.hafalan_per_kategori.Doa, { skor_4: 1, skor_1_3: ['Doa tidur (skor 2)'], belum_dinilai_ulang_30_hari: 1 });
  assert.equal(ctx.perilaku_180_hari[0].perilaku, 'S2 bercanda dengan S1');
  assert.equal(ctx.catatan_guru[0].catatan, 'S2 semangat');
  const input = buildRecommendationInput([{ rule: 'jilid_lama', tingkat: 'sedang', detail: { days: 50, jilid: 'Jilid 2A', threshold: 30 } }], null, profile, m);
  assert.ok(input.profil.riwayat_jilid[0].includes('Jilid 2A'));
});

test('gambaran kelas memakai kode dan menandai perkara', () => {
  const m = buildNameMasker(ROSTER);
  const kelas = buildClassContext(ROSTER, [{ santri_id: 'b', jilid: 'Jilid 2A', jilid_hari: 50, jilid_batas: 30, hadir_4pekan: 10, sesi_4pekan: 16, hafalan: { lulus: 2, total: 8 } }],
    [{ santri_id: 'b', rule: 'jilid_lama', tingkat: 'tinggi' }], m);
  assert.equal(kelas.jumlah_santri, 3);
  assert.equal(kelas.jumlah_perlu_perhatian, 1);
  assert.deepEqual(kelas.santri.map((s) => s.kode), ['S1', 'S2', 'S3']);
  assert.deepEqual(kelas.santri[1].perlu_perhatian, ['lama di jilid (tinggi)']);
  assert.equal(kelas.santri[1].hadir_4_pekan, '10/16');
  assert.equal(/Bilal|Aisyah|Citra/.test(JSON.stringify(kelas)), false);
});

test('pesan chat: riwayat disamarkan, konteks di pesan pengguna pertama', () => {
  const m = buildNameMasker(ROSTER);
  const msgs = buildChatMessages(
    [{ role: 'user', content: 'Bagaimana Bilal?' }, { role: 'assistant', content: 'Bilal perlu latihan.' }],
    'Kalau Aisyah?', 'KONTEKS', m,
  );
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].content, 'KONTEKS\n\n---\nBagaimana S2?');
  assert.equal(msgs[1].content, 'S2 perlu latihan.');
  assert.equal(msgs[2].content, 'Kalau S1?');
  const fresh = buildChatMessages([], 'Saran umum?', 'K', m);
  assert.deepEqual(fresh, [{ role: 'user', content: 'K\n\n---\nSaran umum?' }]);
});

test('parseClassInsight menyaring kode tak dikenal dan membatasi isi', () => {
  const text = JSON.stringify({
    ringkasan: 'Kelas baik.',
    sorotan: [{ kode: 's1', jenis: 'apresiasi', catatan: 'Rajin' }, { kode: 'S9', jenis: 'perhatian', catatan: 'x' }, { kode: 'S2', jenis: 'aneh', catatan: 'Dampingi' }],
    saran_umum: [{ judul: 'Muroja\'ah bersama', alasan: 'banyak skor 2' }],
    fokus_pekan_ini: 'Doa harian',
  });
  const r = parseClassInsight(text, ['S1', 'S2']);
  assert.deepEqual(r.sorotan.map((s) => `${s.kode}:${s.jenis}`), ['S1:apresiasi', 'S2:perhatian']);
  assert.throws(() => parseClassInsight('{"ringkasan":"x","saran_umum":[]}'), /AI_INVALID_JSON/);
});

test('penyedia: percakapan multi-giliran tanpa mode JSON', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ choices: [{ message: { content: 'Jawab' } }] }) }; };
  const messages = [{ role: 'user', content: 'Q1' }, { role: 'assistant', content: 'A1' }, { role: 'user', content: 'Q2' }];
  await generate(resolveProvider({ provider: 'deepseek' }, () => 'k'), { system: 'S', messages, json: false }, { fetchImpl });
  assert.deepEqual(calls[0].messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
  assert.equal(calls[0].response_format, undefined);

  const gem = [];
  await generate(resolveProvider({ provider: 'gemini', model: 'g' }, () => 'k'), { system: 'S', messages, json: false }, {
    fetchImpl: async (url, init) => { gem.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ candidates: [] }) }; },
  });
  assert.deepEqual(gem[0].contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(gem[0].generationConfig, undefined);

  const mock = await generate(resolveProvider({ provider: 'mock' }), { system: 'S', messages: [{ role: 'user', content: 'Bagaimana S3?' }], json: false });
  assert.match(mock.text, /S3/);
  const mockClass = await generate(resolveProvider({ provider: 'mock' }), { kind: 'kelas', system: 'S', user: '{"kode":"S1"},{"kode":"S2"}' });
  assert.equal(parseClassInsight(mockClass.text, ['S1', 'S2']).sorotan.length, 2);
});

test('prompt melarang AI membahas kode kepada guru', async () => {
  const { CHAT_SYSTEM_PROMPT, CLASS_SYSTEM_PROMPT } = await import('../supabase/functions/_shared/aiContext.js');
  for (const p of [CHAT_SYSTEM_PROMPT, CLASS_SYSTEM_PROMPT]) assert.match(p, /Jangan pernah menjelaskan, menyebut kata "kode"/);
});
