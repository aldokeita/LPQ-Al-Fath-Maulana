// Asisten AI LPQ.
//
// recommend (guru/admin)   : saran untuk satu santri di panel "Perlu Perhatian".
// class_insight (guru/admin): saran menyeluruh satu kelas (perlu perhatian + umum). only_cached=true
//                             hanya membaca simpanan tanpa memanggil AI.
// chat (guru/admin)        : konsultasi guru tentang kelas/santri; riwayat tersimpan per pengguna.
// status, test (admin)     : status kunci & pemakaian, uji koneksi.
//
// Semua data dibaca dengan sesi pengguna (RLS & mode senyap berlaku), nama santri disamarkan menjadi
// kode S1, S2, ... sebelum dikirim ke penyedia AI, dan dikembalikan menjadi nama hanya di jawaban.
import { getUserFromRequest } from "../_shared/auth.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { handleOptions } from "../_shared/cors.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import {
  buildUserPrompt, estimateCost, inputHash, parseRecommendation, RESULT_SCHEMA, sha256Hex, SYSTEM_PROMPT,
} from "../_shared/aiAssistant.js";
import {
  buildChatContext, buildChatMessages, buildClassContext, buildNameMasker, buildProfileContext, buildRecommendationInput,
  CHAT_SYSTEM_PROMPT, CLASS_PROMPT_VERSION, CLASS_RESULT_SCHEMA, CLASS_SYSTEM_PROMPT, parseClassInsight, withInstitution,
} from "../_shared/aiContext.js";
import { AiProviderError, generate, keyStatus, resolveProvider } from "../_shared/aiProviders.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getEnv = (name: string) => Deno.env.get(name);
type Json = Record<string, any>;

const ERROR_STATUS: Record<string, number> = {
  AI_KEY_MISSING: 503, AI_MODEL_MISSING: 503, AI_BASE_URL_MISSING: 503,
  AI_KEY_REJECTED: 502, AI_RATE_LIMITED: 429, AI_PROVIDER_ERROR: 502, AI_REFUSED: 422,
  AI_INVALID_JSON: 502, AI_EMPTY_RESPONSE: 502,
};

const errorCode = (err: unknown) => err instanceof AiProviderError ? err.code
  : String((err as Error)?.message || "").startsWith("AI_") ? String((err as Error).message) : "AI_PROVIDER_ERROR";

