// Pure helpers for the multi-face, thumbs-up kiosk. Boxes are raw (unmirrored) pixel rectangles.
export const THUMB_GESTURE = 'Thumb_Up';
export const THUMB_MIN_SCORE = 0.6;
// Consecutive frames a thumb must be held, so a hand passing by does not confirm attendance.
export const THUMB_CONFIRM_FRAMES = 3;
// Faces narrower than this share of the frame are too far away for a reliable descriptor.
export const MIN_FACE_RATIO = 0.08;
export const TRACK_TTL_MS = 1500;
export const FRAME_MAX_AGE_MS = 1500;

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

// A raised thumb belongs to the nearest face it could plausibly come from: beside or below it.
export function assignThumbsToFaces(hands, boxes) {
  const owners = new Set();
  for (const hand of hands) {
    if (hand.gesture !== THUMB_GESTURE || hand.score < THUMB_MIN_SCORE) continue;
    let best = -1; let bestDistance = Infinity;
    boxes.forEach((box, index) => {
      if (owners.has(index)) return;
      const centerX = box.x + box.width / 2; const centerY = box.y + box.height / 2;
      const plausible = Math.abs(hand.x - centerX) <= box.width * 2
        && hand.y >= box.y - box.height * 0.5 && hand.y <= box.y + box.height * 3.5;
      const distance = Math.hypot(hand.x - centerX, hand.y - centerY);
      if (plausible && distance < bestDistance) { best = index; bestDistance = distance; }
    });
    if (best >= 0) owners.add(best);
  }
  return owners;
}

export const mirrorBox = (box, frameWidth) => ({ ...box, x: frameWidth - box.x - box.width });
