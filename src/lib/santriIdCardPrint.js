export const ID_CARD_PAPER_OPTIONS = Object.freeze({
  A4: Object.freeze({
    label: 'A4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'Portrait',
    cardsPerPage: 9,
    columns: 3,
    rows: 3,
    paddingMm: 8,
    gapMm: 5,
  }),
  F4: Object.freeze({
    label: 'F4',
    widthMm: 215.9,
    heightMm: 330.2,
    orientation: 'Portrait',
    cardsPerPage: 9,
    columns: 3,
    rows: 3,
    paddingMm: 8,
    gapMm: 5,
  }),
});

export const ID_CARD_WIDTH_MM = 55;
export const ID_CARD_HEIGHT_MM = 84;

export const getIdCardPaperConfig = (paperSize = 'A4') => (
  ID_CARD_PAPER_OPTIONS[paperSize] || ID_CARD_PAPER_OPTIONS.A4
);

export const chunkIdCardRecords = (records = [], pageSize = ID_CARD_PAPER_OPTIONS.A4.cardsPerPage) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const safePageSize = Math.max(1, Number(pageSize) || ID_CARD_PAPER_OPTIONS.A4.cardsPerPage);
  const pages = [];

  for (let index = 0; index < safeRecords.length; index += safePageSize) {
    pages.push(safeRecords.slice(index, index + safePageSize));
  }

  return pages;
};

export const escapeIdCardHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const normalizeImageUrl = (value) => {
  const url = String(value || '').trim();
  if (/^(?:https?:|data:image\/|\/)/i.test(url)) return url;
  return '';
};

const initials = (name) => String(name || 'S').trim().charAt(0).toUpperCase() || 'S';

const renderImage = ({ alt, className, src }) => {
  const safeSrc = normalizeImageUrl(src);
  return safeSrc
    ? `<img class="${className}" src="${escapeIdCardHtml(safeSrc)}" alt="${escapeIdCardHtml(alt)}" />`
    : '';
};

export const renderIdCardMarkup = ({ card, logoUrl, qrDataUrl = '' }) => {
  const name = card?.nama_lengkap || 'Nama Santri';
  const nomorInduk = card?.nomor_induk_qiroati || '';
  const photo = renderImage({
    alt: `Foto ${name}`,
    className: 'id-card__photo',
    src: card?.foto_url,
  }) || `<span class="id-card__photo-fallback" aria-hidden="true">${escapeIdCardHtml(initials(name))}</span>`;
  const logo = renderImage({
    alt: 'Logo LPQ Al-Fath Maulana',
    className: 'id-card__logo',
    src: logoUrl,
  });
  const qr = nomorInduk && qrDataUrl
    ? renderImage({
      alt: `QR nomor induk ${nomorInduk}`,
      className: 'id-card__qr',
      src: qrDataUrl,
    })
    : `<span class="id-card__qr-fallback">NIQ belum tersedia</span>`;

  return `<article class="id-card" aria-label="ID Card ${escapeIdCardHtml(name)}">
    <div class="id-card__decor id-card__decor--one" aria-hidden="true"></div>
    <div class="id-card__decor id-card__decor--two" aria-hidden="true"></div>
    <div class="id-card__decor id-card__decor--three" aria-hidden="true"></div>
    <header class="id-card__header">
      ${logo || '<span class="id-card__brand-fallback">LPQ</span>'}
      <span class="id-card__brand-copy">Kartu Santri</span>
    </header>
    <div class="id-card__photo-frame">${photo}</div>
    <h2 class="id-card__name">${escapeIdCardHtml(name)}</h2>
    <div class="id-card__number">
      <span>Nomor Induk Qiroati</span>
      <strong>${escapeIdCardHtml(nomorInduk || 'Belum tersedia')}</strong>
    </div>
    <div class="id-card__meta">
      <span>${escapeIdCardHtml(card?.jilid || 'Jilid belum diatur')}</span>
      <span>${escapeIdCardHtml(card?.sesi_label || card?.sesi_mengaji || 'Sesi belum diatur')}</span>
    </div>
    <div class="id-card__qr-wrap">${qr}</div>
    <footer class="id-card__footer">LPQ Al-Fath Maulana</footer>
  </article>`;
};

