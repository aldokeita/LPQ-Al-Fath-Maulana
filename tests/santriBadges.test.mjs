import test from 'node:test';
import assert from 'node:assert/strict';
import {
  badgesForSantri, getBadgeWinner, listBadgeSessions, normalizeBadgeConfig, normalizeBadgeGender, setBadgeWinner,
} from '../src/lib/santriBadges.js';

test('maps stored gender values to putra/putri', () => {
  assert.equal(normalizeBadgeGender('Laki-laki'), 'putra');
  assert.equal(normalizeBadgeGender('Perempuan'), 'putri');
  assert.equal(normalizeBadgeGender(''), null);
});

test('keeps one putra and one putri per badge per sesi', () => {
  let config = setBadgeWinner({}, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putra', santriId: 'a' });
  config = setBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putri', santriId: 'b' });
  config = setBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putra', santriId: 'c' });
  assert.equal(getBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putra' }), 'c');
  assert.equal(getBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putri' }), 'b');
  assert.equal(getBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Sore', gender: 'putra' }), null);
});

test('clearing both winners removes the empty slot', () => {
  let config = setBadgeWinner({}, { badgeId: 'shalat', sesi: 'Sore', gender: 'putri', santriId: 'x' });
  config = setBadgeWinner(config, { badgeId: 'shalat', sesi: 'Sore', gender: 'putri', santriId: null });
  assert.deepEqual(config, { awards: {} });
});

test('lists the badges a santri holds in display order across sesi', () => {
  let config = setBadgeWinner({}, { badgeId: 'shalat', sesi: 'Sore', gender: 'putra', santriId: 'a' });
  config = setBadgeWinner(config, { badgeId: 'terdisiplin', sesi: 'Pagi', gender: 'putra', santriId: 'a' });
  config = setBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putra', santriId: 'z' });
  assert.deepEqual(badgesForSantri(config, 'a').map((badge) => badge.id), ['terdisiplin', 'shalat']);
  assert.deepEqual(badgesForSantri(config, 'nobody'), []);
});

test('drops unknown badges and malformed entries', () => {
  const config = normalizeBadgeConfig({ awards: { unknown: { Pagi: { putra: 'a' } }, hafalan: { Pagi: { putra: 5 }, Sore: 'x' } } });
  assert.deepEqual(config, { awards: {} });
  assert.deepEqual(normalizeBadgeConfig(null), { awards: {} });
});

test('orders sesi Pagi, Siang, Sore, Malam, then others', () => {
  const santri = [{ sesi_mengaji: 'Sore' }, { class: { sesi: 'Pagi' } }, { sesi_mengaji: 'Khusus' }, { sesi_mengaji: 'Sore' }, {}];
  assert.deepEqual(listBadgeSessions(santri), ['Pagi', 'Sore', 'Khusus']);
});
