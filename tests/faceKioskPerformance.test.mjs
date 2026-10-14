import test from 'node:test';
import assert from 'node:assert/strict';
import { createChallengeCache } from '../src/lib/faceChallengeCache.js';
import { createPerfMeter, noopPerf } from '../src/lib/kioskPerf.js';
import { framesReady, recentFrontal, wantsDescriptor, FRAME_MAX_AGE_MS } from '../src/lib/faceKiosk.js';
import { ENROLL_DETECTOR_SIZE, KIOSK_DETECTOR_SIZE, parseDetectorSize } from '../src/lib/faceCameraEngine.js';
import { PASSIVE_MIN_SPAN_MS } from '../supabase/functions/_shared/faceCapture.js';

const clock = () => { let time = 0; return { now: () => time, advance: ms => { time += ms; } }; };
const counter = () => { let issued = 0; const request = async () => ({ id: `c${++issued}` }); return { request, issued: () => issued }; };

test('a prefetched challenge is handed out without another request, and the next one starts loading', async () => {
  const time = clock(); const server = counter();
  const cache = createChallengeCache(server.request, { now: time.now });
  await cache.ensure();
  assert.equal(server.issued(), 1);
  assert.deepEqual(await cache.take(), { id: 'c1' });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(server.issued(), 2);
  assert.deepEqual(await cache.take(), { id: 'c2' });
});

test('a stale challenge is never handed out', async () => {
  const time = clock(); const server = counter();
  const cache = createChallengeCache(server.request, { now: time.now, maxAgeMs: 30000 });
  await cache.ensure();
  time.advance(30001);
  assert.deepEqual(await cache.take(), { id: 'c2' });
});

test('prefetch does not stack requests and backs off after a failure', async () => {
  const time = clock(); let calls = 0; let fail = true;
  const cache = createChallengeCache(async () => { calls += 1; if (fail) throw new Error('offline'); return { id: 'ok' }; }, { now: time.now, retryMs: 5000 });
  cache.prefetch(); cache.prefetch();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  cache.prefetch();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1, 'no retry inside the back-off window');
  time.advance(5000); fail = false; cache.prefetch();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  assert.deepEqual(await cache.take(), { id: 'ok' });
});

test('take surfaces a request error so the kiosk can report it', async () => {
  const cache = createChallengeCache(async () => { throw new Error('Sesi login tidak tersedia.'); });
  await assert.rejects(cache.take(), /Sesi login/);
});

test('descriptors are only wanted for frontal faces that are confirming', () => {
  const idle = { gestureStreak: 0, smileStreak: 0, pendingBy: null };
  assert.equal(wantsDescriptor(idle, true), false);
  assert.equal(wantsDescriptor({ ...idle, gestureStreak: 1 }, true), true);
  assert.equal(wantsDescriptor({ ...idle, smileStreak: 2 }, true), true);
  assert.equal(wantsDescriptor({ ...idle, pendingBy: '👍' }, true), true);
  assert.equal(wantsDescriptor({ ...idle, gestureStreak: 3 }, false), false);
});

test('five frames must span the server minimum before sending', () => {
  const frames = at => at.map(time => ({ at: time }));
  assert.equal(framesReady(frames([0, 100, 200, 300]), PASSIVE_MIN_SPAN_MS), false);
  assert.equal(framesReady(frames([0, 50, 100, 150, 200]), PASSIVE_MIN_SPAN_MS), false);
  assert.equal(framesReady(frames([0, 80, 160, 240, 320]), PASSIVE_MIN_SPAN_MS), true);
});

test('recent frontal passes stay capped at five and age out', () => {
  let times = [];
  for (let at = 0; at < 700; at += 100) times = recentFrontal(times, at, true);
  assert.deepEqual(times, [200, 300, 400, 500, 600]);
  times = recentFrontal(times, 650, false);
  assert.equal(times.length, 5);
  times = recentFrontal(times, 600 + FRAME_MAX_AGE_MS + 1, false);
  assert.deepEqual(times, []);
});

test('the perf meter averages recent samples and counts loop rate', () => {
  const time = clock(); const meter = createPerfMeter({ now: time.now });
  meter.record('deteksi', 100); meter.record('deteksi', 50);
  for (let i = 0; i < 11; i += 1) { meter.loop(); time.advance(100); }
  const snapshot = meter.snapshot();
  assert.deepEqual(snapshot.series, [{ label: 'deteksi', count: 2, last: 50, average: 75 }]);
  assert.ok(Math.abs(snapshot.fps - 10) < 0.01);
  meter.requestSelfCheck();
  assert.equal(meter.takeSelfCheckRequest(), true);
  assert.equal(meter.takeSelfCheckRequest(), false);
  assert.equal(noopPerf.takeSelfCheckRequest(), false);
});

test('detector size only accepts sizes TinyFaceDetector supports', () => {
  assert.equal(parseDetectorSize(null), KIOSK_DETECTOR_SIZE);
  assert.equal(parseDetectorSize('384'), 384);
  assert.equal(parseDetectorSize('300'), KIOSK_DETECTOR_SIZE);
  assert.equal(ENROLL_DETECTOR_SIZE, 416, 'enrollment keeps the size existing templates were made with');
});
