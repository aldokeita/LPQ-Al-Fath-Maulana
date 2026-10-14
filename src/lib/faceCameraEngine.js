import { descriptorDistance, FACE_MODEL_VERSION } from '../../supabase/functions/_shared/faceCapture.js';

// A face may slip out of the guide while turning; keep progress this long before restarting.
export const FACE_LOSS_GRACE_MS = 2500;
// The preview is mirrored like a selfie, so raw-frame poses are shown from the user's own point of view.
export const mirroredPose = pose => ({ left: 'right', right: 'left' }[pose] || pose);

// Enrollment keeps the original detector size so new templates match the ones already stored.
export const ENROLL_DETECTOR_SIZE = 416;
// Smaller sizes are cheaper but lower detection scores below the 0.8/0.85 gates (sample portraits at 1280 px
// fell from 0.86 at 416 to 0.52 at 320), so the kiosk keeps 416 until a smaller size is proven on site.
export const KIOSK_DETECTOR_SIZE = 416;
// TinyFaceDetector accepts multiples of 32; these are the sizes worth trying on site (?ukuran-deteksi=384).
export const DETECTOR_SIZES = [224, 256, 288, 320, 352, 384, 416, 448, 512, 608];
export const parseDetectorSize = value => (DETECTOR_SIZES.includes(Number(value)) ? Number(value) : KIOSK_DETECTOR_SIZE);

const MODEL_BASE = '/face-models/1.7.15/';
export const FACE_MODEL_URLS = ['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model']
  .flatMap(name => [`${MODEL_BASE}${name}-weights_manifest.json`, `${MODEL_BASE}${name}.bin`]);

let loadPromise;
export const loadFaceEngine = () => {
  if (!loadPromise) loadPromise = initialize().catch(error => { loadPromise = null; throw error; });
  return loadPromise;
};

async function fetchBytes(url) {
  const response = await fetch(url, { signal:AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('MODEL_UNAVAILABLE');
  return response.arrayBuffer();
}

async function initialize() {
  const api = await import('@vladmandic/face-api/dist/face-api.esm.js');
  await api.tf.setBackend('webgl');
  await api.tf.ready();
  const integrityResponse = await fetch(MODEL_BASE + 'integrity.json', { signal:AbortSignal.timeout(15000) });
  if (!integrityResponse.ok) throw new Error('MODEL_UNAVAILABLE');
  const integrity = await integrityResponse.json();
  if (integrity.version !== FACE_MODEL_VERSION) throw new Error('MODEL_VERSION_MISMATCH');
  const nets = [api.nets.tinyFaceDetector, api.nets.faceLandmark68Net, api.nets.faceRecognitionNet];
  try {
    // All six files download together; each is still hashed before any weights are decoded.
    const files = await Promise.all(FACE_MODEL_URLS.map(fetchBytes));
    for (const [index, bytes] of files.entries()) {
      const filename = FACE_MODEL_URLS[index].slice(MODEL_BASE.length);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map(v => v.toString(16).padStart(2, '0')).join('');
      if (hash !== integrity.files[filename]?.sha256) throw new Error('MODEL_INTEGRITY_FAILED');
    }
    for (const [i, net] of nets.entries()) {
      const manifest = JSON.parse(new TextDecoder().decode(files[i * 2]));
      await net.loadFromWeightMap(api.tf.io.decodeWeights(files[i * 2 + 1], manifest.flatMap(row => row.weights)));
    }
  } catch (error) { nets.forEach(net => { if (net.isLoaded) net.dispose(); }); throw error; }

  const options = inputSize => new api.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.8 });
  const detectFaces = (input, inputSize = KIOSK_DETECTOR_SIZE) => api.detectAllFaces(input, options(inputSize)).withFaceLandmarks();
  // Same crop as face-api's withFaceDescriptors(): dlib alignment from the 68 landmarks, not alignedRect,
  // so descriptors stay comparable with every stored template.
  const describe = async (input, results) => {
    if (!results.length) return [];
    const faces = await api.extractFaces(input, results.map(result => result.landmarks.align(null, { useDlibAlignment: true })));
    try { return await Promise.all(faces.map(face => api.nets.faceRecognitionNet.computeFaceDescriptor(face))); }
    finally { faces.forEach(face => { face.width = 0; face.height = 0; }); }
  };
  return {
    // Full pipeline for enrollment: detector, landmarks and a descriptor for every face.
    async detect(video) {
      return api.detectAllFaces(video, options(ENROLL_DETECTOR_SIZE)).withFaceLandmarks().withFaceDescriptors();
    },
    // Kiosk scanning: boxes and landmarks only (HUD, tracking, pose). Descriptors come from describe().
    detectFaces,
    describe,
    // On-site check (?debug-kinerja): the kiosk path must give the descriptor the enrollment path gives.
    // pathDistance isolates the crop (same detection), distance adds the smaller detector size.
    async compareDescriptorPaths(input, inputSize = KIOSK_DETECTOR_SIZE) {
      const full = await api.detectAllFaces(input, options(ENROLL_DETECTOR_SIZE)).withFaceLandmarks().withFaceDescriptors();
      const fast = await detectFaces(input, inputSize);
      if (full.length !== 1 || fast.length !== 1) return { state: 'faces', full: full.length, fast: fast.length };
      const [sameDetection] = await describe(input, full);
      const [kiosk] = await describe(input, fast);
      const reference = Array.from(full[0].descriptor);
      return { state: 'ok', inputSize, pathDistance: descriptorDistance(reference, Array.from(sameDetection)), distance: descriptorDistance(reference, Array.from(kiosk)) };
    },
  };
}

// Defaults suit the single-face guide; the multi-face kiosk passes centered:false and a smaller minimum size.
export function frameQuality(video, result, canvas, { centered = true, minRatio = 0.2 } = {}) {
  const { box, score } = result.detection;
  const ratio = box.width / video.videoWidth;
  if (score < 0.85 || ratio < minRatio || ratio > 0.7
    || (centered && Math.abs((box.x + box.width / 2) / video.videoWidth - 0.5) > 0.22)) return false;
  canvas.width = 48; canvas.height = 48;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, 48, 48);
  const pixels = context.getImageData(0, 0, 48, 48).data;
  const grey = [];
  for (let i = 0; i < pixels.length; i += 4) grey.push((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
  const brightness = grey.reduce((a, b) => a + b, 0) / grey.length;
  let sharpness = 0;
  for (let y = 1; y < 47; y++) for (let x = 1; x < 47; x++) {
    const i = y * 48 + x;
    sharpness += (grey[i - 1] + grey[i + 1] + grey[i - 48] + grey[i + 48] - 4 * grey[i]) ** 2;
  }
  context.clearRect(0, 0, 48, 48);
  return brightness >= 45 && brightness <= 220 && sharpness / (46 * 46) >= 60;
}

export function facePose(result) {
  const left = result.landmarks.getLeftEye(); const right = result.landmarks.getRightEye();
  const averageX = points => points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const a = averageX(left); const b = averageX(right);
  const nose = result.landmarks.getNose()[3].x;
  const displacement = (nose - (a + b) / 2) / Math.max(Math.abs(b - a), 1);
  return displacement < -0.18 ? 'left' : displacement > 0.18 ? 'right' : Math.abs(displacement) < 0.1 ? 'center' : 'moving';
}
