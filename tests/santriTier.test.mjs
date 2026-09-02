import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  SANTRI_TIER_DEFINITIONS,
  getSantriTierAsset,
  resolveSantriTier,
  resolveSantriTierProgress,
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

test('derives progress and next tier from the active level thresholds', () => {
  const bronzeProgress = resolveSantriTierProgress({ points: 0, gender: 'Laki-laki' });
  assert.equal(bronzeProgress.label, 'Bronze I');
  assert.equal(bronzeProgress.nextLabel, 'Bronze II');
  assert.equal(bronzeProgress.nextMin, 31);
  assert.equal(bronzeProgress.available, true);
  assert.equal(bronzeProgress.ratio, 0);

  const highestProgress = resolveSantriTierProgress({ points: 700, gender: 'Laki-laki' });
  assert.equal(highestProgress.label, 'Grandmaster');
  assert.equal(highestProgress.isHighest, true);
  assert.equal(highestProgress.nextLabel, null);
  assert.equal(highestProgress.available, false);
});

test('does not invent thresholds for a custom level configuration', () => {
  const config = {
    male: [
      { name: 'Pemula Kustom', min: 0, max: 9 },
      { name: 'Lanjutan Kustom', min: 10, max: 19 },
    ],
  };

  const progress = resolveSantriTierProgress({ points: 5, gender: 'Laki-laki', config });
  assert.equal(progress.label, 'Pemula Kustom');
  assert.equal(progress.nextLabel, 'Lanjutan Kustom');
  assert.equal(progress.nextMin, 10);
  assert.equal(progress.available, true);

  const highest = resolveSantriTierProgress({ points: 20, gender: 'Laki-laki', config });
  assert.equal(highest.label, 'Lanjutan Kustom');
  assert.equal(highest.isHighest, true);
  assert.equal(highest.nextLabel, null);
});

test('keeps the resolver independent from UI markup', async () => {
  const source = await readFile(join(repositoryRoot, 'src', 'lib', 'santriTier.js'), 'utf8');
  assert.doesNotMatch(source, /<img|className=/);
});

test('wires the transparent crest identity row into the attendance profile card contract', async () => {
  const [cardSource, emblemSource, attendanceSource, styleSource] = await Promise.all([
    readFile(join(repositoryRoot, 'src', 'components', 'dashboard', 'shared', 'AttendanceProfileCard.jsx'), 'utf8'),
    readFile(join(repositoryRoot, 'src', 'components', 'dashboard', 'shared', 'TierEmblem.jsx'), 'utf8'),
    readFile(join(repositoryRoot, 'src', 'pages', 'DigitalAttendancePage.jsx'), 'utf8'),
    readFile(join(repositoryRoot, 'src', 'styles', 'admin-dashboard.css'), 'utf8'),
  ]);

  assert.match(cardSource, /import TierEmblem from '\.\/TierEmblem';/);
  assert.match(cardSource, /<TierEmblem\s+levelInfo=\{levelInfo\}\s+points=\{points\}\s+hasTierData=\{hasTierData\}/);
  assert.match(cardSource, /attendance-profile-card__identity-row/);
  assert.match(cardSource, /role="group"/);
  assert.match(cardSource, /attendance-profile-card__identity-divider/);
  assert.match(cardSource, /attendance-profile-card__identity-copy/);
  assert.match(styleSource, /\.attendance-profile-card__identity-row\s*\{[\s\S]*?width:\s*100%;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/);
  assert.match(styleSource, /\.attendance-profile-card__tier-crest\s*\{[\s\S]*?width:\s*clamp\(3\.5rem,\s*10vw,\s*5rem\);[\s\S]*?height:\s*clamp\(3\.5rem,\s*10vw,\s*5rem\);/);
  assert.match(styleSource, /\.attendance-profile-card--white-glass \.attendance-profile-card__identity-row \.attendance-profile-card__name\s*\{[\s\S]*?font-size:\s*clamp\(1\.375rem,\s*6\.2vw,\s*2\.2rem\);/);
  assert.match(styleSource, /\.attendance-profile-card__identity-copy\s*\{[\s\S]*?flex:\s*0 1 24rem;/);
  const identityRowStyles = styleSource.match(/\.attendance-profile-card__identity-row\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.doesNotMatch(identityRowStyles, /margin[^;]*\bauto\b/);
  assert.doesNotMatch(cardSource, /tierProgress=\{scan\.tierProgress\}/);
  assert.match(attendanceSource, /import '@\/styles\/admin-dashboard\.css';/);
  assert.match(emblemSource, /alt=\{tier\.alt\}/);
  assert.match(emblemSource, /width=\{TIER_SYMBOL_DIMENSION\}/);
  assert.match(emblemSource, /height=\{TIER_SYMBOL_DIMENSION\}/);
  assert.match(emblemSource, /loading="eager"/);
  assert.match(emblemSource, /onError=\{\(\) => setFailedSource\(tier\.assetSrc\)\}/);
  assert.match(emblemSource, /attendance-profile-card__tier-crest--fallback/);
  assert.match(emblemSource, /attendance-profile-card__tier-crest-aura/);
  assert.match(emblemSource, /attendance-profile-card__tier-crest-image/);
  assert.doesNotMatch(emblemSource, /LEVEL SANTRI|Tier Tertinggi|progressbar|Menuju/);
  assert.doesNotMatch(attendanceSource, /resolveSantriTierProgress/);
  assert.doesNotMatch(attendanceSource, /tierProgress/);
});
