import { CONFIRM_GESTURES, GESTURE_CONFIRM_FRAMES, isConfirmGesture, mirrorBox, SMILE_CONFIRM_FRAMES, SMILE_SYMBOL } from './faceKiosk';

// HUD for the multi-face kiosk, drawn in raw-frame space and mirrored to match the selfie preview.
const palette = {
  watching: [226, 232, 240], ready: [103, 232, 249], sending: [167, 139, 250],
  done: [45, 212, 191], unknown: [251, 146, 60], gesture: [250, 204, 21], hand: [203, 213, 225],
};
const rgba = ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
const easeOut = value => 1 - (1 - value) ** 3;
const LOCK_ON_MS = 380;
// Detection updates arrive a few times per second; easing toward them keeps boxes from jumping.
const SMOOTHING = 0.32;
const lerpBox = (from, to, amount) => ({ x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount,
  width: from.width + (to.width - from.width) * amount, height: from.height + (to.height - from.height) * amount });

function brackets(context, box, color, lineWidth, ratio = 0.24) {
  const arm = Math.min(box.width, box.height) * ratio;
  const corners = [[box.x, box.y, 1, 1], [box.x + box.width, box.y, -1, 1], [box.x, box.y + box.height, 1, -1], [box.x + box.width, box.y + box.height, -1, -1]];
  context.strokeStyle = color; context.lineWidth = lineWidth; context.lineCap = 'round';
  context.beginPath();
  for (const [x, y, dx, dy] of corners) { context.moveTo(x + arm * dx, y); context.lineTo(x, y); context.lineTo(x, y + arm * dy); }
  context.stroke();
}

function chip(context, x, y, text, color, unit) {
  const font = Math.round(13 * unit);
  context.font = `700 ${font}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
  context.textBaseline = 'middle';
  const padding = 8 * unit; const height = font + padding * 1.2; const width = context.measureText(text).width + padding * 2;
  const left = Math.max(2, Math.min(x, context.canvas.width - width - 2)); const top = Math.max(2, y - height);
  context.fillStyle = 'rgba(8, 15, 30, 0.74)';
  context.beginPath(); context.roundRect(left, top, width, height, 6 * unit); context.fill();
  context.fillStyle = color; context.fillRect(left, top + 4 * unit, 3 * unit, height - 8 * unit);
  context.fillText(text, left + padding, top + height / 2 + unit);
  return { left, top, width, height };
}

function drawFace(context, track, { now, unit, reducedMotion, frameWidth, mode, smileCalibration }) {
  // Gesture: ready once the face held frontal for five recent passes. Passive: scanning while frames are being collected.
  const ready = track.status === 'watching' && (mode === 'passive' ? track.progress > 0 : (track.frontalTimes?.length || 0) >= 5);
  const tone = palette[ready ? 'ready' : track.status];
  track.view = track.view && !reducedMotion ? lerpBox(track.view, track.box, SMOOTHING) : { ...track.box };
  const raw = mirrorBox(track.view, frameWidth);
  // Lock-on: brackets start wide and settle onto the face.
  const settle = reducedMotion ? 1 : easeOut(Math.min(1, (now - track.createdAt) / LOCK_ON_MS));
  const grow = 0.22 * (1 - settle);
  const box = { x: raw.x - raw.width * grow / 2, y: raw.y - raw.height * grow / 2, width: raw.width * (1 + grow), height: raw.height * (1 + grow) };
  const pulse = track.status === 'sending' && !reducedMotion ? 0.65 + 0.35 * Math.sin(now / 120) : 1;

  context.save();
  context.shadowColor = rgba(tone, 0.85); context.shadowBlur = 14 * unit;
  if (track.status === 'done') { context.fillStyle = rgba(tone, 0.1); context.fillRect(box.x, box.y, box.width, box.height); }
  context.strokeStyle = rgba(tone, 0.22); context.lineWidth = 1.2 * unit;
  context.strokeRect(box.x, box.y, box.width, box.height);
  brackets(context, box, rgba(tone, pulse), 3 * unit);
  context.restore();

  // Scan line sweeps while the face is ready or being confirmed.
  if ((ready || track.status === 'sending') && !reducedMotion) {
    const period = track.status === 'sending' ? 650 : 1600;
    const y = box.y + ((now % period) / period) * box.height;
    const gradient = context.createLinearGradient(box.x, 0, box.x + box.width, 0);
    gradient.addColorStop(0, rgba(tone, 0)); gradient.addColorStop(0.5, rgba(tone, 0.9)); gradient.addColorStop(1, rgba(tone, 0));
    context.fillStyle = gradient; context.fillRect(box.x, y - unit, box.width, 2 * unit);
    const trail = context.createLinearGradient(0, y - 26 * unit, 0, y);
    trail.addColorStop(0, rgba(tone, 0)); trail.addColorStop(1, rgba(tone, 0.14));
    context.fillStyle = trail; context.fillRect(box.x, Math.max(box.y, y - 26 * unit), box.width, Math.min(26 * unit, y - box.y));
  }

  const code = `S-${String(track.id).padStart(2, '0')}`;
  // Three dots show how long the current confirmation (hand gesture or smile) has been held.
  const held = track.handGesture ? (track.gestureStreak || 0) / GESTURE_CONFIRM_FRAMES : (track.smileStreak || 0) / SMILE_CONFIRM_FRAMES;
  const filled = Math.min(3, Math.round(Math.min(1, held) * 3));
  const dots = '•'.repeat(filled) + '◦'.repeat(3 - filled);
  const scan = '▮'.repeat(track.progress || 0) + '▯'.repeat(5 - (track.progress || 0));
  const confirmation = track.handGesture ? `${CONFIRM_GESTURES[track.handGesture].symbol} ${dots}`
    : track.smileStreak ? `${SMILE_SYMBOL} TAHAN ${dots}` : '👍  ✌️  😊';
  const text = { sending: `${code}  MENGONFIRMASI…`, done: `✓ ${track.label || 'HADIR'}`, unknown: `${code}  BELUM DIKENALI` }[track.status]
    || (!ready ? `${code}  HADAPKAN WAJAH` : mode === 'passive' ? `${code}  MEMINDAI ${scan}` : `${code}  ${confirmation}`);
  // Keep the label clear of the LIVE readout: faces near the top edge get it just inside the box.
  const chipHeight = 23 * unit; const above = box.y - 6 * unit;
  chip(context, box.x, above - chipHeight < 56 * unit ? box.y + chipHeight + 6 * unit : above, text, rgba(tone), unit);
  if (smileCalibration && track.smile) {
    // On-site tuning aid: current mouth geometry and its gain over this face's neutral baseline.
    const { widthRatio, lift, widthGain, liftGain } = track.smile.reading;
    const sign = value => `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
    chip(context, box.x, box.y + box.height + 30 * unit, `w ${widthRatio.toFixed(3)} (${sign(widthGain)})  l ${lift.toFixed(3)} (${sign(liftGain)})`, rgba(palette.hand), unit);
  }
  return box;
}

