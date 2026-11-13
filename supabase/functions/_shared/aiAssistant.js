// Logika murni rekomendasi AI asisten: penyamaran data, prompt, validasi jawaban, biaya.
// Dipakai Edge Function assistant-ai (Deno) dan diuji dengan node --test.

export const PROMPT_VERSION = 'rekomendasi-v2';

const RULE_LABELS = {
  absen_beruntun: 'Tidak hadir beberapa sesi berturut-turut',
  kehadiran_bulanan: 'Persentase kehadiran bulanan di bawah standar',
  jilid_lama: 'Terlalu lama di jilid yang sama',
  hafalan_macet: 'Hafalan lama tidak mencapai skor 4 (aman)',
  hafalan_wajib_belum_lulus: 'Hafalan wajib jilid belum skor 4',
  murojaah_belum_ditinjau: 'Setoran muroja\'ah belum ditinjau guru',
};

const SESSION_CODES = { hadir: 'H', terlambat: 'T', koreksi: 'H', absen: 'A' };

const int = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const shortText = (value, max = 60) => (typeof value === 'string' ? value.trim().slice(0, max) : null);

// Hanya kunci detail yang aman dan berguna; nama santri, kelas, tanggal lahir, dan nomor HP tidak ikut.
const safeDetail = (rule, detail = {}) => {
  switch (rule) {
    case 'absen_beruntun':
      return { sesi_berturut: int(detail.streak) };
    case 'kehadiran_bulanan':
      return { hadir: int(detail.present), dari: int(detail.total), persen: int(detail.percent), standar_persen: int(detail.min_percent) };
    case 'jilid_lama':
      return { jilid: shortText(detail.jilid, 20), hari: int(detail.days), batas_hari: int(detail.threshold) };
    case 'hafalan_macet':
    case 'hafalan_wajib_belum_lulus':
      return {
        jumlah: int(detail.count),
        contoh_materi: Array.isArray(detail.items) ? detail.items.map((i) => shortText(String(i), 40)).filter(Boolean).slice(0, 5) : [],
      };
    case 'murojaah_belum_ditinjau':
      return { jumlah: int(detail.count) };
    default:
      return {};
  }
};

// Susun masukan tersamar untuk satu santri dari item panel dan ringkasan (snapshot).
export const buildAnonymizedInput = (items = [], snapshot = null) => {
  const perkara = items
    .filter((item) => RULE_LABELS[item.rule])
    .map((item) => ({ jenis: RULE_LABELS[item.rule], tingkat: item.tingkat === 'tinggi' ? 'tinggi' : 'sedang', data: safeDetail(item.rule, item.detail || {}) }))
    .sort((a, b) => a.jenis.localeCompare(b.jenis));

  const input = { santri: 'Santri (nama disamarkan)', perkara };
  if (snapshot) {
    const sesi = Array.isArray(snapshot.sesi_terakhir) ? snapshot.sesi_terakhir : [];
    input.ringkasan = {
      jilid: shortText(snapshot.jilid, 20),
      hari_di_jilid: int(snapshot.jilid_hari),
      batas_hari_jilid: int(snapshot.jilid_batas),
      pola_10_sesi_terakhir: sesi.map((s) => SESSION_CODES[s.s] || '?').join(''),
      hadir_4_pekan: int(snapshot.hadir_4pekan),
      sesi_4_pekan: int(snapshot.sesi_4pekan),
      hafalan_jilid: snapshot.hafalan ? {
        total: int(snapshot.hafalan.total),
        skor_4: int(snapshot.hafalan.lulus),
        masih_skor_1_3: int(snapshot.hafalan.proses),
      } : null,
      murojaah_menunggu: int(snapshot.murojaah_menunggu),
    };
  }
  return input;
};

