import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BADGE_PRIVILEGES, normalizeBadgePrivileges, PRIVILEGE_MAX_ITEMS,
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

test('merges numeric sesi codes with their names', () => {
  const santri = [{ sesi_mengaji: '0' }, { sesi_mengaji: 'Pagi' }, { class: { sesi: '2' } }, { sesi_mengaji: '3' }];
  assert.deepEqual(listBadgeSessions(santri), ['Pagi', 'Siang', 'Sore']);
});

test('privileges fall back to defaults and are trimmed and capped', () => {
  assert.deepEqual(normalizeBadgePrivileges(null), DEFAULT_BADGE_PRIVILEGES);
  const many = normalizeBadgePrivileges({ intro: '  Hak  ', items: ['  Pulang dulu ', '', 7, ...Array(20).fill('x')] });
  assert.equal(many.intro, 'Hak');
  assert.equal(many.items[0], 'Pulang dulu');
  assert.equal(many.items[1], '7');
  assert.equal(many.items.length, PRIVILEGE_MAX_ITEMS);
  assert.deepEqual(normalizeBadgePrivileges({ items: [] }).items, [], 'an emptied list stays empty');
});
