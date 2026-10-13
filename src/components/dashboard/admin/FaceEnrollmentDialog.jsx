import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClipboardCheck, Loader2, ScanFace, SlidersHorizontal, Trash2, UserCheck, UserX } from 'lucide-react';
import FaceCameraCapture from '@/components/dashboard/shared/FaceCameraCapture';
import { faceAttendanceRequest } from '@/lib/faceAttendanceApi';
import { validateConsent } from '../../../../supabase/functions/_shared/faceCapture.js';
import { getJakartaDateString } from '@/utils/AttendanceStatusLogic';
import '@/styles/face-attendance.css';

export default function FaceEnrollmentDialog({ santri, onClose }) {
  const [consent, setConsent] = useState({ guardianName:'', date:'', noticeVersion:'', formReference:'', confirmed:false });
  const [status, setStatus] = useState(null); const [message, setMessage] = useState('Memuat status registrasi...');
  const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false); const [hasError, setHasError] = useState(false);
  const [calibration, setCalibration] = useState({ maxDistance:'', minMargin:'', testReference:'' });
  useEffect(() => {
    let mounted = true;
    faceAttendanceRequest({ action:'status', santriId:santri.id }).then(data => {
      if (!mounted) return; setStatus(data.enrollment); setMessage('');
      if (data.calibration) setCalibration(data.calibration);
    }).catch(error => { if (mounted) { setHasError(true); setMessage(error.message); } });
    return () => { mounted = false; };
  }, [santri.id]);
  async function register(payload) {
    const result = await faceAttendanceRequest({ action:'enroll', santriId:santri.id, consent, ...payload });
    setStatus({ registered:result.registered }); setHasError(false); setMessage('Registrasi tersimpan. Foto profil tidak diubah.');
    return { success:true, message:'Registrasi wajah tersimpan. Kamera dihentikan.' };
  }
  async function remove() {
    if (!window.confirm('Hapus registrasi wajah santri ini? Riwayat absensi dan foto profil tetap dipertahankan.')) return;
    setBusy(true); setReady(false);
    try { await faceAttendanceRequest({ action:'delete', santriId:santri.id }); setStatus({ registered:false }); setHasError(false); setMessage('Registrasi wajah dihapus.'); }
    catch (error) { setHasError(true); setMessage(error.message); } finally { setBusy(false); }
  }
  const complete = (() => { try { validateConsent(consent,getJakartaDateString()); return true; } catch { return false; } })();
  const loading = !status && !hasError;
  const tone = hasError ? 'error' : loading ? 'loading' : 'info';
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="face-enrollment">
      <DialogHeader className="face-enrollment__header">
        <span className="face-enrollment__mark" aria-hidden="true"><ScanFace /></span>
        <div><DialogTitle>Registrasi wajah</DialogTitle><DialogDescription>{santri.nama_lengkap}. Registrasi langsung, bukan dari foto profil.</DialogDescription></div>
      </DialogHeader>
      {status && <div className={`face-enrollment__status ${status.registered ? 'is-registered' : ''}`}>
        {status.registered ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}
        <p>Status: <strong>{status.registered ? 'Sudah terdaftar' : 'Belum terdaftar'}</strong></p>
        {status.registered && <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={remove}><Trash2 aria-hidden="true" /> Hapus registrasi wajah</Button>}
      </div>}
      {message && <p role="status" className={`face-enrollment__notice is-${tone}`}>{loading && <Loader2 className="is-spinning" aria-hidden="true" />}{message}</p>}
      <ol className="face-enrollment__stepper" aria-label="Tahap registrasi">
        <li className={ready ? 'is-done' : 'is-current'} aria-current={ready ? undefined : 'step'}><span aria-hidden="true">1</span>Persetujuan wali</li>
        <li className={ready ? 'is-current' : ''} aria-current={ready ? 'step' : undefined}><span aria-hidden="true">2</span>Rekam lewat kamera</li>
      </ol>
      <fieldset disabled={ready || busy} className="face-enrollment__fields"><legend><ClipboardCheck aria-hidden="true" /> Persetujuan tertulis wali</legend>
        {[['guardianName','Nama wali yang menandatangani','text'],['date','Tanggal persetujuan','date'],
          ['noticeVersion','Versi pemberitahuan penggunaan data','text'],['formReference','Referensi formulir tertulis','text']].map(([key,label,type]) =>
          <label key={key}>{label}<Input type={type} required maxLength={150} value={consent[key]} onChange={event => setConsent({ ...consent, [key]:event.target.value })} /></label>)}
        <label className="face-enrollment__agreement"><input type="checkbox" checked={consent.confirmed} onChange={event => setConsent({ ...consent, confirmed:event.target.checked })} />Saya telah memeriksa persetujuan wali dan identitas santri secara langsung.</label>
      </fieldset>
      <p className="face-camera__privacy">Pilihan sukarela; RFID tetap tersedia. Penghapusan template tidak menghapus riwayat absensi. Salinan backup mengikuti masa retensi backup, bukan dihapus seketika.</p>
      {!ready ? <Button type="button" className="face-enrollment__next" disabled={!status || !complete || busy} onClick={() => setReady(true)}><ScanFace aria-hidden="true" />{status?.registered ? 'Daftarkan ulang melalui kamera' : 'Lanjut ke kamera'}</Button>
        : <><FaceCameraCapture purpose="enroll" santriId={santri.id} consent={consent} onCapture={register} /><Button type="button" variant="outline" onClick={() => setReady(false)}>Kembali ke persetujuan</Button></>}
      <details className="face-enrollment__calibration"><summary><SlidersHorizontal aria-hidden="true" /> Kalibrasi pengenalan pilot</summary>
        <p>Isi hanya setelah uji valid, tidak dikenal, ambigu, foto, dan video dilakukan. Nilai ini adalah ambang jarak, bukan persentase akurasi. Tanpa kalibrasi, pengenalan tidak mencatat absensi.</p>
        <form onSubmit={async event => { event.preventDefault(); setBusy(true);
          try { await faceAttendanceRequest({ action:'calibrate', ...calibration }); setHasError(false); setMessage('Kalibrasi pilot tersimpan.'); }
          catch (error) { setHasError(true); setMessage(error.message); } finally { setBusy(false); }
        }}>
          <label>Jarak maksimum<Input required type="number" min="0.001" max="0.6" step="0.001" value={calibration.maxDistance} onChange={e => setCalibration({ ...calibration, maxDistance:e.target.value })} /></label>
          <label>Selisih minimum kandidat pertama dan kedua<Input required type="number" min="0.001" max="0.999" step="0.001" value={calibration.minMargin} onChange={e => setCalibration({ ...calibration, minMargin:e.target.value })} /></label>
          <label>Referensi hasil uji pilot<Input required maxLength={150} value={calibration.testReference} onChange={e => setCalibration({ ...calibration, testReference:e.target.value })} /></label>
          <Button type="submit" disabled={busy}>Simpan hasil kalibrasi</Button>
        </form>
      </details>
    </DialogContent>
  </Dialog>;
}
