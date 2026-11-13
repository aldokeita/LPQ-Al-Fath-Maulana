import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./helpers/aliasLoader.mjs', import.meta.url);

const {
  buildAnonymizedInput, buildUserPrompt, estimateCost, inputHash, parseRecommendation,
} = await import('../supabase/functions/_shared/aiAssistant.js');
const { generate, keyStatus, resolveProvider, AiProviderError } = await import('../supabase/functions/_shared/aiProviders.js');
const { buildSettingsPatch, fillAiPlaceholders, validateAiSettings } = await import('../src/lib/assistantAlerts.js');

const ITEMS = [
  {
    alert_id: 'a1', santri_id: 's1', nama: 'Muhammad Bilal Ramadhan', nama_panggilan: 'Bilal', nama_kelas: 'Kelas Mawar',
    rule: 'absen_beruntun', tingkat: 'tinggi', detail: { streak: 6, absent_dates: ['2026-11-02'] },
  },
  {
    alert_id: 'a2', santri_id: 's1', nama: 'Muhammad Bilal Ramadhan', nama_panggilan: 'Bilal', nama_kelas: 'Kelas Mawar',
    rule: 'hafalan_macet', tingkat: 'sedang', detail: { count: 2, items: ['Doa makan', 'Surat An-Nas'], max_days: 30 },
  },
];
const SNAPSHOT = {
  santri_id: 's1', jilid: 'Jilid 2A', jilid_hari: 48, jilid_batas: 30, no_hp_wali: '081234567890',
  sesi_terakhir: [{ s: 'hadir' }, { s: 'terlambat' }, { s: 'absen' }, { s: 'koreksi' }],
  hadir_4pekan: 10, sesi_4pekan: 16, hafalan: { total: 8, lulus: 5, proses: 3 }, murojaah_menunggu: 1,
};

test('masukan AI tersamar: tanpa nama, kelas, tanggal, atau nomor HP', () => {
  const input = buildAnonymizedInput(ITEMS, SNAPSHOT);
  const text = JSON.stringify(input);
  for (const secret of ['Bilal', 'Ramadhan', 'Mawar', '0812', '2026-11-02', 's1', 'a1']) {
    assert.equal(text.includes(secret), false, `bocor: ${secret}`);
  }
  assert.equal(input.perkara.length, 2);
  assert.equal(input.ringkasan.pola_10_sesi_terakhir, 'HTAH');
  assert.deepEqual(input.ringkasan.hafalan_jilid, { total: 8, skor_4: 5, masih_skor_1_3: 3 });
  assert.match(buildUserPrompt(input), /Doa makan/);
});

test('hash masukan stabil dan berubah bila data/model berubah', async () => {
  const input = buildAnonymizedInput(ITEMS, SNAPSHOT);
  const a = await inputHash(input, 'anthropic', 'claude-haiku-5-5');
  assert.equal(a, await inputHash(buildAnonymizedInput([...ITEMS].reverse(), SNAPSHOT), 'anthropic', 'claude-haiku-5-5'));
  assert.notEqual(a, await inputHash(input, 'openai', 'x'));
  assert.notEqual(a, await inputHash(buildAnonymizedInput(ITEMS.slice(0, 1), SNAPSHOT), 'anthropic', 'claude-haiku-5-5'));
});

test('parseRecommendation menerima JSON berpagar dan membatasi isi', () => {
  const text = '```json\n{"ringkasan":"{nama} sering absen.","langkah":[{"judul":"Telepon wali","alasan":"6 kali absen"},"Sapa {nama}",{"judul":""},{"judul":"a"},{"judul":"b"}],"pesan_wali":"Assalamu\'alaikum"}\n```';
  const result = parseRecommendation(text);
  assert.equal(result.ringkasan, '{nama} sering absen.');
  assert.equal(result.langkah.length, 4);
  assert.deepEqual(result.langkah[1], { judul: 'Sapa {nama}', alasan: '' });
  assert.throws(() => parseRecommendation('maaf, tidak bisa'), /AI_INVALID_JSON/);
  assert.throws(() => parseRecommendation('{"ringkasan":"x","langkah":[]}'), /AI_INVALID_JSON/);
});

test('estimateCost dan harga bawaan/cadangan', () => {
  assert.equal(estimateCost({ inputTokens: 1_000_000, outputTokens: 200_000 }, { input: 0.1, output: 0.5 }), 0.2);
  assert.deepEqual(resolveProvider({ provider: 'anthropic' }).price, { input: 0.1, output: 0.5 });
  assert.deepEqual(resolveProvider({ provider: 'openai', model: 'm' }).price, { input: 1, output: 4 });
  assert.deepEqual(resolveProvider({ provider: 'openai', price_input_per_mtok: 0.2, price_output_per_mtok: 0.8 }).price, { input: 0.2, output: 0.8 });
});

test('resolveProvider: model bawaan, base URL custom, status kunci', () => {
  const env = { DEEPSEEK_API_KEY: 'sk-test' };
  const getEnv = (k) => env[k];
  const p = resolveProvider({ provider: 'deepseek' }, getEnv);
  assert.equal(p.model, 'deepseek-chat');
  assert.equal(p.hasKey, true);
  assert.equal(resolveProvider({ provider: 'custom', base_url: 'https://x.ai/v1/' }).baseUrl, 'https://x.ai/v1');
  assert.equal(resolveProvider({ provider: 'tidak-ada' }).id, 'mock');
  const status = keyStatus(getEnv);
  assert.equal(status.deepseek.configured, true);
  assert.equal(status.openai.configured, false);
  assert.equal(status.mock.configured, true);
});

