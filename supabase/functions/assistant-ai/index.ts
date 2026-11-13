// Asisten AI LPQ.
//
// recommend (guru/admin)    : saran untuk satu santri di panel "Perlu Perhatian".
// class_insight (guru/admin): saran menyeluruh satu kelas. only_cached=true hanya membaca simpanan.
// chat (guru/admin)         : konsultasi guru tentang kelas/santri; riwayat tersimpan per pengguna.
// report (guru/admin)       : draf rapor bulanan untuk wali satu santri.
// status, test (admin)      : status kunci & pemakaian, uji koneksi.
// weekly_digest (pg_cron)   : ringkasan kelas pekanan ke Telegram guru; memakai header x-dispatch-secret.
//
// Data dibaca dengan sesi pengguna (RLS & mode senyap berlaku), nama santri disamarkan menjadi kode
// S1, S2, ... sebelum dikirim ke penyedia AI, dan dikembalikan menjadi nama hanya di jawaban.
import { getUserFromRequest } from "../_shared/auth.ts";
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { handleOptions } from "../_shared/cors.ts";
import { fail, methodNotAllowed, ok } from "../_shared/response.ts";
import { safeEqual } from "../_shared/telegram.ts";
import {
  buildUserPrompt, estimateCost, inputHash, parseRecommendation, RESULT_SCHEMA, sha256Hex, SYSTEM_PROMPT,
} from "../_shared/aiAssistant.js";
import {
  buildClassContext, buildNameMasker, buildRecommendationInput,
  CLASS_PROMPT_VERSION, CLASS_RESULT_SCHEMA, CLASS_SYSTEM_PROMPT, formatWeeklyDigest, parseClassInsight,
  parseReport, REPORT_PROMPT_VERSION, REPORT_SCHEMA, REPORT_SYSTEM_PROMPT, selectKnowledge, withKnowledge,
} from "../_shared/aiContext.js";
import { generate, keyStatus, resolveProvider } from "../_shared/aiProviders.js";
import {
  ChatError, ERROR_STATUS, errorCode, friendlyMessage, loadKnowledge, monthUsageExceeded, runChatTurn, usageLimit,
} from "../_shared/aiChatCore.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getEnv = (name: string) => Deno.env.get(name);
type Json = Record<string, any>;

const jakartaDate = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

