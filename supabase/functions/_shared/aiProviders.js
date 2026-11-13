// Adapter penyedia AI untuk asisten. Semua penyedia mengembalikan bentuk yang sama:
// { text, inputTokens, outputTokens }. Kunci API dibaca dari secret Edge Function lewat getEnv.
//
// Jenis adapter:
//   anthropic — Claude, lewat SDK resmi @anthropic-ai/sdk
//   gemini    — Google Gemini generateContent
//   openai    — API /chat/completions bergaya OpenAI (OpenAI, DeepSeek, OpenCode Zen, OpenRouter,
//               Groq, atau alamat lain yang kompatibel)
//   mock      — jawaban tiruan tanpa jaringan untuk uji lokal

export const PROVIDERS = {
  mock: { label: 'Tiruan (uji lokal)', kind: 'mock', keyEnv: null, defaultModel: 'mock', price: { input: 0, output: 0 } },
  anthropic: {
    label: 'Anthropic Claude', kind: 'anthropic', keyEnv: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-haiku-5-5', price: { input: 0.1, output: 0.5 },
  },
  openai: {
    label: 'OpenAI', kind: 'openai', keyEnv: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1',
    defaultModel: '', jsonMode: true,
  },
  gemini: {
    label: 'Google Gemini', kind: 'gemini', keyEnv: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: '',
  },
  deepseek: {
    label: 'DeepSeek', kind: 'openai', keyEnv: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat', jsonMode: true,
  },
  opencode: {
    label: 'OpenCode Zen', kind: 'openai', keyEnv: 'OPENCODE_API_KEY', baseUrl: 'https://opencode.ai/zen/v1',
    defaultModel: '',
  },
  openrouter: {
    label: 'OpenRouter', kind: 'openai', keyEnv: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
  },
  groq: {
    label: 'Groq', kind: 'openai', keyEnv: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: '', jsonMode: true,
  },
  custom: { label: 'Lainnya (kompatibel OpenAI)', kind: 'openai', keyEnv: 'AI_CUSTOM_API_KEY', defaultModel: '' },
};

// Harga cadangan bila admin belum mengisi harga dan penyedia tidak punya harga bawaan, supaya
// batas anggaran tetap bekerja (sengaja lebih tinggi dari kebanyakan model kecil).
export const FALLBACK_PRICE = { input: 1, output: 4 };

const TIMEOUT_MS = 45_000;

export class AiProviderError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Gabungkan pengaturan admin dengan bawaan penyedia.
export const resolveProvider = (ai = {}, getEnv = () => undefined) => {
  const id = PROVIDERS[ai.provider] ? ai.provider : 'mock';
  const def = PROVIDERS[id];
  const model = (ai.model || '').trim() || def.defaultModel;
  const baseUrl = (id === 'custom' ? ai.base_url : def.baseUrl) || '';
  const priceIn = Number(ai.price_input_per_mtok) || 0;
  const priceOut = Number(ai.price_output_per_mtok) || 0;
  const price = priceIn || priceOut
    ? { input: priceIn, output: priceOut }
    : (def.price || FALLBACK_PRICE);
  const apiKey = def.keyEnv ? (getEnv(def.keyEnv) || '') : '';
  return { id, ...def, model, baseUrl: baseUrl.replace(/\/+$/, ''), price, apiKey, hasKey: !def.keyEnv || Boolean(apiKey) };
};

export const keyStatus = (getEnv = () => undefined) => Object.fromEntries(
  Object.entries(PROVIDERS).map(([id, def]) => [id, { label: def.label, keyEnv: def.keyEnv, configured: !def.keyEnv || Boolean(getEnv(def.keyEnv)), defaultModel: def.defaultModel }]),
);

const readError = async (res) => {
  const body = await res.text().catch(() => '');
  let message = body;
  try {
    const data = JSON.parse(body);
    message = data?.error?.message || data?.message || body;
  } catch { /* teks biasa */ }
  return String(message || `HTTP ${res.status}`).slice(0, 300);
};

const httpError = async (res) => {
  const message = await readError(res);
  if (res.status === 401 || res.status === 403) return new AiProviderError('AI_KEY_REJECTED', message, res.status);
  if (res.status === 429) return new AiProviderError('AI_RATE_LIMITED', message, res.status);
  return new AiProviderError('AI_PROVIDER_ERROR', message, res.status);
};

