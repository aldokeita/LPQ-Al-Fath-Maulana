import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClipboardCheck, Loader2, ScanFace, SlidersHorizontal, Trash2, UserCheck, UserX } from 'lucide-react';
import FaceCameraCapture from '@/components/dashboard/shared/FaceCameraCapture';
import { faceAttendanceRequest } from '@/lib/faceAttendanceApi';
import { supabase } from '@/lib/customSupabaseClient';
import { CALIBRATION_HINT, parseCalibration, validateConsent } from '../../../../supabase/functions/_shared/faceCapture.js';
import { getJakartaDateString } from '@/utils/AttendanceStatusLogic';
import '@/styles/face-attendance.css';

// Guardians sign a paper consent form; the admin only attests to it here, and the record keeps who and when.
const WRITTEN_CONSENT = { noticeVersion:'FORMULIR-TERTULIS-1', formReference:'Arsip formulir tertulis' };
const formatDecimal = value => Number(value).toLocaleString('id-ID', { minimumFractionDigits:2, maximumFractionDigits:3 });
const guardianLabel = guardian => ((guardian?.nama_ayah || guardian?.nama_ibu || '').trim() || 'Wali santri (formulir tertulis)').slice(0, 150);

export default function FaceEnrollmentDialog({ santri, onClose }) {
  const [confirmed, setConfirmed] = useState(false); const [guardian, setGuardian] = useState(null);
  const consent = { confirmed, guardianName:guardianLabel(guardian), date:getJakartaDateString(), ...WRITTEN_CONSENT };
  const [status, setStatus] = useState(null); const [message, setMessage] = useState('Memuat status registrasi...');
  const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false); const [hasError, setHasError] = useState(false);
  const [calibration, setCalibration] = useState({ maxDistance:'', minMargin:'', testReference:'' });
  const [savedCalibration, setSavedCalibration] = useState(null); const [defaultCalibration, setDefaultCalibration] = useState(null);
  useEffect(() => {
    let mounted = true;
    faceAttendanceRequest({ action:'status', santriId:santri.id }).then(data => {
      if (!mounted) return; setStatus(data.enrollment); setMessage(''); setDefaultCalibration(data.defaultCalibration || null);
      if (data.calibration) {
        setSavedCalibration(data.calibration);
        setCalibration({ maxDistance:String(data.calibration.maxDistance), minMargin:String(data.calibration.minMargin), testReference:data.calibration.testReference });
      }
    }).catch(error => { if (mounted) { setHasError(true); setMessage(error.message); } });
    // Optional: older schemas may lack guardian columns, so a failed lookup falls back to a generic label.
    supabase.from('santri').select('nama_ayah,nama_ibu').eq('id', santri.id).maybeSingle()
      .then(({ data }) => { if (mounted) setGuardian(data); }, () => {});
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
      <fieldset disabled={ready || busy} className="face-enrollment__fields face-enrollment__fields--single"><legend><ClipboardCheck aria-hidden="true" /> Persetujuan tertulis wali</legend>
        <label className="face-enrollment__agreement"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Persetujuan tertulis wali sudah ada, dan identitas santri sudah saya periksa langsung.</label>
        <p className="face-enrollment__consent-note">Dicatat atas nama {consent.guardianName}, tanggal {consent.date}, oleh akun admin ini.</p>
      </fieldset>
      <p className="face-camera__privacy">Pilihan sukarela; RFID tetap tersedia. Penghapusan template tidak menghapus riwayat absensi. Salinan backup mengikuti masa retensi backup, bukan dihapus seketika.</p>
      {!ready ? <Button type="button" className="face-enrollment__next" disabled={!status || !complete || busy} onClick={() => setReady(true)}><ScanFace aria-hidden="true" />{status?.registered ? 'Daftarkan ulang melalui kamera' : 'Lanjut ke kamera'}</Button>
        : <><FaceCameraCapture purpose="enroll" santriId={santri.id} consent={consent} onCapture={register} /><Button type="button" variant="outline" onClick={() => setReady(false)}>Kembali ke persetujuan</Button></>}
      <details className="face-enrollment__calibration"><summary><SlidersHorizontal aria-hidden="true" /> Kalibrasi pengenalan pilot</summary>
        <p>Nilai ini adalah ambang jarak, bukan persentase akurasi. Setiap percobaan absen wajah mencatat <code>best_distance</code> dan <code>second_distance</code> di log server; pilih jarak maksimum sedikit di atas jarak santri yang benar dan di bawah jarak orang lain. Selama belum ada kalibrasi tersimpan, pengenalan memakai nilai bawaan.</p>
        <form onSubmit={async event => { event.preventDefault(); setBusy(true);
          let parsed;
          try { parsed = parseCalibration(calibration); } catch { setHasError(true); setMessage(CALIBRATION_HINT); setBusy(false); return; }
          try { await faceAttendanceRequest({ action:'calibrate', ...parsed }); setSavedCalibration(parsed); setHasError(false); setMessage('Kalibrasi pilot tersimpan.'); }
          catch (error) { setHasError(true); setMessage(error.message); } finally { setBusy(false); }
        }}>
          {savedCalibration ? <p className="face-enrollment__saved">Tersimpan: jarak maksimum <strong>{formatDecimal(savedCalibration.maxDistance)}</strong> · selisih minimum <strong>{formatDecimal(savedCalibration.minMargin)}</strong></p>
            : defaultCalibration && <p className="face-enrollment__saved">Belum ada kalibrasi tersimpan. Dipakai nilai bawaan: jarak maksimum <strong>{formatDecimal(defaultCalibration.maxDistance)}</strong> · selisih minimum <strong>{formatDecimal(defaultCalibration.minMargin)}</strong></p>}
          <label>Jarak maksimum (0,20–0,60)<Input required type="text" inputMode="decimal" placeholder="contoh 0,40" value={calibration.maxDistance} onChange={e => setCalibration({ ...calibration, maxDistance:e.target.value })} />
            <span className="face-enrollment__hint">Lebih kecil = lebih ketat. Pilih sedikit di atas <code>best_distance</code> santri yang benar.</span></label>
          <label>Selisih minimum kandidat pertama dan kedua (0,01–0,30)<Input required type="text" inputMode="decimal" placeholder="contoh 0,08" value={calibration.minMargin} onChange={e => setCalibration({ ...calibration, minMargin:e.target.value })} />
            <span className="face-enrollment__hint">Mencegah dua santri yang mirip saling tertukar.</span></label>
          <label>Referensi hasil uji pilot<Input required maxLength={150} value={calibration.testReference} onChange={e => setCalibration({ ...calibration, testReference:e.target.value })} /></label>
          <Button type="submit" disabled={busy}>Simpan hasil kalibrasi</Button>
        </form>
      </details>
    </DialogContent>
  </Dialog>;
}
