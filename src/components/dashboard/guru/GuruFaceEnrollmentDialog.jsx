import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Loader2, ScanFace, Trash2, UserCheck, UserX } from 'lucide-react';
import FaceCameraCapture from '@/components/dashboard/shared/FaceCameraCapture';
import { faceAttendanceRequest } from '@/lib/faceAttendanceApi';
import { GURU_ADMIN_NOTICE_VERSION, GURU_SELF_NOTICE_VERSION } from '../../../../supabase/functions/_shared/faceCapture.js';
import '@/styles/face-attendance.css';

// Two ways in: a guru registers their own face (no `guru` prop; the server uses the logged-in guru's
// row), or an admin registers a guru from Manajemen Guru (`guru` = { id, nama }) and attests the
// guru's consent. The server enforces both: self actions act only on the caller, admin actions need an admin.
export default function GuruFaceEnrollmentDialog({ guru, guruName, onClose }) {
  const byAdmin = Boolean(guru);
  const name = byAdmin ? guru.nama : guruName;
  const [confirmed, setConfirmed] = useState(false);
  const consent = { confirmed, noticeVersion:byAdmin ? GURU_ADMIN_NOTICE_VERSION : GURU_SELF_NOTICE_VERSION };
  const target = byAdmin ? { guruId:guru.id } : {};
  const [status, setStatus] = useState(null); const [message, setMessage] = useState('Memuat status registrasi...');
  const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false); const [hasError, setHasError] = useState(false);
  useEffect(() => {
    let mounted = true;
    const guruId = guru?.id;
    faceAttendanceRequest(guruId ? { action:'guru_status', guruId } : { action:'self_status' })
      .then(data => { if (mounted) { setStatus(data.enrollment); setMessage(''); } })
      .catch(error => { if (mounted) { setHasError(true); setMessage(error.message); } });
    return () => { mounted = false; };
  }, [guru?.id]);
  async function register(payload) {
    const result = await faceAttendanceRequest({ action:byAdmin ? 'guru_enroll' : 'self_enroll', ...target, consent, ...payload });
    setStatus({ registered:result.registered }); setHasError(false);
    setMessage(byAdmin ? 'Registrasi wajah guru tersimpan. Foto profil tidak diubah.' : 'Registrasi wajah tersimpan. Anda bisa absen di kiosk wajah.');
    return { success:true, message:'Registrasi wajah tersimpan. Kamera dihentikan.' };
  }
  async function remove() {
    if (!window.confirm(byAdmin ? 'Hapus registrasi wajah guru ini? Riwayat absensi dan foto profil tetap dipertahankan.'
      : 'Hapus registrasi wajah Anda? Riwayat absensi dan foto profil tetap dipertahankan.')) return;
    setBusy(true); setReady(false);
    try { await faceAttendanceRequest({ action:byAdmin ? 'guru_delete' : 'self_delete', ...target }); setStatus({ registered:false }); setHasError(false); setMessage('Registrasi wajah dihapus.'); }
    catch (error) { setHasError(true); setMessage(error.message); } finally { setBusy(false); }
  }
  const loading = !status && !hasError;
  const tone = hasError ? 'error' : loading ? 'loading' : 'info';
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="face-enrollment">
      <DialogHeader className="face-enrollment__header">
        <span className="face-enrollment__mark" aria-hidden="true"><ScanFace /></span>
        <div><DialogTitle>{byAdmin ? 'Registrasi wajah guru' : 'Wajah saya'}</DialogTitle><DialogDescription>{name ? `${name}. ` : ''}Untuk absen di kiosk wajah, sama seperti tap kartu RFID.</DialogDescription></div>
      </DialogHeader>
      {status && <div className={`face-enrollment__status ${status.registered ? 'is-registered' : ''}`}>
        {status.registered ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}
        <p>Status: <strong>{status.registered ? 'Sudah terdaftar' : 'Belum terdaftar'}</strong></p>
        {status.registered && <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={remove}><Trash2 aria-hidden="true" /> Hapus registrasi wajah</Button>}
      </div>}
      {message && <p role="status" className={`face-enrollment__notice is-${tone}`}>{loading && <Loader2 className="is-spinning" aria-hidden="true" />}{message}</p>}
      <ol className="face-enrollment__stepper" aria-label="Tahap registrasi">
        <li className={ready ? 'is-done' : 'is-current'} aria-current={ready ? undefined : 'step'}><span aria-hidden="true">1</span>Persetujuan</li>
        <li className={ready ? 'is-current' : ''} aria-current={ready ? 'step' : undefined}><span aria-hidden="true">2</span>Rekam lewat kamera</li>
      </ol>
      <fieldset disabled={ready || busy} className="face-enrollment__fields face-enrollment__fields--single"><legend><ClipboardCheck aria-hidden="true" /> {byAdmin ? 'Persetujuan guru' : 'Persetujuan saya'}</legend>
        <label className="face-enrollment__agreement"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{byAdmin
          ? 'Guru ini sudah menyetujui wajahnya disimpan untuk absensi di kiosk LPQ, dan identitasnya sudah saya periksa langsung.'
          : 'Saya setuju wajah saya disimpan sebagai template pengenalan untuk absensi di kiosk LPQ. Saya bisa menghapusnya kapan saja.'}</label>
        <p className="face-enrollment__consent-note">Yang disimpan berupa 128 angka, bukan foto. {byAdmin ? 'Dicatat atas nama akun admin ini.' : 'Dicatat atas akun Anda sendiri.'}</p>
      </fieldset>
      <p className="face-camera__privacy">Pilihan sukarela; kartu RFID tetap bisa dipakai. Penghapusan template tidak menghapus riwayat absensi. Salinan backup mengikuti masa retensi backup, bukan dihapus seketika.</p>
      {!ready ? <Button type="button" className="face-enrollment__next" disabled={!status || !confirmed || busy} onClick={() => setReady(true)}><ScanFace aria-hidden="true" />{status?.registered ? 'Daftarkan ulang melalui kamera' : 'Lanjut ke kamera'}</Button>
        : <><FaceCameraCapture purpose={byAdmin ? 'guru_enroll' : 'self_enroll'} guruId={guru?.id} consent={consent} onCapture={register} /><Button type="button" variant="outline" onClick={() => setReady(false)}>Kembali ke persetujuan</Button></>}
    </DialogContent>
  </Dialog>;
}