const callOpenAiCompatible = async (p, { system, user }, fetchImpl) => {
  const body = {
    model: p.model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  if (p.jsonMode) body.response_format = { type: 'json_object' };
  const headers = { 'content-type': 'application/json' };
  if (p.apiKey) headers.authorization = `Bearer ${p.apiKey}`;
  const res = await fetchImpl(`${p.baseUrl}/chat/completions`, {
    method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  return {
    text: data?.choices?.[0]?.message?.content || '',
    inputTokens: data?.usage?.prompt_tokens || 0,
    outputTokens: data?.usage?.completion_tokens || 0,
  };
};

const callGemini = async (p, { system, user }, fetchImpl) => {
  const res = await fetchImpl(`${p.baseUrl}/models/${encodeURIComponent(p.model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': p.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  const meta = data?.usageMetadata || {};
  return {
    text: (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join(''),
    inputTokens: meta.promptTokenCount || 0,
    outputTokens: (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0),
  };
};

// Model Claude generasi 5 menerima output_config.effort; model lama tidak.
const supportsEffort = (model) => /^claude-(haiku|sonnet|opus|fable)-5/.test(model);

const callAnthropic = async (p, { system, user, schema }, _fetchImpl, loadAnthropic) => {
  const Anthropic = await loadAnthropic();
  const client = new Anthropic({ apiKey: p.apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  const outputConfig = { format: { type: 'json_schema', schema } };
  if (supportsEffort(p.model)) outputConfig.effort = 'low';
  let response;
  try {
    response = await client.messages.create({
      model: p.model,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: outputConfig,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AiProviderError('AI_KEY_REJECTED', err.message, err.status);
    }
    if (err instanceof Anthropic.RateLimitError) throw new AiProviderError('AI_RATE_LIMITED', err.message, 429);
    if (err instanceof Anthropic.APIError) throw new AiProviderError('AI_PROVIDER_ERROR', err.message, err.status ?? null);
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new AiProviderError('AI_REFUSED', 'Model menolak permintaan.');
  return {
    text: response.content.filter((block) => block.type === 'text').map((block) => block.text).join(''),
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };
};

const mockAnswer = (user) => {
  const tinggi = /"tingkat": "tinggi"/.test(user);
  return {
    text: JSON.stringify({
      ringkasan: `{nama} ${tinggi ? 'perlu perhatian segera' : 'perlu dipantau'} berdasarkan data kehadiran dan capaian terakhir.`,
      langkah: [
        { judul: 'Sapa {nama} secara pribadi di sesi berikutnya', alasan: 'Membangun kedekatan sebelum membahas kendala.' },
        { judul: 'Hubungi wali untuk menanyakan kendala', alasan: 'Data menunjukkan pola yang perlu dikonfirmasi ke rumah.' },
      ],
      pesan_wali: 'Assalamu\'alaikum, Bapak/Ibu. Kami ingin mengabarkan perkembangan {nama} di TPQ dan berharap bisa bekerja sama. Jazakumullahu khairan. Salam, {guru}.',
    }),
    inputTokens: Math.ceil(user.length / 4),
    outputTokens: 120,
  };
};

// Specifier npm: hanya dikenali Deno (Edge Function); tes Node menyuntikkan loadAnthropic tiruan.
// eslint-disable-next-line import/no-unresolved
const defaultLoadAnthropic = async () => (await import('npm:@anthropic-ai/sdk')).default;

// Panggil penyedia terpilih. fetchImpl dan loadAnthropic dapat diganti untuk pengujian.
export const generate = async (provider, prompt, { fetchImpl = fetch, loadAnthropic = defaultLoadAnthropic } = {}) => {
  if (provider.kind === 'mock') return mockAnswer(prompt.user);
  if (!provider.model) throw new AiProviderError('AI_MODEL_MISSING', 'Nama model belum diisi di pengaturan AI.');
  if (!provider.hasKey) throw new AiProviderError('AI_KEY_MISSING', `Secret ${provider.keyEnv} belum diisi.`);
  if (provider.kind === 'anthropic') return callAnthropic(provider, prompt, fetchImpl, loadAnthropic);
  if (provider.kind === 'gemini') return callGemini(provider, prompt, fetchImpl);
  if (!provider.baseUrl) throw new AiProviderError('AI_BASE_URL_MISSING', 'Alamat API belum diisi.');
  return callOpenAiCompatible(provider, prompt, fetchImpl);
};
