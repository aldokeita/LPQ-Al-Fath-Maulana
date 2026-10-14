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
