export const TOUR_STAGES = [
  { id: 'exterior', label: 'Tampak depan', progress: 0 },
  { id: 'ground', label: 'Kelas lantai 1', progress: 0.31 },
  { id: 'stairs', label: 'Tangga dan selasar', progress: 0.55 },
  { id: 'upper', label: 'Kelas lantai 2', progress: 0.77 },
  { id: 'terrace', label: 'Ruang semi indoor', progress: 1 },
];

export const clampProgress = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function scrollProgress(top, height, viewportHeight) {
  return clampProgress(-top / Math.max(1, height - viewportHeight));
}

export function stageAt(progress) {
  const p = clampProgress(progress);
  return TOUR_STAGES.reduce((best, stage, index) => (
    Math.abs(stage.progress - p) < Math.abs(TOUR_STAGES[best].progress - p) ? index : best
  ), 0);
}

export function sampleCamera(keyframes, progress) {
  const p = clampProgress(progress);
  const next = keyframes.findIndex((frame) => frame.progress >= p);
  if (next <= 0) return next === 0 ? keyframes[0] : keyframes[keyframes.length - 1];
  const a = keyframes[next - 1];
  const b = keyframes[next];
  const t = (p - a.progress) / (b.progress - a.progress);
  const mix = (x, y) => x + (y - x) * t;
  return {
    position: a.position.map((value, i) => mix(value, b.position[i])),
    target: a.target.map((value, i) => mix(value, b.target[i])),
    fov: mix(a.fov, b.fov),
  };
}

export function validateTour(data) {
  if (data?.version !== 1 || data?.upAxis !== 'Y' || !Array.isArray(data.keyframes) || data.keyframes.length < 2) {
    throw new Error('Data jalur tur tidak valid.');
  }
  let last = -1;
  for (const frame of data.keyframes) {
    if (!Number.isFinite(frame.progress) || frame.progress <= last || frame.progress > 1
      || ![frame.position, frame.target].every((vector) => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite))
      || !Number.isFinite(frame.fov) || frame.fov < 10 || frame.fov > 100) {
      throw new Error('Koordinat tur tidak valid.');
    }
    last = frame.progress;
  }
  if (data.keyframes[0].progress !== 0 || last !== 1) throw new Error('Jalur tur tidak lengkap.');
  return data;
}