const fakeFetch = (reply, calls) => async (url, init) => {
  calls.push({ url, init: { ...init, body: JSON.parse(init.body) } });
  return { ok: true, status: 200, json: async () => reply, text: async () => JSON.stringify(reply) };
};

test('adapter bergaya OpenAI (OpenCode, DeepSeek, dll.)', async () => {
  const calls = [];
  const p = resolveProvider({ provider: 'opencode', model: 'zen-model' }, () => 'kunci');
  const out = await generate(p, { system: 'S', user: 'U' }, {
    fetchImpl: fakeFetch({ choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }, calls),
  });
  assert.deepEqual(out, { text: '{"a":1}', inputTokens: 10, outputTokens: 5 });
  assert.equal(calls[0].url, 'https://opencode.ai/zen/v1/chat/completions');
  assert.equal(calls[0].init.headers.authorization, 'Bearer kunci');
  assert.equal(calls[0].init.body.model, 'zen-model');
  assert.equal(calls[0].init.body.response_format, undefined);

  const calls2 = [];
  await generate(resolveProvider({ provider: 'deepseek' }, () => 'k'), { system: 'S', user: 'U' }, {
    fetchImpl: fakeFetch({ choices: [{ message: { content: '{}' } }] }, calls2),
  });
  assert.deepEqual(calls2[0].init.body.response_format, { type: 'json_object' });
});

test('adapter Gemini', async () => {
  const calls = [];
  const p = resolveProvider({ provider: 'gemini', model: 'gemini-x' }, () => 'g-key');
  const out = await generate(p, { system: 'S', user: 'U' }, {
    fetchImpl: fakeFetch({
      candidates: [{ content: { parts: [{ text: '{"b"' }, { text: ':2}' }] } }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3, thoughtsTokenCount: 4 },
    }, calls),
  });
  assert.deepEqual(out, { text: '{"b":2}', inputTokens: 7, outputTokens: 7 });
  assert.match(calls[0].url, /models\/gemini-x:generateContent$/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'g-key');
  assert.equal(calls[0].init.body.systemInstruction.parts[0].text, 'S');
});

test('adapter Anthropic memakai SDK dengan output terstruktur dan effort rendah', async () => {
  let created = null;
  class FakeAnthropic {
    constructor(opts) { this.opts = opts; this.messages = { create: async (req) => { created = { req, opts }; return { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"c":3}' }], usage: { input_tokens: 9, output_tokens: 4 } }; } }; }
  }
  FakeAnthropic.APIError = class extends Error {};
  const p = resolveProvider({ provider: 'anthropic' }, () => 'sk-ant');
  const out = await generate(p, { system: 'S', user: 'U', schema: { type: 'object' } }, { loadAnthropic: async () => FakeAnthropic });
  assert.deepEqual(out, { text: '{"c":3}', inputTokens: 9, outputTokens: 4 });
  assert.equal(created.req.model, 'claude-haiku-5-5');
  assert.equal(created.opts.apiKey, 'sk-ant');
  assert.deepEqual(created.req.output_config, { format: { type: 'json_schema', schema: { type: 'object' } }, effort: 'low' });
});

test('galat penyedia: kunci/model kosong dan 401', async () => {
  await assert.rejects(generate(resolveProvider({ provider: 'openai', model: 'm' }), { system: '', user: '' }), (e) => e.code === 'AI_KEY_MISSING');
  await assert.rejects(generate(resolveProvider({ provider: 'openai' }, () => 'k'), { system: '', user: '' }), (e) => e.code === 'AI_MODEL_MISSING');
  const deny = async () => ({ ok: false, status: 401, text: async () => '{"error":{"message":"bad key"}}' });
  await assert.rejects(
    generate(resolveProvider({ provider: 'groq', model: 'm' }, () => 'k'), { system: '', user: '' }, { fetchImpl: deny }),
    (e) => e instanceof AiProviderError && e.code === 'AI_KEY_REJECTED' && e.message === 'bad key',
  );
});

test('mode tiruan menghasilkan rekomendasi yang lolos parser', async () => {
  const out = await generate(resolveProvider({ provider: 'mock' }), { system: 'S', user: buildUserPrompt(buildAnonymizedInput(ITEMS, SNAPSHOT)) });
  const rec = parseRecommendation(out.text);
  assert.match(rec.ringkasan, /segera/);
});

test('validasi & patch pengaturan AI di frontend, isi placeholder', () => {
  const base = { enabled: false, provider: 'mock', model: '', base_url: '', monthly_budget_usd: 10, price_input_per_mtok: 0, price_output_per_mtok: 0, daily_limit_per_user: 40 };
  assert.equal(validateAiSettings(base), null);
  assert.match(validateAiSettings({ ...base, enabled: true, provider: 'openai' }), /model/);
  assert.match(validateAiSettings({ ...base, provider: 'custom' }), /alamat API/);
  assert.match(validateAiSettings({ ...base, base_url: 'http://x.ai' }), /https/);
  assert.match(validateAiSettings({ ...base, monthly_budget_usd: -1 }), /Anggaran/);
  const saved = { silent_mode: false, school_days: [1], jilid: { per_jilid: {} }, notifications: {}, ai: base };
  const patch = buildSettingsPatch(saved, { ...saved, ai: { ...base, enabled: true, provider: 'anthropic' } });
  assert.deepEqual(patch.ai, { enabled: true, provider: 'anthropic' });
  assert.equal(fillAiPlaceholders('Sapa {nama}. Salam, {guru}', { nama: 'Bilal', guru: 'Ust. Aldo' }), 'Sapa Bilal. Salam, Ust. Aldo');
});
