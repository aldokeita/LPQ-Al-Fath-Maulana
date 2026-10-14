import test from 'node:test';
import assert from 'node:assert/strict';
import { assignGesturesToFaces, createSmileTracker, GESTURE_MIN_SCORE, iou, matchTracks, mirrorBox, plainBox, SMILE_BASELINE_FRAMES, smileScore } from '../src/lib/faceKiosk.js';

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
  assert.deepEqual([...assignGesturesToFaces([thumb(180, 330)], faces)], [[0, { handIndex: 0, gesture: 'Thumb_Up' }]]);
  assert.deepEqual([...assignGesturesToFaces([thumb(560, 300), thumb(140, 260)], faces)].map(([face, owner]) => [face, owner.handIndex]).sort(), [[0, 1], [1, 0]], 'each hand links to its own face');
  assert.equal(assignGesturesToFaces([thumb(180, 330, GESTURE_MIN_SCORE - 0.1)], faces).size, 0);
  assert.equal(assignGesturesToFaces([thumb(180, 330, 0.9, 'Open_Palm')], faces).size, 0);
  assert.equal(assignGesturesToFaces([thumb(180, -60)], faces).size, 0, 'a hand far above the head is not a confirmation');
  assert.equal(assignGesturesToFaces([thumb(1200, 330)], faces).size, 0, 'a hand far to the side belongs to nobody');
});

test('overlay boxes are mirrored to match the selfie preview', () => {
  assert.deepEqual(mirrorBox(box(100, 50), 1280), box(1080, 50));
});

test('face-api style boxes with getter fields become plain boxes the overlay can draw', () => {
  class GetterBox { constructor() { this._x = 10; this._y = 20; this._width = 30; this._height = 40; }
    get x() { return this._x; } get y() { return this._y; } get width() { return this._width; } get height() { return this._height; } }
  assert.equal({ ...new GetterBox() }.x, undefined, 'spreading loses getter fields, which hid every HUD box');
  assert.deepEqual(plainBox(new GetterBox()), box(10, 20, 30, 40));
  assert.deepEqual(mirrorBox(plainBox(new GetterBox()), 100), box(60, 20, 30, 40));
});

test('a peace sign confirms like a thumb, other hand shapes do not', () => {
  const faces = [box(100, 100)];
  const hand = gesture => ({ x: 180, y: 330, score: 0.9, gesture });
  assert.deepEqual(assignGesturesToFaces([hand('Victory')], faces).get(0), { handIndex: 0, gesture: 'Victory' });
  for (const gesture of ['Open_Palm', 'Closed_Fist', 'Pointing_Up', 'ILoveYou', 'None']) assert.equal(assignGesturesToFaces([hand(gesture)], faces).size, 0, gesture);
});

// Synthetic 68-point face: only the points the smile score reads are placed; the rest sit at the origin.
const face68 = ({ mouthWidth, cornerLift, roll = 0 }) => {
  const points = Array.from({ length: 68 }, () => ({ x: 0, y: 0 }));
  const place = (index, x, y) => { points[index] = { x: x * Math.cos(roll) - y * Math.sin(roll), y: x * Math.sin(roll) + y * Math.cos(roll) }; };
  place(36, -50, 0); place(45, 50, 0);
  place(62, 0, 66); place(66, 0, 74);
  place(48, -mouthWidth / 2, 70 - cornerLift); place(54, mouthWidth / 2, 70 - cornerLift);
  return points;
};
const neutral = (extra = {}) => face68({ mouthWidth: 55, cornerLift: 3, ...extra });
const smiling = (extra = {}) => face68({ mouthWidth: 68, cornerLift: 9, ...extra });

test('mouth geometry is measured level with the eyes, against the inner lip line', () => {
  const flat = smileScore(smiling()); const tilted = smileScore(smiling({ roll: 0.35 }));
  assert.ok(Math.abs(flat.widthRatio - 0.68) < 1e-9 && Math.abs(flat.lift - 9 / 68) < 1e-9);
  assert.ok(Math.abs(tilted.widthRatio - flat.widthRatio) < 1e-9 && Math.abs(tilted.lift - flat.lift) < 1e-9);
  assert.deepEqual(smileScore([]), { widthRatio: 0, lift: 0 });
});

test('a smile counts only as a change from the same face\'s neutral mouth', () => {
  const tracker = createSmileTracker();
  for (let i = 0; i < SMILE_BASELINE_FRAMES + 1; i++) assert.equal(tracker.update(neutral()), false, 'learning the neutral mouth');
  assert.equal(tracker.update(face68({ mouthWidth: 68, cornerLift: 3 })), false, 'wider but not lifted');
  assert.equal(tracker.update(face68({ mouthWidth: 56, cornerLift: 9 })), false, 'lifted but not wider');
  assert.equal(tracker.update(smiling({ roll: 0.3 })), true, 'wider and lifted, head tilted');

  const alreadySmiling = createSmileTracker();
  for (let i = 0; i < 10; i++) assert.equal(alreadySmiling.update(smiling()), false, 'no change from baseline, no confirmation');

  const early = createSmileTracker();
  early.update(neutral());
  assert.equal(early.update(smiling()), false, 'needs a baseline before a smile can count');
});
