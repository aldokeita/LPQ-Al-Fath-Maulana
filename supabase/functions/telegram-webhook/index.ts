// Menerima pembaruan dari Telegram (chat pribadi saja).
// - /start <token> dan /stop: menyambungkan dan memutus akun.
// - Pesan teks dari guru yang tersambung: pertanyaan untuk asisten AI (sama dengan "Tanya asisten" di dasbor).
// - /kelas, /santri, /semua, /baru, /status, /bantuan: mengatur percakapan.
// - Tombol (callback_query): memilih kelas/santri dan menilai jawaban 👍/👎.
// Permintaan dengan x-dispatch-secret {"action":"daftar_ulang"} memperbarui pendaftaran webhook di Telegram.
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { type InlineButton, safeEqual, sendTelegramMessage, telegramApi } from "../_shared/telegram.ts";
import { findSantri, santriShortName, splitTelegram, toTelegramHtml } from "../_shared/aiContext.js";
import { resolveProvider } from "../_shared/aiProviders.js";
import { ChatError, friendlyMessage, type Json, loadKnowledge, runChatTurn } from "../_shared/aiChatCore.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

// deno-lint-ignore no-explicit-any
type Db = any;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const done = () => new Response("ok", { status: 200 });
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const reply = async (chatId: number, text: string, opts: { html?: boolean; keyboard?: InlineButton[][] } = {}) => {
  try {
    await sendTelegramMessage(chatId, text, opts);
  } catch {
    // Balasan gagal tidak boleh membuat Telegram mengulang pembaruan yang sama.
  }
};

// Proses di latar belakang agar Telegram segera mendapat 200 (jawaban AI bisa butuh beberapa detik).
const inBackground = async (work: Promise<unknown>) => {
  const safe = work.catch((err) => console.error("telegram-webhook:", String((err as Error)?.message || err)));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(safe);
  else await safe;
};

const HELP =
  "<b>Asisten AI LPQ</b>\n" +
  "Ketik pertanyaan langsung, misalnya: <i>Siapa yang perlu saya dampingi pekan ini?</i>\n\n" +
  "/santri Bilal — bahas satu santri (atau /santri saja untuk memilih)\n" +
  "/semua — kembali membahas seluruh kelas\n" +
  "/kelas — ganti kelas\n" +
  "/baru — mulai percakapan baru\n" +
  "/status — kelas dan santri yang sedang dibahas\n" +
  "/stop — putuskan Telegram dari akun\n\n" +
  "Nama santri tidak dikirim ke penyedia AI. Riwayat juga tampil di dasbor, bagian Tanya asisten.";

const loadContext = (db: Db, chatId: number, classId: string | null = null, santriId: string | null = null) =>
  db.rpc("assistant_ai_telegram_data", { p_chat_id: chatId, p_class: classId, p_santri: santriId })
    .then(({ data, error }: { data: Json | null; error: unknown }) => (error ? null : data));

const saveState = (db: Db, userId: string, patch: Json) =>
  db.from("assistant_ai_telegram_state").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });

const className = (ctx: Json) => (ctx.classes || []).find((c: Json) => c.id === ctx.class_id)?.nama_kelas || "-";
const santriOf = (ctx: Json, id: string | null) => (ctx.roster || []).find((r: Json) => r.santri_id === id) || null;
const focusLine = (ctx: Json, santriId: string | null) => {
  const s = santriOf(ctx, santriId);
  return `${esc(className(ctx))} · ${s ? esc(santriShortName(s)) : "seluruh kelas"}`;
};

const feedbackKeyboard = (messageId: string, nilai = 0): InlineButton[][] => [[
  { text: nilai === 1 ? "👍 Bermanfaat ✓" : "👍 Bermanfaat", callback_data: `f:${messageId}:1` },
  { text: nilai === -1 ? "👎 Kurang tepat ✓" : "👎 Kurang tepat", callback_data: `f:${messageId}:-1` },
]];

const pairs = (buttons: InlineButton[]) => buttons.reduce<InlineButton[][]>((rows, b, i) => {
  if (i % 2 === 0) rows.push([b]); else rows[rows.length - 1].push(b);
  return rows;
}, []);

