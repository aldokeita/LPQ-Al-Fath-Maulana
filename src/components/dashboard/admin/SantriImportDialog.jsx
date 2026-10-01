import React, { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { loadXlsx } from '@/lib/xlsxLoader';
import { importSantriAccounts, loadSantriImportIdentities } from '@/lib/santriBulkImportAdapters';
import { createImportSource, IMPORT_FIELDS, inferImportDateOrder, parseSantriImport, readImportWorkbook } from '@/lib/santriImportParsing';
import { validateSantriImport } from '@/lib/santriImportWorkflow';
import { getSessionName } from '@/utils/sessionMapping';
import '@/styles/santri-import.css';

const defaultServices = { loadIdentities: loadSantriImportIdentities, importAccounts: importSantriAccounts };

const RecordPreview = ({ records }) => {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(records.length / 10) - 1));
  return <>
    {records.slice(current * 10, current * 10 + 10).map(record => <details className="santri-import-record" key={record.__importRow}>
      <summary><strong>Baris {record.__importRow}: {record.nama_lengkap}</strong><span>{record.jilid || 'Jilid belum diisi'} · {getSessionName(record.sesi_mengaji) || 'Sesi mengikuti kelas'}</span><span>NIQ {record.nomor_induk_qiroati} {record.is_auto_niq ? '(otomatis)' : ''}</span></summary>
      <dl>{IMPORT_FIELDS.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.key === 'sesi_mengaji' ? getSessionName(record[field.key]) || 'Belum diisi' : String(record[field.key] ?? '') || 'Belum diisi'}</dd></div>)}</dl>
    </details>)}
    {records.length > 10 && <div className="santri-import-actions"><Button variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Sebelumnya</Button><span>Halaman {current + 1}/{Math.ceil(records.length / 10)}</span><Button variant="outline" disabled={(current + 1) * 10 >= records.length} onClick={() => setPage(current + 1)}>Berikutnya</Button></div>}
  </>;
};

