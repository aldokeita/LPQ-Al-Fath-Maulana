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

export const ID_CARD_WIDTH_MM = 53.8;
export const ID_CARD_HEIGHT_MM = 86;

export const DEFAULT_ID_CARD_DESIGN = Object.freeze({
  backgroundUrl: '/id-card/kartu-murid-abstrak-5.jpeg',
  logoUrl: '',
  logoPosition: 'top-left',
  logoSizeMm: 12,
  logoOffsetXmm: 0,
  logoOffsetYmm: 0,
  photoSizeMm: 26,
  photoOffsetXmm: 0,
  photoOffsetYmm: -2,
  nameFontFamily: 'Montserrat, Arial, sans-serif',
  nameColor: '#f59e0b',
  nameSizePt: 13,
  nameGapMm: 0,
  numberFontFamily: 'Montserrat, Arial, sans-serif',
  numberColor: '#475569',
  numberSizePt: 10,
  numberGapMm: 0,
  numberWidthMm: 34,
  numberLetterSpacing: 0.08,
  qrSizeMm: 17,
  qrRightMm: 4,
  qrBottomMm: 3,
  qrOffsetXmm: 0,
  qrOffsetYmm: 0,
  showOuterBorder: true,
  outerBorderColor: '#8bc7c0',
  outerBorderWidthMm: 0.45,
  cardRadiusMm: 3.6,
});

const clampDesignNumber = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

export const normalizeIdCardDesign = (value = {}) => {
  const design = { ...DEFAULT_ID_CARD_DESIGN, ...(value || {}) };
  return {
    ...design,
    logoPosition: ['top-left', 'top-center', 'top-right'].includes(design.logoPosition) ? design.logoPosition : DEFAULT_ID_CARD_DESIGN.logoPosition,
    logoSizeMm: clampDesignNumber(design.logoSizeMm, DEFAULT_ID_CARD_DESIGN.logoSizeMm, 7, 22),
    logoOffsetXmm: clampDesignNumber(design.logoOffsetXmm, DEFAULT_ID_CARD_DESIGN.logoOffsetXmm, -12, 12),
    logoOffsetYmm: clampDesignNumber(design.logoOffsetYmm, DEFAULT_ID_CARD_DESIGN.logoOffsetYmm, -8, 8),
    photoSizeMm: clampDesignNumber(design.photoSizeMm, DEFAULT_ID_CARD_DESIGN.photoSizeMm, 22, 32),
    photoOffsetXmm: clampDesignNumber(design.photoOffsetXmm, DEFAULT_ID_CARD_DESIGN.photoOffsetXmm, -12, 12),
    photoOffsetYmm: clampDesignNumber(design.photoOffsetYmm, DEFAULT_ID_CARD_DESIGN.photoOffsetYmm, -12, 12),
    nameSizePt: clampDesignNumber(design.nameSizePt, DEFAULT_ID_CARD_DESIGN.nameSizePt, 9, 18),
    nameGapMm: clampDesignNumber(design.nameGapMm, DEFAULT_ID_CARD_DESIGN.nameGapMm, 0, 8),
    numberSizePt: clampDesignNumber(design.numberSizePt, DEFAULT_ID_CARD_DESIGN.numberSizePt, 7, 15),
    numberGapMm: clampDesignNumber(design.numberGapMm, DEFAULT_ID_CARD_DESIGN.numberGapMm, 0, 8),
    numberWidthMm: clampDesignNumber(design.numberWidthMm, DEFAULT_ID_CARD_DESIGN.numberWidthMm, 26, 42),
    numberLetterSpacing: clampDesignNumber(design.numberLetterSpacing, DEFAULT_ID_CARD_DESIGN.numberLetterSpacing, 0, 0.18),
    qrSizeMm: clampDesignNumber(design.qrSizeMm, DEFAULT_ID_CARD_DESIGN.qrSizeMm, 10, 22),
    qrRightMm: clampDesignNumber(design.qrRightMm, DEFAULT_ID_CARD_DESIGN.qrRightMm, 0, 10),
    qrBottomMm: clampDesignNumber(design.qrBottomMm, DEFAULT_ID_CARD_DESIGN.qrBottomMm, 0, 10),
    qrOffsetXmm: clampDesignNumber(design.qrOffsetXmm, DEFAULT_ID_CARD_DESIGN.qrOffsetXmm, -12, 12),
    qrOffsetYmm: clampDesignNumber(design.qrOffsetYmm, DEFAULT_ID_CARD_DESIGN.qrOffsetYmm, -12, 12),
    outerBorderWidthMm: clampDesignNumber(design.outerBorderWidthMm, DEFAULT_ID_CARD_DESIGN.outerBorderWidthMm, 0, 2),
    cardRadiusMm: clampDesignNumber(design.cardRadiusMm, DEFAULT_ID_CARD_DESIGN.cardRadiusMm, 0, 8),
    showOuterBorder: design.showOuterBorder !== false,
  };
};

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
  const name = card?.nama_panggilan || card?.nama_lengkap || 'Nama Santri';
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
    : `<span class="id-card__qr-fallback">QR tidak tersedia</span>`;

  return `<article class="id-card" aria-label="ID Card ${escapeIdCardHtml(name)}">
    <div class="id-card__decor id-card__decor--one" aria-hidden="true"></div>
    <div class="id-card__decor id-card__decor--two" aria-hidden="true"></div>
    <div class="id-card__decor id-card__decor--three" aria-hidden="true"></div>
    <header class="id-card__header">
      ${logo || '<span class="id-card__brand-fallback">LPQ</span>'}
    </header>
    <div class="id-card__photo-frame">${photo}</div>
    <h2 class="id-card__name">${escapeIdCardHtml(name)}</h2>
    <div class="id-card__number"><strong>${escapeIdCardHtml(nomorInduk || 'Belum tersedia')}</strong></div>
    <div class="id-card__qr-wrap">${qr}</div>
  </article>`;
};

