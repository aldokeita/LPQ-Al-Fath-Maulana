import { getLogoBase64 } from './reportUtils';
import { getSessionName } from './sessionMapping';

const escapeHtml = (value) => String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const safeFilePart = (value) => String(value || 'Santri')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const formatDate = (value) => value
    ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Belum Evaluasi';

const metricCard = (label, value, tone) => `
    <article class="metric ${tone}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
    </article>`;

const buildCharacterCards = (items) => items.length
    ? items.map((item) => `
        <article class="character-card">
            <span>${escapeHtml(item.item_name || item.title)}</span>
            <strong>${escapeHtml(item.score || 0)}/4</strong>
        </article>`).join('')
    : '<p class="empty">Belum ada data penilaian karakter.</p>';

const buildHafalanRows = (items, isPtpt) => items.length
    ? items.map((item) => `
        <tr>
            <td>${escapeHtml(item.jilid)}</td>
            <td><strong>${escapeHtml(item.item_name || item.display_name || item.nama_item || item.title)}</strong></td>
            <td>${escapeHtml(item.category || (isPtpt ? 'Tahfizh PTPT' : 'Surat Pendek'))}</td>
            <td>${escapeHtml(item.score ? `${item.score} / 4` : '-')}</td>
            <td><span class="status ${item.is_completed ? 'done' : 'progress'}">${item.is_completed ? 'Lulus / Dihafal' : 'Dalam Proses'}</span></td>
            <td>${escapeHtml(formatDate(item.evaluated_at))}</td>
        </tr>`).join('')
    : '<tr><td class="empty" colspan="6">Belum ada rincian hafalan yang tercatat.</td></tr>';

