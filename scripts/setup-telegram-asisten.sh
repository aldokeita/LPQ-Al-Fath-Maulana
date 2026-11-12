#!/usr/bin/env bash
# Menyiapkan bot Telegram asisten di proyek Supabase yang ter-link (produksi).
# Dijalankan sendiri oleh admin dari root repo:  bash scripts/setup-telegram-asisten.sh
#
# Yang dilakukan:
#   1. Meminta token bot dari @BotFather (tidak ditampilkan, tidak disimpan di repo).
#   2. Membuat dua rahasia acak untuk webhook dan pengirim antrean.
#   3. Menyimpan ketiganya sebagai secret Edge Function.
#   4. Men-deploy telegram-webhook dan telegram-dispatch.
#   5. Menyimpan alamat fungsi dan rahasia pengirim di Vault agar pg_cron bisa memanggilnya.
#   6. Mendaftarkan webhook bot ke Telegram.
set -euo pipefail

cd "$(dirname "$0")/.."
REF="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [[ -z "$REF" ]]; then
  echo "Proyek Supabase belum ter-link (supabase/.temp/project-ref tidak ada)." >&2
  exit 1
fi
FUNCTIONS_URL="https://${REF}.supabase.co/functions/v1"
echo "Proyek target: ${REF}"
read -r -p "Lanjutkan menyiapkan Telegram di proyek ini? (ketik ya) " CONFIRM
[[ "$CONFIRM" == "ya" ]] || { echo "Dibatalkan."; exit 1; }

read -r -s -p "Tempel token bot dari @BotFather: " BOT_TOKEN; echo
if [[ ! "$BOT_TOKEN" =~ ^[0-9]{6,}:[A-Za-z0-9_-]{30,}$ ]]; then
  echo "Format token tidak dikenali." >&2
  exit 1
fi

ME="$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getMe")" || { echo "Token ditolak Telegram." >&2; exit 1; }
BOT_USERNAME="$(printf '%s' "$ME" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')"
echo "Bot terdeteksi: @${BOT_USERNAME}"

WEBHOOK_SECRET="$(openssl rand -hex 32)"
DISPATCH_SECRET="$(openssl rand -hex 32)"

TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

umask 077
printf 'TELEGRAM_BOT_TOKEN=%s\nTELEGRAM_WEBHOOK_SECRET=%s\nTELEGRAM_DISPATCH_SECRET=%s\n' \
  "$BOT_TOKEN" "$WEBHOOK_SECRET" "$DISPATCH_SECRET" > "$TMP/secrets.env"

echo "Menyimpan secret Edge Function..."
npx supabase secrets set --env-file "$TMP/secrets.env"

echo "Men-deploy telegram-webhook dan telegram-dispatch..."
npx supabase functions deploy telegram-webhook telegram-dispatch

echo "Menyimpan alamat fungsi dan rahasia pengirim di Vault..."
cat > "$TMP/vault.sql" <<SQL
do \$\$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'assistant_functions_url';
  if v_id is null then perform vault.create_secret('${FUNCTIONS_URL}', 'assistant_functions_url');
  else perform vault.update_secret(v_id, '${FUNCTIONS_URL}'); end if;
  select id into v_id from vault.secrets where name = 'telegram_dispatch_secret';
  if v_id is null then perform vault.create_secret('${DISPATCH_SECRET}', 'telegram_dispatch_secret');
  else perform vault.update_secret(v_id, '${DISPATCH_SECRET}'); end if;
end \$\$;
SQL
npx supabase db query --remote --file "$TMP/vault.sql"

echo "Mendaftarkan webhook ke Telegram..."
curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${FUNCTIONS_URL}/telegram-webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]' \
  --data-urlencode "drop_pending_updates=true" >/dev/null
echo

echo "Selesai. Langkah terakhir di dasbor admin > Asisten > Notifikasi Telegram:"
echo "  - isi nama pengguna bot: ${BOT_USERNAME}"
echo "  - nyalakan 'Kirim lewat Telegram', lalu Simpan pengaturan."
echo "Pesan baru terkirim bila mode senyap sudah dimatikan."
