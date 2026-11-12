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

export const sendTelegramMessage = async (chatId: number | string, text: string): Promise<SendResult> => {
  const res = await fetch(`https://api.telegram.org/bot${getBotToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (res.ok) return { ok: true, blocked: false };
  const body = await res.json().catch(() => ({}));
  const description = String(body?.description || `HTTP ${res.status}`);
  // 403: pengguna memblokir bot atau chat tidak ada lagi.
  return { ok: false, blocked: res.status === 403, error: description.slice(0, 300) };
};
