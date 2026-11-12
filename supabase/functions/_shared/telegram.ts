// Utilitas bot Telegram asisten. Token bot hanya dibaca dari secret Edge Function.

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

type SendOptions = { html?: boolean; buttonUrl?: string | null; buttonText?: string };

export const sendTelegramMessage = async (
  chatId: number | string,
  text: string,
  { html = false, buttonUrl = null, buttonText = "Buka dasbor" }: SendOptions = {},
): Promise<SendResult> => {
  const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true };
  if (html) body.parse_mode = "HTML";
  if (buttonUrl && /^https:\/\//.test(buttonUrl)) {
    body.reply_markup = { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] };
  }
  const res = await fetch(`https://api.telegram.org/bot${getBotToken()}/sendMessage`, {
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
