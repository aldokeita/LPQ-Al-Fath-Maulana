const LEVEL_NAMES = [
  'Bronze I', 'Bronze II', 'Bronze III',
  'Silver I', 'Silver II', 'Silver III',
  'Gold I', 'Gold II', 'Gold III', 'Gold IV',
  'Platinum I', 'Platinum II', 'Platinum III', 'Platinum IV',
  'Diamond I', 'Diamond II', 'Diamond III', 'Diamond IV',
  'Heroic', 'Elite Heroic', 'Master', 'Grandmaster',
];

const LEVEL_STAGES = LEVEL_NAMES.map((name, index) => ({
  name,
  min: index === 0 ? 0 : (index * 30) + 1,
  max: index === LEVEL_NAMES.length - 1 ? 999999 : (index + 1) * 30,
}));

const PREVIOUS_DEFAULT_STAGES = [
  { name: 'Bronze', min: 0, max: 50 },
  { name: 'Silver', min: 51, max: 150 },
  { name: 'Gold', min: 151, max: 300 },
  { name: 'Platinum', min: 301, max: 500 },
  { name: 'Diamond', min: 501, max: 800 },
  { name: 'Mythic', min: 801, max: 1000 },
];

const LEVEL_COLORS = {
  male: [
    '#a16207', '#b7791f', '#c58a32',
    '#64748b', '#76869b', '#8b9aaf',
    '#ca8a04', '#d49a0b', '#e0a814', '#eab308',
    '#0f8fa6', '#0891b2', '#0284c7', '#0e7490',
    '#2563eb', '#315fda', '#4f46e5', '#5b4fd6',
    '#7c3aed', '#6d28d9', '#4338ca', '#1d4ed8',
  ],
  female: [
    '#b76e4f', '#c97a5b', '#d58a6b',
    '#7c7f93', '#8d879e', '#9d91aa',
    '#c98b16', '#d59a22', '#dfa62d', '#e8b43b',
    '#0d9488', '#149b91', '#20a49b', '#2aaba4',
    '#6366f1', '#7c5ce7', '#9552dc', '#a94fcf',
    '#c026d3', '#db2777', '#be185d', '#9d174d',
  ],
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

const FALLBACK_LEVEL_CONFIG = createDefaultSantriLevelConfig();
const FALLBACK_LEVELS = FALLBACK_LEVEL_CONFIG.male;

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

const isPreviousDefaultLevelCollection = (levels) => levels.length === PREVIOUS_DEFAULT_STAGES.length
  && PREVIOUS_DEFAULT_STAGES.every((stage, index) => {
    const level = levels[index];
    return String(level?.name || level?.label || '').trim().toLowerCase() === stage.name.toLowerCase()
      && Number(level?.min) === stage.min
      && Number(level?.max) === stage.max;
  });

const PREVIOUS_RANK_NAMES = new Set(PREVIOUS_DEFAULT_STAGES.map((stage) => stage.name.toLowerCase()));
const isPreviousRankCollection = (levels) => levels.length > 0
  && levels.length <= PREVIOUS_DEFAULT_STAGES.length
  && levels.every((level) => PREVIOUS_RANK_NAMES.has(String(level.name || level.label || '').trim().toLowerCase()));

export const normalizeLevelConfigShape = (config) => {
  const parsed = parseLevelConfig(config);
  if (!parsed || typeof parsed !== 'object') return { male: [], female: [] };

  if (Array.isArray(parsed)) {
    const sharedLevels = toLevelArray(parsed);
    if (isLegacyLevelCollection(sharedLevels) || isPreviousDefaultLevelCollection(sharedLevels) || isPreviousRankCollection(sharedLevels)) {
      return createDefaultSantriLevelConfig();
    }
    return { male: sharedLevels, female: sharedLevels };
  }

  const hasGenderGroups = ['male', 'female', 'putra', 'putri', 'laki_laki', 'perempuan']
    .some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  const sharedLevels = hasGenderGroups ? [] : toLevelArray(parsed);

  const male = toLevelArray(parsed.male ?? parsed.putra ?? parsed.laki_laki ?? sharedLevels);
  const female = toLevelArray(parsed.female ?? parsed.putri ?? parsed.perempuan ?? sharedLevels);
  const defaults = createDefaultSantriLevelConfig();

  return {
    male: isLegacyLevelCollection(male) || isPreviousDefaultLevelCollection(male) || isPreviousRankCollection(male) ? defaults.male : male,
    female: isLegacyLevelCollection(female) || isPreviousDefaultLevelCollection(female) || isPreviousRankCollection(female) ? defaults.female : female,
  };
};

export const resolveSantriLevel = ({ points = 0, gender, config }) => {
  // Level thresholds are whole-point boundaries. A half point remains in the
  // current tier until the student reaches the next whole point.
  const safePoints = Math.floor(Math.max(0, Number(points) || 0));
  const genderKey = normalizeGenderKey(gender);
  const configuredLevels = normalizeLevelConfigShape(config)[genderKey];
  const fallbackLevels = FALLBACK_LEVEL_CONFIG[genderKey];
  const levels = Array.isArray(configuredLevels) && configuredLevels.length > 0
    ? configuredLevels
    : fallbackLevels;

  const matched = levels.find((level) => {
    const min = Number(level.min ?? 0);
    const max = Number(level.max ?? Number.POSITIVE_INFINITY);
    return safePoints >= min && safePoints <= max;
  }) || levels[levels.length - 1] || fallbackLevels[0];

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
