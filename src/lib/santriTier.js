import { resolveSantriLevel } from './santriLevel.js';

const TIER_ASSET_BASE_PATH = '/assets/tiers';

const LEGACY_LEVEL_LABELS = new Set([
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'mythic',
  'santri biasa',
  'santri rajin',
  'santri super',
  'santri legend',
]);

export const normalizeTierLabel = (label) => String(label || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const TIER_DEFINITIONS = [
  ['Bronze I', 'bronze-i'],
  ['Bronze II', 'bronze-ii'],
  ['Bronze III', 'bronze-iii'],
  ['Silver I', 'silver-i'],
  ['Silver II', 'silver-ii'],
  ['Silver III', 'silver-iii'],
  ['Gold I', 'gold-i'],
  ['Gold II', 'gold-ii'],
  ['Gold III', 'gold-iii'],
  ['Gold IV', 'gold-iv'],
  ['Platinum I', 'platinum-i'],
  ['Platinum II', 'platinum-ii'],
  ['Platinum III', 'platinum-iii'],
  ['Platinum IV', 'platinum-iv'],
  ['Diamond I', 'diamond-i'],
  ['Diamond II', 'diamond-ii'],
  ['Diamond III', 'diamond-iii'],
  ['Diamond IV', 'diamond-iv'],
  ['Heroic', 'heroic'],
  ['Elite Heroic', 'elite-heroic'],
  ['Master', 'master'],
  ['Grandmaster', 'grandmaster'],
].map(([label, key]) => ({
  label,
  key,
  src: `${TIER_ASSET_BASE_PATH}/${key}.webp`,
  alt: `Simbol tier ${label}`,
}));

export const SANTRI_TIER_DEFINITIONS = Object.freeze(
  TIER_DEFINITIONS.map((definition) => Object.freeze(definition)),
);

export const SANTRI_TIER_ASSETS = Object.freeze(
  Object.fromEntries(
    SANTRI_TIER_DEFINITIONS.map((definition) => [normalizeTierLabel(definition.label), definition]),
  ),
);

export const getSantriTierAsset = (label) => (
  SANTRI_TIER_ASSETS[normalizeTierLabel(label)] || null
);

const getLevelLabel = (levelInfo) => String(
  levelInfo?.name ?? levelInfo?.label ?? '',
).trim();

/**
 * Resolves the configured student level to one of the bundled tier symbols.
 * The point-based resolver is used as a safe fallback when the card receives
 * a delayed or legacy level label.
 */
export const resolveSantriTier = ({ levelInfo, points = 0, gender, config } = {}) => {
  const derivedLevel = resolveSantriLevel({ points, gender, config });
  const suppliedLabel = getLevelLabel(levelInfo);
  const suppliedAsset = getSantriTierAsset(suppliedLabel);
  const derivedLabel = getLevelLabel(derivedLevel);
  const derivedAsset = getSantriTierAsset(derivedLabel);
  const mayUseDerivedLevel = !suppliedLabel || LEGACY_LEVEL_LABELS.has(normalizeTierLabel(suppliedLabel));
  const asset = suppliedAsset || (mayUseDerivedLevel ? derivedAsset : null);
  const label = asset?.label || suppliedLabel || (mayUseDerivedLevel ? derivedLabel : null);

  return {
    label,
    assetKey: asset?.key || null,
    assetSrc: asset?.src || null,
    alt: asset?.alt || 'Simbol tier belum tersedia',
    isFallback: !asset,
  };
};
