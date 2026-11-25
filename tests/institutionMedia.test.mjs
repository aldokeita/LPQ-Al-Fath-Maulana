import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  OFFICIAL_ANNOUNCEMENTS,
  OFFICIAL_FACILITIES,
  OFFICIAL_GALLERY,
  OFFICIAL_NEWS,
  withOfficialFallback,
  withOfficialItems,
} from '../src/lib/institutionContent.js';

const publicPath = (url) => new URL(`../public${url}`, import.meta.url);

test('semua foto bawaan LPQ ada di folder public', () => {
  const urls = [
    ...OFFICIAL_GALLERY.map((item) => item.url),
    ...OFFICIAL_FACILITIES.map((item) => item.image_url),
    ...OFFICIAL_NEWS.map((item) => item.cover_image_url),
    ...OFFICIAL_ANNOUNCEMENTS.map((item) => item.cover_image_url),
  ];
  for (const url of urls) assert.ok(existsSync(publicPath(url)), `foto tidak ditemukan: ${url}`);
});

test('slug berita dan pengumuman bawaan unik', () => {
  const slugs = [...OFFICIAL_NEWS, ...OFFICIAL_ANNOUNCEMENTS].map((item) => item.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('withOfficialItems: data Supabase duluan, foto bawaan tidak dobel', () => {
  const fromDb = [{ id: 'db-1', url: OFFICIAL_GALLERY[0].url }, { id: 'db-2', url: '/x.webp' }];
  const merged = withOfficialItems(fromDb, OFFICIAL_GALLERY);
  assert.deepEqual(merged.slice(0, 2), fromDb);
  assert.equal(merged.length, 2 + OFFICIAL_GALLERY.length - 1);
  assert.equal(merged.filter((item) => item.url === OFFICIAL_GALLERY[0].url).length, 1);
});

test('withOfficialItems: konten kosong atau rusak diisi konten bawaan', () => {
  assert.equal(withOfficialItems(null, OFFICIAL_FACILITIES).length, OFFICIAL_FACILITIES.length);
  assert.equal(withOfficialItems({}, OFFICIAL_FACILITIES).length, OFFICIAL_FACILITIES.length);
});

test('withOfficialFallback: data Supabase dipakai apa adanya, kosong pakai bawaan', () => {
  const fromDb = [{ id: 'db-1', url: '/x.webp' }];
  assert.deepEqual(withOfficialFallback(fromDb, OFFICIAL_GALLERY), fromDb);
  assert.equal(withOfficialFallback([], OFFICIAL_GALLERY).length, OFFICIAL_GALLERY.length);
  assert.equal(withOfficialFallback(undefined, OFFICIAL_GALLERY).length, OFFICIAL_GALLERY.length);
});

test('prioritas pengumuman bawaan lolos constraint database', () => {
  for (const item of OFFICIAL_ANNOUNCEMENTS) assert.ok(['low', 'normal', 'high'].includes(item.priority));
});
