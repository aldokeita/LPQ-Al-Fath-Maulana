import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve('@vladmandic/face-api/package.json'));
const packageInfo = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
if (packageInfo.version !== '1.7.15') throw new Error('Face model package version changed; re-run the compatibility/license gate.');
const destination = new URL('../public/face-models/1.7.15/', import.meta.url);
await mkdir(destination, { recursive: true });
const manifest = { version: 'faceapi-1.7.15-resnet128', files: {} };
for (const model of ['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model']) {
  for (const suffix of ['.bin', '-weights_manifest.json']) {
    const name = model + suffix;
    const bytes = await readFile(path.join(source, 'model', name));
    manifest.files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    await copyFile(path.join(source, 'model', name), new URL(name, destination));
  }
}
await copyFile(path.join(source, 'LICENSE'), new URL('LICENSE-faceapi.txt', destination));
await writeFile(new URL('integrity.json', destination), JSON.stringify(manifest, null, 2) + '\n');
console.log('Prepared three face models; no demographic or emotion models.');
