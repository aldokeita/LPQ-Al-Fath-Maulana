// Rekomendasi AI asisten untuk satu santri di panel "Perlu Perhatian".
//
// action "recommend" (guru/admin): baca data panel dengan sesi pengguna (RLS & mode senyap tetap
//   berlaku), samarkan, cek cache dan anggaran, panggil penyedia AI terpilih, simpan hasil.
// action "status" (admin): penyedia mana yang kuncinya sudah terpasang + pemakaian bulan ini.
// action "test" (admin): panggilan kecil untuk memastikan kunci dan model bekerja.
import { getUserFromRequest } from "../_shared/auth.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { handleOptions } from "../_shared/cors.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import {
  buildAnonymizedInput, buildUserPrompt, estimateCost, inputHash, parseRecommendation, RESULT_SCHEMA, SYSTEM_PROMPT,
} from "../_shared/aiAssistant.js";
import { AiProviderError, generate, keyStatus, resolveProvider } from "../_shared/aiProviders.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getEnv = (name: string) => Deno.env.get(name);

const ERROR_STATUS: Record<string, number> = {
  AI_KEY_MISSING: 503, AI_MODEL_MISSING: 503, AI_BASE_URL_MISSING: 503,
  AI_KEY_REJECTED: 502, AI_RATE_LIMITED: 429, AI_PROVIDER_ERROR: 502, AI_REFUSED: 422,
  AI_INVALID_JSON: 502, AI_EMPTY_RESPONSE: 502,
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return methodNotAllowed(req);

  const { user, client } = await getUserFromRequest(req);
  if (!user || !client) return fail(req, "AUTH_REQUIRED", "Sesi tidak valid. Silakan masuk ulang.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(req, "INVALID_REQUEST", "Permintaan tidak valid.");
  }
  const action = String(body?.action || "recommend");

  const { data: settings, error: settingsError } = await client.rpc("get_assistant_settings");
  if (settingsError) return fail(req, "SETTINGS_FAILED", "Pengaturan asisten tidak dapat dibaca.", 500);
  const ai = settings?.ai || {};
  const provider = resolveProvider(ai, getEnv);
  const admin = getServiceRoleClient();

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
      const biaya = estimateCost(result, provider.price);
      await admin.from("assistant_ai_usage").insert({
        user_id: user.id, fitur: "uji", provider: provider.id, model: provider.model, status: "uji",
        input_tokens: result.inputTokens, output_tokens: result.outputTokens, biaya_usd: biaya,
      });
      return ok(req, { ok: true, ms: Date.now() - started, model: provider.model, sample: result.text.slice(0, 200) });
    } catch (err) {
      const code = err instanceof AiProviderError ? err.code : "AI_PROVIDER_ERROR";
      return fail(req, code, String((err as Error)?.message || err).slice(0, 300), ERROR_STATUS[code] || 502);
    }
  }

  if (action !== "recommend") return fail(req, "INVALID_REQUEST", "Aksi tidak dikenal.");
  if (!ai.enabled) return fail(req, "AI_DISABLED", "Rekomendasi AI belum diaktifkan admin.", 403);

  const santriId = String(body?.santri_id || "");
  if (!UUID.test(santriId)) return fail(req, "INVALID_REQUEST", "Santri tidak valid.");
  const refresh = body?.refresh === true;

  // Data diambil sebagai pengguna: guru hanya kelasnya, kosong saat mode senyap.
  const { data: attention, error: attentionError } = await client.rpc("get_assistant_attention", { p_class_id: null });
  if (attentionError) return fail(req, "ATTENTION_FAILED", "Data panel tidak dapat dibaca.", 500);
  const items = ((attention?.items || []) as Array<Record<string, unknown>>).filter((item) => item.santri_id === santriId);
  if (items.length === 0) return fail(req, "NO_ALERTS", "Santri ini tidak sedang perlu perhatian.", 404);

  const { data: snapshots } = await client.rpc("get_assistant_santri_snapshot", { p_santri_ids: [santriId] });
  const snapshot = Array.isArray(snapshots) ? snapshots.find((s: Record<string, unknown>) => s.santri_id === santriId) : null;

  const input = buildAnonymizedInput(items, snapshot);
  const hash = await inputHash(input, provider.id, provider.model);
  const alertIds = items.map((item) => item.alert_id);

  const logUsage = (row: Record<string, unknown>) => admin.from("assistant_ai_usage").insert({
    user_id: user.id, santri_id: santriId, fitur: "rekomendasi", provider: provider.id, model: provider.model, ...row,
  });

  if (!refresh) {
    const { data: cached } = await admin.from("assistant_ai_recommendations")
      .select("id, hasil, provider, model, created_at")
      .eq("santri_id", santriId).eq("input_hash", hash)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (cached) {
      await logUsage({ status: "cache" });
      return ok(req, { ...cached, cached: true });
    }
  }

  // Batas harian per pengguna dan anggaran bulanan lembaga.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("assistant_ai_usage").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("status", "ok").gte("created_at", since);
  if ((count || 0) >= Number(ai.daily_limit_per_user || 40)) {
    return fail(req, "AI_DAILY_LIMIT", "Batas permintaan AI harian Anda sudah tercapai. Coba lagi besok.", 429);
  }
  const { data: usage } = await admin.rpc("assistant_ai_month_usage");
  const budget = Number(ai.monthly_budget_usd ?? 10);
  if (Number(usage?.biaya_usd || 0) >= budget) {
    return fail(req, "AI_BUDGET_EXCEEDED", "Anggaran AI bulan ini sudah habis. Hubungi admin.", 429);
  }

  let hasil;
  let tokens = { inputTokens: 0, outputTokens: 0 };
  try {
    const result = await generate(provider, { system: SYSTEM_PROMPT, user: buildUserPrompt(input), schema: RESULT_SCHEMA });
    tokens = result;
    hasil = parseRecommendation(result.text);
  } catch (err) {
    const code = err instanceof AiProviderError ? err.code : String((err as Error)?.message || "").startsWith("AI_")
      ? String((err as Error).message) : "AI_PROVIDER_ERROR";
    await logUsage({
      status: "gagal", input_tokens: tokens.inputTokens, output_tokens: tokens.outputTokens,
      biaya_usd: estimateCost(tokens, provider.price), galat: `${code}: ${String((err as Error)?.message || err)}`.slice(0, 300),
    });
    const message = ["AI_KEY_MISSING", "AI_MODEL_MISSING", "AI_BASE_URL_MISSING", "AI_KEY_REJECTED"].includes(code)
      ? "Asisten AI belum siap dipakai. Hubungi admin untuk memeriksa pengaturan AI."
      : code === "AI_RATE_LIMITED"
        ? "Penyedia AI sedang sibuk. Coba lagi beberapa menit lagi."
        : "Saran AI gagal dibuat. Coba lagi sebentar lagi.";
    return fail(req, code, message, ERROR_STATUS[code] || 502);
  }

  const { data: saved, error: saveError } = await admin.from("assistant_ai_recommendations").insert({
    santri_id: santriId, requested_by: user.id, alert_ids: alertIds, input_hash: hash,
    provider: provider.id, model: provider.model, hasil,
  }).select("id, hasil, provider, model, created_at").single();
  await logUsage({
    status: "ok", input_tokens: tokens.inputTokens, output_tokens: tokens.outputTokens,
    biaya_usd: estimateCost(tokens, provider.price),
  });
  if (saveError) return ok(req, { hasil, provider: provider.id, model: provider.model, created_at: new Date().toISOString(), cached: false });
  return ok(req, { ...saved, cached: false });
});