export const ID_CARD_PRINT_STYLES = ({ paperSize = 'A4' } = {}) => {
  const paper = getIdCardPaperConfig(paperSize);
  return `
    :root {
      --id-card-page-width: ${paper.widthMm}mm;
      --id-card-page-height: ${paper.heightMm}mm;
      --id-card-width: ${ID_CARD_WIDTH_MM}mm;
      --id-card-height: ${ID_CARD_HEIGHT_MM}mm;
      --id-card-padding: ${paper.paddingMm}mm;
      --id-card-gap: ${paper.gapMm}mm;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #e9f1f4; }
    body { color: #10213c; font-family: Arial, Helvetica, sans-serif; }
    .id-card-document { padding: 16px; }
    .id-card-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; max-width: var(--id-card-page-width); margin: 0 auto 14px; padding: 12px 14px; border: 1px solid #b9dbe2; border-radius: 14px; background: rgba(255,255,255,.92); box-shadow: 0 12px 28px rgba(15,23,42,.14); }
    .id-card-toolbar strong { display: block; color: #10213c; font-size: 14px; }
    .id-card-toolbar span { display: block; margin-top: 3px; color: #526278; font-size: 12px; }
    .id-card-toolbar button { min-height: 40px; padding: 0 18px; border: 0; border-radius: 999px; color: #fff; background: linear-gradient(135deg,#0d9488,#2563eb); font-weight: 800; cursor: pointer; }
    .id-card-sheet { display: grid; width: var(--id-card-page-width); min-height: var(--id-card-page-height); grid-template-columns: repeat(${paper.columns}, var(--id-card-width)); grid-template-rows: repeat(${paper.rows}, var(--id-card-height)); align-content: start; justify-content: center; gap: var(--id-card-gap); padding: var(--id-card-padding); margin: 0 auto 18px; background: #fff; box-shadow: 0 20px 48px rgba(15,23,42,.18); break-after: page; page-break-after: always; }
    .id-card-sheet:last-child { break-after: auto; page-break-after: auto; }
    .id-card { position: relative; display: flex; width: var(--id-card-width); height: var(--id-card-height); flex-direction: column; align-items: center; overflow: hidden; page-break-inside: avoid; break-inside: avoid; border: .45mm solid #8bc7c0; border-radius: 3.6mm; background: linear-gradient(145deg,#fff,#f3fbfa 68%,#e8f8f4); box-shadow: 0 1.4mm 3mm rgba(15,118,110,.17); }
    .id-card::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 12% 14%,rgba(20,184,166,.22) 0 2.2mm,transparent 2.5mm), radial-gradient(circle at 89% 28%,rgba(234,179,8,.25) 0 2mm,transparent 2.4mm), radial-gradient(circle at 9% 88%,rgba(37,99,235,.16) 0 1.7mm,transparent 2mm); pointer-events: none; }
    .id-card::after { content: ""; position: absolute; inset: 2.4mm; border: .22mm solid rgba(13,148,136,.27); border-radius: 2.5mm; pointer-events: none; }
    .id-card__decor { position: absolute; z-index: 0; width: 13mm; height: 1mm; border-radius: 999px; opacity: .78; transform: rotate(-28deg); }
    .id-card__decor--one { top: 20mm; left: -3mm; background: #14b8a6; }
    .id-card__decor--two { top: 10mm; right: -2mm; background: #eab308; transform: rotate(26deg); }
    .id-card__decor--three { bottom: 19mm; left: -2mm; background: #2563eb; transform: rotate(28deg); }
    .id-card__header { position: relative; z-index: 1; display: flex; width: 100%; align-items: center; justify-content: center; gap: 1.1mm; padding: 4.5mm 4mm 0; }
    .id-card__logo { width: 10mm; height: 10mm; object-fit: contain; }
    .id-card__brand-fallback { display: grid; width: 10mm; height: 10mm; place-items: center; border-radius: 50%; color: #fff; background: #0d9488; font-size: 7pt; font-weight: 900; }
    .id-card__brand-copy { color: #0f766e; font-size: 7pt; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
    .id-card__photo-frame { position: relative; z-index: 1; display: grid; width: 30mm; height: 30mm; place-items: center; margin-top: 3.5mm; padding: 1.3mm; border: 1.4mm solid #a3d915; border-radius: 50%; background: #fff; box-shadow: 0 1.5mm 3mm rgba(101,163,13,.22); }
    .id-card__photo { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .id-card__photo-fallback { display: grid; width: 100%; height: 100%; place-items: center; border-radius: 50%; color: #0f766e; background: #dff7f2; font-size: 22pt; font-weight: 900; }
    .id-card__name { position: relative; z-index: 1; width: 100%; min-height: 10mm; margin: 2.5mm 5mm 0; color: #f59e0b; font-size: 13pt; font-weight: 900; line-height: 1.05; text-align: center; overflow-wrap: anywhere; }
    .id-card__number { position: relative; z-index: 1; display: flex; width: 42mm; min-height: 10mm; flex-direction: column; align-items: center; justify-content: center; border: .6mm solid #8b8b8b; border-radius: 5mm; background: rgba(255,255,255,.77); }
    .id-card__number span { color: #64748b; font-size: 5pt; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .id-card__number strong { max-width: 38mm; color: #475569; font-family: monospace; font-size: 10pt; letter-spacing: .08em; overflow-wrap: anywhere; text-align: center; }
    .id-card__meta { position: relative; z-index: 1; display: flex; gap: 2mm; margin-top: 2.4mm; }
    .id-card__meta span { padding: 1mm 2.3mm; border-radius: 999px; color: #0f766e; background: rgba(204,251,241,.86); font-size: 5.7pt; font-weight: 800; }
    .id-card__qr-wrap { position: relative; z-index: 1; display: grid; width: 18mm; height: 18mm; place-items: center; margin-top: auto; margin-bottom: 3mm; }
    .id-card__qr { width: 17mm; height: 17mm; object-fit: contain; }
    .id-card__qr-fallback { color: #64748b; font-size: 5pt; text-align: center; }
    .id-card__footer { position: relative; z-index: 1; width: 100%; padding: 0 3mm 2.5mm; color: #0f766e; font-size: 5.3pt; font-weight: 900; letter-spacing: .04em; text-align: center; }
    @page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: 0; }
    @media print {
      html, body { width: auto; min-height: auto; background: #fff; }
      .id-card-document { padding: 0; }
      .id-card-toolbar { display: none !important; }
      .id-card-sheet { width: var(--id-card-page-width); min-height: var(--id-card-page-height); margin: 0; box-shadow: none; }
    }
    @media screen and (max-width: 720px) {
      .id-card-document { min-width: var(--id-card-page-width); }
    }
  `;
};

export const buildIdCardPrintHtml = ({
  cards = [],
  logoUrl = '/logo-lpq-al-fath-maulana.webp',
  paperSize = 'A4',
  qrDataUrls = {},
}) => {
  const paper = getIdCardPaperConfig(paperSize);
  const pages = chunkIdCardRecords(cards, paper.cardsPerPage);
  const sheetMarkup = pages.map((page) => `
    <section class="id-card-sheet">
      ${page.map((card) => renderIdCardMarkup({ card, logoUrl, qrDataUrl: qrDataUrls[card.id] })).join('')}
    </section>`).join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>ID Card Santri — ${escapeIdCardHtml(paper.label)}</title>
  <style>${ID_CARD_PRINT_STYLES({ paperSize })}</style>
</head>
<body>
  <main class="id-card-document">
    <div class="id-card-toolbar">
      <div><strong>ID Card Santri — ${escapeIdCardHtml(paper.label)} Portrait</strong><span>${cards.length} kartu · ${paper.cardsPerPage} kartu per halaman</span></div>
      <button type="button" onclick="window.print()">Cetak</button>
    </div>
    ${sheetMarkup}
  </main>
</body>
</html>`;
};
