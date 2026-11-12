// Menerima pembaruan dari Telegram. Bot hanya menanggapi /start <token> dan /stop di chat pribadi.
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { safeEqual, sendTelegramMessage } from "../_shared/telegram.ts";

const reply = async (chatId: number, text: string) => {
  try {
    await sendTelegramMessage(chatId, text);
  } catch {
    // Balasan gagal tidak boleh membuat Telegram mengulang pembaruan yang sama.
  }
};

const done = () => new Response("ok", { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), Deno.env.get("TELEGRAM_WEBHOOK_SECRET"))) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const chatId = Number(message?.chat?.id);
  const text = String(message?.text || "").trim();
  if (!message || !Number.isFinite(chatId)) return done();
  if (message.chat?.type !== "private") return done();

  const db = getServiceRoleClient();

  if (text === "/stop") {
    await db.rpc("telegram_stop", { p_chat_id: chatId });
    await reply(chatId, "Notifikasi asisten LPQ dihentikan. Sambungkan lagi kapan saja dari dasbor.");
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
      "Anda akan menerima ringkasan santri yang perlu perhatian dan peringatan prioritas tinggi. Kirim /stop untuk berhenti.");
    return done();
  }

  await reply(chatId, "Bot ini hanya mengirim notifikasi. Kirim /stop untuk berhenti.");
  return done();
});
