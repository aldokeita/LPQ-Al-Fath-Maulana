import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildJilidCard, buildProfilCard, cardFileName, fillPesan, formatTanggal, limitList, panggilanOf, DEFAULT_PESAN,
} = await import('../src/lib/santriCards.js');
const { parseCardNote } = await import('../supabase/functions/_shared/aiContext.js');

const TODAY = new Date(2026, 10, 13);

test('kartu naik jilid memakai riwayat terakhir dan menghitung tanggal naik', () => {
  const card = buildJilidCard({
    nama_lengkap: 'Muhammad Bilal', nama_panggilan: 'Bilal', jilid: 'Jilid 2A',
    riwayat_jilid: [{ dari: 'Jilid 1C', ke: 'Jilid 2A', hari_lalu: 3 }, { dari: 'Jilid 1B', ke: 'Jilid 1C', hari_lalu: 60 }],
  }, { today: TODAY });
  assert.deepEqual(card, {
    namaLengkap: 'Muhammad Bilal', panggilan: 'Bilal', dari: 'Jilid 1C', ke: 'Jilid 2A',
    tanggal: '10 November 2026', adaRiwayat: true, hariLalu: 3,
  });
  const noHistory = buildJilidCard({ nama_lengkap: 'Rumi Azzahra', jilid: 'Jilid 1A' }, { today: TODAY });
  assert.equal(noHistory.adaRiwayat, false);
  assert.equal(noHistory.ke, 'Jilid 1A');
  assert.equal(noHistory.panggilan, 'Rumi');
  assert.equal(buildJilidCard(null), null);
});

test('kartu profil merangkum kehadiran dan hafalan', () => {
  const card = buildProfilCard({
    nama_lengkap: 'Aisyah Putri', nama_panggilan: 'Aisyah', jilid: 'Jilid 2B', poin: 12.5,
    hafalan: [
      { kategori: 'Doa', materi: 'Doa makan', skor: 4 },
      { kategori: 'Doa', materi: 'Tasbih', skor: 2 },
      { kategori: 'Surat', materi: 'An-Nas', skor: 3 },
    ],
    hafalan_wajib_jilid: [
      { kategori: 'Doa', materi: 'Doa makan', skor: 4 },
      { kategori: 'Doa', materi: 'Tasbih', skor: 2 },
      { kategori: 'Surat', materi: 'Al-Falaq', skor: null },
      { kategori: 'Surat', materi: 'Al-Ikhlas', skor: null },
    ],
  }, {
    hadir_4pekan: 15, sesi_4pekan: 20,
    sesi_terakhir: Array.from({ length: 12 }, (_, i) => ({ t: `2026-11-${i + 1}`, s: i % 4 === 0 ? 'absen' : 'hadir' })),
  }, { today: TODAY });
  assert.equal(card.bulan, 'November 2026');
  assert.deepEqual(card.kehadiran.persen, 75);
  assert.equal(card.kehadiran.sesi.length, 10);
  assert.deepEqual(card.hafalan.sudahHafal, ['Doa makan']);
  assert.deepEqual(card.hafalan.dilatih, [{ materi: 'An-Nas', skor: 3 }, { materi: 'Tasbih', skor: 2 }]);
  assert.equal(card.hafalan.wajibAman, 1);
  assert.equal(card.hafalan.wajibTotal, 4);
  assert.equal(card.hafalan.persen, 25);
  assert.equal(card.hafalan.belumDinilai, 2);
  assert.deepEqual(card.hafalan.belumDinilaiList, ['Al-Falaq', 'Al-Ikhlas']);
});

test('kartu profil tetap aman tanpa sesi maupun hafalan', () => {
  const card = buildProfilCard({ nama_lengkap: 'Rumi', jilid: 'Jilid 1A' }, null, { today: TODAY });
  assert.equal(card.kehadiran.persen, null);
  assert.deepEqual(card.kehadiran.sesi, []);
  assert.equal(card.hafalan.persen, null);
  assert.deepEqual(card.hafalan.sudahHafal, []);
});

test('pesan, nama, dan utilitas kartu', () => {
  assert.equal(fillPesan(DEFAULT_PESAN.jilid, { nama: 'Bilal', ke: 'Jilid 2A' }).startsWith('Alhamdulillah, Bilal telah naik ke Jilid 2A.'), true);
  assert.equal(fillPesan('Hai {nama}'), 'Hai Ananda');
  assert.equal(panggilanOf({ nama_lengkap: '  Siti Aminah ' }), 'Siti');
  assert.equal(formatTanggal(TODAY), '13 November 2026');
  assert.deepEqual(limitList([1, 2, 3], 2), { shown: [1, 2], more: 1 });
  assert.equal(cardFileName('jilid', 'Muhammad Bilal', '2026-11-13'), 'kartu-naik-jilid-muhammad-bilal-2026-11-13.png');
  assert.equal(cardFileName('profil', ''), cardFileName('profil', '').replace(/santri/, 'santri'));
});

test('pesan kartu dari AI dibersihkan dan dibatasi', () => {
  assert.equal(parseCardNote('  "Selamat **{nama}**!\nTerus semangat."  '), 'Selamat {nama}! Terus semangat.');
  assert.equal(parseCardNote('x'.repeat(400)).length, 240);
  assert.throws(() => parseCardNote('  '), /AI_EMPTY_RESPONSE/);
});