const friendlyMessage = (code: string) =>
  ["AI_KEY_MISSING", "AI_MODEL_MISSING", "AI_BASE_URL_MISSING", "AI_KEY_REJECTED"].includes(code)
    ? "Asisten AI belum siap dipakai. Hubungi admin untuk memeriksa pengaturan AI."
    : code === "AI_RATE_LIMITED"
      ? "Penyedia AI sedang sibuk. Coba lagi beberapa menit lagi."
      : "Asisten AI gagal menjawab. Coba lagi sebentar lagi.";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return methodNotAllowed(req);

  const { user, client } = await getUserFromRequest(req);
  if (!user || !client) return fail(req, "AUTH_REQUIRED", "Sesi tidak valid. Silakan masuk ulang.", 401);

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return fail(req, "INVALID_REQUEST", "Permintaan tidak valid.");
  }
  const action = String(body?.action || "recommend");

  const { data: settings, error: settingsError } = await client.rpc("get_assistant_settings");
  if (settingsError) return fail(req, "SETTINGS_FAILED", "Pengaturan asisten tidak dapat dibaca.", 500);
  const ai = settings?.ai || {};
  const konteks = String(ai.konteks_lembaga || "");
  const provider = resolveProvider(ai, getEnv);
  const admin = getServiceRoleClient();

  const logUsage = (row: Json) => admin.from("assistant_ai_usage").insert({
    user_id: user.id, provider: provider.id, model: provider.model, ...row,
  });

  // ===== Admin: status & uji =====
  if (action === "status" || action === "test") {
    const { data: isAdmin } = await client.rpc("is_admin");
    if (!isAdmin) return fail(req, "ADMIN_REQUIRED", "Hanya admin.", 403);
    if (action === "status") {
      const { data: usage } = await admin.rpc("assistant_ai_month_usage");
      return ok(req, {
        providers: keyStatus(getEnv),
        active: { id: provider.id, label: provider.label, model: provider.model, hasKey: provider.hasKey, price: provider.price },
        usage,
      });
    }
    try {
      const started = Date.now();
      const result = await generate(provider, {
        system: 'Balas hanya dengan JSON {"ringkasan": "...", "langkah": [{"judul": "...", "alasan": "..."}], "pesan_wali": "..."}.',
        user: "Uji koneksi. Isi ringkasan dengan kata OK.",
        schema: RESULT_SCHEMA,
      });
      await logUsage({
        fitur: "uji", status: "uji", input_tokens: result.inputTokens, output_tokens: result.outputTokens,
        biaya_usd: estimateCost(result, provider.price),
      });
      return ok(req, { ok: true, ms: Date.now() - started, model: provider.model, sample: result.text.slice(0, 200) });
    } catch (err) {
      const code = errorCode(err);
      return fail(req, code, String((err as Error)?.message || err).slice(0, 300), ERROR_STATUS[code] || 502);
    }
  }

  if (!["recommend", "class_insight", "chat"].includes(action)) return fail(req, "INVALID_REQUEST", "Aksi tidak dikenal.");
  if (!ai.enabled) return fail(req, "AI_DISABLED", "Asisten AI belum diaktifkan admin.", 403);

  // Batas harian per pengguna dan anggaran bulanan lembaga.
  const checkLimits = async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from("assistant_ai_usage").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "ok").gte("created_at", since);
    if ((count || 0) >= Number(ai.daily_limit_per_user || 40)) {
      return fail(req, "AI_DAILY_LIMIT", "Batas permintaan AI harian Anda sudah tercapai. Coba lagi besok.", 429);
    }
    const { data: usage } = await admin.rpc("assistant_ai_month_usage");
    if (Number(usage?.biaya_usd || 0) >= Number(ai.monthly_budget_usd ?? 10)) {
      return fail(req, "AI_BUDGET_EXCEEDED", "Anggaran AI bulan ini sudah habis. Hubungi admin.", 429);
    }
    return null;
  };

  // Panggil AI dan catat pemakaian; mengembalikan teks atau Response galat.
  const callAi = async (fitur: string, santriId: string | null, prompt: Json, parse: (text: string) => unknown) => {
    let tokens = { inputTokens: 0, outputTokens: 0 };
    try {
      const result = await generate(provider, prompt);
      tokens = result;
      const parsed = parse(result.text);
      await logUsage({
        fitur, santri_id: santriId, status: "ok", input_tokens: tokens.inputTokens, output_tokens: tokens.outputTokens,
        biaya_usd: estimateCost(tokens, provider.price),
      });
      return { parsed };
    } catch (err) {
      const code = errorCode(err);
      await logUsage({
        fitur, santri_id: santriId, status: "gagal", input_tokens: tokens.inputTokens, output_tokens: tokens.outputTokens,
        biaya_usd: estimateCost(tokens, provider.price), galat: `${code}: ${String((err as Error)?.message || err)}`.slice(0, 300),
      });
      return { error: fail(req, code, friendlyMessage(code), ERROR_STATUS[code] || 502) };
    }
  };

  const readClass = async (classId: string) => {
    const { data: roster, error } = await client.rpc("get_assistant_class_roster", { p_class_id: classId });
    if (error) return { error: fail(req, "CLASS_ACCESS_DENIED", "Anda tidak memiliki akses ke kelas ini.", 403) };
    const list = (roster || []) as Json[];
    if (list.length === 0) return { error: fail(req, "CLASS_EMPTY", "Belum ada santri TPQ anak di kelas ini.", 404) };
    const ids = list.map((r) => r.santri_id);
    const [{ data: snapshots }, { data: attention }] = await Promise.all([
      client.rpc("get_assistant_santri_snapshot", { p_santri_ids: ids }),
      client.rpc("get_assistant_attention", { p_class_id: classId }),
    ]);
    const items = ((attention?.items || []) as Json[]).filter((i) => ids.includes(i.santri_id));
    const masker = buildNameMasker(list);
    return { roster: list, masker, items, kelas: buildClassContext(list, snapshots || [], items, masker) };
  };

  // ===== Saran per santri =====
  if (action === "recommend") {
    const santriId = String(body?.santri_id || "");
    if (!UUID.test(santriId)) return fail(req, "INVALID_REQUEST", "Santri tidak valid.");
    const refresh = body?.refresh === true;

    const { data: attention, error: attentionError } = await client.rpc("get_assistant_attention", { p_class_id: null });
    if (attentionError) return fail(req, "ATTENTION_FAILED", "Data panel tidak dapat dibaca.", 500);
    const items = ((attention?.items || []) as Json[]).filter((item) => item.santri_id === santriId);
    if (items.length === 0) return fail(req, "NO_ALERTS", "Santri ini tidak sedang perlu perhatian.", 404);

    const [{ data: snapshots }, { data: profile }] = await Promise.all([
      client.rpc("get_assistant_santri_snapshot", { p_santri_ids: [santriId] }),
      client.rpc("get_assistant_santri_profile", { p_santri_id: santriId }),
    ]);
    const snapshot = Array.isArray(snapshots) ? snapshots.find((s: Json) => s.santri_id === santriId) : null;
    const masker = buildNameMasker(profile ? [profile] : []);
    const input = buildRecommendationInput(items, snapshot, profile, masker);
    const hash = await inputHash({ input, konteks }, provider.id, provider.model);

    if (!refresh) {
      const { data: cached } = await admin.from("assistant_ai_recommendations")
        .select("id, hasil, provider, model, created_at")
        .eq("santri_id", santriId).eq("input_hash", hash)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cached) {
        await logUsage({ fitur: "rekomendasi", santri_id: santriId, status: "cache" });
        return ok(req, { ...cached, cached: true });
      }
    }
    const limited = await checkLimits();
    if (limited) return limited;

    // Profil memakai kode S1; prompt saran memakai placeholder {nama}.
    const userPrompt = buildUserPrompt(input).replace(/\bS1\b/g, "{nama}");
    const out = await callAi("rekomendasi", santriId,
      { system: withInstitution(konteks, SYSTEM_PROMPT), user: userPrompt, schema: RESULT_SCHEMA }, parseRecommendation);
    if (out.error) return out.error;
    const hasil = out.parsed;

    const { data: saved, error: saveError } = await admin.from("assistant_ai_recommendations").insert({
      santri_id: santriId, requested_by: user.id, alert_ids: items.map((i) => i.alert_id), input_hash: hash,
      provider: provider.id, model: provider.model, hasil,
    }).select("id, hasil, provider, model, created_at").single();
    if (saveError) return ok(req, { hasil, provider: provider.id, model: provider.model, created_at: new Date().toISOString(), cached: false });
    return ok(req, { ...saved, cached: false });
  }

  // ===== Saran kelas =====
  if (action === "class_insight") {
    const classId = String(body?.class_id || "");
    if (!UUID.test(classId)) return fail(req, "INVALID_REQUEST", "Kelas tidak valid.");
    const cls = await readClass(classId);
    if (cls.error) return cls.error;

    const names = (kodeMap: Record<string, string>) => Object.fromEntries(Object.entries(kodeMap || {})
      .map(([code, id]) => [code, cls.masker.display[cls.masker.codeOf(id) || ""] || code]));

    const hash = await sha256Hex(JSON.stringify({ v: CLASS_PROMPT_VERSION, p: provider.id, m: provider.model, konteks, kelas: cls.kelas }));
    const { data: cached } = await admin.from("assistant_ai_class_insights")
      .select("id, hasil, provider, model, created_at, kode_santri, input_hash")
      .eq("class_id", classId).order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (body?.only_cached === true || (cached && cached.input_hash === hash && body?.refresh !== true)) {
      if (!cached) return ok(req, { hasil: null });
      if (body?.only_cached !== true) await logUsage({ fitur: "kelas", status: "cache" });
      const { input_hash: _h, kode_santri, ...rest } = cached;
      return ok(req, { ...rest, nama: names(kode_santri), usang: cached.input_hash !== hash, cached: true });
    }

    const limited = await checkLimits();
    if (limited) return limited;
    const codes = cls.kelas.santri.map((s: Json) => s.kode);
    const out = await callAi("kelas", null, {
      kind: "kelas",
      system: withInstitution(konteks, CLASS_SYSTEM_PROMPT),
      user: `Gambaran kelas (JSON):\n${JSON.stringify(cls.kelas)}\n\nBuat saran sesuai aturan.`,
      schema: CLASS_RESULT_SCHEMA,
    }, (text) => parseClassInsight(text, codes));
    if (out.error) return out.error;

    const kodeSantri = cls.masker.santriOf;
    const { data: saved } = await admin.from("assistant_ai_class_insights").insert({
      class_id: classId, requested_by: user.id, input_hash: hash, provider: provider.id, model: provider.model,
      hasil: out.parsed, kode_santri: kodeSantri,
    }).select("id, hasil, provider, model, created_at").single();
    return ok(req, {
      ...(saved || { hasil: out.parsed, provider: provider.id, model: provider.model, created_at: new Date().toISOString() }),
      nama: names(kodeSantri), usang: false, cached: false,
    });
  }

  // ===== Chat =====
  const message = String(body?.message || "").trim();
  if (!message || message.length > 2000) return fail(req, "INVALID_REQUEST", "Tulis pertanyaan (maksimal 2.000 karakter).");
  const classId = String(body?.class_id || "");
  if (!UUID.test(classId)) return fail(req, "INVALID_REQUEST", "Pilih kelas dulu.");
  const santriId = body?.santri_id ? String(body.santri_id) : null;
  if (santriId && !UUID.test(santriId)) return fail(req, "INVALID_REQUEST", "Santri tidak valid.");

  const cls = await readClass(classId);
  if (cls.error) return cls.error;
  if (santriId && !cls.roster.some((r) => r.santri_id === santriId)) return fail(req, "INVALID_REQUEST", "Santri bukan anggota kelas ini.");

  let conversationId = body?.conversation_id ? String(body.conversation_id) : null;
  let history: Json[] = [];
  if (conversationId) {
    if (!UUID.test(conversationId)) return fail(req, "INVALID_REQUEST", "Percakapan tidak valid.");
    const { data: conv } = await admin.from("assistant_ai_conversations").select("id, user_id")
      .eq("id", conversationId).maybeSingle();
    if (!conv || conv.user_id !== user.id) return fail(req, "NOT_FOUND", "Percakapan tidak ditemukan.", 404);
    const { data: rows } = await admin.from("assistant_ai_messages").select("role, content")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true });
    history = rows || [];
  }

  const limited = await checkLimits();
  if (limited) return limited;

  let profil = null;
  if (santriId) {
    const { data: profile } = await client.rpc("get_assistant_santri_profile", { p_santri_id: santriId });
    profil = buildProfileContext(profile, cls.masker);
  }
  const contextText = buildChatContext({ kelas: cls.kelas, profil, kodeFokus: santriId ? cls.masker.codeOf(santriId) : null });
  const messages = buildChatMessages(history, message, contextText, cls.masker);
  const out = await callAi("chat", santriId, {
    system: withInstitution(konteks, CHAT_SYSTEM_PROMPT), messages, json: false,
  }, (text) => {
    if (!String(text || "").trim()) throw new Error("AI_EMPTY_RESPONSE");
    return cls.masker.unmask(String(text).trim()).slice(0, 6000);
  });
  if (out.error) return out.error;
  const answer = out.parsed as string;

  if (!conversationId) {
    const { data: conv } = await admin.from("assistant_ai_conversations").insert({
      user_id: user.id, class_id: classId, santri_id: santriId, judul: message.slice(0, 80),
    }).select("id").single();
    conversationId = conv?.id || null;
  } else {
    await admin.from("assistant_ai_conversations").update({ updated_at: new Date().toISOString(), santri_id: santriId, class_id: classId })
      .eq("id", conversationId);
  }
  if (conversationId) {
    await admin.from("assistant_ai_messages").insert([
      { conversation_id: conversationId, role: "user", content: message },
      { conversation_id: conversationId, role: "assistant", content: answer },
    ]);
  }
  return ok(req, { conversation_id: conversationId, answer, provider: provider.id, model: provider.model });
});
