import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, Circle, Loader2, RefreshCw, ScanFace, ShieldCheck, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadFaceEngine, frameQuality, facePose, FACE_LOSS_GRACE_MS, mirroredPose } from '@/lib/faceCameraEngine';
import { faceAttendanceRequest } from '@/lib/faceAttendanceApi';
import { captureSteps, descriptorDistance, FACE_MODEL_VERSION, getCameraErrorMessage } from '../../../../supabase/functions/_shared/faceCapture.js';

// Keyed by the mirrored (on-screen) direction; capture logic keeps using raw-frame poses.
const instructions = { center: 'Hadapkan wajah ke tengah', left: 'Putar wajah perlahan ke kiri', right: 'Putar wajah perlahan ke kanan' };
const poseLabels = { center: 'Tengah', left: 'Kiri', right: 'Kanan' };
const poseIcons = { center: Circle, left: ArrowLeft, right: ArrowRight };
const stateIcons = { idle: Camera, permission: Loader2, loading: Loader2, active: ScanFace, detected: ScanFace, waiting: ScanFace,
  recognizing: Loader2, success: CheckCircle2, unrecognized: AlertTriangle, error: AlertTriangle };
const spinningStates = ['permission', 'loading', 'recognizing'];

export default function FaceCameraCapture({ purpose = 'attendance', santriId, consent, onCapture }) {
  const video = useRef(null); const stream = useRef(null); const generation = useRef(0);
  const callback = useRef(onCapture); callback.current = onCapture;
  const [state, setState] = useState('idle'); const [message, setMessage] = useState('Kamera hanya aktif setelah Anda menekan Mulai kamera.');
  // Mirrors the capture loop so the operator sees which pose comes next; it never feeds back into the loop.
  const [poseSteps, setPoseSteps] = useState([]); const [posesDone, setPosesDone] = useState(0);
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
      setPoseSteps(steps); setPosesDone(0);
      let began = performance.now(); let evidence = []; let waitingUntil = 0; let waitForExit = false; let reference = null;
      let lostSince = 0;
      const resetProgress = () => {
        step = 0; setPosesDone(0); evidence = []; poseStart = 0; lostSince = 0;
        reference?.fill(0); reference = null;
        poseSamples.forEach(row => row.fill(0)); poseSamples = [];
        descriptors.forEach(row => row.fill(0)); descriptors = [];
      };
      const canvas = document.createElement('canvas');
      setState('active'); setMessage('Kamera aktif. Posisikan satu wajah pada panduan.');
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
            began = performance.now(); poseStart = 0; lostSince = 0; waitForExit = false; reference = null; setState('active');
            setPoseSteps(steps); setPosesDone(0);
          } else { await new Promise(resolve => setTimeout(resolve, 160)); continue; }
        }
        if (Date.now() >= Date.parse(challenge.expiresAt)) throw new Error('Tantangan kedaluwarsa. Tekan Mulai lagi.');
        if (results.length > 1) {
          resetProgress(); setMessage('Beberapa wajah terdeteksi. Satu santri saja di depan kamera.');
          await new Promise(resolve => setTimeout(resolve, 160)); continue;
        }
        const face = results[0];
        if (!face || !frameQuality(video.current, face, canvas)) {
          // A brief slip keeps completed poses; the reference check below still rejects a different face on return.
          const lostAt = performance.now(); if (!lostSince) lostSince = lostAt;
          poseStart = 0; descriptors.forEach(row => row.fill(0)); descriptors = [];
          const expired = lostAt - lostSince > FACE_LOSS_GRACE_MS;
          if (expired) resetProgress();
          setMessage(step && !expired ? 'Wajah keluar dari panduan. Kembali ke lingkaran untuk melanjutkan.'
            : face ? 'Dekatkan wajah dan pastikan pencahayaan cukup serta gambar tidak kabur.' : 'Kamera aktif. Posisikan satu wajah pada panduan.');
          await new Promise(resolve => setTimeout(resolve, 160)); continue;
        }
        lostSince = 0;
        const pose = facePose(face); const now = performance.now();
        const currentDescriptor = Array.from(face.descriptor);
        if (reference && descriptorDistance(currentDescriptor, reference) > 0.45) {
          step = 0; setPosesDone(0); evidence = []; poseStart = 0; reference.fill(0); reference = null;
          poseSamples.forEach(row => row.fill(0)); poseSamples = [];
          descriptors.forEach(row => row.fill(0)); descriptors = [];
          setMessage('Wajah berubah atau hasil tidak konsisten. Ulangi dari posisi tengah.'); continue;
        }
        if (!reference && pose === 'center') reference = currentDescriptor;
        setMessage(instructions[mirroredPose(steps[step])]); setState('detected');
        if (pose !== steps[step]) { poseStart = 0; descriptors = []; }
        else {
          if (!poseStart) poseStart = now;
          if (now - poseStart >= 350 && step < 4) {
            poseSamples.push(currentDescriptor);
            evidence.push({ pose, elapsedMs: now - began, faceCount: 1, quality: true }); step++; poseStart = 0; setPosesDone(step);
          } else if (step === 4) {
            const descriptor = Array.from(face.descriptor);
            if (descriptors.length && descriptorDistance(descriptor, descriptors[0]) > 0.25) {
              descriptors.forEach(row => row.fill(0)); descriptors = [];
              setMessage('Hasil wajah belum stabil. Tetap menghadap ke tengah.');
            } else descriptors.push(descriptor);
            if (descriptors.length === 5) {
              evidence.push({ pose, elapsedMs: now - began, faceCount: 1, quality: true }); setPosesDone(5);
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
  const StatusIcon = stateIcons[state] || ScanFace;
  const tracking = poseSteps.length > 0 && running;
  const halt = () => { stop(); setState('idle'); setPoseSteps([]); setPosesDone(0); setMessage('Kamera dihentikan.'); };
  return <section className={`face-camera face-camera--${state}`} aria-label="Kamera pengenalan wajah">
    <div className="face-camera__viewport">
      <video ref={video} muted playsInline aria-label="Pratinjau kamera langsung seperti cermin, tidak direkam" />
      <div className="face-camera__guide" aria-hidden="true" />
      {state === 'idle' && <div className="face-camera__placeholder" aria-hidden="true"><ScanFace /><span>Kamera belum aktif</span></div>}
      {tracking && <ol className="face-camera__track" aria-label="Urutan gerakan wajah">
        {poseSteps.map((pose, index) => {
          const shownPose = mirroredPose(pose); const PoseIcon = poseIcons[shownPose];
          const status = index < posesDone ? 'done' : index === posesDone ? 'current' : 'pending';
          return <li key={index} className={`face-camera__track-step is-${status}`} aria-current={status === 'current' ? 'step' : undefined}>
            <span className="face-camera__track-dot" aria-hidden="true">{status === 'done' ? <CheckCircle2 /> : <PoseIcon />}</span>
            <span className="face-camera__track-label">{poseLabels[shownPose]}<span className="sr-only">{status === 'done' ? ', selesai' : status === 'current' ? ', sekarang' : ''}</span></span>
          </li>;
        })}
      </ol>}
    </div>
    <div className="face-camera__status" role="status" aria-live="polite" aria-atomic="true">
      <span className="face-camera__status-icon" aria-hidden="true"><StatusIcon className={spinningStates.includes(state) ? 'is-spinning' : undefined} /></span>
      <p>{message}</p>
    </div>
    <div className="face-camera__controls">
      <Button type="button" className="face-camera__primary" onClick={start} disabled={running}>{state === 'error' ? <RefreshCw /> : <Camera />}{state === 'error' ? 'Mulai lagi' : 'Mulai kamera'}</Button>
      <Button type="button" variant="outline" className="face-camera__secondary" onClick={halt} disabled={!running}><Square /> Hentikan</Button>
    </div>
    <p className="face-camera__privacy"><ShieldCheck aria-hidden="true" />Pilot terawasi. Foto/video tidak disimpan. Jika sulit dikenali, gunakan kartu RFID.</p>
  </section>;
}
