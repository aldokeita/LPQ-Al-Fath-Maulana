// Pure helpers for the multi-face gesture kiosk. Boxes are raw (unmirrored) pixel rectangles.
// Hand gestures that confirm attendance (MediaPipe categories) and the symbol the HUD shows for each.
// Only the thumb confirms; the peace sign was turned off on 2026-10-14.
export const CONFIRM_GESTURES = { Thumb_Up: { symbol: '👍', label: 'JEMPOL' } };
export const GESTURE_MIN_SCORE = 0.6;
// Consecutive frames a gesture must be held, so a hand passing by does not confirm attendance.
export const GESTURE_CONFIRM_FRAMES = 3;
// Faces narrower than this share of the frame are too far away for a reliable descriptor.
export const MIN_FACE_RATIO = 0.08;
export const TRACK_TTL_MS = 1500;
export const FRAME_MAX_AGE_MS = 1500;
// The hand model runs on every HAND_DETECT_EVERY-th scanning pass; gesture streaks only count those passes.
export const HAND_DETECT_EVERY = 2;
// A confirmed gesture may wait this long for its five descriptor frames before it lapses.
export const CONFIRM_PENDING_MS = 2000;

// Descriptors are only computed for faces that are frontal and starting to confirm, or already confirmed.
export const wantsDescriptor = (track, frontal) => frontal && (track.gestureStreak > 0 || Boolean(track.pendingBy));
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
