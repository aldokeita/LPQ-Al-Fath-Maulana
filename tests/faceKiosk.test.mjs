import test from 'node:test';
import assert from 'node:assert/strict';
import { assignThumbsToFaces, iou, matchTracks, mirrorBox, THUMB_MIN_SCORE } from '../src/lib/faceKiosk.js';

const box = (x, y, width = 100, height = 120) => ({ x, y, width, height });

test('faces keep their track between frames and new faces start new tracks', () => {
  const tracks = [{ box: box(100, 100) }, { box: box(500, 100) }];
  const { matches, unmatched } = matchTracks(tracks, [box(510, 105), box(900, 100), box(105, 98)]);
  assert.deepEqual(matches.sort((a, b) => a.track - b.track), [{ track: 0, detection: 2 }, { track: 1, detection: 0 }]);
  assert.deepEqual(unmatched, [1]);
  assert.equal(iou(box(0, 0), box(300, 0)), 0);
});

test('a raised thumb confirms only the nearest plausible face', () => {
  const faces = [box(100, 100), box(500, 100)];
  const thumb = (x, y, score = 0.9, gesture = 'Thumb_Up') => ({ x, y, score, gesture });
  assert.deepEqual([...assignThumbsToFaces([thumb(180, 330)], faces)], [[0, 0]]);
  assert.deepEqual([...assignThumbsToFaces([thumb(560, 300), thumb(140, 260)], faces)].sort(), [[0, 1], [1, 0]], 'each hand links to its own face');
  assert.equal(assignThumbsToFaces([thumb(180, 330, THUMB_MIN_SCORE - 0.1)], faces).size, 0);
  assert.equal(assignThumbsToFaces([thumb(180, 330, 0.9, 'Open_Palm')], faces).size, 0);
  assert.equal(assignThumbsToFaces([thumb(180, -60)], faces).size, 0, 'a hand far above the head is not a confirmation');
  assert.equal(assignThumbsToFaces([thumb(1200, 330)], faces).size, 0, 'a hand far to the side belongs to nobody');
});

test('overlay boxes are mirrored to match the selfie preview', () => {
  assert.deepEqual(mirrorBox(box(100, 50), 1280), box(1080, 50));
});
