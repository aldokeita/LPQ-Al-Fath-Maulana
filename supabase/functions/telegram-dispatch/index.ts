// Mengirim antrean pesan Telegram. Dipanggil pg_cron (assistant_telegram_tick) dengan header rahasia.
import { getServiceRoleClient } from "../_shared/supabaseAdmin.ts";
import { safeEqual, sendTelegramMessage } from "../_shared/telegram.ts";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!safeEqual(req.headers.get("x-dispatch-secret"), Deno.env.get("TELEGRAM_DISPATCH_SECRET"))) {
    return json({ ok: false }, 403);
  }

  const db = getServiceRoleClient();
  const { data: rows, error } = await db.rpc("assistant_telegram_claim", { p_limit: 30 });
  if (error) return json({ ok: false, error: "CLAIM_FAILED" }, 500);

  let sent = 0;
  let failed = 0;
  for (const row of rows || []) {
    let result;
    try {
      result = await sendTelegramMessage(row.chat_id, row.pesan);
    } catch (err) {
      result = { ok: false, blocked: false, error: String((err as Error)?.message || err).slice(0, 300) };
    }
    await db.rpc("assistant_telegram_mark", {
      p_id: row.id, p_ok: result.ok, p_error: result.error ?? null, p_blocked: result.blocked,
    });
    if (result.ok) sent += 1; else failed += 1;
    // Batas Telegram sekitar 30 pesan/detik; jeda kecil cukup untuk lembaga ini.
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return json({ ok: true, sent, failed });
});