const SantriImportDialog = ({ open, onOpenChange, category = 'Anak', userRole, onComplete, services = defaultServices }) => {
  const [inputMethod, setInputMethod] = useState('file');
  const [mode, setMode] = useState('headers');
  const [text, setText] = useState('');
  const [source, setSource] = useState(null);
  const [mapping, setMapping] = useState([]);
  const [dateOrder, setDateOrder] = useState('auto');
  const [parsed, setParsed] = useState(null);
  const [identities, setIdentities] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [stage, setStage] = useState('input');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ackWarnings, setAckWarnings] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const lock = useRef(false);
  const attempted = useRef(false);
  const niqCache = useRef(new Map());
  const successfulRows = useRef(new Set());
  const report = useMemo(() => parsed && identities ? validateSantriImport(parsed, identities, { niqCache: niqCache.current, decisions }) : null, [parsed, identities, decisions]);
  const detected = source ? inferImportDateOrder(source, mapping) : null;
  const guardedClose = value => { if (!busy && !lock.current) onOpenChange(value); };

  const acceptSource = next => {
    setSource(next); setMapping(next.mapping); setStage('mapping'); setError(''); setDecisions({});
    setDateOrder('auto'); setParsed(null); setIdentities(null); setAckWarnings(false);
    niqCache.current.clear();
  };
  const readFile = async event => {
    const file = event.target.files?.[0]; if (!file || busy) return;
    setBusy('reading'); setError('');
    try {
      const XLSX = await loadXlsx();
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true, cellText: true, cellNF: true });
      acceptSource(readImportWorkbook(workbook, XLSX));
    } catch (e) { setError(e.message || 'File tidak dapat dibaca. Pilih file Excel/CSV yang valid.'); }
    finally { setBusy(''); event.target.value = ''; }
  };
  const readText = () => {
    try { acceptSource(createImportSource(text.split(/\r?\n/).map(line => line.split('\t')), { mode })); }
    catch (e) { setError(e.message); }
  };
  const template = async () => {
    setBusy('template'); setError('');
    try {
      const XLSX = await loadXlsx();
      const workbook = XLSX.utils.book_new();
      const headers = IMPORT_FIELDS.map(f => f.key.startsWith('tanggal_') ? `${f.label} (YYYY-MM-DD)` : f.label);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers]), 'Template Santri');
      XLSX.writeFile(workbook, 'Template_Import_Santri.xlsx');
    } catch { setError('Template gagal diunduh. Coba lagi.'); }
    finally { setBusy(''); }
  };
  const validate = async () => {
    if (lock.current || userRole !== 'admin') return;
    lock.current = true; setBusy('validating'); setError(''); setIdentities(null);
    try {
      const next = parseSantriImport(source, { mapping, dateOrder, category });
      const existing = await services.loadIdentities();
      setParsed(next); setIdentities(existing); setDecisions({}); setStage('preview'); setAckWarnings(false);
    } catch (e) { setError(e.message || 'Validasi gagal. Coba lagi.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const confirm = async () => {
    if (lock.current || userRole !== 'admin' || !report?.ready.length || (report.warnings.length && !ackWarnings)) return;
    lock.current = true; setBusy('validating'); setError('');
    try {
      // Recheck immediately before creating accounts, not just when the file was opened.
      const fresh = await services.loadIdentities();
      const next = validateSantriImport(parsed, fresh, { niqCache: niqCache.current, decisions });
      setIdentities(fresh);
      if (JSON.stringify([next.ready, next.review, next.errors]) !== JSON.stringify([report.ready, report.review, report.errors])) {
        setError('Data berubah sejak preview. Periksa hasil validasi terbaru sebelum menekan impor lagi.'); return;
      }
      const rows = next.ready.filter(row => !successfulRows.current.has(row.__importRow));
      if (!rows.length) return;
      attempted.current = true; setBusy('importing');
      setProgress({ completed: 0, total: rows.length, successCount: 0, failureCount: 0 });
      const outcome = await services.importAccounts(rows, { onProgress: setProgress });
      outcome.successes.forEach(row => successfulRows.current.add(row.__importRow));
      setCompletedCount(successfulRows.current.size); setResult(outcome); setStage('result');
      try { await onComplete?.(); } catch { setError('Impor sudah selesai, tetapi daftar dashboard belum diperbarui. Muat ulang setelah menutup modal.'); }
    } catch (e) { setError(e.message || 'Impor tidak terkonfirmasi. Periksa ulang data sebelum mencoba kembali.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const retry = async () => {
    if (lock.current || !result?.failures.length || userRole !== 'admin') return;
    lock.current = true; setBusy('validating'); setError(''); setIdentities(null);
    try {
      const existing = await services.loadIdentities();
      setParsed({ records: result.failures.map(f => f.record).filter(r => !successfulRows.current.has(r.__importRow)), errors: [], warnings: [], ignoredColumns: [] });
      setIdentities(existing); setDecisions({}); setStage('preview'); setAckWarnings(false);
    } catch (e) { setError(e.message || 'Pemeriksaan ulang gagal. Tidak ada baris yang dikirim ulang.'); }
    finally { lock.current = false; setBusy(''); }
  };

  return <Dialog open={open} onOpenChange={guardedClose}>
    <DialogContent className="santri-import-dialog max-w-5xl w-[calc(100vw-2rem)]" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader className="pr-10"><DialogTitle>Impor santri baru</DialogTitle><DialogDescription>Kenali kolom dari header, periksa data, lalu buat akun baru. Data santri lama tidak diubah.</DialogDescription></DialogHeader>
      {userRole !== 'admin' ? <p role="alert">Hanya admin yang berwenang dapat mengimpor santri.</p> : <>
        <p className="santri-import-step">{stage === 'input' ? 'Unggah data' : stage === 'mapping' ? 'Pemetaan kolom & pengaturan' : stage === 'preview' ? 'Validasi & konfirmasi' : 'Hasil impor'}</p>
        {error && <p className="santri-import-error" role="alert">{error}</p>}
        {busy && <p role="status" className="santri-import-status">{busy === 'importing' ? 'Membuat akun santri...' : busy === 'reading' ? 'Membaca file...' : busy === 'template' ? 'Menyiapkan template...' : 'Memeriksa identitas santri...'}</p>}
        {progress && busy === 'importing' && <div aria-live="polite"><progress max={progress.total} value={progress.completed} aria-label="Progres impor"/><p>{progress.completed}/{progress.total} diproses · {progress.successCount} berhasil · {progress.failureCount} gagal</p></div>}
        {stage === 'input' && <div className="santri-import-stack">
          <label>Metode input<select value={inputMethod} onChange={e => setInputMethod(e.target.value)} disabled={Boolean(busy)}><option value="file">File Excel / CSV</option><option value="text">Tempel dari Excel</option></select></label>
          {inputMethod === 'file' ? <label className="santri-import-upload">Pilih file santri<input type="file" accept=".xlsx,.xls,.csv" onChange={readFile} disabled={Boolean(busy)}/><span>Header boleh berbeda urutan. Sheet pertama akan dibaca.</span></label> : <>
            <label>Format tempelan<select value={mode} onChange={e => setMode(e.target.value)}><option value="headers">Dengan header, urutan bebas</option><option value="legacy">Urutan template lama, tanpa header</option></select></label>
            {mode === 'legacy' && <p>Urutan 16 kolom: {IMPORT_FIELDS.map(f => f.label).join(' · ')}</p>}
            <label>Data dengan pemisah TAB<textarea rows={7} value={text} onChange={e => setText(e.target.value)} placeholder="Salin kolom beserta header dari Excel."/></label>
            <Button onClick={readText} disabled={!text.trim()}>Baca data tempelan</Button>
          </>}
          <Button variant="outline" onClick={template} disabled={Boolean(busy)}>Unduh template</Button>
        </div>}
        {stage === 'mapping' && source && <div className="santri-import-stack">
          <p>{source.entries.length} baris terdeteksi{source.sheetName ? ` di sheet ${source.sheetName}` : ''}. Kolom yang tidak dipakai akan diabaikan.</p>
          <div className="santri-import-mapping">{source.headers.map((header, index) => <label key={index}><span>{header || `Kolom ${index + 1} tanpa nama`}</span><select aria-label={`Pemetaan kolom ${index + 1}: ${header}`} value={mapping[index] || ''} onChange={e => { const next = [...mapping]; next[index] = e.target.value; setMapping(next); }} disabled={Boolean(busy)}><option value="">Abaikan kolom</option>{IMPORT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>)}</div>
          <div className="santri-import-settings">
            <label>Format tanggal teks<select value={dateOrder} onChange={e => setDateOrder(e.target.value)} disabled={Boolean(busy)}><option value="auto">Deteksi otomatis</option><option value="dmy">Hari / Bulan / Tahun</option><option value="mdy">Bulan / Hari / Tahun</option></select></label>
            <p>Sesi yang tidak tersedia atau kosong diterima sebagai kosong. Sesi akan mengikuti kelas ketika santri dimasukkan ke kelas yang memiliki sesi.</p>
          </div>
          <p>{detected?.needsChoice ? detected.reason : detected?.order ? `Format terdeteksi: ${detected.order === 'mdy' ? 'Bulan/Hari/Tahun' : 'Hari/Bulan/Tahun'}.` : 'Tanggal Excel dan YYYY-MM-DD dibaca langsung.'}</p>
          <p>Kolom Kelas dipakai sebagai jilid, bukan penempatan kelas guru. NIQ kosong dibuat otomatis. Kolom opsional kosong tidak ditebak.</p>
          <div className="santri-import-actions"><Button variant="outline" onClick={() => setStage('input')} disabled={Boolean(busy)}>Ganti sumber data</Button><Button onClick={validate} disabled={Boolean(busy)}>Validasi data</Button></div>
        </div>}
        {stage === 'preview' && report && <div className="santri-import-stack">
          <div className="santri-import-counts"><p><strong>{report.ready.length}</strong> Siap impor</p><p><strong>{report.review.length}</strong> Perlu diperiksa</p><p><strong>{report.errors.length}</strong> Bermasalah</p><p><strong>{report.skipped.length}</strong> Dilewati</p></div>
          {report.ignoredColumns.length > 0 && <p>Kolom diabaikan: {report.ignoredColumns.join(', ')}.</p>}
          {report.errors.length > 0 && <section><h3>Baris bermasalah, tidak akan diimpor</h3><ul className="santri-import-issues">{report.errors.map(e => <li key={e.row}>Baris {e.row}: {e.name}. {e.reason}</li>)}</ul></section>}
          {report.reviewCandidates.length > 0 && <section><h3>Periksa kemungkinan santri yang sama</h3><p>Hanya konfirmasi sebagai baru jika ini benar-benar orang berbeda.</p>{report.reviewCandidates.map(row => <label className="santri-import-review" key={row.__importRow}><span>Baris {row.__importRow}: {row.nama_lengkap} · {row.tanggal_lahir}<small>{row.reason}</small></span><select aria-label={`Keputusan duplikat baris ${row.__importRow}`} value={decisions[row.__importRow] || ''} disabled={Boolean(busy)} onChange={e => setDecisions({ ...decisions, [row.__importRow]: e.target.value })}><option value="">Tahan, belum diperiksa</option><option value="skip">Lewati, santri yang sama</option><option value="new">Orang berbeda (baru)</option></select></label>)}</section>}
          {report.warnings.length > 0 && <section><h3>Periksa format angka dari Excel</h3><ul className="santri-import-issues">{report.warnings.map((w, i) => <li key={i}>Baris {w.row}: {w.reason}</li>)}</ul><label className="santri-import-check"><input type="checkbox" checked={ackWarnings} onChange={e => setAckWarnings(e.target.checked)} disabled={Boolean(busy)}/>Saya sudah memeriksa digit pada preview.</label></section>}
          <section><h3>Preview santri baru</h3><p>Ketuk nama untuk melihat seluruh field. Baris ditahan, dilewati, dan bermasalah tidak dikirim.</p>{report.ready.length ? <RecordPreview records={report.ready}/> : <p>Tidak ada baris siap impor. Perbaiki data atau keputusan pemeriksaan.</p>}</section>
          <div className="santri-import-actions">{!attempted.current && <Button variant="outline" onClick={() => setStage('mapping')} disabled={Boolean(busy)}>Ubah pemetaan</Button>}<Button onClick={confirm} disabled={Boolean(busy) || !report.ready.length || (report.warnings.length > 0 && !ackWarnings)}>Impor {report.ready.length} santri baru</Button></div>
        </div>}
        {stage === 'result' && result && <div className="santri-import-stack">
          <p role="status"><strong>{completedCount} santri berhasil dibuat dalam sesi impor ini.</strong> Percobaan terakhir: {result.successCount} berhasil, {result.failures.length} gagal.</p>
          {result.failures.length > 0 && <><ul className="santri-import-issues">{result.failures.map(f => <li key={f.row}>Baris {f.row}: {f.name}. {f.reason}</li>)}</ul><p>Periksa ulang sebelum mencoba. Baris berhasil tidak akan dikirim ulang.</p><Button variant="outline" onClick={retry} disabled={Boolean(busy)}>Periksa ulang hanya baris gagal</Button></>}
          {!result.failures.length && <p>Data dan akun login berhasil dibuat. NIQ menjadi identitas login sesuai aturan akun yang berlaku.</p>}
        </div>}
      </>}
      <div className="santri-import-actions"><Button variant="outline" disabled={Boolean(busy)} onClick={() => guardedClose(false)}>Tutup</Button></div>
    </DialogContent>
  </Dialog>;
};
export default SantriImportDialog;
