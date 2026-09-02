import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  SANTRI_TIER_DEFINITIONS,
  getSantriTierAsset,
  resolveSantriTier,
} from '../src/lib/santriTier.js';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('bundles every configured rank with a WebP asset', async () => {
  assert.equal(SANTRI_TIER_DEFINITIONS.length, 22);

  await Promise.all(SANTRI_TIER_DEFINITIONS.map(async ({ src, label }) => {
    const assetPath = join(repositoryRoot, 'public', src.slice(1).replaceAll('/', '\\'));
    await access(assetPath);
    assert.match(src, /^\/assets\/tiers\/[a-z-]+\.webp$/);
    assert.ok(label);
  }));
});

test('resolves labels case-insensitively and falls back to points', () => {
  assert.equal(getSantriTierAsset('  gOLD   ii ')?.key, 'gold-ii');
  assert.equal(resolveSantriTier({ levelInfo: { label: 'Grandmaster' } }).assetKey, 'grandmaster');
  assert.equal(resolveSantriTier({ points: 0 }).assetKey, 'bronze-i');
  assert.equal(resolveSantriTier({ points: 500 }).assetKey, 'diamond-iii');
});

test('returns an honest fallback when the level has no matching symbol', () => {
  const result = resolveSantriTier({
    levelInfo: { label: 'Level Kustom' },
    points: null,
    config: { male: [{ name: 'Level Kustom', min: 0, max: 999 }] },
  });

  assert.equal(result.assetSrc, null);
  assert.equal(result.assetKey, null);
  assert.equal(result.isFallback, true);
  assert.equal(result.alt, 'Simbol tier belum tersedia');
});

test('keeps the resolver independent from UI markup', async () => {
  const source = await readFile(join(repositoryRoot, 'src', 'lib', 'santriTier.js'), 'utf8');
  assert.doesNotMatch(source, /<img|className=/);
});

test('wires the tier symbol into the attendance profile card contract', async () => {
  const [cardSource, emblemSource] = await Promise.all([
    readFile(join(repositoryRoot, 'src', 'components', 'dashboard', 'shared', 'AttendanceProfileCard.jsx'), 'utf8'),
    readFile(join(repositoryRoot, 'src', 'components', 'dashboard', 'shared', 'TierEmblem.jsx'), 'utf8'),
  ]);

  assert.match(cardSource, /import TierEmblem from '\.\/TierEmblem';/);
  assert.match(cardSource, /<TierEmblem\s+levelInfo=\{levelInfo\}\s+points=\{points\}/);
  assert.match(emblemSource, /alt=\{tier\.alt\}/);
  assert.match(emblemSource, /width=\{TIER_SYMBOL_DIMENSION\}/);
  assert.match(emblemSource, /height=\{TIER_SYMBOL_DIMENSION\}/);
  assert.match(emblemSource, /loading="eager"/);
  assert.match(emblemSource, /onError=\{\(\) => setFailedSource\(tier\.assetSrc\)\}/);
  assert.match(emblemSource, /attendance-profile-card__tier-emblem--fallback/);
});
