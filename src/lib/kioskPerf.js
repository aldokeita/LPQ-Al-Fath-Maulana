// Timing for the kiosk's ?debug-kinerja panel. Without the flag the kiosk gets noopPerf and pays nothing.
const SAMPLE_LIMIT = 30;
const FPS_WINDOW_MS = 3000;

export const noopPerf = {
  enabled: false,
  record() {}, loop() {}, note() {},
  takeSelfCheckRequest: () => false,
};

export function createPerfMeter({ now = () => performance.now() } = {}) {
  const series = new Map(); const info = {}; let loops = []; let selfCheckRequested = false;
  return {
    enabled: true,
    // Rolling average of the last SAMPLE_LIMIT durations per label (milliseconds).
    record(label, ms) {
      const samples = series.get(label) || [];
      samples.push(ms); if (samples.length > SAMPLE_LIMIT) samples.shift();
      series.set(label, samples);
    },
    // One call per scanning-loop pass; FPS is counted over the last few seconds.
    loop() {
      const at = now(); loops.push(at);
      loops = loops.filter(time => at - time <= FPS_WINDOW_MS);
    },
    note(key, value) { info[key] = value; },
    requestSelfCheck() { selfCheckRequested = true; },
    takeSelfCheckRequest() { const requested = selfCheckRequested; selfCheckRequested = false; return requested; },
    snapshot() {
      const at = now(); const recent = loops.filter(time => at - time <= FPS_WINDOW_MS);
      const span = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0;
      return {
        fps: span > 0 ? (recent.length - 1) / (span / 1000) : 0,
        series: [...series].map(([label, samples]) => ({
          label, count: samples.length, last: samples[samples.length - 1],
          average: samples.reduce((sum, value) => sum + value, 0) / samples.length,
        })),
        info: { ...info },
      };
    },
  };
}

// Where a model file came from on this page load: 0 bytes transferred means the browser cache answered,
// a few hundred bytes means a 304 revalidation, anything bigger a fresh download.
export function resourceSource(path) {
  if (typeof performance === 'undefined' || typeof location === 'undefined') return 'tidak diketahui';
  const [entry] = performance.getEntriesByName(new URL(path, location.origin).href);
  if (!entry || !entry.decodedBodySize) return 'tidak diketahui';
  if (entry.transferSize === 0) return 'cache';
  return entry.transferSize < entry.encodedBodySize ? 'validasi ulang (304)' : 'unduh';
}