export const createRaporHTML = ({ santri, attendance, hafalan, period, character, scores, logo }) => {
    const isPtpt = String(santri.kategori || '').toUpperCase() === 'PTPT';
    const strengths = character?.strengths || [];
    const teacher = santri.class?.guru?.nama || santri.guru?.nama || santri.nama_guru || '....................................';
    const guardian = santri.nama_ibu || santri.nama_ayah || santri.nama_wali || '-';
    const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapor ${escapeHtml(santri.nama_lengkap)}</title>
<style>
:root{--ink:#10213a;--muted:#63718a;--line:rgba(94,122,163,.22);--glass:rgba(255,255,255,.72);--violet:#7557d9;--blue:#247dc6;--cyan:#13a6b7;--teal:#12997f;--gold:#d9982f;--rose:#d9566f;--shadow:0 24px 70px rgba(38,70,116,.18)}
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;color:var(--ink);font-family:Inter,"Segoe UI",Arial,sans-serif;background:radial-gradient(circle at 12% 10%,rgba(32,183,177,.22),transparent 34%),radial-gradient(circle at 88% 18%,rgba(119,86,217,.20),transparent 38%),linear-gradient(145deg,#effbfa 0%,#edf4ff 48%,#f5efff 100%);line-height:1.5}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(81,112,154,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(81,112,154,.045) 1px,transparent 1px);background-size:28px 28px}
.page{position:relative;width:min(1120px,calc(100% - 32px));margin:34px auto;padding:24px;border:1px solid rgba(255,255,255,.84);border-radius:32px;background:rgba(255,255,255,.48);box-shadow:var(--shadow);backdrop-filter:blur(24px)}
.hero{position:relative;overflow:hidden;padding:32px;border-radius:24px;color:white;background:linear-gradient(125deg,#0d9283 0%,#187eb8 46%,#7052cc 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 18px 42px rgba(60,87,162,.24)}
.hero:after{content:"";position:absolute;width:300px;height:300px;right:-100px;top:-180px;border-radius:50%;background:rgba(255,255,255,.16)}.brand{position:relative;z-index:1;display:flex;align-items:center;gap:20px}.logo{width:76px;height:76px;object-fit:contain;padding:8px;border-radius:20px;background:rgba(255,255,255,.94);box-shadow:0 12px 28px rgba(15,38,76,.2)}
.eyebrow{margin:0 0 4px;text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:800;opacity:.82}.hero h1{margin:0;font-family:Montserrat,"Segoe UI",sans-serif;font-size:clamp(24px,4vw,38px);line-height:1.12}.period{margin:10px 0 0;font-size:13px}.seal{margin-left:auto;align-self:flex-start;padding:8px 12px;border:1px solid rgba(255,255,255,.42);border-radius:999px;background:rgba(255,255,255,.14);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.section{margin-top:18px;padding:22px;border:1px solid var(--line);border-radius:22px;background:var(--glass);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 12px 30px rgba(54,83,128,.08);backdrop-filter:blur(18px)}.section h2{margin:0 0 16px;font:800 17px/1.2 Montserrat,"Segoe UI",sans-serif}.identity{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.datum{padding:14px;border-radius:16px;background:rgba(241,247,252,.72);border:1px solid rgba(118,143,179,.15)}.datum span,.metric span{display:block;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.datum strong{display:block;margin-top:5px;font-size:14px}.sub{display:block;color:var(--muted);font-size:11px;margin-top:2px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{padding:16px;border-radius:17px;border:1px solid var(--line);background:rgba(255,255,255,.76)}.metric strong{display:block;margin-top:5px;font-size:23px}.metric.primary{background:linear-gradient(145deg,rgba(117,87,217,.12),rgba(36,125,198,.10))}.metric.good strong{color:var(--teal)}.metric.warn strong{color:var(--gold)}.metric.bad strong{color:var(--rose)}
.strengths{display:flex;flex-wrap:wrap;gap:8px}.chip,.status{display:inline-block;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800}.chip{color:#79520d;background:linear-gradient(135deg,#fff0c4,#ffe1a4);border:1px solid #efc873}.character-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.character-card{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:rgba(249,251,255,.72);font-size:12px}.character-card strong{color:var(--violet);white-space:nowrap}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:16px}table{width:100%;border-collapse:collapse;font-size:11px}th{padding:11px 12px;text-align:left;color:#40516b;background:rgba(223,234,246,.72);text-transform:uppercase;letter-spacing:.05em}td{padding:11px 12px;border-top:1px solid var(--line)}tbody tr:nth-child(even){background:rgba(243,247,252,.58)}.done{color:#08755e;background:#d9f4ec}.progress{color:#8a5b07;background:#fff0c9}.empty{text-align:center;color:var(--muted);font-style:italic;padding:22px}
.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:26px;text-align:center;font-size:11px}.signature{padding-top:12px}.signature strong{display:block;margin-top:58px;padding-bottom:6px;border-bottom:1px solid #aab5c5}.footer{margin:22px 6px 2px;color:var(--muted);font-size:10px;text-align:center}.print-button{position:fixed;right:22px;bottom:22px;z-index:4;border:1px solid rgba(255,255,255,.5);border-radius:14px;padding:12px 16px;color:white;background:linear-gradient(135deg,var(--teal),var(--blue),var(--violet));box-shadow:0 12px 28px rgba(52,82,143,.28);font:800 12px Inter,"Segoe UI",sans-serif;cursor:pointer}.print-button:focus-visible{outline:3px solid #fff;outline-offset:3px}
@media(max-width:760px){.page{width:min(100% - 16px,1120px);margin:8px auto;padding:10px;border-radius:20px}.hero,.section{padding:18px;border-radius:18px}.brand{align-items:flex-start}.logo{width:58px;height:58px}.seal{display:none}.identity,.metrics{grid-template-columns:repeat(2,1fr)}.character-grid{grid-template-columns:1fr}.signatures{grid-template-columns:1fr}.signature strong{margin-top:34px}.print-button{position:static;display:block;margin:8px 8px 0 auto;padding:10px 13px}}
@media print{@page{size:A4;margin:12mm}body{background:#fff;color:#111}body:before,.print-button{display:none}.page{width:100%;margin:0;padding:0;border:0;border-radius:0;background:#fff;box-shadow:none}.hero{padding:18px;border-radius:14px;background:#fff;color:#111;border:2px solid #244f7d;box-shadow:none}.logo{width:58px;height:58px;border:1px solid #ccd6e4}.seal{border-color:#7f8da0}.section{break-inside:avoid;margin-top:12px;padding:14px;background:#fff;box-shadow:none}.table-wrap{overflow:visible}table{font-size:9px}th,td{padding:7px}.chip{border:1px solid #b98a2d;background:#fff}.metric,.datum,.character-card{background:#fff}.signatures{break-inside:avoid}.footer{margin-top:14px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<button class="print-button" type="button" onclick="window.print()" aria-label="Cetak rapor ini">Cetak Rapor</button>
<main class="page">
<header class="hero"><div class="brand">${logo ? `<img class="logo" src="${logo}" alt="Logo LPQ Al-Fath Maulana">` : ''}<div><p class="eyebrow">LPQ Al-Fath Maulana · Metode Qiroati</p><h1>Rapor Akademik &amp; Karakter Santri</h1><p class="period">Periode Evaluasi: <strong>${escapeHtml(period)}</strong></p></div><span class="seal">Qiroati Certified</span></div></header>
<section class="section identity" aria-label="Biodata santri">
<div class="datum"><span>Nama Santri</span><strong>${escapeHtml(santri.nama_lengkap)}</strong><small class="sub">NIQ: ${escapeHtml(santri.nomor_induk_qiroati)}</small></div>
<div class="datum"><span>Kelas &amp; Sesi</span><strong>${escapeHtml(santri.className || santri.class?.nama_kelas)}</strong><small class="sub">${escapeHtml(getSessionName(santri.sesi_mengaji) || 'Sesi Reguler')}</small></div>
<div class="datum"><span>Tingkat Jilid</span><strong>${escapeHtml(santri.jilid)}</strong><small class="sub">Kategori: ${escapeHtml(santri.kategori || 'Anak')}</small></div>
<div class="datum"><span>Wali Santri</span><strong>${escapeHtml(guardian)}</strong><small class="sub">HP: ${escapeHtml(santri.no_hp_ortu)}</small></div>
</section>
<section class="section"><h2>Ringkasan Perkembangan</h2><div class="metrics">
${metricCard('Skor Keseluruhan', scores ? `${scores.overallAverage} · Grade ${scores.grade}` : '-', 'primary')}
${metricCard('Kehadiran', `${attendance.attendancePercentage || 0}%`, 'good')}
${metricCard('Ketuntasan Hafalan', `${scores?.hafalanScore || 0}%`, 'good')}
${metricCard('Perkembangan Karakter', `${scores?.characterScore || 0}%`, 'primary')}
</div></section>
<section class="section"><h2>1. Rekapitulasi Kehadiran</h2><div class="metrics">
${metricCard('Hari Efektif', `${attendance.totalDays || 0} Hari`, 'primary')}${metricCard('Hadir', `${attendance.totalPresent || 0} Hari`, 'good')}${metricCard('Terlambat', `${attendance.totalLate || 0} Hari`, 'warn')}${metricCard('Tidak Hadir', `${attendance.totalAbsent || 0} Hari`, 'bad')}
</div></section>
<section class="section"><h2>2. Perkembangan Karakter</h2><div class="strengths">${strengths.length ? strengths.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('') : '<span class="empty">Belum ditetapkan oleh guru pengampu.</span>'}</div><div class="character-grid">${buildCharacterCards(character?.assessedItems || [])}</div></section>
<section class="section"><h2>3. Rekapitulasi Hafalan ${isPtpt ? 'PTPT' : 'Surat Pendek, Doa & Sholat'}</h2><div class="table-wrap"><table><thead><tr><th>Jilid</th><th>Nama Item / Surat</th><th>Kategori</th><th>Skor</th><th>Status</th><th>Evaluasi</th></tr></thead><tbody>${buildHafalanRows(hafalan.allItems || [], isPtpt)}</tbody></table></div></section>
<section class="signatures" aria-label="Pengesahan rapor"><div class="signature">Mengetahui,<br>Orang Tua / Wali Santri<strong>( .................................... )</strong></div><div class="signature">Guru Pengampu Kelas,<br>Ustadz / Ustadzah<strong>( ${escapeHtml(teacher)} )</strong></div><div class="signature">Disahkan oleh,<br>Pentashih Official LPQ<strong>Pentashih LPQ Al-Fath Maulana</strong></div></section>
<footer class="footer">Dokumen resmi LPQ Al-Fath Maulana · Dibuat pada ${escapeHtml(new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }))}</footer>
</main>
</body>
</html>`;

    return html;
};

export const downloadRaporHTML = async (reportData) => {
    const logo = await getLogoBase64();
    const html = createRaporHTML({ ...reportData, logo });
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `Rapor_LPQ_${safeFilePart(reportData.santri.nama_lengkap)}_${safeFilePart(reportData.period)}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
};
