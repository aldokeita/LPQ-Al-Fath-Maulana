const MODEL_BASE = '/gesture-models/gesture_recognizer-float16-1/';
const MODEL_VERSION = 'mediapipe-gesture_recognizer-float16-1';
const MODEL_FILE = 'gesture_recognizer.task';

let loadPromise;
export const loadGestureEngine = () => {
  if (!loadPromise) loadPromise = initialize().catch(error => { loadPromise = null; throw error; });
  return loadPromise;
};

async function initialize() {
  const integrityResponse = await fetch(MODEL_BASE + 'integrity.json', { signal: AbortSignal.timeout(15000) });
  if (!integrityResponse.ok) throw new Error('MODEL_UNAVAILABLE');
  const integrity = await integrityResponse.json();
  if (integrity.version !== MODEL_VERSION) throw new Error('MODEL_VERSION_MISMATCH');
  const modelResponse = await fetch(MODEL_BASE + MODEL_FILE, { signal: AbortSignal.timeout(30000) });
  if (!modelResponse.ok) throw new Error('MODEL_UNAVAILABLE');
  const model = new Uint8Array(await modelResponse.arrayBuffer());
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', model)))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== integrity.files[MODEL_FILE]?.sha256) throw new Error('MODEL_INTEGRITY_FAILED');

  const { GestureRecognizer } = await import('@mediapipe/tasks-vision');
  // Vite emits these as hashed build assets; nothing is fetched until gesture mode starts.
  const fileset = {
    wasmLoaderPath: new URL('../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', import.meta.url).href,
    wasmBinaryPath: new URL('../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', import.meta.url).href,
  };
  const options = delegate => ({
    baseOptions: { modelAssetBuffer: model, delegate },
    runningMode: 'VIDEO', numHands: 4,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
  });
  let recognizer;
  try { recognizer = await GestureRecognizer.createFromOptions(fileset, options('GPU')); }
  catch { recognizer = await GestureRecognizer.createFromOptions(fileset, options('CPU')); }

  let lastTimestamp = 0;
  return {
    // Hands in raw (unmirrored) pixel coordinates with their top gesture.
    detect(video) {
      const timestamp = Math.max(performance.now(), lastTimestamp + 1); lastTimestamp = timestamp;
      const result = recognizer.recognizeForVideo(video, timestamp);
      return (result.landmarks || []).map((points, index) => {
        const top = result.gestures?.[index]?.[0];
        const x = points.reduce((sum, point) => sum + point.x, 0) / points.length * video.videoWidth;
        const y = points.reduce((sum, point) => sum + point.y, 0) / points.length * video.videoHeight;
        return { gesture: top?.categoryName || 'None', score: top?.score || 0, x, y };
      });
    },
  };
}
