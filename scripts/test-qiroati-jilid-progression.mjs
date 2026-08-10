import assert from 'node:assert/strict';
import {
  getAdjacentQiroatiJilid,
  normalizeQiroatiJilid,
  QIROATI_JILID_OPTIONS,
} from '../src/lib/qiroatiJilid.js';

assert.equal(getAdjacentQiroatiJilid('Jilid 5B', 'up'), 'Jilid Juz 27');
assert.equal(getAdjacentQiroatiJilid('Jilid Juz 27', 'up'), 'Jilid 6A');
assert.equal(getAdjacentQiroatiJilid('Jilid 6A', 'down'), 'Jilid Juz 27');

assert.equal(normalizeQiroatiJilid('Juz 27'), 'Jilid Juz 27');
assert.equal(getAdjacentQiroatiJilid('Juz 27', 'up'), 'Jilid 6A');

assert.equal(
  QIROATI_JILID_OPTIONS.indexOf('Jilid Juz 27'),
  QIROATI_JILID_OPTIONS.indexOf('Jilid 5B') + 1,
);
assert.equal(
  QIROATI_JILID_OPTIONS.indexOf('Jilid 6A'),
  QIROATI_JILID_OPTIONS.indexOf('Jilid Juz 27') + 1,
);

console.log('Qiroati jilid progression tests passed.');
