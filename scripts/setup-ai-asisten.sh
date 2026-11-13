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

declare -A ENV_OF=(
  [anthropic]=ANTHROPIC_API_KEY [openai]=OPENAI_API_KEY [gemini]=GEMINI_API_KEY
  [deepseek]=DEEPSEEK_API_KEY [opencode]=OPENCODE_API_KEY [openrouter]=OPENROUTER_API_KEY
  [groq]=GROQ_API_KEY [custom]=AI_CUSTOM_API_KEY
)
echo "Penyedia: anthropic, openai, gemini, deepseek, opencode, openrouter, groq, custom"
echo "(atau 'lewati' untuk hanya men-deploy fungsi tanpa memasang kunci)"
read -r -p "Penyedia yang kuncinya akan dipasang: " PROVIDER

TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
umask 077

if [[ "$PROVIDER" != "lewati" ]]; then
  KEY_ENV="${ENV_OF[$PROVIDER]:-}"
  [[ -n "$KEY_ENV" ]] || { echo "Penyedia tidak dikenal." >&2; exit 1; }
  read -r -s -p "Tempel kunci API ${PROVIDER}: " API_KEY; echo
  [[ ${#API_KEY} -ge 16 && "$API_KEY" != *[[:space:]]* ]] || { echo "Kunci tidak valid." >&2; exit 1; }
  printf '%s=%s\n' "$KEY_ENV" "$API_KEY" > "$TMP/secrets.env"
  echo "Menyimpan ${KEY_ENV} sebagai secret Edge Function..."
  npx supabase secrets set --env-file "$TMP/secrets.env"
fi

echo "Men-deploy assistant-ai..."
npx supabase functions deploy assistant-ai
echo "Selesai. Atur penyedia dan model di dasbor admin > Asisten > Rekomendasi AI, lalu Uji koneksi."
