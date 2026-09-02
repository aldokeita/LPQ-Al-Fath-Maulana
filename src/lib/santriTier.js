import {
  createDefaultSantriLevelConfig,
  normalizeLevelConfigShape,
  resolveSantriLevel,
} from './santriLevel.js';

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

const normalizeGenderKey = (gender) => {
  const value = String(gender || '').toLowerCase();
  return value.includes('perempuan') || value.includes('putri') || value === 'p'
    ? 'female'
    : 'male';
};

const getConfiguredLevels = (config, gender) => {
  const normalizedConfig = normalizeLevelConfigShape(config);
  const genderKey = normalizeGenderKey(gender);
  const configuredLevels = normalizedConfig[genderKey];
  const fallbackLevels = createDefaultSantriLevelConfig()[genderKey];
  const levels = Array.isArray(configuredLevels) && configuredLevels.length > 0
    ? configuredLevels
    : fallbackLevels;

  return levels
    .map((level, index) => ({
      ...level,
      name: String(level?.name ?? level?.label ?? `Level ${index + 1}`).trim(),
      min: Number(level?.min ?? 0),
      max: Number(level?.max ?? Number.POSITIVE_INFINITY),
    }))
    .filter((level) => level.name && Number.isFinite(level.min) && level.min >= 0)
    .sort((a, b) => a.min - b.min);
};

const clampProgressRatio = (ratio) => Math.min(1, Math.max(0, ratio));

/**
 * Resolves progress using the active level configuration. The returned ratio
 * is only a visual fill value; labels and thresholds always come from data.
 */
export const resolveSantriTierProgress = ({ points, gender, config, levelInfo } = {}) => {
  const numericPoints = Number(points);
  const hasPoints = Number.isFinite(numericPoints) && numericPoints >= 0;
  const displayPoints = hasPoints ? numericPoints : null;
  const wholePoints = hasPoints ? Math.floor(numericPoints) : 0;
  const levels = getConfiguredLevels(config, gender);
  const resolvedLevel = resolveSantriLevel({ points: wholePoints, gender, config });
  const resolvedLabel = getLevelLabel(resolvedLevel);
  const suppliedLabel = getLevelLabel(levelInfo);

  let currentIndex = levels.findIndex((level) => normalizeTierLabel(level.name) === normalizeTierLabel(resolvedLabel));
  if (currentIndex < 0 && suppliedLabel) {
    currentIndex = levels.findIndex((level) => normalizeTierLabel(level.name) === normalizeTierLabel(suppliedLabel));
  }
  if (currentIndex < 0 && hasPoints) {
    currentIndex = levels.findIndex((level) => wholePoints >= level.min && wholePoints <= level.max);
  }

  const currentLevel = levels[currentIndex] || null;
  const nextLevel = currentIndex >= 0 ? levels[currentIndex + 1] || null : null;
  const nextMin = nextLevel ? Number(nextLevel.min) : null;
  const currentMin = currentLevel ? Number(currentLevel.min) : null;
  const hasValidRange = Boolean(
    hasPoints
      && currentLevel
      && Number.isFinite(currentMin)
      && nextLevel
      && Number.isFinite(nextMin)
      && nextMin > currentMin,
  );

  return {
    label: currentLevel?.name || resolvedLabel || suppliedLabel || null,
    currentMin,
    currentMax: currentLevel ? Number(currentLevel.max) : null,
    currentPoints: displayPoints,
    nextLabel: nextLevel?.name || null,
    nextMin: hasValidRange ? nextMin : null,
    ratio: hasValidRange ? clampProgressRatio((displayPoints - currentMin) / (nextMin - currentMin)) : null,
    available: hasValidRange,
    isHighest: Boolean(currentLevel && !nextLevel),
  };
};

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
