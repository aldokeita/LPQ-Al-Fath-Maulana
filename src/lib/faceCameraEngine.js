import { FACE_MODEL_VERSION } from '../../supabase/functions/_shared/faceCapture.js';

let loadPromise;
export const loadFaceEngine = () => {
  if (!loadPromise) loadPromise = initialize().catch(error => { loadPromise = null; throw error; });
  return loadPromise;
};

async function initialize() {
  const api = await import('@vladmandic/face-api/dist/face-api.esm.js');
  await api.tf.setBackend('webgl');
  await api.tf.ready();
  const base = '/face-models/1.7.15/';
  const integrityResponse = await fetch(base + 'integrity.json', { signal:AbortSignal.timeout(15000) });
  if (!integrityResponse.ok) throw new Error('MODEL_UNAVAILABLE');
  const integrity = await integrityResponse.json();
  if (integrity.version !== FACE_MODEL_VERSION) throw new Error('MODEL_VERSION_MISMATCH');
  const nets = [api.nets.tinyFaceDetector, api.nets.faceLandmark68Net, api.nets.faceRecognitionNet];
  try {
    for (const [i, name] of ['tiny_face_detector_model','face_landmark_68_model','face_recognition_model'].entries()) {
      const manifestResponse = await fetch(base + name + '-weights_manifest.json', { signal:AbortSignal.timeout(15000) });
      const weightsResponse = await fetch(base + name + '.bin', { signal:AbortSignal.timeout(15000) });
      if (!manifestResponse.ok || !weightsResponse.ok) throw new Error('MODEL_UNAVAILABLE');
      const manifestBytes = await manifestResponse.arrayBuffer();
      const weights = await weightsResponse.arrayBuffer();
      for (const [filename, bytes] of [[name + '.bin', weights], [name + '-weights_manifest.json', manifestBytes]]) {
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map(v => v.toString(16).padStart(2, '0')).join('');
        if (hash !== integrity.files[filename]?.sha256) throw new Error('MODEL_INTEGRITY_FAILED');
      }
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      await nets[i].loadFromWeightMap(api.tf.io.decodeWeights(weights, manifest.flatMap(row => row.weights)));
    }
  } catch (error) { nets.forEach(net => { if (net.isLoaded) net.dispose(); }); throw error; }
  return {
    async detect(video) {
      return api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.8 }))
        .withFaceLandmarks().withFaceDescriptors();
    },
  };
}

export function frameQuality(video, result, canvas) {
  const { box, score } = result.detection;
  const ratio = box.width / video.videoWidth;
  if (score < 0.85 || ratio < 0.2 || ratio > 0.7
    || Math.abs((box.x + box.width / 2) / video.videoWidth - 0.5) > 0.22) return false;
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