const santriKeyboard = (list: Json[]) => [
  ...pairs(list.slice(0, 40).map((r) => ({ text: String(r.nama_lengkap || santriShortName(r)).slice(0, 40), callback_data: `s:${r.santri_id}` }))),
  [{ text: "Seluruh kelas", callback_data: "s:all" }],
];

// Pesan tidak bisa dijawab AI: belum tersambung, AI mati, atau tidak ada kelas.
const blockedReason = (ctx: Json | null) => {
  if (!ctx) return "Akun Telegram ini belum tersambung. Tekan \"Sambungkan Telegram\" di dasbor LPQ.";
  if (!ctx.ai?.enabled) return "Asisten AI belum diaktifkan admin.";
  if (!(ctx.classes || []).length) {
    return ctx.silent ? "Asisten sedang dalam mode senyap; tanya jawab AI belum dibuka." : "Belum ada kelas TPQ anak yang bisa dibahas.";
  }
  return null;
};

async function handleMessage(db: Db, chatId: number, text: string) {
  const command = text.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  const name = command?.[1]?.toLowerCase() || null;
  const arg = String(command?.[2] || "").trim();

  if (name === "bantuan" || name === "help") {
    await reply(chatId, HELP, { html: true });
    return;
  }

  const ctx = await loadContext(db, chatId);
  const blocked = blockedReason(ctx);
  if (blocked) {
    await reply(chatId, blocked);
    return;
  }

  if (name === "kelas") {
    const classes = ctx.classes as Json[];
    if (classes.length === 1) {
      await reply(chatId, `Kelas Anda: <b>${esc(classes[0].nama_kelas)}</b>.`, { html: true });
      return;
    }
    await reply(chatId, `Kelas aktif: <b>${esc(className(ctx))}</b>. Pilih kelas:`, {
      html: true, keyboard: classes.map((c) => [{ text: String(c.nama_kelas).slice(0, 60), callback_data: `k:${c.id}` }]),
    });
    return;
  }

  if (name === "santri") {
    const roster = ctx.roster as Json[];
    if (!arg) {
      await reply(chatId, `Pilih santri ${esc(className(ctx))} yang ingin dibahas:`, { html: true, keyboard: santriKeyboard(roster) });
      return;
    }
    const found = findSantri(roster, arg);
    if (found.length === 1) {
      await saveState(db, ctx.user_id, { class_id: ctx.class_id, santri_id: found[0].santri_id, conversation_id: null });
      await reply(chatId, `Sekarang membahas <b>${esc(santriShortName(found[0]))}</b> (${esc(className(ctx))}). Silakan kirim pertanyaan.`, { html: true });
    } else if (found.length > 1) {
      await reply(chatId, "Ada beberapa santri yang cocok. Pilih salah satu:", { keyboard: santriKeyboard(found) });
    } else {
      await reply(chatId, `Santri "${arg.slice(0, 40)}" tidak ditemukan di ${className(ctx)}. Kirim /santri untuk melihat daftar.`);
    }
    return;
  }

  if (name === "semua") {
    await saveState(db, ctx.user_id, { class_id: ctx.class_id, santri_id: null, conversation_id: null });
    await reply(chatId, `Sekarang membahas seluruh <b>${esc(className(ctx))}</b>.`, { html: true });
    return;
  }

  if (name === "baru") {
    await saveState(db, ctx.user_id, { class_id: ctx.class_id, santri_id: ctx.santri_id, conversation_id: null });
    await reply(chatId, `Percakapan baru dimulai · ${focusLine(ctx, ctx.santri_id)}.`, { html: true });
    return;
  }

  if (name === "status") {
    await reply(chatId, `Sedang membahas: ${focusLine(ctx, ctx.santri_id)}.\nGanti dengan /kelas, /santri, atau /semua.`, { html: true });
    return;
  }

  if (name) {
    await reply(chatId, HELP, { html: true });
    return;
  }

  // ===== Pertanyaan untuk asisten =====
  if (text.length > 2000) {
    await reply(chatId, "Pertanyaan terlalu panjang (maksimal 2.000 karakter).");
    return;
  }
  await telegramApi("sendChatAction", { chat_id: chatId, action: "typing" });

  const ai = ctx.ai as Json;
  const provider = resolveProvider(ai, (key: string) => Deno.env.get(key));
  const knowledge = await loadKnowledge(db);
  const ask = (conversationId: string | null) => runChatTurn({
    admin: db, provider, ai, knowledge, userId: ctx.user_id, classId: ctx.class_id,
    roster: ctx.roster || [], snapshots: ctx.snapshots || [], items: ctx.items || [],
    santriId: ctx.santri_id, profile: ctx.profile, conversationId, message: text, sumber: "telegram", fitur: "telegram",
  });

  let turn;
  try {
    try {
      turn = await ask(ctx.conversation_id || null);
    } catch (err) {
      // Percakapan sudah dihapus dari dasbor: mulai yang baru.
      if (err instanceof ChatError && err.code === "NOT_FOUND") turn = await ask(null);
      else throw err;
    }
  } catch (err) {
    await reply(chatId, err instanceof ChatError ? err.message : friendlyMessage("AI_PROVIDER_ERROR"));
    return;
  }

  await saveState(db, ctx.user_id, { class_id: ctx.class_id, santri_id: ctx.santri_id, conversation_id: turn.conversationId });
  const parts = splitTelegram(`<i>${focusLine(ctx, ctx.santri_id)}</i>\n\n${toTelegramHtml(turn.answer)}`);
  for (let i = 0; i < parts.length; i += 1) {
    const last = i === parts.length - 1;
    await reply(chatId, parts[i], { html: true, keyboard: last && turn.messageId ? feedbackKeyboard(turn.messageId) : undefined });
  }
}

