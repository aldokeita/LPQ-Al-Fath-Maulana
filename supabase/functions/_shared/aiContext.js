// Konteks AI asisten: penyamaran nama, profil santri, gambaran kelas, dan prompt untuk saran kelas
// serta chatbot guru. Logika murni; dipakai Edge Function assistant-ai dan diuji dengan node --test.

import { buildAnonymizedInput } from './aiAssistant.js';

export const CLASS_PROMPT_VERSION = 'kelas-v1';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (value) => String(value || '').split(/[\s.,'’-]+/).map((w) => w.trim()).filter((w) => w.length >= 3);

// Kode santri stabil dalam satu kelas: S1, S2, ... urut nama lengkap.
// mask(): ganti nama santri (lengkap, panggilan, atau kata nama yang unik) dengan kodenya; kata nama
// yang dipakai beberapa santri (mis. "Muhammad") diganti "[nama]". unmask(): kode -> nama panggilan.
export const buildNameMasker = (roster = []) => {
  const sorted = [...roster].sort((a, b) => String(a.nama_lengkap || '').localeCompare(String(b.nama_lengkap || '')));
  const codes = new Map();
  const display = {};
  const santriOf = {};
  const tokenOwners = new Map();
  sorted.forEach((s) => {
    new Set([...words(s.nama_lengkap), ...words(s.nama_panggilan)].map((w) => w.toLowerCase()))
      .forEach((w) => tokenOwners.set(w, [...(tokenOwners.get(w) || []), s.santri_id]));
  });

  // Nama tampilan: panggilan, atau kata nama pertama yang tidak dipakai santri lain.
  sorted.forEach((s, index) => {
    const code = `S${index + 1}`;
    codes.set(s.santri_id, code);
    const parts = words(s.nama_lengkap);
    display[code] = String(s.nama_panggilan || '').trim()
      || parts.find((w) => (tokenOwners.get(w.toLowerCase()) || []).length === 1)
      || parts[0] || code;
    santriOf[code] = s.santri_id;
  });

  const rules = [];
  sorted.forEach((s) => {
    const code = codes.get(s.santri_id);
    [s.nama_lengkap, s.nama_panggilan].map((v) => String(v || '').trim()).filter((v) => v.length >= 3)
      .forEach((phrase) => rules.push({ text: phrase, to: code }));
  });
  tokenOwners.forEach((owners, token) => {
    rules.push({ text: token, to: owners.length === 1 ? codes.get(owners[0]) : '[nama]' });
  });
  // Frasa terpanjang lebih dulu agar "Bilal Ramadhan" tidak terpotong oleh "Bilal".
  rules.sort((a, b) => b.text.length - a.text.length);
  const compiled = rules.map((r) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(r.text)}(?![\\p{L}\\p{N}])`, 'giu'), to: r.to }));

  const mask = (text) => compiled.reduce((acc, r) => acc.replace(r.re, r.to), String(text ?? ''));
  const unmask = (text) => String(text ?? '').replace(/\bS(\d{1,3})\b/g, (m) => display[m] || m);
  return { mask, unmask, codeOf: (id) => codes.get(id) || null, santriOf, display };
};

const int = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : null);

// Profil tersamar satu santri (untuk saran per santri dan chat).
export const buildProfileContext = (profile, masker) => {
  if (!profile) return null;
  const hafalan = {};
  (profile.hafalan || []).forEach((h) => {
    const k = h.kategori || 'Lainnya';
    hafalan[k] = hafalan[k] || { skor_4: 0, skor_1_3: [], belum_dinilai_ulang_30_hari: 0 };
    if (Number(h.skor) === 4) hafalan[k].skor_4 += 1;
    else hafalan[k].skor_1_3.push(`${h.materi} (skor ${h.skor ?? '-'})`);
    if (Number(h.skor) !== 4 && Number(h.hari_sejak_dinilai) > 30) hafalan[k].belum_dinilai_ulang_30_hari += 1;
  });
  Object.values(hafalan).forEach((v) => { v.skor_1_3 = v.skor_1_3.slice(0, 15); });
  const m = (t) => masker.mask(t);
  return {
    usia_tahun: int(profile.usia),
    jenis_kelamin: profile.jenis_kelamin || null,
    poin_gamifikasi: profile.poin ?? 0,
    riwayat_jilid: (profile.riwayat_jilid || []).map((r) => `${r.dari || '?'} → ${r.ke} (${r.hari_lalu} hari lalu)`),
    hafalan_per_kategori: hafalan,
    karakter: (profile.karakter || []).map((c) => `${c.indikator}: ${c.skor}`),
    kekuatan_karakter: profile.kekuatan || [],
    perilaku_180_hari: (profile.perilaku || []).map((b) => ({
      tingkat: b.tingkat, perilaku: m(b.perilaku), tindak_lanjut: m(b.tindak_lanjut), hari_lalu: b.hari_lalu,
    })),
    catatan_guru: (profile.catatan_guru || []).map((n) => ({ catatan: m(n.catatan), hari_lalu: n.hari_lalu })),
  };
};

// Masukan saran per santri: data panel + profil lengkap.
export const buildRecommendationInput = (items, snapshot, profile, masker) => {
  const input = buildAnonymizedInput(items, snapshot);
  const extra = buildProfileContext(profile, masker);
  if (extra) input.profil = extra;
  return input;
};

const ALERT_SHORT = {
  absen_beruntun: 'absen beruntun', kehadiran_bulanan: 'kehadiran rendah', jilid_lama: 'lama di jilid',
  hafalan_macet: 'hafalan belum aman', hafalan_wajib_belum_lulus: 'hafalan wajib belum skor 4', murojaah_belum_ditinjau: 'setoran menunggu',
};

// Gambaran kelas tersamar: satu baris per santri dengan kode.
export const buildClassContext = (roster, snapshots, items, masker) => {
  const snap = Object.fromEntries((snapshots || []).map((s) => [s.santri_id, s]));
  const alertsBy = {};
  (items || []).forEach((i) => {
    alertsBy[i.santri_id] = alertsBy[i.santri_id] || new Set();
    alertsBy[i.santri_id].add(`${ALERT_SHORT[i.rule] || i.rule}${i.tingkat === 'tinggi' ? ' (tinggi)' : ''}`);
  });
  const santri = [...roster]
    .map((r) => {
      const s = snap[r.santri_id] || {};
      return {
        kode: masker.codeOf(r.santri_id),
        usia: int(r.usia),
        jilid: s.jilid || null,
        hari_di_jilid: int(s.jilid_hari),
        batas_hari: int(s.jilid_batas),
        hadir_4_pekan: s.sesi_4pekan ? `${s.hadir_4pekan}/${s.sesi_4pekan}` : null,
        hafalan_jilid_skor_4: s.hafalan ? `${s.hafalan.lulus}/${s.hafalan.total}` : null,
        poin: r.poin ?? 0,
        karakter_rata: r.karakter_rata ?? null,
        kekuatan: r.kekuatan || [],
        catatan_perilaku_90_hari: int(r.perilaku_90_hari) || 0,
        perlu_perhatian: alertsBy[r.santri_id] ? [...alertsBy[r.santri_id]] : [],
      };
    })
    .sort((a, b) => Number(a.kode.slice(1)) - Number(b.kode.slice(1)));
  return {
    jumlah_santri: santri.length,
    jumlah_perlu_perhatian: santri.filter((s) => s.perlu_perhatian.length).length,
    santri,
  };
};

const BASE_RULES = `Aturan umum:
- Data sudah disamarkan. Santri disebut dengan kode S1, S2, dst.; tulis kodenya persis agar aplikasi dapat menggantinya dengan nama. Jangan menebak nama asli.
- Bahasa Indonesia yang santun, hangat, dan ringkas; jangan berceramah.
- Saran harus bisa dilakukan guru di sesi mengaji atau bersama wali, dan merujuk pada data.
- Jangan memberi label medis atau psikologis, dan jangan menyalahkan anak maupun orang tua.
- Jangan menyalin kode mentah dari data (mis. pola "HHAAH"); jelaskan dengan kata-kata.`;

export const withInstitution = (konteks, body) =>
  `${konteks ? `Pengetahuan dasar lembaga:\n${String(konteks).trim()}\n\n` : ''}${body}`;

export const CLASS_SYSTEM_PROMPT = `Anda asisten guru TPQ. Tugas: membaca gambaran satu kelas dan memberi saran menyeluruh, baik untuk santri yang perlu perhatian maupun kelas secara umum.

${BASE_RULES}

Balas HANYA dengan JSON valid tanpa teks lain:
{"ringkasan": "2–3 kalimat keadaan kelas",
 "sorotan": [{"kode": "S1", "jenis": "perhatian", "catatan": "apa yang perlu dilakukan"},
             {"kode": "S2", "jenis": "apresiasi", "catatan": "apa yang patut dihargai"}],
 "saran_umum": [{"judul": "tindakan untuk seluruh kelas", "alasan": "merujuk data"}],
 "fokus_pekan_ini": "satu kalimat fokus utama"}
"sorotan" berisi paling banyak 6 perhatian dan 4 apresiasi; "saran_umum" 2 sampai 4 butir.`;

export const CLASS_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ringkasan', 'sorotan', 'saran_umum', 'fokus_pekan_ini'],
  properties: {
    ringkasan: { type: 'string' },
    sorotan: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['kode', 'jenis', 'catatan'],
        properties: { kode: { type: 'string' }, jenis: { type: 'string', enum: ['perhatian', 'apresiasi'] }, catatan: { type: 'string' } },
      },
    },
    saran_umum: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['judul', 'alasan'], properties: { judul: { type: 'string' }, alasan: { type: 'string' } } },
    },
    fokus_pekan_ini: { type: 'string' },
  },
};

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const extractJson = (text) => {
  if (typeof text !== 'string' || !text.trim()) throw new Error('AI_EMPTY_RESPONSE');
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last <= first) throw new Error('AI_INVALID_JSON');
  try {
    return JSON.parse(raw.slice(first, last + 1));
  } catch {
    throw new Error('AI_INVALID_JSON');
  }
};

export const parseClassInsight = (text, validCodes = []) => {
  const data = extractJson(text);
  const codes = new Set(validCodes);
  const sorotan = (Array.isArray(data?.sorotan) ? data.sorotan : [])
    .map((s) => ({ kode: clean(s?.kode, 6).toUpperCase(), jenis: s?.jenis === 'apresiasi' ? 'apresiasi' : 'perhatian', catatan: clean(s?.catatan, 300) }))
    .filter((s) => s.catatan && (!codes.size || codes.has(s.kode)))
    .slice(0, 10);
  const saran = (Array.isArray(data?.saran_umum) ? data.saran_umum : [])
    .map((s) => ({ judul: clean(s?.judul, 120), alasan: clean(s?.alasan, 300) }))
    .filter((s) => s.judul)
    .slice(0, 4);
  const result = { ringkasan: clean(data?.ringkasan, 600), sorotan, saran_umum: saran, fokus_pekan_ini: clean(data?.fokus_pekan_ini, 200) };
  if (!result.ringkasan || saran.length === 0) throw new Error('AI_INVALID_JSON');
  return result;
};

export const CHAT_SYSTEM_PROMPT = `Anda asisten konsultasi untuk guru TPQ. Jawab pertanyaan guru tentang santri dan kelasnya berdasarkan data yang diberikan dan riwayat percakapan.

${BASE_RULES}
- Jawab langsung dan praktis, paling banyak sekitar 200 kata. Pakai poin bernomor bila memberi langkah.
- Bila data tidak cukup untuk menjawab, katakan apa yang belum tercatat dan sarankan cara mengamatinya.
- Untuk pertanyaan di luar pendidikan santri, arahkan kembali dengan sopan.`;

export const buildChatContext = ({ kelas, profil, kodeFokus }) => {
  const parts = [`Data kelas (tersamar):\n${JSON.stringify(kelas)}`];
  if (profil && kodeFokus) parts.push(`Profil lengkap santri ${kodeFokus} yang sedang dibahas:\n${JSON.stringify(profil)}`);
  return parts.join('\n\n');
};

// Riwayat chat -> pesan untuk penyedia; konteks data diselipkan di awal pesan pengguna pertama.
export const buildChatMessages = (history, question, contextText, masker, limit = 12) => {
  const recent = history.slice(-limit).map((m) => ({ role: m.role, content: masker.mask(m.content) }));
  const messages = [...recent, { role: 'user', content: masker.mask(question) }];
  messages[0] = { role: messages[0].role, content: messages[0].role === 'user' ? `${contextText}\n\n---\n${messages[0].content}` : messages[0].content };
  if (messages[0].role !== 'user') messages.unshift({ role: 'user', content: contextText });
  return messages;
};
