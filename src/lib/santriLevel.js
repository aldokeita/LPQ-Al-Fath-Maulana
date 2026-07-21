const LEVEL_STAGES = [
  { name: 'Bronze', min: 0, max: 50 },
  { name: 'Silver', min: 51, max: 150 },
  { name: 'Gold', min: 151, max: 300 },
  { name: 'Platinum', min: 301, max: 500 },
  { name: 'Diamond', min: 501, max: 800 },
  { name: 'Mythic', min: 801, max: 1000 },
];

const LEVEL_COLORS = {
  male: ['#b7793f', '#64748b', '#d49a00', '#0891b2', '#2563eb', '#7c3aed'],
  female: ['#c56b48', '#7c7f93', '#d89a16', '#0d9488', '#6366f1', '#db2777'],
};

export const createDefaultSantriLevelConfig = () => Object.fromEntries(
  Object.entries(LEVEL_COLORS).map(([gender, colors]) => [
    gender,
    LEVEL_STAGES.map((stage, index) => ({
      id: index + 1,
      ...stage,
      color: colors[index],
      accentColor: colors[index],
      cardBgColor: '#ffffff',
      textColor: colors[index],
      cardBorderThickness: Math.min(8 + index, 12),
      avatarBorderThickness: Math.min(4 + Math.floor(index / 2), 6),
      enableGradient: true,
      textGradient: true,
    })),
  ]),
);

const FALLBACK_LEVELS = createDefaultSantriLevelConfig().male;

const normalizeGenderKey = (gender) => {
  const value = String(gender || '').toLowerCase();
  return value.includes('perempuan') || value.includes('putri') || value === 'p'
    ? 'female'
    : 'male';
};

const parseLevelConfig = (config) => {
  if (typeof config !== 'string') return config;
  try {
    return JSON.parse(config);
  } catch {
    return null;
  }
};

const toLevelArray = (value) => {
  if (Array.isArray(value)) return value.filter((level) => level && typeof level === 'object');
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value)
    .filter(([, level]) => level && typeof level === 'object' && !Array.isArray(level))
    .map(([key, level]) => ({ ...level, name: level.name || level.label || key }));
};

const LEGACY_LEVEL_NAMES = new Set(['pemula', 'menengah', 'mahir', 'newbie', 'intermediate', 'advanced', 'master', 'a', 'b', 'c', 's']);

const isLegacyLevelCollection = (levels) => levels.length > 0
  && levels.length <= 4
  && levels.every((level) => LEGACY_LEVEL_NAMES.has(String(level.name || level.label || '').trim().toLowerCase()));

export const normalizeLevelConfigShape = (config) => {
  const parsed = parseLevelConfig(config);
  if (!parsed || typeof parsed !== 'object') return { male: [], female: [] };

  if (Array.isArray(parsed)) {
    const sharedLevels = toLevelArray(parsed);
    if (isLegacyLevelCollection(sharedLevels)) return createDefaultSantriLevelConfig();
    return { male: sharedLevels, female: sharedLevels };
  }

  const hasGenderGroups = ['male', 'female', 'putra', 'putri', 'laki_laki', 'perempuan']
    .some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  const sharedLevels = hasGenderGroups ? [] : toLevelArray(parsed);

  const male = toLevelArray(parsed.male ?? parsed.putra ?? parsed.laki_laki ?? sharedLevels);
  const female = toLevelArray(parsed.female ?? parsed.putri ?? parsed.perempuan ?? sharedLevels);
  if (isLegacyLevelCollection(male) || isLegacyLevelCollection(female)) {
    return createDefaultSantriLevelConfig();
  }

  return { male, female };
};

export const resolveSantriLevel = ({ points = 0, gender, config }) => {
  const safePoints = Math.max(0, Number(points) || 0);
  const configuredLevels = normalizeLevelConfigShape(config)[normalizeGenderKey(gender)];
  const levels = Array.isArray(configuredLevels) && configuredLevels.length > 0
    ? configuredLevels
    : FALLBACK_LEVELS;

  const matched = levels.find((level) => {
    const min = Number(level.min ?? 0);
    const max = Number(level.max ?? Number.POSITIVE_INFINITY);
    return safePoints >= min && safePoints <= max;
  }) || levels[levels.length - 1] || FALLBACK_LEVELS[0];

  const accentColor = matched.accentColor || matched.color || '#0ea5e9';

  return {
    name: matched.name || matched.label || 'Bronze',
    min: Number(matched.min ?? 0),
    max: Number(matched.max ?? Number.POSITIVE_INFINITY),
    accentColor,
    textColor: matched.textColor || accentColor,
    cardBgColor: matched.cardBgColor || '#ffffff',
    cardBorderThickness: matched.cardDepth ?? matched.cardBorderThickness ?? 8,
    avatarBorderThickness: matched.avatarDepth ?? matched.avatarBorderThickness ?? 4,
    enableGradient: matched.enableGradient ?? true,
    textGradient: matched.textGradient ?? true,
  };
};

export { FALLBACK_LEVELS };
