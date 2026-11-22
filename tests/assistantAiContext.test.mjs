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
  assert.deepEqual(ctx.hafalan_per_kategori.Doa, { sudah_hafal_skor_4: ['Doa makan'], masih_dilatih: ['Doa tidur (skor 2)'], belum_dinilai_ulang_30_hari: 1 });
  assert.equal(ctx.hafalan_wajib_jilid_ini, null);
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

const {
  selectKnowledge, withKnowledge, parseReport, REPORT_SECTIONS, formatWeeklyDigest,
} = await import('../supabase/functions/_shared/aiContext.js');

test('selectKnowledge memilih materi paling relevan dan menghormati batas karakter', () => {
  const entries = [
    { judul: 'Adab di kelas', kategori: 'Adab', isi: 'Salam, duduk rapi, dan mendengarkan guru.' },
    { judul: 'Target Jilid 3', kategori: 'Jilid', isi: 'Jilid 3 menekankan mad thobi\'i dan bacaan panjang.' },
    { judul: 'Hafalan doa harian', kategori: 'Hafalan', isi: 'Doa makan, doa tidur, doa masuk masjid.' },
  ];
  const picked = selectKnowledge(entries, 'Bagaimana target jilid 3?');
  assert.ok(picked.startsWith('### Target Jilid 3'));
  assert.ok(picked.includes('Adab di kelas'));
  const small = selectKnowledge(entries, 'hafalan doa', 80);
  assert.ok(small.includes('Hafalan doa harian'));
  assert.ok(small.length <= 80);
  assert.equal(selectKnowledge([], 'apa saja'), '');
});

test('withKnowledge menambahkan pustaka hanya bila ada', () => {
  assert.ok(withKnowledge('Profil LPQ', '### A\nisi', 'Tugas').includes('Pustaka materi lembaga'));
  assert.ok(!withKnowledge('Profil LPQ', '', 'Tugas').includes('Pustaka materi'));
});

test('parseReport mewajibkan bagian inti dan memotong teks panjang', () => {
  const full = Object.fromEntries(REPORT_SECTIONS.map((k) => [k, `Isi ${k} {nama}`]));
  full.hafalan = 'x'.repeat(900);
  const parsed = parseReport(JSON.stringify(full));
  assert.equal(parsed.pembuka, 'Isi pembuka {nama}');
  assert.ok(parsed.hafalan.length <= 500);
  assert.throws(() => parseReport(JSON.stringify({ pembuka: 'a' })), /AI_INVALID_JSON/);
});

test('mock rapor menghasilkan semua bagian dengan placeholder', async () => {
  const provider = resolveProvider({ provider: 'mock' });
  const result = await generate(provider, { kind: 'rapor', system: 's', user: 'data' });
  const parsed = parseReport(result.text);
  assert.deepEqual(Object.keys(parsed), REPORT_SECTIONS);
  assert.ok(parsed.penutup.includes('{guru}'));
});

test('formatWeeklyDigest mengganti kode dengan nama dan meloloskan HTML', () => {
  const hasil = {
    ringkasan: 'S1 rajin, S2 perlu didampingi <segera>.',
    fokus_pekan_ini: 'Murojaah bersama',
    sorotan: [{ kode: 'S2', jenis: 'perhatian', catatan: 'absen 3 kali' }, { kode: 'S1', jenis: 'apresiasi', catatan: 'hafalan lancar' }],
    saran_umum: [{ judul: 'Apresiasi pagi', alasan: '' }],
  };
  const text = formatWeeklyDigest(hasil, 'Kelas A & B', { S1: 'Aisyah', S2: 'Bilal' }, '16-11-2026');
  assert.ok(text.includes('Aisyah rajin, Bilal perlu didampingi &lt;segera&gt;.'));
  assert.ok(text.includes('<i>Kelas A &amp; B</i>'));
  assert.ok(text.includes('<b>Bilal</b> — absen 3 kali'));
  assert.ok(!/\bS\d\b/.test(text));
});

const { toTelegramHtml, splitTelegram, findSantri, santriShortName } = await import('../supabase/functions/_shared/aiContext.js');

test('toTelegramHtml mengubah markdown jawaban AI menjadi HTML Telegram yang aman', () => {
  const html = toTelegramHtml('## Saran\n- **Bilal**: latih <Al-Kafirun> & murojaah\n\n\n\nSelesai **');
  assert.equal(html, 'Saran\n• <b>Bilal</b>: latih &lt;Al-Kafirun&gt; &amp; murojaah\n\nSelesai');
});

test('splitTelegram memotong di batas paragraf tanpa melebihi batas', () => {
  const para = 'a'.repeat(300);
  const parts = splitTelegram(Array(20).fill(para).join('\n\n'), 1000);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 1000 && !p.startsWith('\n')));
  assert.deepEqual(splitTelegram('pendek'), ['pendek']);
});

test('findSantri mendahulukan nama persis, lalu awalan kata, lalu sebagian', () => {
  const roster = [
    { santri_id: '1', nama_lengkap: 'Muhammad Bilal', nama_panggilan: 'Bilal' },
    { santri_id: '2', nama_lengkap: 'Bilqis Azzahra', nama_panggilan: null },
    { santri_id: '3', nama_lengkap: 'Ahmad Nabil', nama_panggilan: 'Nabil' },
  ];
  assert.deepEqual(findSantri(roster, 'bilal').map((r) => r.santri_id), ['1']);
  assert.deepEqual(findSantri(roster, 'Bil').map((r) => r.santri_id), ['1', '2']);
  assert.deepEqual(findSantri(roster, 'abil').map((r) => r.santri_id), ['3']);
  assert.deepEqual(findSantri(roster, '  '), []);
  assert.equal(santriShortName(roster[1]), 'Bilqis');
});

test('profil memuat hafalan wajib jilid: sudah hafal, masih dilatih, dan belum dinilai', () => {
  const ctx = buildProfileContext({
    jilid: 'Jilid 1A',
    hafalan: [{ kategori: 'Doa', materi: 'Doa makan', skor: 4, hari_sejak_dinilai: 3 }],
    hafalan_wajib_jilid: [
      { kategori: 'Doa', materi: 'Doa makan', skor: 4, status: 'lulus' },
      { kategori: 'Doa', materi: 'Tasbih', skor: 2, status: 'proses' },
      { kategori: 'Surat', materi: 'Al-Fatihah', skor: null, status: 'belum' },
    ],
  }, buildNameMasker([]));
  assert.deepEqual(ctx.hafalan_wajib_jilid_ini, {
    jilid: 'Jilid 1A', total: 3, sudah_skor_4: 1,
    masih_dilatih: ['Doa: Tasbih (skor 2)'], belum_dinilai: ['Surat: Al-Fatihah'],
  });
});
