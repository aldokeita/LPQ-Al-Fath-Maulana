import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, Circle, Loader2, RefreshCw, ScanFace, ShieldCheck, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadFaceEngine, frameQuality, facePose, FACE_LOSS_GRACE_MS, mirroredPose } from '@/lib/faceCameraEngine';
import { faceAttendanceRequest } from '@/lib/faceAttendanceApi';
import { loadGestureEngine } from '@/lib/gestureEngine';
import { assignThumbsToFaces, FRAME_MAX_AGE_MS, matchTracks, MIN_FACE_RATIO, plainBox, THUMB_CONFIRM_FRAMES, TRACK_TTL_MS } from '@/lib/faceKiosk';
import { drawKioskOverlay } from '@/lib/kioskOverlay';
import { captureSteps, descriptorDistance, FACE_MODEL_VERSION, getCameraErrorMessage, PASSIVE_MIN_SPAN_MS } from '../../../../supabase/functions/_shared/faceCapture.js';

// Keyed by the mirrored (on-screen) direction; capture logic keeps using raw-frame poses.
const instructions = { center: 'Hadapkan wajah ke tengah', left: 'Putar wajah perlahan ke kiri', right: 'Putar wajah perlahan ke kanan' };
const poseLabels = { center: 'Tengah', left: 'Kiri', right: 'Kanan' };
const poseIcons = { center: Circle, left: ArrowLeft, right: ArrowRight };
const stateIcons = { idle: Camera, permission: Loader2, loading: Loader2, active: ScanFace, detected: ScanFace, waiting: ScanFace,
  recognizing: Loader2, success: CheckCircle2, unrecognized: AlertTriangle, error: AlertTriangle };
