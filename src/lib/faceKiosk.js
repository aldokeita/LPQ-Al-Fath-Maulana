// Pure helpers for the multi-face gesture kiosk. Boxes are raw (unmirrored) pixel rectangles.
// Hand gestures that confirm attendance (MediaPipe categories) and the symbol the HUD shows for each.
export const CONFIRM_GESTURES = { Thumb_Up: { symbol: '👍', label: 'JEMPOL' }, Victory: { symbol: '✌️', label: 'PEACE' } };
export const GESTURE_MIN_SCORE = 0.6;
// Consecutive frames a gesture must be held, so a hand passing by does not confirm attendance.
export const GESTURE_CONFIRM_FRAMES = 3;
// A smile must be held longer (about a second) so a passer-by who happens to smile is not recorded.
export const SMILE_CONFIRM_FRAMES = 6;
export const SMILE_SYMBOL = '😊';
// Smiles are measured against each face's own neutral mouth, because absolute landmark geometry varies
// too much between people. Tune these deltas on site (open the kiosk with ?kalibrasi-senyum).
export const SMILE_WIDTH_DELTA = 0.06;
export const SMILE_LIFT_DELTA = 0.035;
// Frontal frames needed to learn a neutral baseline before any smile can count.
export const SMILE_BASELINE_FRAMES = 4;
// The baseline creeps up slowly so one low glitch frame cannot lock it too low.
const BASELINE_DRIFT = 0.004;
// Faces narrower than this share of the frame are too far away for a reliable descriptor.
export const MIN_FACE_RATIO = 0.08;
export const TRACK_TTL_MS = 1500;
export const FRAME_MAX_AGE_MS = 1500;
// The hand model runs on every HAND_DETECT_EVERY-th scanning pass; gesture streaks only count those passes.
export const HAND_DETECT_EVERY = 2;
// A confirmed gesture or smile may wait this long for its five descriptor frames before it lapses.
export const CONFIRM_PENDING_MS = 2000;

// Descriptors are only computed for faces that are frontal and starting to confirm, or already confirmed.
export const wantsDescriptor = (track, frontal) => frontal && (track.gestureStreak > 0 || track.smileStreak > 0 || Boolean(track.pendingBy));
// Timestamps of recent frontal passes (at most five), so the HUD can show a face as ready without descriptors.
export const recentFrontal = (times, now, frontal) => [...times.filter(time => now - time <= FRAME_MAX_AGE_MS), ...(frontal ? [now] : [])].slice(-5);
// Five frames spanning the server's minimum interval are enough to send.
export const framesReady = (frames, minSpanMs) => frames.length === 5 && frames[4].at - frames[0].at >= minSpanMs;

// face-api boxes expose x/y/width/height as prototype getters, which object spread drops; copy them explicitly.
export const plainBox = box => ({ x: box.x, y: box.y, width: box.width, height: box.height });

export const iou = (a, b) => {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  const overlap = width * height;
  return overlap / (a.width * a.height + b.width * b.height - overlap);
};

// Greedy IoU matching of this frame's faces to existing tracks.
export function matchTracks(tracks, boxes, minIou = 0.3) {
  const pairs = boxes.flatMap((box, detection) => tracks.map((track, index) => ({ detection, index, score: iou(track.box, box) })))
    .filter(pair => pair.score >= minIou).sort((left, right) => right.score - left.score);
  const usedTracks = new Set(); const usedDetections = new Set(); const matches = [];
  for (const pair of pairs) {
    if (usedTracks.has(pair.index) || usedDetections.has(pair.detection)) continue;
    usedTracks.add(pair.index); usedDetections.add(pair.detection); matches.push({ track: pair.index, detection: pair.detection });
  }
  return { matches, unmatched: boxes.map((_, index) => index).filter(index => !usedDetections.has(index)) };
}

export const isConfirmGesture = hand => Boolean(CONFIRM_GESTURES[hand.gesture]) && hand.score >= GESTURE_MIN_SCORE;

// A confirming hand belongs to the nearest face it could plausibly come from: beside or below it.
// Returns face index -> { handIndex, gesture }, so the overlay can link each hand to its face.
export function assignGesturesToFaces(hands, boxes) {
  const owners = new Map();
  for (const [handIndex, hand] of hands.entries()) {
    if (!isConfirmGesture(hand)) continue;
    let best = -1; let bestDistance = Infinity;
    boxes.forEach((box, index) => {
      if (owners.has(index)) return;
      const centerX = box.x + box.width / 2; const centerY = box.y + box.height / 2;
      const plausible = Math.abs(hand.x - centerX) <= box.width * 2
        && hand.y >= box.y - box.height * 0.5 && hand.y <= box.y + box.height * 3.5;
      const distance = Math.hypot(hand.x - centerX, hand.y - centerY);
      if (plausible && distance < bestDistance) { best = index; bestDistance = distance; }
    });
    if (best >= 0) owners.set(best, { handIndex, gesture: hand.gesture });
  }
  return owners;
}

export const mirrorBox = (box, frameWidth) => ({ ...box, x: frameWidth - box.x - box.width });

// Mouth geometry from 68 face landmarks, rotated level with the eyes: mouth width against the outer eye
// corners, and how far the lip corners (48/54) sit above the inner lip line (62/66).
export function smileScore(points) {
  if (!points || points.length < 68) return { widthRatio: 0, lift: 0 };
  const left = points[36]; const right = points[45];
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  const cos = Math.cos(-angle); const sin = Math.sin(-angle);
  const level = point => ({ x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos });
  const [eyeLeft, eyeRight, cornerLeft, cornerRight, innerUpper, innerLower] = [36, 45, 48, 54, 62, 66].map(index => level(points[index]));
  const eyeSpan = Math.abs(eyeRight.x - eyeLeft.x); const mouthWidth = Math.abs(cornerRight.x - cornerLeft.x);
  if (!eyeSpan || !mouthWidth) return { widthRatio: 0, lift: 0 };
  const lipLine = (innerUpper.y + innerLower.y) / 2; const corners = (cornerLeft.y + cornerRight.y) / 2;
  return { widthRatio: mouthWidth / eyeSpan, lift: (lipLine - corners) / mouthWidth };
}

// Per-face smile detector: learns the neutral mouth, then reports a smile when the mouth is both wider and
// lifted beyond that baseline. Someone who arrives already smiling simply cannot confirm by smile.
export function createSmileTracker() {
  let baseline = null; let samples = 0; let last = { widthRatio: 0, lift: 0, widthGain: 0, liftGain: 0 };
  return {
    update(points) {
      const score = smileScore(points);
      if (!score.widthRatio) return false;
      samples += 1;
      baseline = baseline
        ? { widthRatio: Math.min(score.widthRatio, baseline.widthRatio + BASELINE_DRIFT), lift: Math.min(score.lift, baseline.lift + BASELINE_DRIFT) }
        : { ...score };
      last = { ...score, widthGain: score.widthRatio - baseline.widthRatio, liftGain: score.lift - baseline.lift };
      return samples > SMILE_BASELINE_FRAMES && last.widthGain >= SMILE_WIDTH_DELTA && last.liftGain >= SMILE_LIFT_DELTA;
    },
    get reading() { return last; },
  };
}
