// Poster A4 santri berprestasi (badge Apresiasi): satu halaman per sesi, siap dicetak atau disimpan
// sebagai satu berkas HTML mandiri (gambar ditanam sebagai data URL).
import { BADGE_GENDERS, getBadgeWinner, SANTRI_BADGES } from './santriBadges.js';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const initialsOf = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export const formatPeriode = (date = new Date()) => `${BULAN[date.getMonth()]} ${date.getFullYear()}`;

// Pemenang per sesi: [{ sesi, badges: [{ badge, winners: [{ gender, santri }] }] }], hanya sesi/badge yang terisi.
export const collectPosterPages = ({ config, sessions = [], santriById = new Map() }) => {
  const knownSessions = new Set(sessions);
  const allSessions = [...sessions];
  SANTRI_BADGES.forEach((badge) => Object.keys(config?.awards?.[badge.id] || {}).forEach((sesi) => {
    if (!knownSessions.has(sesi)) { knownSessions.add(sesi); allSessions.push(sesi); }
  }));
  return allSessions.map((sesi) => ({
    sesi,
    badges: SANTRI_BADGES.map((badge) => ({
      badge,
      winners: BADGE_GENDERS.map((gender) => {
        const id = getBadgeWinner(config, { badgeId: badge.id, sesi, gender: gender.id });
        const row = id ? santriById.get(id) : null;
        return id && row ? { gender, santri: row } : null;
      }).filter(Boolean),
    })).filter((entry) => entry.winners.length > 0),
  })).filter((page) => page.badges.length > 0);
};

const badgePlaque = (badge, logo) => {
  const [kicker, ...rest] = badge.lines;
  return `<div class="plaque">
    <img class="plaque-star" src="${logo}" alt="">
    <div class="plaque-body" style="--from:${badge.from};--to:${badge.to}">
      <span class="plaque-kicker">${escapeHtml(kicker)}</span>
      <span class="plaque-title">${escapeHtml(rest.join(' ') || kicker)}</span>
    </div>
  </div>`;
};

const winnerCard = ({ gender, santri }, photos, badge) => {
  const photo = photos.get(santri.id);
  return `<figure class="winner" style="--from:${badge.from};--to:${badge.to}">
    <div class="photo">${photo ? `<img src="${photo}" alt="">` : `<span>${escapeHtml(initialsOf(santri.nama_lengkap))}</span>`}</div>
    <figcaption>
      <strong>${escapeHtml(santri.nama_lengkap)}</strong>
      <span>${escapeHtml(gender.label)}</span>
    </figcaption>
  </figure>`;
};