// Hasilkan saran kelas dari data mentah (roster, snapshot, perkara). Dipakai aksi class_insight dan
// ringkasan pekanan.
const generateClassInsight = async (opts: {
  provider: Json; konteks: string; knowledge: Json[]; roster: Json[]; snapshots: Json[]; items: Json[];
}) => {
  const masker = buildNameMasker(opts.roster);
  const kelas = buildClassContext(opts.roster, opts.snapshots, opts.items, masker);
  const jilids = [...new Set(kelas.santri.map((s: Json) => s.jilid).filter(Boolean))].join(" ");
  const pustaka = selectKnowledge(opts.knowledge, `kelas ${jilids} hafalan kehadiran motivasi`);
  const result = await generate(opts.provider, {
    kind: "kelas",
    system: withKnowledge(opts.konteks, pustaka, CLASS_SYSTEM_PROMPT),
    user: `Gambaran kelas (JSON):\n${JSON.stringify(kelas)}\n\nBuat saran sesuai aturan.`,
    schema: CLASS_RESULT_SCHEMA,
  });
  const hasil = parseClassInsight(result.text, kelas.santri.map((s: Json) => s.kode));
  return { hasil, masker, kelas, tokens: result };
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return methodNotAllowed(req);

  // ===== Ringkasan pekanan (pg_cron) =====
  if (req.headers.get("x-dispatch-secret")) {
    if (!safeEqual(req.headers.get("x-dispatch-secret"), Deno.env.get("TELEGRAM_DISPATCH_SECRET"))) {
      return new Response(JSON.stringify({ ok: false }), { status: 403 });
    }
    return await weeklyDigest();
  }

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

  if (!["recommend", "class_insight", "chat", "report"].includes(action)) return fail(req, "INVALID_REQUEST", "Aksi tidak dikenal.");
  if (!ai.enabled) return fail(req, "AI_DISABLED", "Asisten AI belum diaktifkan admin.", 403);

  const knowledge = await loadKnowledge(admin);

  // Batas harian per pengguna dan anggaran bulanan lembaga.
  const checkLimits = async () => {
    const code = await usageLimit(admin, ai, user.id);
    return code ? fail(req, code, friendlyMessage(code), 429) : null;
  };

  // Panggil AI dan catat pemakaian; mengembalikan hasil parse atau Response galat.
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
    return { roster: list, snapshots: (snapshots || []) as Json[], masker, items, kelas: buildClassContext(list, snapshots || [], items, masker) };
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
    const pustaka = selectKnowledge(knowledge, `${snapshot?.jilid || ""} ${items.map((i) => i.rule).join(" ")} hafalan jilid kehadiran`);
    const hash = await inputHash({ input, konteks, pustaka }, provider.id, provider.model);

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
      { system: withKnowledge(konteks, pustaka, SYSTEM_PROMPT), user: userPrompt, schema: RESULT_SCHEMA }, parseRecommendation);
    if (out.error) return out.error;
    const hasil = out.parsed;

    const { data: saved, error: saveError } = await admin.from("assistant_ai_recommendations").insert({
      santri_id: santriId, requested_by: user.id, alert_ids: items.map((i) => i.alert_id), input_hash: hash,
      provider: provider.id, model: provider.model, hasil,
    }).select("id, hasil, provider, model, created_at").single();
    if (saveError) return ok(req, { hasil, provider: provider.id, model: provider.model, created_at: new Date().toISOString(), cached: false });
    return ok(req, { ...saved, cached: false });
  }

  // ===== Rapor wali =====
  if (action === "report") {
    const santriId = String(body?.santri_id || "");
    if (!UUID.test(santriId)) return fail(req, "INVALID_REQUEST", "Santri tidak valid.");
    const [{ data: profile, error: profileError }, { data: snapshots }] = await Promise.all([
      client.rpc("get_assistant_santri_profile", { p_santri_id: santriId }),
      client.rpc("get_assistant_santri_snapshot", { p_santri_ids: [santriId] }),
    ]);
    if (profileError) return fail(req, "CLASS_ACCESS_DENIED", "Anda tidak memiliki akses ke santri ini.", 403);
    if (!profile) return fail(req, "NOT_FOUND", "Data santri tidak tersedia.", 404);
    const snapshot = Array.isArray(snapshots) ? snapshots.find((s: Json) => s.santri_id === santriId) : null;
    const masker = buildNameMasker([profile]);
    const { perkara: _p, santri: _s, ...data } = buildRecommendationInput([], snapshot, profile, masker);
    const input = { bulan: jakartaDate().slice(0, 7), ...data };
    const pustaka = selectKnowledge(knowledge, `${profile.jilid || ""} rapor wali orang tua rumah`);
    const bulan = input.bulan;
    const hash = await sha256Hex(JSON.stringify({ v: REPORT_PROMPT_VERSION, p: provider.id, m: provider.model, konteks, pustaka, input }));

    if (body?.refresh !== true) {
      const { data: cached } = await admin.from("assistant_ai_reports").select("id, hasil, provider, model, created_at, bulan")
        .eq("santri_id", santriId).eq("input_hash", hash).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cached) {
        await logUsage({ fitur: "rapor", santri_id: santriId, status: "cache" });
        return ok(req, { ...cached, cached: true });
      }
    }
    const limited = await checkLimits();
    if (limited) return limited;
    const out = await callAi("rapor", santriId, {
      kind: "rapor",
      system: withKnowledge(konteks, pustaka, REPORT_SYSTEM_PROMPT),
      user: `Data santri bulan ${bulan} (JSON):\n${JSON.stringify(input).replace(/\bS1\b/g, "{nama}")}\n\nSusun rapor sesuai aturan.`,
      schema: REPORT_SCHEMA,
    }, parseReport);
    if (out.error) return out.error;
    const { data: saved } = await admin.from("assistant_ai_reports").insert({
      santri_id: santriId, bulan, requested_by: user.id, input_hash: hash, provider: provider.id, model: provider.model, hasil: out.parsed,
    }).select("id, hasil, provider, model, created_at, bulan").single();
    return ok(req, { ...(saved || { hasil: out.parsed, provider: provider.id, model: provider.model, created_at: new Date().toISOString(), bulan }), cached: false });
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
    let generated;
    try {
      generated = await generateClassInsight({ provider, konteks, knowledge, roster: cls.roster, snapshots: cls.snapshots, items: cls.items });
    } catch (err) {
      const code = errorCode(err);
      await logUsage({ fitur: "kelas", status: "gagal", galat: `${code}: ${String((err as Error)?.message || err)}`.slice(0, 300) });
      return fail(req, code, friendlyMessage(code), ERROR_STATUS[code] || 502);
    }
    await logUsage({
      fitur: "kelas", status: "ok", input_tokens: generated.tokens.inputTokens, output_tokens: generated.tokens.outputTokens,
      biaya_usd: estimateCost(generated.tokens, provider.price),
    });
    const kodeSantri = cls.masker.santriOf;
    const { data: saved } = await admin.from("assistant_ai_class_insights").insert({
      class_id: classId, requested_by: user.id, input_hash: hash, provider: provider.id, model: provider.model,
      hasil: generated.hasil, kode_santri: kodeSantri,
    }).select("id, hasil, provider, model, created_at").single();
    return ok(req, {
      ...(saved || { hasil: generated.hasil, provider: provider.id, model: provider.model, created_at: new Date().toISOString() }),
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
  const conversationId = body?.conversation_id ? String(body.conversation_id) : null;
  if (conversationId && !UUID.test(conversationId)) return fail(req, "INVALID_REQUEST", "Percakapan tidak valid.");

  let profile = null;
  if (santriId) {
    const { data } = await client.rpc("get_assistant_santri_profile", { p_santri_id: santriId });
    profile = data;
  }
  try {
    const turn = await runChatTurn({
      admin, provider, ai, knowledge, userId: user.id, classId, roster: cls.roster, snapshots: cls.snapshots, items: cls.items,
      santriId, profile, conversationId, message, sumber: "dasbor",
    });
    return ok(req, {
      conversation_id: turn.conversationId, answer: turn.answer, provider: provider.id, model: provider.model,
      user_message_id: turn.userMessageId, message_id: turn.messageId,
    });
  } catch (err) {
    const code = err instanceof ChatError ? err.code : "AI_PROVIDER_ERROR";
    return fail(req, code, err instanceof ChatError ? err.message : friendlyMessage(code), ERROR_STATUS[code] || 502);
  }
});

