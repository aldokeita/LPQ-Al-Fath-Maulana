import assert from 'node:assert/strict';
import {
  createDefaultSantriLevelConfig,
  normalizeLevelConfigShape,
  resolveSantriLevel,
} from '../src/lib/santriLevel.js';

const defaults = createDefaultSantriLevelConfig();

for (const gender of ['male', 'female']) {
  const levels = defaults[gender];
  assert.equal(levels.length, 22);
  assert.equal(levels[0].name, 'Bronze I');
  assert.deepEqual([levels[0].min, levels[0].max], [0, 30]);
  assert.equal(levels.at(-1).name, 'Grandmaster');

  levels.slice(1).forEach((level, index) => {
    assert.equal(level.min, levels[index].max + 1);
  });
}

assert.notEqual(defaults.male[0].color, defaults.female[0].color);
assert.equal(resolveSantriLevel({ points: 0, gender: 'putri', config: null }).accentColor, defaults.female[0].color);
assert.equal(resolveSantriLevel({ points: 31, gender: 'putra', config: defaults }).name, 'Bronze II');
assert.equal(resolveSantriLevel({ points: 631, gender: 'putri', config: defaults }).name, 'Grandmaster');

const previousDefault = {
  male: [
    { name: 'Bronze', min: 0, max: 50 },
    { name: 'Silver', min: 51, max: 150 },
    { name: 'Gold', min: 151, max: 300 },
    { name: 'Platinum', min: 301, max: 500 },
    { name: 'Diamond', min: 501, max: 800 },
    { name: 'Mythic', min: 801, max: 1000 },
  ],
  female: [{ name: 'Custom Putri', min: 0, max: 9999, color: '#123456' }],
};
const upgraded = normalizeLevelConfigShape(previousDefault);
assert.equal(upgraded.male.length, 22);
assert.equal(upgraded.male[0].name, 'Bronze I');
assert.equal(upgraded.female.length, 1);
assert.equal(upgraded.female[0].name, 'Custom Putri');

const editedPreviousMale = normalizeLevelConfigShape({
  male: [
    { name: 'Bronze', min: 0, max: 75, color: '#010203' },
    { name: 'Silver', min: 76, max: 225, color: '#040506' },
    { name: 'Gold', min: 226, max: 450, color: '#070809' },
  ],
  female: defaults.female,
});
assert.equal(editedPreviousMale.male.length, 22);
assert.equal(editedPreviousMale.male[0].name, 'Bronze I');
assert.equal(editedPreviousMale.male[0].color, defaults.male[0].color);
assert.equal(editedPreviousMale.female.length, 22);

console.log('Santri level tests passed.');