const STYLE = `
@page { size: A4 portrait; margin: 0; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: #e7ecef; font-family: 'Outfit', 'Poppins', system-ui, sans-serif; color: #0f2f36;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.toolbar { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center;
  padding: 12px 16px; background: rgba(15,47,54,0.92); color: #fff; font-size: 14px; }
.toolbar button { min-height: 40px; padding: 0 18px; border: 0; border-radius: 9999px; font: 600 14px 'Outfit', system-ui, sans-serif; cursor: pointer; }
.toolbar .primary { background: #14b8a6; color: #04201c; }
.toolbar .secondary { background: rgba(255,255,255,0.14); color: #fff; }
.toolbar button:focus-visible { outline: 3px solid #fde68a; outline-offset: 2px; }
.sheet { position: relative; width: 210mm; height: 297mm; margin: 12mm auto; overflow: hidden; background: #fbfdfc;
  box-shadow: 0 18px 50px rgba(15,47,54,0.22); display: flex; flex-direction: column; padding: 14mm 14mm 10mm; page-break-after: always; break-after: page; }
.sheet:last-of-type { page-break-after: auto; break-after: auto; }
.bg { position: absolute; inset: 0; z-index: 0; }
.bg-building { position: absolute; left: 0; top: 0; width: 100%; height: 92mm; object-fit: cover; object-position: center 45%; }
.bg-veil { position: absolute; inset: 0; background:
  linear-gradient(180deg, rgba(251,253,252,0.55) 0mm, rgba(251,253,252,0.86) 70mm, #fbfdfc 96mm),
  radial-gradient(circle at 8% 4%, rgba(45,212,191,0.32), transparent 42%),
  radial-gradient(circle at 96% 10%, rgba(99,102,241,0.24), transparent 40%),
  radial-gradient(circle at 50% 104%, rgba(56,189,248,0.22), transparent 46%); }
.content { position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%; }
.brand { display: flex; align-items: center; gap: 4mm; }
.brand img { width: 17mm; height: 17mm; object-fit: contain; background: #fff; border-radius: 50%; padding: 1.2mm; box-shadow: 0 0 0 1mm rgba(13,148,136,0.16); }
.brand-name { font-family: 'Cinzel', serif; font-weight: 700; font-size: 17pt; letter-spacing: 0.6pt; line-height: 1.1; }
.brand-sub { font-size: 9pt; font-weight: 700; letter-spacing: 2.6pt; text-transform: uppercase; color: #b7791f; }
.heading { margin-top: 9mm; text-align: center; }
.heading .kicker { display: inline-block; padding: 1.6mm 5mm; border-radius: 9999px; background: rgba(13,148,136,0.12); color: #0f766e;
  font-weight: 700; font-size: 10pt; letter-spacing: 2.4pt; text-transform: uppercase; }
.heading h1 { margin: 3mm 0 1mm; font-family: 'Fredoka', 'Outfit', sans-serif; font-weight: 700; font-size: 34pt; line-height: 1.05; color: #0f4f5c; }
.heading p { margin: 0; font-size: 12pt; color: #3f5f64; }
.grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, 1fr); gap: 6mm; margin-top: 8mm; }
.grid.few { grid-template-columns: 1fr; grid-auto-rows: auto; align-content: center; gap: 10mm; }
.grid.few .block { padding: 10mm 6mm; }
.grid.few .photo { width: 44mm; height: 44mm; }
.grid.few .winner { max-width: 60mm; }
.grid.few .winner strong { font-size: 14pt; }
.block { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6mm; padding: 6mm 4mm 5mm; border-radius: 6mm;
  background: rgba(255,255,255,0.86); border: 0.35mm solid rgba(15,47,54,0.08); box-shadow: 0 3mm 9mm rgba(15,47,54,0.08); }
.plaque { position: relative; display: inline-flex; align-items: center; height: 17mm; padding-left: 9.6mm; }
.plaque-star { position: absolute; left: 0; top: 0; width: 17mm; height: 17mm; object-fit: contain; z-index: 2;
  filter: drop-shadow(0 0 0.4mm #fff) drop-shadow(0 0 0.4mm #fff); }
.plaque-body { display: inline-flex; flex-direction: column; justify-content: center; height: 13mm; padding: 0 6mm 0 9mm;
  border-radius: 0 9999px 9999px 0; border: 0.6mm solid transparent;
  background: linear-gradient(#fff, #fff) padding-box, linear-gradient(120deg, var(--from), var(--to)) border-box;
  font-family: 'Fredoka', 'Outfit', sans-serif; text-transform: uppercase; white-space: nowrap; }
.plaque-kicker { font-size: 7.5pt; font-weight: 600; letter-spacing: 2pt; line-height: 1; color: var(--from); }
.plaque-title { margin-top: 0.6mm; font-size: 14pt; font-weight: 700; line-height: 1; color: var(--to); }
.winners { display: flex; justify-content: center; gap: 5mm; width: 100%; }
.winner { margin: 0; flex: 1; max-width: 44mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
.photo { width: 34mm; height: 34mm; border-radius: 50%; padding: 1mm; background: linear-gradient(135deg, var(--from), var(--to)); }
.photo img, .photo span { width: 100%; height: 100%; border-radius: 50%; border: 0.8mm solid #fff; object-fit: cover; display: flex; align-items: center; justify-content: center; }
.photo span { background: linear-gradient(135deg, #0d9488, #6366f1); color: #fff; font: 700 22pt 'Fredoka', 'Outfit', sans-serif; }
.grid.few .photo span { font-size: 30pt; }
.winner figcaption { margin-top: 2.6mm; display: flex; flex-direction: column; gap: 0.8mm; }
.winner strong { font-size: 11.5pt; line-height: 1.2; font-weight: 700; color: #0f2f36; }
.winner figcaption span { font-size: 8pt; font-weight: 700; letter-spacing: 1.4pt; text-transform: uppercase; color: var(--from); }
.footer { margin-top: 6mm; padding-top: 3mm; border-top: 0.3mm solid rgba(15,47,54,0.14); display: flex; justify-content: space-between; gap: 6mm;
  font-size: 8.5pt; color: #3f5f64; }
.footer .doa { font-family: 'Amiri', serif; font-size: 13pt; color: #0f766e; }
@media print {
  body { background: none; }
  .toolbar { display: none !important; }
  .sheet { margin: 0; box-shadow: none; }
}
@media screen and (max-width: 860px) {
  .sheet { transform-origin: top left; }
}
`;

