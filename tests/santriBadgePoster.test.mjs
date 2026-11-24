import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBadgePosterHtml, collectPosterPages, escapeHtml } from '../src/lib/santriBadgePoster.js';
import { setBadgeWinner } from '../src/lib/santriBadges.js';

const santriById = new Map([
  ['a', { id: 'a', nama_lengkap: 'Ahmad <Fauzi>' }],
  ['b', { id: 'b', nama_lengkap: 'Bilqis' }],
  ['c', { id: 'c', nama_lengkap: 'Citra' }],
]);

test('one page per sesi with every badge; empty slots stay as mystery entries', () => {
  let config = setBadgeWinner({}, { badgeId: 'shalat', sesi: 'Sore', gender: 'putri', santriId: 'c' });
  config = setBadgeWinner(config, { badgeId: 'terdisiplin', sesi: 'Pagi', gender: 'putra', santriId: 'a' });
  config = setBadgeWinner(config, { badgeId: 'hafalan', sesi: 'Pagi', gender: 'putra', santriId: 'gone' });
  const pages = collectPosterPages({ config, sessions: ['Pagi', 'Siang', 'Sore'], santriById });
  assert.deepEqual(pages.map((p) => p.sesi), ['Pagi', 'Siang', 'Sore']);
  assert.deepEqual(pages[0].badges.map((b) => b.badge.id), ['terdisiplin', 'hafalan', 'drilling', 'shalat']);
  assert.deepEqual(pages[0].badges[0].winners.map((w) => w.santri?.id ?? null), ['a', null]);
  assert.equal(pages[0].badges[1].winners[0].santri, null, 'unknown santri becomes a mystery slot');
});

test('mystery slots and the privilege page render', () => {
  const pages = collectPosterPages({ config: {}, sessions: ['Pagi'], santriById });
  const html = buildBadgePosterHtml({ pages, privileges: { intro: 'Hak <istimewa>', items: ['Pulang dulu'] } });
  assert.equal(html.match(/class="winner mystery"/g).length, 8);
  assert.match(html, /<strong>\?\?\?<\/strong>/);
  assert.match(html, /class="sesi-pill"><small>Sesi<\/small><b>Pagi<\/b>/);
  assert.equal(html.match(/class="sheet"/g).length, 2);
  assert.match(html, /Hak &lt;istimewa&gt;/);
  assert.match(html, /<span class="num">1<\/span><span>Pulang dulu<\/span>/);
  assert.equal(buildBadgePosterHtml({ pages, privileges: { items: [] } }).match(/class="sheet"/g).length, 1);
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
