import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadFaceEngine, frameQuality, facePose } from '@/lib/faceCameraEngine';
import { faceAttendanceRequest } from '@/lib/faceAttendanceApi';
import { captureSteps, descriptorDistance, FACE_MODEL_VERSION, getCameraErrorMessage } from '../../../../supabase/functions/_shared/faceCapture.js';

const instructions = { center: 'Hadapkan wajah ke tengah', left: 'Putar wajah perlahan ke kiri layar', right: 'Putar wajah perlahan ke kanan layar' };

export default function FaceCameraCapture({ purpose = 'attendance', santriId, consent, onCapture }) {
  const video = useRef(null); const stream = useRef(null); const generation = useRef(0);
  const callback = useRef(onCapture); callback.current = onCapture;
  const [state, setState] = useState('idle'); const [message, setMessage] = useState('Kamera hanya aktif setelah Anda menekan Mulai kamera.');
  const stop = () => {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(() => {
    const hidden = () => { if (document.hidden) { stop(); setState('idle'); setMessage('Kamera dihentikan saat halaman tidak aktif.'); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { stop(); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  async function start() {
    stop(); const ticket = generation.current;
    let descriptors = []; let poseSamples = [];
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia pada browser ini. Gunakan HTTPS atau kartu RFID.');
      setState('permission'); setMessage('Meminta izin kamera...');
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
      if (ticket !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      media.getVideoTracks()[0].addEventListener('ended', () => {
        if (ticket === generation.current) { stop(); setState('error'); setMessage('Koneksi kamera terputus. Hubungkan kembali kamera.'); }
      }, { once: true });
      video.current.srcObject = media; await video.current.play();
      setState('loading'); setMessage('Memuat model pengenalan wajah...');
      const engine = await loadFaceEngine();
      if (ticket !== generation.current) return;
      let challenge = await faceAttendanceRequest({ action: 'challenge', purpose, santriId, consent });
      let steps = captureSteps(challenge.firstDirection); let step = 0; let poseStart = 0;
      let began = performance.now(); let evidence = []; let waitingUntil = 0; let waitForExit = false; let reference = null;
      const canvas = document.createElement('canvas');
      setState('active');
      while (ticket === generation.current && stream.current?.active) {
        const results = await engine.detect(video.current);
        if (ticket !== generation.current) break;
        if (waitForExit) {
          if (Date.now() >= waitingUntil && results.length) {
            setState('waiting'); setMessage('Tunggu area kamera kosong sebelum santri berikutnya.');
          }
          if (!results.length && Date.now() >= waitingUntil) {
            challenge = await faceAttendanceRequest({ action: 'challenge', purpose, santriId, consent });
            steps = captureSteps(challenge.firstDirection); step = 0; evidence = []; descriptors = []; poseSamples = [];
            began = performance.now(); poseStart = 0; waitForExit = false; reference = null; setState('active');
          } else { await new Promise(resolve => setTimeout(resolve, 160)); continue; }
        }
        if (Date.now() >= Date.parse(challenge.expiresAt)) throw new Error('Tantangan kedaluwarsa. Tekan Mulai lagi.');
        if (results.length !== 1) {
          step = 0; evidence = []; descriptors.forEach(row => row.fill(0)); descriptors = [];
          poseSamples.forEach(row => row.fill(0)); poseSamples = []; poseStart = 0; reference = null;
          setMessage(results.length > 1 ? 'Beberapa wajah terdeteksi. Satu santri saja di depan kamera.' : 'Kamera aktif. Posisikan satu wajah pada panduan.');
          await new Promise(resolve => setTimeout(resolve, 160)); continue;
        }
        const face = results[0];
        if (!frameQuality(video.current, face, canvas)) {
          step = 0; evidence = []; poseStart = 0; reference = null;
          poseSamples.forEach(row => row.fill(0)); poseSamples = [];
          descriptors.forEach(row => row.fill(0)); descriptors = []; setMessage('Dekatkan wajah dan pastikan pencahayaan cukup serta gambar tidak kabur.');
          await new Promise(resolve => setTimeout(resolve, 160)); continue;
        }
        const pose = facePose(face); const now = performance.now();
        const currentDescriptor = Array.from(face.descriptor);
        if (reference && descriptorDistance(currentDescriptor, reference) > 0.45) {
          step = 0; evidence = []; poseStart = 0; reference.fill(0); reference = null;
          poseSamples.forEach(row => row.fill(0)); poseSamples = [];
          descriptors.forEach(row => row.fill(0)); descriptors = [];
          setMessage('Wajah berubah atau hasil tidak konsisten. Ulangi dari posisi tengah.'); continue;
        }
        if (!reference && pose === 'center') reference = currentDescriptor;
        setMessage(instructions[steps[step]]); setState('detected');
        if (pose !== steps[step]) { poseStart = 0; descriptors = []; }
        else {
          if (!poseStart) poseStart = now;
          if (now - poseStart >= 350 && step < 4) {
            poseSamples.push(currentDescriptor);
            evidence.push({ pose, elapsedMs: now - began, faceCount: 1, quality: true }); step++; poseStart = 0;
          } else if (step === 4) {
            const descriptor = Array.from(face.descriptor);
            if (descriptors.length && descriptorDistance(descriptor, descriptors[0]) > 0.25) {
              descriptors.forEach(row => row.fill(0)); descriptors = [];
              setMessage('Hasil wajah belum stabil. Tetap menghadap ke tengah.');
            } else descriptors.push(descriptor);
            if (descriptors.length === 5) {
              evidence.push({ pose, elapsedMs: now - began, faceCount: 1, quality: true });
              setState('recognizing'); setMessage(purpose === 'enroll' ? 'Menyimpan registrasi wajah...' : 'Mengenali wajah dan mengonfirmasi pencatatan...');
              const samples = purpose === 'enroll' ? [...poseSamples, descriptors[descriptors.length - 1]] : descriptors;
              const result = await callback.current({ challengeId: challenge.id, modelVersion: FACE_MODEL_VERSION, descriptors:samples, evidence });
              descriptors.forEach(row => row.fill(0)); descriptors = [];
              poseSamples.forEach(row => row.fill(0)); poseSamples = [];
              if (ticket !== generation.current) break;
              setState(result?.success ? 'success' : 'unrecognized');
              setMessage(result?.message || 'Hasil belum dikenali. Silakan gunakan RFID.');
              if (purpose === 'enroll') { stop(); break; }
              waitForExit = true; waitingUntil = Date.now() + 5000;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 120));
      }
      canvas.width = 0; canvas.height = 0;
    } catch (error) {
      if (ticket !== generation.current) return;
      stop(); setState('error');
      setMessage(error?.name && error.name !== 'Error' ? getCameraErrorMessage(error)
        : String(error.message || '').startsWith('MODEL_') ? 'Model wajah tidak dapat diverifikasi. Coba lagi atau hubungi admin.'
        : error.message || getCameraErrorMessage(error));
    } finally { descriptors.forEach(row => row.fill(0)); descriptors = []; poseSamples.forEach(row => row.fill(0)); poseSamples = []; }
  }

  const running = !['idle','error'].includes(state);
  return <section className="face-camera" aria-label="Kamera pengenalan wajah">
    <div className="face-camera__viewport">
      <video ref={video} muted playsInline aria-label="Pratinjau kamera langsung, tidak direkam" />
      <div className="face-camera__guide" aria-hidden="true" />
      {state === 'idle' && <Camera className="face-camera__placeholder" aria-hidden="true" />}
    </div>
    <div className="face-camera__status" role="status" aria-live="polite" aria-atomic="true"><p>{message}</p></div>
    <div className="face-camera__controls">
      <Button type="button" onClick={start} disabled={running}>{state === 'error' ? <RefreshCw /> : <Camera />}{state === 'error' ? 'Mulai lagi' : 'Mulai kamera'}</Button>
      <Button type="button" variant="outline" onClick={() => { stop(); setState('idle'); setMessage('Kamera dihentikan.'); }} disabled={!running}><Square /> Hentikan</Button>
    </div>
    <p className="face-camera__privacy">Pilot terawasi. Foto/video tidak disimpan. Jika sulit dikenali, gunakan kartu RFID.</p>
  </section>;
}
