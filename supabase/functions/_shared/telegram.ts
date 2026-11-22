// Utilitas bot Telegram asisten. Token bot hanya dibaca dari secret Edge Function.

// Alamat Bot API; hanya diganti untuk uji lokal dengan server tiruan.
const apiBase = () => Deno.env.get("TELEGRAM_API_BASE") || "https://api.telegram.org";

export const getBotToken = (): string => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
};

// Perbandingan waktu-konstan untuk rahasia header.
export const safeEqual = (a: string | null, b: string | undefined): boolean => {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export type SendResult = { ok: boolean; blocked: boolean; error?: string };

export type InlineButton = { text: string; url?: string; callback_data?: string };

type SendOptions = { html?: boolean; buttonUrl?: string | null; buttonText?: string; keyboard?: InlineButton[][] | null };

// Panggilan Bot API umum; galat jaringan/HTTP dikembalikan, tidak dilempar.
export const telegramApi = async (method: string, body: Record<string, unknown>) => {
  try {
    const res = await fetch(`${apiBase()}/bot${getBotToken()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.ok !== false, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { description: String((err as Error)?.message || err) } };
  }
};

export const sendTelegramMessage = async (
  chatId: number | string,
  text: string,
  { html = false, buttonUrl = null, buttonText = "Buka dasbor", keyboard = null }: SendOptions = {},
): Promise<SendResult> => {
  const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true };
  if (html) body.parse_mode = "HTML";
  const rows: InlineButton[][] = [...(keyboard || [])];
  if (buttonUrl && /^https:\/\//.test(buttonUrl)) rows.push([{ text: buttonText, url: buttonUrl }]);
  if (rows.length) body.reply_markup = { inline_keyboard: rows };
  const res = await fetch(`${apiBase()}/bot${getBotToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true, blocked: false };
  const reply = await res.json().catch(() => ({}));
  const description = String(reply?.description || `HTTP ${res.status}`);
  // 403: pengguna memblokir bot atau chat tidak ada lagi.
  return { ok: false, blocked: res.status === 403, error: description.slice(0, 300) };
};