export const ID_CARD_PRINT_STYLES = ({ designConfig, paperSize = 'A4' } = {}) => {
  const paper = getIdCardPaperConfig(paperSize);
  const design = normalizeIdCardDesign(designConfig);
  const backgroundUrl = normalizeImageUrl(design.backgroundUrl);
  const backgroundCss = backgroundUrl ? `url("${backgroundUrl.replace(/["\\)]/g, '\\$&')}")` : 'none';
  const borderCss = design.showOuterBorder ? `${design.outerBorderWidthMm}mm solid ${design.outerBorderColor}` : '0 solid transparent';
  const logoAlignment = design.logoPosition === 'top-left' ? 'flex-start' : design.logoPosition === 'top-right' ? 'flex-end' : 'center';
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
    .id-card { position: relative; display: flex; width: var(--id-card-width); height: var(--id-card-height); flex-direction: column; align-items: center; overflow: hidden; page-break-inside: avoid; break-inside: avoid; border: ${borderCss}; border-radius: ${design.cardRadiusMm}mm; background: #fff ${backgroundCss} center / 100% 100% no-repeat; box-shadow: 0 1.4mm 3mm rgba(15,118,110,.17); }
    .id-card::before { content: ""; position: absolute; inset: 0; background: transparent; pointer-events: none; }
    .id-card__decor { position: absolute; z-index: 0; width: 13mm; height: 1mm; border-radius: 999px; opacity: .78; transform: rotate(-28deg); }
    .id-card__decor--one { top: 20mm; left: -3mm; background: #14b8a6; }
    .id-card__decor--two { top: 10mm; right: -2mm; background: #eab308; transform: rotate(26deg); }
    .id-card__decor--three { bottom: 19mm; left: -2mm; background: #2563eb; transform: rotate(28deg); }
    .id-card__header { position: relative; z-index: 1; display: flex; width: 100%; align-items: center; justify-content: ${logoAlignment}; gap: 1.1mm; padding: 4.5mm 4mm 0; transform: translate(${design.logoOffsetXmm}mm, ${design.logoOffsetYmm}mm); }
    .id-card__logo { width: ${design.logoSizeMm}mm; height: ${design.logoSizeMm}mm; object-fit: contain; }
    .id-card__brand-fallback { display: grid; width: 17mm; height: 9mm; place-items: center; border-radius: 2mm; color: #0f766e; background: rgba(204,251,241,.9); font-size: 6.2pt; font-weight: 900; letter-spacing: .06em; }
    .id-card__photo-frame { position: relative; z-index: 1; display: grid; width: ${design.photoSizeMm}mm; height: ${design.photoSizeMm}mm; place-items: center; margin-top: 3.5mm; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: none; transform: translate(${design.photoOffsetXmm}mm, ${design.photoOffsetYmm}mm); }
    .id-card__photo { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .id-card__photo-fallback { display: grid; width: 100%; height: 100%; place-items: center; border-radius: 50%; color: #0f766e; background: #dff7f2; font-size: 22pt; font-weight: 900; }
    .id-card__name { position: relative; z-index: 1; width: 100%; min-height: 0; margin: ${design.nameGapMm}mm 5mm 0; color: ${design.nameColor}; font-family: ${design.nameFontFamily}; font-size: ${design.nameSizePt}pt; font-weight: 900; line-height: 1.05; text-align: center; overflow-wrap: anywhere; }
    .id-card__number { position: relative; z-index: 1; display: flex; width: ${design.numberWidthMm}mm; min-height: 9mm; align-items: center; justify-content: center; margin-top: ${design.numberGapMm}mm; border: .6mm solid #8b8b8b; border-radius: 5mm; background: rgba(255,255,255,.77); }
    .id-card__number strong { max-width: ${Math.max(22, design.numberWidthMm - 4)}mm; color: ${design.numberColor}; font-family: ${design.numberFontFamily}; font-size: ${design.numberSizePt}pt; letter-spacing: ${design.numberLetterSpacing}em; overflow-wrap: anywhere; text-align: center; }
    .id-card__qr-wrap { position: relative; z-index: 1; display: grid; width: ${design.qrSizeMm}mm; height: ${design.qrSizeMm}mm; place-items: center; align-self: flex-end; margin-top: auto; margin-right: ${design.qrRightMm}mm; margin-bottom: ${design.qrBottomMm}mm; transform: translate(${design.qrOffsetXmm}mm, ${design.qrOffsetYmm}mm); }
    .id-card__qr { width: ${design.qrSizeMm}mm; height: ${design.qrSizeMm}mm; object-fit: contain; }
    .id-card__qr-fallback { color: #64748b; font-size: 5pt; text-align: center; }
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
  logoUrl = '',
  paperSize = 'A4',
  qrDataUrls = {},
  designConfig,
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
  <style>${ID_CARD_PRINT_STYLES({ designConfig, paperSize })}</style>
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
