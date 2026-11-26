// Poster A4 santri berprestasi (badge Apresiasi): satu halaman per sesi, siap dicetak atau disimpan
// sebagai satu berkas HTML mandiri (gambar ditanam sebagai data URL).
import { BADGE_GENDERS, getBadgeWinner, SANTRI_BADGES } from './santriBadges.js';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const initialsOf = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export const formatPeriode = (date = new Date()) => `${BULAN[date.getMonth()]} ${date.getFullYear()}`;

// Pemenang per sesi: [{ sesi, badges: [{ badge, winners: [{ gender, santri|null }] }] }].
// Semua badge dan kedua jenis kelamin selalu ada; slot kosong (santri null) dicetak sebagai "???" misterius.
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
        return { gender, santri: id && row ? row : null };
      }),
    })),
  }));
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

// Siluet misterius untuk badge yang belum ada pemenangnya.
const MYSTERY_FACE = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="39" r="17" fill="rgba(255,255,255,0.2)"/><path d="M16 96c3-21 18-32 34-32s31 11 34 32z" fill="rgba(255,255,255,0.2)"/></svg>`;

const winnerCard = ({ gender, santri }, photos, badge) => {
  if (!santri) {
    return `<figure class="winner mystery" style="--from:${badge.from};--to:${badge.to}">
    <div class="photo"><span class="mystery-face">${MYSTERY_FACE}<b>?</b></span></div>
    <figcaption>
      <strong>???</strong>
      <span>${escapeHtml(gender.label)}</span>
      <em>Siapa yang akan meraihnya?</em>
    </figcaption>
  </figure>`;
  }
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
.block { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6mm; padding: 6mm 4mm 5mm; border-radius: 6mm;
  background: rgba(255,255,255,0.86); border: 0.35mm solid rgba(15,47,54,0.08); box-shadow: 0 3mm 9mm rgba(15,47,54,0.08); }
.plaque { position: relative; display: inline-flex; align-items: center; height: 17mm; padding-left: 9.6mm; }
.plaque-star { position: absolute; left: 0; top: 0; width: 17mm; height: 17mm; object-fit: contain; z-index: 2; }
/* Tanpa CSS filter: Chrome merasterisasi elemen ber-filter di resolusi layar saat cetak sehingga logo pecah.
   Halo putih sudah dipanggang di aset logoHalo (1024px). */
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
.winner figcaption { margin-top: 2.6mm; display: flex; flex-direction: column; gap: 0.8mm; }
.winner strong { font-size: 11.5pt; line-height: 1.2; font-weight: 700; color: #0f2f36; }
.winner figcaption span { font-size: 8pt; font-weight: 700; letter-spacing: 1.4pt; text-transform: uppercase; color: var(--from); }
.sesi-pill { display: inline-flex; align-items: center; gap: 2.6mm; margin-top: 3mm; padding: 1.4mm 1.4mm 1.4mm 6.5mm; border-radius: 9999px;
  background: linear-gradient(120deg, #0d9488, #0284c7); color: #fff; box-shadow: 0 2.5mm 7mm rgba(2,132,199,0.3), inset 0 0.4mm 0 rgba(255,255,255,0.35);
  font-family: 'Fredoka', 'Outfit', sans-serif; font-size: 17pt; line-height: 1; }
/* "Sesi" dan nama sesi berukuran sama; nama sesi disorot lewat kapsul putih, bukan ukuran huruf. */
.sesi-pill small { font-size: inherit; font-weight: 500; opacity: 0.92; }
.sesi-pill b { font-size: inherit; font-weight: 700; padding: 1.6mm 5.5mm; border-radius: 9999px; background: #fff; color: #0369a1;
  box-shadow: 0 0.6mm 1.6mm rgba(3,105,161,0.25); }
.heading .periode { margin-top: 2.6mm; font-size: 10.5pt; color: #3f5f64; }
.mystery .photo { background: linear-gradient(135deg, #94a3b8, #475569); }
.photo .mystery-face { position: relative; width: 100%; height: 100%; border-radius: 50%; border: 0.8mm solid #fff; overflow: hidden;
  display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 35%, #334155, #0f172a 75%); }
.photo .mystery-face svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.photo .mystery-face b { position: relative; margin-top: -2mm; font: 700 34pt 'Fredoka', 'Outfit', sans-serif; color: #fde68a; text-shadow: 0 0 3mm rgba(253,230,138,0.6); }
.mystery strong { letter-spacing: 2pt; color: #475569; }
.mystery figcaption span { color: #64748b; }
.mystery em { font-size: 7.5pt; font-style: normal; color: #94a3b8; }
.privileges { list-style: none; margin: 9mm 0 0; padding: 0; display: grid; gap: 4.2mm; }
.privileges li { display: flex; align-items: center; gap: 5mm; padding: 4.2mm 6mm; border-radius: 5mm; background: rgba(255,255,255,0.9);
  border: 0.35mm solid rgba(15,47,54,0.08); box-shadow: 0 2mm 6mm rgba(15,47,54,0.07); font-size: 13pt; line-height: 1.35; }
.privileges .num { flex-shrink: 0; width: 11mm; height: 11mm; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0d9488, #6366f1); color: #fff; font: 700 13pt 'Fredoka', 'Outfit', sans-serif; }
.heading .privilege-intro { margin: 4mm auto 0; max-width: 150mm; text-align: center; font-size: 12pt; color: #3f5f64; }
.badge-row { margin-top: auto; padding-top: 8mm; display: flex; flex-direction: column; align-items: center; gap: 4mm; }
.badge-row p { margin: 0; font-size: 9pt; font-weight: 700; letter-spacing: 2pt; text-transform: uppercase; color: #3f5f64; }
.badge-row .plaques { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 8mm; justify-items: center; }
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
export const buildBadgePosterHtml = ({ pages, photos = new Map(), assets = {}, date = new Date(), address = '', privileges = null }) => {
  const periode = formatPeriode(date);
  const logo = assets.logo || '';
  const logoHalo = assets.logoHalo || logo;
  const background = assets.building ? `<img class="bg-building" src="${assets.building}" alt="">` : '';
  const brand = `<div class="brand">
        ${logo ? `<img src="${logo}" alt="Logo LPQ Al-Fath Maulana">` : ''}
        <div><div class="brand-name">LPQ Al-Fath Maulana</div><div class="brand-sub">Metode Qiroati</div></div>
      </div>`;
  const footer = `<div class="footer">
        <span class="doa" lang="ar" dir="rtl">بَارَكَ اللهُ فِيكُمْ</span>
        <span>${escapeHtml(address)}</span>
      </div>`;
  // Halaman penjelasan hak istimewa, di akhir berkas.
  const privilegeSheet = privileges?.items?.length ? `
  <section class="sheet" aria-label="Hak istimewa santri berprestasi">
    <div class="bg" aria-hidden="true">${background}<div class="bg-veil"></div></div>
    <div class="content">
      ${brand}
      <div class="heading">
        <span class="kicker">Apresiasi Santri</span>
        <h1>Hak Istimewa Santri Berprestasi</h1>
        ${privileges.intro ? `<p class="privilege-intro">${escapeHtml(privileges.intro)}</p>` : ''}
      </div>
      <ol class="privileges">
        ${privileges.items.map((item, index) => `<li><span class="num">${index + 1}</span><span>${escapeHtml(item)}</span></li>`).join('')}
      </ol>
      <div class="badge-row">
        <p>Berlaku untuk peraih badge</p>
        <div class="plaques">${SANTRI_BADGES.map((badge) => badgePlaque(badge, logoHalo)).join('')}</div>
      </div>
      ${footer}
    </div>
  </section>` : '';
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
        <div><span class="sesi-pill"><small>Sesi</small><b>${escapeHtml(page.sesi)}</b></span></div>
        <p class="periode">Periode ${escapeHtml(periode)}</p>
      </div>
      <div class="grid">
        ${page.badges.map(({ badge, winners }) => `
        <article class="block">
          ${badgePlaque(badge, logoHalo)}
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
  <span>${pages.length + (privilegeSheet ? 1 : 0)} halaman A4 · Periode ${escapeHtml(periode)}</span>
  <button type="button" class="primary" id="print-btn">Cetak / Simpan PDF</button>
  <button type="button" class="secondary" id="save-btn">Unduh HTML</button>
</div>
${sheets}
${privilegeSheet}
<script>${SCRIPT}</script>
</body>
</html>`;
};
