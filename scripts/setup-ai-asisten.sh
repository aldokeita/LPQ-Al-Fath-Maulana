#!/usr/bin/env bash
# Memasang kunci API penyedia AI untuk rekomendasi asisten di proyek Supabase yang ter-link (produksi),
# lalu men-deploy Edge Function assistant-ai. Dijalankan sendiri oleh admin dari root repo:
#   bash scripts/setup-ai-asisten.sh
# Kunci tidak ditampilkan dan tidak disimpan di repo. Setelah selesai, pilih penyedia dan model di
# dasbor admin > Asisten > Rekomendasi AI, simpan, lalu tekan "Uji koneksi".
set -euo pipefail

cd "$(dirname "$0")/.."
REF="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [[ -z "$REF" ]]; then
  echo "Proyek Supabase belum ter-link (supabase/.temp/project-ref tidak ada)." >&2
  exit 1
fi
echo "Proyek target: ${REF}"

key_env_for() {
  case "$1" in
    anthropic) echo ANTHROPIC_API_KEY ;;
    openai) echo OPENAI_API_KEY ;;
    gemini) echo GEMINI_API_KEY ;;
    deepseek) echo DEEPSEEK_API_KEY ;;
    opencode) echo OPENCODE_API_KEY ;;
    openrouter) echo OPENROUTER_API_KEY ;;
    groq) echo GROQ_API_KEY ;;
    custom) echo AI_CUSTOM_API_KEY ;;
    *) echo "" ;;
  esac
}

echo "Penyedia: anthropic, openai, gemini, deepseek, opencode, openrouter, groq, custom"
echo "Ketik 'lewati' untuk hanya men-deploy fungsi tanpa memasang kunci."
PROVIDER=""
KEY_ENV=""
while true; do
  read -r -p "Penyedia (atau lewati): " PROVIDER
  PROVIDER="$(printf '%s' "$PROVIDER" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  [[ "$PROVIDER" == "lewati" ]] && break
  KEY_ENV="$(key_env_for "$PROVIDER")"
  [[ -n "$KEY_ENV" ]] && break
  echo "Penyedia tidak dikenal. Pilih salah satu dari daftar di atas, atau ketik lewati."
done

TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
umask 077

if [[ "$PROVIDER" != "lewati" ]]; then
  read -r -s -p "Tempel kunci API ${PROVIDER}: " API_KEY; echo
  [[ ${#API_KEY} -ge 16 && "$API_KEY" != *[[:space:]]* ]] || { echo "Kunci tidak valid." >&2; exit 1; }
  printf '%s=%s\n' "$KEY_ENV" "$API_KEY" > "$TMP/secrets.env"
  echo "Menyimpan ${KEY_ENV} sebagai secret Edge Function..."
  npx supabase secrets set --env-file "$TMP/secrets.env"
fi

echo "Men-deploy assistant-ai..."
npx supabase functions deploy assistant-ai
echo "Selesai. Atur penyedia dan model di dasbor admin > Asisten > Rekomendasi AI, lalu Uji koneksi."