const spinningStates = ['permission', 'loading', 'recognizing'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Evidence must stay within 40 s of issue (server expiry is 45 s), so idle kiosks refresh earlier.
const PASSIVE_CHALLENGE_REFRESH_MS = 30000;
// An unrecognized santri who stays in front of the camera gets another attempt after this delay.
const PASSIVE_RETRY_MS = 4000;
// Single-face kiosk has no guide ring, so faces may sit anywhere but must be reasonably close.
const PASSIVE_MIN_FACE_RATIO = 0.12;
const passiveReadyMessage = 'Kamera aktif. Hadapkan wajah ke kamera, kehadiran tercatat otomatis.';
const gestureReadyMessage = 'Kamera aktif. Santri yang ingin absen: hadapkan wajah ke kamera lalu acungkan jempol 👍.';

export default function FaceCameraCapture({ purpose = 'attendance', mode = 'passive', santriId, consent, onCapture }) {
  const gestureMode = purpose === 'attendance' && mode === 'gesture';
  // Both kiosk modes draw the HUD overlay; only enrollment keeps the head-turn guide ring.
  const hudMode = purpose === 'attendance';
  const overlay = useRef(null);
  const video = useRef(null); const stream = useRef(null); const generation = useRef(0);
  const callback = useRef(onCapture); callback.current = onCapture;
  const [state, setState] = useState('idle'); const [message, setMessage] = useState('Kamera hanya aktif setelah Anda menekan Mulai kamera.');
  // Mirrors the capture loop so the operator sees which pose comes next; it never feeds back into the loop.
  const [poseSteps, setPoseSteps] = useState([]); const [posesDone, setPosesDone] = useState(0);
  const stop = () => {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    overlay.current?.getContext('2d')?.clearRect(0, 0, overlay.current.width, overlay.current.height);
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
      if (purpose === 'attendance') { await (gestureMode ? runGestureAttendance(engine, ticket) : runPassiveAttendance(engine, ticket)); return; }
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

  // HUD rendering runs at display rate, decoupled from the slower detection loop. A failed frame is
  // logged and skipped so one bad draw can never freeze the overlay.
  function startHud(scene, hudKind) {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let request = 0; let warned = false;
    const render = () => {
      const target = overlay.current; const source = video.current;
      if (target && source?.videoWidth) {
        if (target.width !== source.videoWidth) { target.width = source.videoWidth; target.height = source.videoHeight; }
        try { drawKioskOverlay(target.getContext('2d'), { ...scene(), now: performance.now(), reducedMotion, mode: hudKind }); }
        catch (error) { if (!warned) { warned = true; console.warn('[face-hud] overlay frame skipped:', error); } }
      }
      request = requestAnimationFrame(render);
    };
    request = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(request); overlay.current?.getContext('2d')?.clearRect(0, 0, overlay.current.width, overlay.current.height); };
  }

  // Supervised kiosk: recognize any single frontal face without a head-turn challenge.
  async function runPassiveAttendance(engine, ticket) {
    const canvas = document.createElement('canvas');
    let challenge = null; let issuedAt = 0; let frames = [];
    let lastDescriptor = null; let lastSucceeded = false; let retryAt = 0; let cooldownUntil = 0;
    let hudTracks = []; let hudId = 1;
    const syncHud = (results, now) => {
      const boxes = results.map(result => plainBox(result.detection.box));
      const { matches, unmatched } = matchTracks(hudTracks, boxes);
      const next = matches.map(match => Object.assign(hudTracks[match.track], { box: boxes[match.detection] }));
      for (const index of unmatched) next.push({ id: hudId++, box: boxes[index], frames: [], progress: 0, status: 'watching', thumbStreak: 0, label: '', createdAt: now });
      hudTracks = next;
    };
    const clearFrames = () => { frames.forEach(frame => frame.descriptor.fill(0)); frames = []; };
    const refreshChallenge = async () => {
      try {
        challenge = await faceAttendanceRequest({ action: 'challenge', purpose: 'attendance' }); issuedAt = performance.now();
      } catch (error) {
        challenge = null; setState('unrecognized'); setMessage(`${error.message} Mencoba lagi sebentar lagi.`);
      }
    };
    const stopHud = startHud(() => ({ tracks: hudTracks, hands: [] }), 'passive');
    try {
      await refreshChallenge();
      if (challenge) { setState('active'); setMessage(passiveReadyMessage); }
      while (ticket === generation.current && stream.current?.active) {
        if (!challenge || (!frames.length && performance.now() - issuedAt > PASSIVE_CHALLENGE_REFRESH_MS)) {
          await refreshChallenge();
          if (!challenge) { await pause(5000); continue; }
        }
        const results = await engine.detect(video.current);
        if (ticket !== generation.current) break;
        const now = performance.now(); syncHud(results, now);
        if (now < cooldownUntil) { await pause(160); continue; }
        if (lastDescriptor) {
          // One attempt per presence: wait until this santri leaves or a different face steps in.
          const sameFace = results.length === 1 && descriptorDistance(Array.from(results[0].descriptor), lastDescriptor) <= 0.45;
          if (results.length && (sameFace || results.length > 1) && (lastSucceeded || now < retryAt)) {
            setState('waiting'); setMessage(lastSucceeded ? 'Silakan bergeser untuk santri berikutnya.' : 'Hadapkan wajah lurus ke kamera, mencoba lagi sebentar lagi.');
            await pause(160); continue;
          }
          lastDescriptor.fill(0); lastDescriptor = null; setState('active'); setMessage(passiveReadyMessage);
          hudTracks.forEach(track => { track.status = 'watching'; track.label = ''; track.progress = 0; });
        }
        if (results.length !== 1) {
          clearFrames(); setState('active'); hudTracks.forEach(track => { track.progress = 0; });
          setMessage(results.length > 1 ? 'Beberapa wajah terdeteksi. Satu per satu di depan kamera.' : passiveReadyMessage);
          await pause(160); continue;
        }
        const face = results[0]; const hud = hudTracks[0];
        if (!frameQuality(video.current, face, canvas, { centered: false, minRatio: PASSIVE_MIN_FACE_RATIO }) || facePose(face) !== 'center') {
          clearFrames(); hud.progress = 0; setState('detected'); setMessage('Hadapkan wajah lurus ke kamera dan mendekat sedikit.');
          await pause(120); continue;
        }
        const descriptor = Array.from(face.descriptor);
        if (frames.length && descriptorDistance(descriptor, frames[0].descriptor) > 0.25) clearFrames();
        frames.push({ descriptor, elapsedMs: now - issuedAt });
        if (frames.length > 5) frames.shift().descriptor.fill(0);
        hud.progress = frames.length; setState('detected'); setMessage('Wajah terdeteksi, tahan sebentar...');
        if (frames.length < 5 || frames[4].elapsedMs - frames[0].elapsedMs < PASSIVE_MIN_SPAN_MS) { await pause(120); continue; }
        setState('recognizing'); setMessage('Mengenali wajah dan mengonfirmasi pencatatan...'); hud.status = 'sending';
        const payload = { challengeId: challenge.id, modelVersion: FACE_MODEL_VERSION, descriptors: frames.map(frame => frame.descriptor),
          evidence: frames.map(frame => ({ pose: 'center', elapsedMs: frame.elapsedMs, faceCount: 1, quality: true })) };
        lastDescriptor = descriptor.slice(); challenge = null;
        let result;
        try { result = await callback.current(payload); } catch (error) { result = { success: false, message: error.message }; }
        clearFrames();
        if (ticket !== generation.current) break;
        lastSucceeded = Boolean(result?.success);
        hud.status = lastSucceeded ? 'done' : 'unknown'; hud.label = result?.name || ''; hud.progress = 0;
        setState(lastSucceeded ? 'success' : 'unrecognized');
        setMessage(result?.message || 'Wajah belum dikenali. Silakan gunakan kartu RFID.');
        cooldownUntil = performance.now() + 2000; retryAt = cooldownUntil + PASSIVE_RETRY_MS;
      }
    } finally {
      stopHud(); clearFrames(); lastDescriptor?.fill(0); canvas.width = 0; canvas.height = 0;
    }
  }

  // Multi-face kiosk: faces are only tracked locally until their owner raises a thumb; then that one face is recognized.
  async function runGestureAttendance(engine, ticket) {
    setState('loading'); setMessage('Memuat model gesture tangan...');
    const hands = await loadGestureEngine();
    if (ticket !== generation.current) return;
    const canvas = document.createElement('canvas');
    let tracks = []; let nextId = 1; let inFlight = false; let resultUntil = 0;
    const dropFrames = track => { track.frames.forEach(frame => frame.descriptor.fill(0)); track.frames = []; };
    const confirm = async track => {
      inFlight = true; track.status = 'sending';
      const frames = track.frames.map(frame => ({ ...frame, descriptor: frame.descriptor.slice() })); dropFrames(track);
      let result;
      try {
        const challenge = await faceAttendanceRequest({ action: 'challenge', purpose: 'attendance' });
        // Evidence times are relative to the first frame; the server checks order, span and the 40 s ceiling.
        const payload = { challengeId: challenge.id, modelVersion: FACE_MODEL_VERSION, descriptors: frames.map(frame => frame.descriptor),
          evidence: frames.map(frame => ({ pose: 'center', elapsedMs: frame.at - frames[0].at + 1, faceCount: 1, quality: true })) };
        result = await callback.current(payload);
      } catch (error) { result = { success: false, message: error.message }; }
      finally { frames.forEach(frame => frame.descriptor.fill(0)); inFlight = false; }
      if (ticket !== generation.current) return;
      track.status = result?.success ? 'done' : 'unknown'; track.label = result?.name || '';
      track.retryAt = performance.now() + PASSIVE_RETRY_MS; track.thumbStreak = 0;
      setState(result?.success ? 'success' : 'unrecognized');
      setMessage(result?.message || 'Wajah belum dikenali. Silakan gunakan kartu RFID.'); resultUntil = performance.now() + 3000;
    };
    let handResults = [];
    const stopHud = startHud(() => ({ tracks, hands: handResults }), 'gesture');
    try {
      setState('active'); setMessage(gestureReadyMessage);
      while (ticket === generation.current && stream.current?.active) {
        const faces = await engine.detect(video.current);
        if (ticket !== generation.current) break;
        const now = performance.now(); handResults = hands.detect(video.current);
        const boxes = faces.map(face => plainBox(face.detection.box));
        const { matches, unmatched } = matchTracks(tracks, boxes);
        const seen = new Map(matches.map(match => [match.detection, tracks[match.track]]));
        for (const index of unmatched) {
          const track = { id: nextId++, box: boxes[index], frames: [], status: 'watching', thumbStreak: 0, retryAt: 0, label: '', lastSeen: now, createdAt: now, hand: null };
          tracks.push(track); seen.set(index, track);
        }
        const thumbOwners = assignThumbsToFaces(handResults, boxes);
        for (const [index, track] of seen) {
          const face = faces[index]; track.box = boxes[index]; track.lastSeen = now;
          track.frames = track.frames.filter(frame => { const fresh = now - frame.at <= FRAME_MAX_AGE_MS; if (!fresh) frame.descriptor.fill(0); return fresh; });
          if (frameQuality(video.current, face, canvas, { centered: false, minRatio: MIN_FACE_RATIO }) && facePose(face) === 'center') {
            const descriptor = Array.from(face.descriptor);
            if (track.frames.length && descriptorDistance(descriptor, track.frames[0].descriptor) > 0.25) dropFrames(track);
            track.frames.push({ descriptor, at: now });
            if (track.frames.length > 5) track.frames.shift().descriptor.fill(0);
          }
          track.thumbStreak = thumbOwners.has(index) ? track.thumbStreak + 1 : 0;
          track.hand = thumbOwners.has(index) ? handResults[thumbOwners.get(index)] : null;
          if (track.status === 'unknown' && now >= track.retryAt) track.status = 'watching';
          const span = track.frames.length === 5 ? track.frames[4].at - track.frames[0].at : 0;
          if (!inFlight && track.status === 'watching' && track.thumbStreak >= THUMB_CONFIRM_FRAMES && span >= PASSIVE_MIN_SPAN_MS) confirm(track);
        }
        tracks = tracks.filter(track => {
          const alive = now - track.lastSeen <= TRACK_TTL_MS || track.status === 'sending';
          if (!alive) dropFrames(track);
          return alive;
        });
        if (now >= resultUntil) {
          const visible = tracks.filter(track => track.lastSeen === now);
          if (inFlight) { setState('recognizing'); setMessage('Mengonfirmasi kehadiran...'); }
          else if (!visible.length) { setState('active'); setMessage(gestureReadyMessage); }
          else { setState('detected'); setMessage(`${visible.length} wajah terdeteksi. Acungkan jempol 👍 untuk absen.`); }
        }
        await pause(60);
      }
    } finally {
      stopHud(); tracks.forEach(dropFrames); tracks = []; canvas.width = 0; canvas.height = 0;
    }
  }

  const running = !['idle','error'].includes(state);
  const StatusIcon = stateIcons[state] || ScanFace;
  const tracking = poseSteps.length > 0 && running;
  const halt = () => { stop(); setState('idle'); setPoseSteps([]); setPosesDone(0); setMessage('Kamera dihentikan.'); };
  return <section className={`face-camera face-camera--${state}${hudMode ? ' face-camera--hud' : ''}`} aria-label="Kamera pengenalan wajah">
    <div className="face-camera__viewport">
      <video ref={video} muted playsInline aria-label="Pratinjau kamera langsung seperti cermin, tidak direkam" />
      {hudMode ? <canvas ref={overlay} className="face-camera__overlay" aria-hidden="true" /> : <div className="face-camera__guide" aria-hidden="true" />}
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
    <p className="face-camera__privacy"><ShieldCheck aria-hidden="true" />{gestureMode
      ? 'Kiosk wajib diawasi petugas. Wajah yang lewat hanya dideteksi di perangkat ini; hanya wajah yang mengacungkan jempol yang dikirim untuk dikenali. Foto/video tidak disimpan.'
      : purpose === 'attendance'
      ? 'Kiosk wajib diawasi petugas: mode cepat tidak dapat membedakan foto dari wajah asli. Foto/video tidak disimpan. Jika sulit dikenali, gunakan kartu RFID.'
      : 'Pilot terawasi. Foto/video tidak disimpan. Jika sulit dikenali, gunakan kartu RFID.'}</p>
  </section>;
}
