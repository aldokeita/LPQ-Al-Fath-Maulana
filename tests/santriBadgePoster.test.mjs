import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBadgePosterHtml, collectPosterPages, escapeHtml } from '../src/lib/santriBadgePoster.js';
import { setBadgeWinner } from '../src/lib/santriBadges.js';

const santriById = new Map([
  ['a', { id: 'a', nama_lengkap: 'Ahmad <Fauzi>' }],
  ['b', { id: 'b', nama_lengkap: 'Bilqis' }],
  ['c', { id: 'c', nama_lengkap: 'Citra' }],
]);

test('one page per sesi with only filled badges, in badge order', () => {
  let config = setBadgeWinner({}, { badgeId: 'shalat', sesi: 'Sore', gender: 'putri', santriId: 'c' });
  config = setBadgeWinner(config, { badgeId: 'terdisiplin', sesi: 'Pagi', gender: 'putra', santriId: 'a' });
  config = setBadgeWinner(config, { badgeId: 'terdisiplin', sesi: 'Pagi', gender: 'putri', santriId: 'b' });
  config = setBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putra', santriId: 'gone' });
  const pages = collectPosterPages({ config, sessions: ['Pagi', 'Siang', 'Sore'], santriById });
  assert.deepEqual(pages.map((p) => p.sesi), ['Pagi', 'Sore']);
  assert.deepEqual(pages[0].badges.map((b) => b.badge.id), ['terdisiplin'], 'unknown santri is skipped');
  assert.deepEqual(pages[0].badges[0].winners.map((w) => w.gender.id), ['putra', 'putri']);
});

test('poster html escapes names and has one A4 sheet per page', () => {
  const config = setBadgeWinner({}, { badgeId: 'terdisiplin', sesi: 'Pagi', gender: 'putra', santriId: 'a' });
  const pages = collectPosterPages({ config, sessions: ['Pagi'], santriById });
  const html = buildBadgePosterHtml({ pages, date: new Date(2026, 10, 23) });
  assert.match(html, /size: A4 portrait/);
  assert.equal(html.match(/class="sheet"/g).length, 1);
  assert.match(html, /Ahmad &lt;Fauzi&gt;/);
  assert.doesNotMatch(html, /Ahmad <Fauzi>/);
  assert.match(html, /Periode November 2026/);
  assert.equal(escapeHtml(`"x" & 'y'`), '&quot;x&quot; &amp; &#39;y&#39;');
});
