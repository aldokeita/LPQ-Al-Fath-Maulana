import React, { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';

const REFRESH_MS = 500;
const ms = value => (Number.isFinite(value) ? `${Math.round(value)} ms` : '–');
const distance = value => value.toFixed(3);

function selfCheckText(result) {
  if (!result) return 'Belum diuji. Hadapkan satu wajah ke kamera lalu tekan tombol.';
  if (result.state === 'error') return `Gagal: ${result.message}`;
  if (result.state === 'faces') return `Perlu tepat satu wajah (jalur registrasi ${result.full}, jalur kiosk ${result.fast}).`;
  const verdict = result.distance < 0.05 ? 'setara' : result.distance < 0.1 ? 'sedikit berbeda' : 'berbeda, kembalikan ukuran 416';
  return `Potongan ${distance(result.pathDistance)} · total ${distance(result.distance)} pada ukuran ${result.inputSize} (${verdict})`;
}

// On-site measurement for /absensi-wajah?debug-kinerja: loop rate, per-step averages and model source.
export default function KioskPerfPanel({ meter }) {
  const [snapshot, setSnapshot] = useState(() => meter.snapshot());
  useEffect(() => {
    const timer = setInterval(() => setSnapshot(meter.snapshot()), REFRESH_MS);
    return () => clearInterval(timer);
  }, [meter]);
  const { fps, series, info } = snapshot;
  return <section className="face-perf" aria-label="Debug kinerja kiosk">
    <header className="face-perf__header">
      <Gauge aria-hidden="true" />
      <h2>Debug kinerja</h2>
      <strong className="face-perf__fps">{fps.toFixed(1)} FPS</strong>
    </header>
    <dl className="face-perf__grid">
      {series.map(row => <div key={row.label} className="face-perf__row">
        <dt>{row.label}</dt>
        <dd>{ms(row.average)} <span>terakhir {ms(row.last)} · n={row.count}</span></dd>
      </div>)}
      {Object.entries(info).filter(([key]) => key !== 'kesetaraan').map(([key, value]) => <div key={key} className="face-perf__row">
        <dt>{key}</dt><dd>{String(value)}</dd>
      </div>)}
    </dl>
    <div className="face-perf__check">
      <button type="button" className="face-perf__button" onClick={() => meter.requestSelfCheck()}>Uji kesetaraan deskriptor</button>
      <p role="status">{selfCheckText(info.kesetaraan)}</p>
    </div>
  </section>;
}
