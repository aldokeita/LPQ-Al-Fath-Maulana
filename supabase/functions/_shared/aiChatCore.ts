// Inti asisten AI yang dipakai bersama oleh assistant-ai (dasbor) dan telegram-webhook (bot).
// Data kelas/santri sudah dibaca sesuai hak pengguna oleh pemanggil; di sini nama disamarkan,
// AI dipanggil, pemakaian dicatat, dan percakapan disimpan.
import {
  buildChatContext, buildChatMessages, buildClassContext, buildNameMasker, buildProfileContext, CHAT_SYSTEM_PROMPT,
  selectKnowledge, withKnowledge,
} from "./aiContext.js";
import { estimateCost } from "./aiAssistant.js";
import { AiProviderError, generate } from "./aiProviders.js";

// deno-lint-ignore no-explicit-any
export type Json = Record<string, any>;

export const ERROR_STATUS: Record<string, number> = {
  AI_KEY_MISSING: 503, AI_MODEL_MISSING: 503, AI_BASE_URL_MISSING: 503,
  AI_KEY_REJECTED: 502, AI_RATE_LIMITED: 429, AI_PROVIDER_ERROR: 502, AI_REFUSED: 422,
  AI_INVALID_JSON: 502, AI_EMPTY_RESPONSE: 502, AI_DAILY_LIMIT: 429, AI_BUDGET_EXCEEDED: 429,
  NOT_FOUND: 404, INVALID_REQUEST: 400,
};

export const errorCode = (err: unknown) => err instanceof AiProviderError ? err.code
  : String((err as Error)?.message || "").startsWith("AI_") ? String((err as Error).message) : "AI_PROVIDER_ERROR";

export const friendlyMessage = (code: string) =>
  code === "AI_DAILY_LIMIT" ? "Batas permintaan AI harian Anda sudah tercapai. Coba lagi besok."
    : code === "AI_BUDGET_EXCEEDED" ? "Anggaran AI bulan ini sudah habis. Hubungi admin."
      : ["AI_KEY_MISSING", "AI_MODEL_MISSING", "AI_BASE_URL_MISSING", "AI_KEY_REJECTED"].includes(code)
        ? "Asisten AI belum siap dipakai. Hubungi admin untuk memeriksa pengaturan AI."
        : code === "AI_RATE_LIMITED"
          ? "Penyedia AI sedang sibuk. Coba lagi beberapa menit lagi."
          : "Asisten AI gagal menjawab. Coba lagi sebentar lagi.";

export class ChatError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || friendlyMessage(code));
    this.code = code;
  }
}

// deno-lint-ignore no-explicit-any
type Db = any;

export const loadKnowledge = async (admin: Db) => {
  const { data } = await admin.from("assistant_ai_knowledge").select("judul, kategori, isi")
    .eq("aktif", true).order("updated_at", { ascending: false }).limit(60);
  return (data || []) as Json[];
};

export const monthUsageExceeded = async (admin: Db, ai: Json) => {
  const { data: usage } = await admin.rpc("assistant_ai_month_usage");
  return Number(usage?.biaya_usd || 0) >= Number(ai.monthly_budget_usd ?? 10);
};

// Batas harian per pengguna (semua saluran) dan anggaran bulanan lembaga.
export const usageLimit = async (admin: Db, ai: Json, userId: string): Promise<string | null> => {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("assistant_ai_usage").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("status", "ok").gte("created_at", since);
  if ((count || 0) >= Number(ai.daily_limit_per_user || 40)) return "AI_DAILY_LIMIT";
  if (await monthUsageExceeded(admin, ai)) return "AI_BUDGET_EXCEEDED";
  return null;
};

export type ChatTurn = {
  admin: Db;
  provider: Json;
  ai: Json;
  knowledge: Json[];
  userId: string;
  classId: string;
  roster: Json[];
  snapshots: Json[];
  items: Json[];
  santriId: string | null;
  profile: Json | null;
  conversationId: string | null;
  message: string;
  sumber?: "dasbor" | "telegram";
  fitur?: string;
};

