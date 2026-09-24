import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleCamera, scrollProgress, stageAt, validateTour, TOUR_STAGES } from '../src/components/public/home/buildingTourMath.js';

const tour = JSON.parse(readFileSync(new URL('../public/models/lpq-building-tour.json', import.meta.url)));

test('exported route covers both floors and every presentation stop', () => {
  assert.equal(validateTour(tour), tour);
  assert.deepEqual(tour.roomCounts, { ground: 5, upper: 4 });
  assert.deepEqual(tour.stages, TOUR_STAGES);
  for (const stop of tour.stages) {
    const pose = sampleCamera(tour.keyframes, stop.progress);
    assert.ok(pose.position.every(Number.isFinite));
    assert.ok(pose.target.some((v, i) => v !== pose.position[i]));
  }
});

test('scroll clamps before/after hero and maps reverse scroll consistently', () => {
  assert.equal(scrollProgress(100, 3000, 1000), 0);
  assert.equal(scrollProgress(-1000, 3000, 1000), 0.5);
  assert.equal(scrollProgress(-4000, 3000, 1000), 1);
  assert.equal(scrollProgress(0, 500, 900), 0);
  for (const p of [0, .31, .77, 1, .77, .31, 0]) {
    const actual = sampleCamera(tour.keyframes, p);
    const exact = tour.keyframes.find((frame) => frame.progress === p);
    assert.deepEqual(actual.position, exact.position);
    assert.deepEqual(actual.target, exact.target);
  }
});

test('camera interpolation stays on each collision-checked segment', () => {
  for (let i = 1; i < tour.keyframes.length; i += 1) {
    const a = tour.keyframes[i - 1]; const b = tour.keyframes[i];
    const pose = sampleCamera(tour.keyframes, (a.progress + b.progress) / 2);
    pose.position.forEach((value, axis) => assert.ok(Math.abs(value - (a.position[axis] + b.position[axis]) / 2) < 1e-8));
  }
  assert.equal(stageAt(1), 4);
  assert.equal(stageAt(0), 0);
});

test('invalid or incomplete path data falls back instead of moving a camera', () => {
  assert.throws(() => validateTour(null));
  assert.throws(() => validateTour({ ...tour, keyframes: [...tour.keyframes].reverse() }));
  assert.throws(() => validateTour({ ...tour, keyframes: [{ progress: 0, position: [NaN, 0, 0], target: [0, 0, 0], fov: 40 }, tour.keyframes.at(-1)] }));
});

test('GLB is self-contained, within budget, and has independently revealable shades', () => {
  const glb = readFileSync(new URL('../public/models/lpq-building.glb', import.meta.url));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  assert.ok(glb.length < 12 * 1024 * 1024);
  const document = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
  assert.ok(document.meshes.length < 60);
  assert.ok(document.nodes.some((node) => node.extras?.tourReveal));
  assert.ok(document.images.every((image) => !image.uri && Number.isInteger(image.bufferView)));
  assert.ok(document.buffers.every((buffer) => !buffer.uri));
});