// Ringkasan kelas pekanan untuk setiap guru yang menyambungkan Telegram. Dipanggil pg_cron Senin pagi.
async function weeklyDigest(): Promise<Response> {
  const admin = getServiceRoleClient();
  const json = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const { data: targets, error } = await admin.rpc("assistant_ai_digest_targets");
  if (error) return json({ ok: false, error: "TARGETS_FAILED" }, 500);
  const list = (targets || []) as Json[];
  if (list.length === 0) return json({ ok: true, sent: 0 });

  const { data: settingsRow } = await admin.from("assistant_settings").select("settings").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const ai = settingsRow?.settings?.ai || {};
  const dashboardUrl = settingsRow?.settings?.notifications?.dashboard_url || null;
  const provider = resolveProvider(ai, getEnv);
  const knowledge = await loadKnowledge(admin);
  const tanggal = jakartaDate().split("-").reverse().join("-");
  let queued = 0;
  let failed = 0;

  for (const target of list) {
    if (await monthUsageExceeded(admin, ai)) break;
    const { data: payload, error: dataError } = await admin.rpc("assistant_ai_class_data_as", { p_user: target.user_id, p_class: target.class_id });
    if (dataError || !payload || !(payload.roster || []).length) continue;
    try {
      const generated = await generateClassInsight({
        provider, konteks: String(payload.konteks || ""), knowledge,
        roster: payload.roster, snapshots: payload.snapshots || [], items: payload.items || [],
      });
      await admin.from("assistant_ai_usage").insert({
        user_id: target.user_id, fitur: "kelas_pekanan", provider: provider.id, model: provider.model, status: "ok",
        input_tokens: generated.tokens.inputTokens, output_tokens: generated.tokens.outputTokens, biaya_usd: estimateCost(generated.tokens, provider.price),
      });
      const hash = await sha256Hex(JSON.stringify({ v: CLASS_PROMPT_VERSION, p: provider.id, m: provider.model, konteks: payload.konteks, kelas: generated.kelas }));
      await admin.from("assistant_ai_class_insights").insert({
        class_id: target.class_id, requested_by: target.user_id, input_hash: hash, provider: provider.id, model: provider.model,
        hasil: generated.hasil, kode_santri: generated.masker.santriOf,
      });
      const { error: outboxError } = await admin.from("assistant_telegram_outbox").insert({
        user_id: target.user_id, jenis: "pekanan", alert_ids: [],
        pesan: formatWeeklyDigest(generated.hasil, target.nama_kelas, generated.masker.display, tanggal),
        tautan: dashboardUrl, dedupe_key: `pekanan:${jakartaDate()}:${target.class_id}`,
      });
      if (!outboxError) queued += 1;
    } catch (err) {
      failed += 1;
      await admin.from("assistant_ai_usage").insert({
        user_id: target.user_id, fitur: "kelas_pekanan", provider: provider.id, model: provider.model, status: "gagal",
        galat: `${errorCode(err)}: ${String((err as Error)?.message || err)}`.slice(0, 300),
      });
    }
  }
  return json({ ok: true, queued, failed });
}