function drawHand(context, hand, { unit, frameWidth, linkedFace, now, reducedMotion }) {
  if (!hand.box) return;
  const confirming = isConfirmGesture(hand);
  const tone = confirming ? palette.gesture : palette.hand;
  const raw = mirrorBox(hand.box, frameWidth); const pad = Math.max(raw.width, raw.height) * 0.18;
  const box = { x: raw.x - pad, y: raw.y - pad, width: raw.width + pad * 2, height: raw.height + pad * 2 };
  context.save();
  if (confirming) { context.shadowColor = rgba(tone, 0.8); context.shadowBlur = 12 * unit; }
  brackets(context, box, rgba(tone, confirming ? 1 : 0.45), (confirming ? 2.6 : 1.6) * unit, 0.3);
  context.restore();
  if (!confirming) return;
  const { symbol, label } = CONFIRM_GESTURES[hand.gesture];
  chip(context, box.x, box.y + box.height + 26 * unit, `${symbol} ${label}`, rgba(tone), unit);
  if (!linkedFace) return;
  // Animated tether from the confirming hand to the face it belongs to.
  const from = { x: box.x + box.width / 2, y: box.y };
  const to = { x: linkedFace.x + linkedFace.width / 2, y: linkedFace.y + linkedFace.height };
  context.save();
  context.shadowColor = rgba(tone, 0.9); context.shadowBlur = 8 * unit;
  context.strokeStyle = rgba(tone, 0.9); context.lineWidth = 2 * unit;
  context.setLineDash([7 * unit, 5 * unit]); context.lineDashOffset = reducedMotion ? 0 : -(now / 35) % (12 * unit);
  context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
  context.setLineDash([]); context.fillStyle = rgba(tone);
  for (const point of [from, to]) { context.beginPath(); context.arc(point.x, point.y, 4 * unit, 0, Math.PI * 2); context.fill(); }
  context.restore();
}

export function drawKioskOverlay(context, { tracks, hands, now, reducedMotion, mode = 'gesture', smileCalibration = false }) {
  const { width } = context.canvas;
  context.clearRect(0, 0, width, context.canvas.height);
  const unit = Math.max(1, width / 900);
  const faceBoxes = new Map();
  for (const track of tracks) faceBoxes.set(track, drawFace(context, track, { now, unit, reducedMotion, frameWidth: width, mode, smileCalibration }));
  for (const hand of hands) {
    const owner = tracks.find(track => track.hand === hand);
    drawHand(context, hand, { unit, frameWidth: width, linkedFace: owner ? faceBoxes.get(owner) : null, now, reducedMotion });
  }
  // LIVE readout, top-left of the frame.
  const blink = reducedMotion ? 1 : 0.45 + 0.55 * Math.abs(Math.sin(now / 500));
  const visible = tracks.length;
  const label = `LIVE  ·  ${visible} SUBJEK`;
  const area = chip(context, 14 * unit, 44 * unit, `   ${label}`, rgba(palette.done), unit);
  context.fillStyle = rgba([239, 68, 68], blink);
  context.beginPath(); context.arc(area.left + 15 * unit, area.top + area.height / 2, 4 * unit, 0, Math.PI * 2); context.fill();
}