const SCRIPT = `
document.getElementById('print-btn').addEventListener('click', function () { window.print(); });
document.getElementById('save-btn').addEventListener('click', function () {
  var html = '<!doctype html>\\n' + document.documentElement.outerHTML;
  var blob = new Blob([html], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = document.body.getAttribute('data-file') || 'santri-berprestasi.html';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
});
`;

/**
 * HTML mandiri berisi satu halaman A4 per sesi. `photos` = Map(santriId → data URL),
 * `assets` = { logo, building } (data URL atau alamat absolut).
 */
export const buildBadgePosterHtml = ({ pages, photos = new Map(), assets = {}, date = new Date(), address = '' }) => {
  const periode = formatPeriode(date);
  const logo = assets.logo || '';
  const sheets = pages.map((page) => `
  <section class="sheet" aria-label="Santri berprestasi sesi ${escapeHtml(page.sesi)}">
    <div class="bg" aria-hidden="true">
      ${assets.building ? `<img class="bg-building" src="${assets.building}" alt="">` : ''}
      <div class="bg-veil"></div>
    </div>
    <div class="content">
      <div class="brand">
        ${logo ? `<img src="${logo}" alt="Logo LPQ Al-Fath Maulana">` : ''}
        <div><div class="brand-name">LPQ Al-Fath Maulana</div><div class="brand-sub">Metode Qiroati</div></div>
      </div>
      <div class="heading">
        <span class="kicker">Apresiasi Santri</span>
        <h1>Santri Berprestasi</h1>
        <p>Sesi ${escapeHtml(page.sesi)} · Periode ${escapeHtml(periode)}</p>
      </div>
      <div class="grid${page.badges.length <= 2 ? ' few' : ''}">
        ${page.badges.map(({ badge, winners }) => `
        <article class="block">
          ${badgePlaque(badge, logo)}
          <div class="winners">${winners.map((w) => winnerCard(w, photos, badge)).join('')}</div>
        </article>`).join('')}
      </div>
      <div class="footer">
        <span class="doa" lang="ar" dir="rtl">بَارَكَ اللهُ فِيكُمْ</span>
        <span>${escapeHtml(address)}</span>
      </div>
    </div>
  </section>`).join('');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Santri Berprestasi · ${escapeHtml(periode)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cinzel:wght@700&family=Fredoka:wght@600;700&family=Outfit:wght@400;600;700&display=swap">
<style>${STYLE}</style>
</head>
<body data-file="santri-berprestasi-${escapeHtml(periode.toLowerCase().replace(/\s+/g, '-'))}.html">
<div class="toolbar" role="toolbar" aria-label="Aksi cetak">
  <span>${pages.length} halaman A4 · Periode ${escapeHtml(periode)}</span>
  <button type="button" class="primary" id="print-btn">Cetak / Simpan PDF</button>
  <button type="button" class="secondary" id="save-btn">Unduh HTML</button>
</div>
${sheets}
<script>${SCRIPT}</script>
</body>
</html>`;
};