export const SYSTEM_PROMPT = `Anda asisten guru di sebuah Taman Pendidikan Al-Qur'an (TPQ) untuk anak-anak.
Tugas: dari data seorang santri yang perlu perhatian, beri saran tindak lanjut yang praktis untuk guru.

Aturan:
- Data sudah disamarkan. Jangan menebak nama. Sebut santri dengan placeholder {nama}; sebut guru dengan {guru}.
- Bahasa Indonesia yang santun, hangat, dan ringkas. Nuansa adab pesantren boleh, tetapi jangan berceramah.
- Saran harus bisa dilakukan guru di sesi mengaji atau lewat wali, dan merujuk pada data yang diberikan.
- Jangan memberi label medis, psikologis, atau menyalahkan anak maupun orang tua.
- Hafalan dinilai skor 1–4; skor 4 berarti sudah hafal/aman.
- "pola_10_sesi_terakhir": H = hadir, T = terlambat, A = tidak hadir, urut dari lama ke baru. Jangan menyalin pola mentah ini; jelaskan dengan kata-kata.
- Bila ada "profil" (hafalan per kategori, karakter, kekuatan, perilaku, catatan guru, poin), pakai untuk menyesuaikan saran: mulai dari kekuatan dan apresiasi, lalu sebut materi hafalan yang perlu dilatih secara spesifik.
- Ikuti pengetahuan lembaga dan metode Qiroati di atas; jangan menyarankan naik jilid tanpa tes kenaikan.
- Pesan untuk wali: buka dengan salam, sampaikan keadaan dengan lembut, ajak bekerja sama, tutup dengan doa dan nama {guru}. Maksimal 6 kalimat.

Balas HANYA dengan JSON valid tanpa teks lain, dengan bentuk:
{"ringkasan": "1–2 kalimat inti keadaan santri",
 "langkah": [{"judul": "tindakan singkat", "alasan": "kenapa, merujuk data"}],
 "pesan_wali": "draf pesan WhatsApp untuk wali"}
"langkah" berisi 2 sampai 4 butir.`;

export const buildUserPrompt = (input) =>
  `Data santri (JSON):\n${JSON.stringify(input, null, 2)}\n\nBuat rekomendasi sesuai aturan.`;

export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ringkasan', 'langkah', 'pesan_wali'],
  properties: {
    ringkasan: { type: 'string' },
    langkah: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['judul', 'alasan'],
        properties: { judul: { type: 'string' }, alasan: { type: 'string' } },
      },
    },
    pesan_wali: { type: 'string' },
  },
};

const clean = (value, max) => (typeof value === 'string' ? value.replace(/\s+\n/g, '\n').trim().slice(0, max) : '');

// Ambil JSON dari jawaban model (boleh dibungkus ```json), lalu rapikan dan batasi panjangnya.
export const parseRecommendation = (text) => {
  if (typeof text !== 'string' || !text.trim()) throw new Error('AI_EMPTY_RESPONSE');
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last <= first) throw new Error('AI_INVALID_JSON');
  let data;
  try {
    data = JSON.parse(raw.slice(first, last + 1));
  } catch {
    throw new Error('AI_INVALID_JSON');
  }
  const langkah = (Array.isArray(data?.langkah) ? data.langkah : [])
    .map((step) => (typeof step === 'string' ? { judul: step, alasan: '' } : step))
    .map((step) => ({ judul: clean(step?.judul, 120), alasan: clean(step?.alasan, 300) }))
    .filter((step) => step.judul)
    .slice(0, 4);
  const result = { ringkasan: clean(data?.ringkasan, 400), langkah, pesan_wali: clean(data?.pesan_wali, 900) };
  if (!result.ringkasan || result.langkah.length === 0) throw new Error('AI_INVALID_JSON');
  return result;
};

// Biaya dalam USD dari jumlah token dan harga per 1 juta token.
export const estimateCost = ({ inputTokens = 0, outputTokens = 0 }, { input = 0, output = 0 }) =>
  Math.round(((inputTokens * input + outputTokens * output) / 1_000_000) * 1_000_000) / 1_000_000;

export const sha256Hex = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const inputHash = (input, provider, model) =>
  sha256Hex(JSON.stringify({ v: PROMPT_VERSION, provider, model, input }));
