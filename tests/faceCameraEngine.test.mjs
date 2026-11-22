import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_LOSS_GRACE_MS, mirroredPose } from '../src/lib/faceCameraEngine.js';
import { captureSteps } from '../supabase/functions/_shared/faceCapture.js';

test('mirrored preview swaps side labels without changing the raw capture order', () => {
  assert.equal(mirroredPose('left'), 'right');
  assert.equal(mirroredPose('right'), 'left');
  assert.equal(mirroredPose('center'), 'center');
  const raw = captureSteps('left');
  assert.deepEqual(raw, ['center', 'left', 'center', 'right', 'center']);
  assert.deepEqual(raw.map(mirroredPose), ['center', 'right', 'center', 'left', 'center']);
});

test('a brief slip out of the guide is tolerated for a bounded time', () => {
  assert.ok(FACE_LOSS_GRACE_MS >= 1000 && FACE_LOSS_GRACE_MS <= 5000);
});

test('a face too close or too far gets the matching hint before any pixels are read', async () => {
  const { frameIssue, frameHint } = await import('../src/lib/faceCameraEngine.js');
  const video = { videoWidth: 480 };
  const face = width => ({ detection: { score: 0.95, box: { x: 0, y: 0, width, height: width } } });
  assert.equal(frameIssue(video, face(420), null, { centered: false, minRatio: 0.12 }), 'close');
  assert.equal(frameIssue(video, face(30), null, { centered: false, minRatio: 0.12 }), 'far');
  assert.match(frameHint('close', 'center'), /Mundur/);
  assert.match(frameHint('far', 'center'), /Mendekat/);
  assert.match(frameHint(null, 'left'), /lurus/);
});