async function handleCallback(db: Db, query: Json) {
  const chatId = Number(query?.message?.chat?.id);
  const messageId = query?.message?.message_id;
  const data = String(query?.data || "");
  const answer = (text: string) => telegramApi("answerCallbackQuery", { callback_query_id: query.id, text: text.slice(0, 190) });
  if (!Number.isFinite(chatId) || query?.message?.chat?.type !== "private") {
    await answer("");
    return;
  }

  const [kind, id, value] = data.split(":");
  const ctx = await loadContext(db, chatId, kind === "k" && UUID.test(id) ? id : null);
  const blocked = blockedReason(ctx);
  if (blocked) {
    await answer(blocked);
    return;
  }

  if (kind === "k") {
    if (ctx.class_id !== id) {
      await answer("Kelas tidak tersedia.");
      return;
    }
    await saveState(db, ctx.user_id, { class_id: id, santri_id: null, conversation_id: null });
    await answer(`Kelas: ${className(ctx)}`);
    await telegramApi("editMessageText", {
      chat_id: chatId, message_id: messageId, parse_mode: "HTML",
      text: `Kelas aktif: <b>${esc(className(ctx))}</b>. Kirim pertanyaan, atau /santri untuk memilih santri.`,
    });
    return;
  }

  if (kind === "s") {
    const santri = id === "all" ? null : santriOf(ctx, id);
    if (id !== "all" && !santri) {
      await answer("Santri tidak ditemukan di kelas aktif.");
      return;
    }
    await saveState(db, ctx.user_id, { class_id: ctx.class_id, santri_id: santri?.santri_id || null, conversation_id: null });
    const label = santri ? santriShortName(santri) : "seluruh kelas";
    await answer(`Membahas ${label}`);
    await telegramApi("editMessageText", {
      chat_id: chatId, message_id: messageId, parse_mode: "HTML",
      text: `Sekarang membahas <b>${esc(label)}</b> (${esc(className(ctx))}). Silakan kirim pertanyaan.`,
    });
    return;
  }

  if (kind === "f" && UUID.test(id) && (value === "1" || value === "-1")) {
    const { data: msg } = await db.from("assistant_ai_messages")
      .select("id, role, assistant_ai_conversations!inner(user_id)").eq("id", id).maybeSingle();
    if (!msg || msg.role !== "assistant" || msg.assistant_ai_conversations?.user_id !== ctx.user_id) {
      await answer("Jawaban tidak ditemukan.");
      return;
    }
    const nilai = Number(value);
    const { error } = await db.from("assistant_ai_feedback").upsert({
      user_id: ctx.user_id, jenis: "chat", target_id: id, nilai, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,jenis,target_id" });
    if (error) {
      await answer("Penilaian gagal disimpan. Coba lagi.");
      return;
    }
    await answer(nilai > 0 ? "Terima kasih, ditandai bermanfaat." : "Terima kasih, masukan Anda tercatat.");
    await telegramApi("editMessageReplyMarkup", {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: feedbackKeyboard(id, nilai) },
    });
    return;
  }

  await answer("");
}

async function registerWebhook(): Promise<Response> {
  const base = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!base || !secret) return new Response(JSON.stringify({ ok: false, error: "CONFIG_MISSING" }), { status: 500 });
  const result = await telegramApi("setWebhook", {
    url: `${base.replace(/\/$/, "")}/functions/v1/telegram-webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  });
  return new Response(JSON.stringify({ ok: result.ok, description: result.data?.description || null }), {
    status: result.ok ? 200 : 502, headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  if (req.headers.get("x-dispatch-secret")) {
    if (!safeEqual(req.headers.get("x-dispatch-secret"), Deno.env.get("TELEGRAM_DISPATCH_SECRET"))) {
      return new Response("forbidden", { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    return body?.action === "daftar_ulang" ? await registerWebhook() : new Response("unknown action", { status: 400 });
  }

  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), Deno.env.get("TELEGRAM_WEBHOOK_SECRET"))) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await req.json().catch(() => null);
  if (!update) return done();
  const db = getServiceRoleClient();

  // Telegram mengirim ulang bila balasan terlambat; setiap update_id hanya diproses sekali.
  const updateId = Number(update.update_id);
  if (Number.isFinite(updateId)) {
    const { error } = await db.from("assistant_telegram_updates").insert({ update_id: updateId });
    if (error?.code === "23505") return done();
    if (updateId % 100 === 0) {
      await db.from("assistant_telegram_updates").delete().lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    }
  }

  if (update.callback_query) {
    await inBackground(handleCallback(db, update.callback_query));
    return done();
  }

  const message = update.message;
  const chatId = Number(message?.chat?.id);
  const text = String(message?.text || "").trim();
  if (!message || !Number.isFinite(chatId)) return done();
  if (message.chat?.type !== "private") return done();

  if (text === "/stop") {
    await db.rpc("telegram_stop", { p_chat_id: chatId });
    await reply(chatId, "Telegram diputus dari akun asisten LPQ: notifikasi dan tanya jawab AI berhenti. Sambungkan lagi kapan saja dari dasbor.");
    return done();
  }

  const start = text.match(/^\/start(?:\s+([a-f0-9]{36}))?$/);
  if (start) {
    if (!start[1]) {
      await reply(chatId, "Untuk menyambungkan akun, tekan tombol \"Sambungkan Telegram\" di dasbor LPQ.");
      return done();
    }
    const { data, error } = await db.rpc("telegram_consume_link_token", { p_token: start[1], p_chat_id: chatId });
    if (error || !data?.ok) {
      await reply(chatId, "Tautan sudah kedaluwarsa atau sudah dipakai. Buat tautan baru dari dasbor.");
      return done();
    }
    await reply(chatId,
      `Assalamu'alaikum, ${data.nama}. Akun Anda tersambung dengan asisten LPQ Al-Fath Maulana.\n\n` +
      "Anda akan menerima ringkasan santri yang perlu perhatian dan peringatan prioritas tinggi. " +
      "Anda juga bisa langsung bertanya ke asisten AI di sini; kirim /bantuan untuk caranya. Kirim /stop untuk berhenti.");
    return done();
  }

  if (!text) {
    await reply(chatId, "Kirim pertanyaan dalam bentuk teks, atau /bantuan untuk melihat perintah.");
    return done();
  }

  await inBackground(handleMessage(db, chatId, text));
  return done();
});