// Satu giliran tanya-jawab. Melempar ChatError dengan kode galat yang sudah ramah pengguna.
export async function runChatTurn(t: ChatTurn) {
  const { admin, provider, userId } = t;
  const masker = buildNameMasker(t.roster);
  const kelas = buildClassContext(t.roster, t.snapshots, t.items, masker);

  let conversationId = t.conversationId;
  let history: Json[] = [];
  if (conversationId) {
    const { data: conv } = await admin.from("assistant_ai_conversations").select("id, user_id")
      .eq("id", conversationId).maybeSingle();
    if (!conv || conv.user_id !== userId) throw new ChatError("NOT_FOUND", "Percakapan tidak ditemukan.");
    const { data: rows } = await admin.from("assistant_ai_messages").select("role, content")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true });
    history = rows || [];
  }

  const limited = await usageLimit(admin, t.ai, userId);
  if (limited) throw new ChatError(limited);

  const profil = t.santriId ? buildProfileContext(t.profile, masker) : null;
  const pustaka = selectKnowledge(t.knowledge, `${t.message} ${t.profile?.jilid || ""}`);
  const contextText = buildChatContext({ kelas, profil, kodeFokus: t.santriId ? masker.codeOf(t.santriId) : null });
  const messages = buildChatMessages(history, t.message, contextText, masker);
  const fitur = t.fitur || "chat";
  const logUsage = (row: Json) => admin.from("assistant_ai_usage").insert({
    user_id: userId, provider: provider.id, model: provider.model, fitur, santri_id: t.santriId, ...row,
  });

  let tokens = { inputTokens: 0, outputTokens: 0 };
  let answer: string;
  try {
    const result = await generate(provider, {
      system: withKnowledge(String(t.ai.konteks_lembaga || ""), pustaka, CHAT_SYSTEM_PROMPT), messages, json: false,
    });
    tokens = result;
    if (!String(result.text || "").trim()) throw new Error("AI_EMPTY_RESPONSE");
    answer = masker.unmask(String(result.text).trim()).slice(0, 6000);
    await logUsage({
      status: "ok", input_tokens: tokens.inputTokens, output_tokens: tokens.outputTokens, biaya_usd: estimateCost(tokens, provider.price),
    });
  } catch (err) {
    const code = errorCode(err);
    await logUsage({
      status: "gagal", input_tokens: tokens.inputTokens, output_tokens: tokens.outputTokens,
      biaya_usd: estimateCost(tokens, provider.price), galat: `${code}: ${String((err as Error)?.message || err)}`.slice(0, 300),
    });
    throw new ChatError(code);
  }

  if (!conversationId) {
    const { data: conv } = await admin.from("assistant_ai_conversations").insert({
      user_id: userId, class_id: t.classId, santri_id: t.santriId, judul: t.message.slice(0, 80), sumber: t.sumber || "dasbor",
    }).select("id").single();
    conversationId = conv?.id || null;
  } else {
    await admin.from("assistant_ai_conversations").update({ updated_at: new Date().toISOString(), santri_id: t.santriId, class_id: t.classId })
      .eq("id", conversationId);
  }
  let saved: Json[] = [];
  if (conversationId) {
    const now = Date.now();
    const { data } = await admin.from("assistant_ai_messages").insert([
      { conversation_id: conversationId, role: "user", content: t.message, created_at: new Date(now).toISOString() },
      { conversation_id: conversationId, role: "assistant", content: answer, created_at: new Date(now + 1).toISOString() },
    ]).select("id, role");
    saved = data || [];
  }
  return {
    answer,
    conversationId,
    userMessageId: (saved.find((m) => m.role === "user")?.id as string) || null,
    messageId: (saved.find((m) => m.role === "assistant")?.id as string) || null,
  };
}
