// Data untuk kartu santri yang dibagikan ke wali: apresiasi kenaikan jilid dan profil kehadiran & hafalan.
// Semua data sudah dibaca sesuai hak guru (RLS); di sini hanya dirapikan untuk tampilan kartu.

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const formatTanggal = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatBulan = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? '' : `${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

export const panggilanOf = (profile) => String(profile?.nama_panggilan || '').trim()
  || String(profile?.nama_lengkap || 'Ananda').trim().split(/\s+/)[0];

export const fillPesan = (text, { nama, ke } = {}) => String(text || '')
  .replace(/\{nama\}/g, nama || 'Ananda')
  .replace(/\{ke\}/g, ke || 'jilid berikutnya');

export const DEFAULT_PESAN = {
  jilid: 'Alhamdulillah, {nama} telah naik ke {ke}. Terima kasih atas ketekunan dan semangatnya. Semoga Allah memudahkan langkah berikutnya dalam belajar Al-Qur\'an.',
  profil: 'Terus semangat mengaji, {nama}! Pertahankan kehadiran dan ulangi hafalan bersama Ayah dan Bunda di rumah.',
};

const daysAgo = (today, days) => {
  const d = new Date(today);
  d.setDate(d.getDate() - (Number(days) || 0));
  return d;
};

// Kartu apresiasi kenaikan jilid. Memakai riwayat kenaikan terakhir; tanpa riwayat, jilid saat ini.
export const buildJilidCard = (profile, { today = new Date() } = {}) => {
  if (!profile) return null;
  const last = (profile.riwayat_jilid || [])[0] || null;
  const ke = last?.ke || profile.jilid || '';
  return {
    namaLengkap: String(profile.nama_lengkap || '').trim(),
    panggilan: panggilanOf(profile),
    dari: last?.dari || null,
    ke,
    tanggal: formatTanggal(last ? daysAgo(today, last.hari_lalu) : today),
    adaRiwayat: Boolean(last),
    hariLalu: last ? Number(last.hari_lalu) : null,
  };
};

const scoreOf = (value) => (value === null || value === undefined || value === '' ? null : Number(value));

// Kartu profil: kehadiran 4 pekan + 10 sesi terakhir, dan hafalan (sudah hafal, dilatih, belum dinilai).
export const buildProfilCard = (profile, snapshot, { today = new Date() } = {}) => {
  if (!profile) return null;
  const sesi = Array.isArray(snapshot?.sesi_terakhir) ? snapshot.sesi_terakhir : [];
  const hadir4 = Number(snapshot?.hadir_4pekan ?? NaN);
  const total4 = Number(snapshot?.sesi_4pekan ?? NaN);
  const progress = (profile.hafalan || []).map((h) => ({ ...h, skor: scoreOf(h.skor) }));
  const wajib = (profile.hafalan_wajib_jilid || []).map((w) => ({ ...w, skor: scoreOf(w.skor) }));

  const sudahHafal = progress.filter((h) => h.skor === 4).map((h) => h.materi).filter(Boolean);
  const dilatih = progress.filter((h) => h.skor !== null && h.skor < 4)
    .sort((a, b) => b.skor - a.skor)
    .map((h) => ({ materi: h.materi, skor: h.skor }));
  const wajibTotal = wajib.length || Number(snapshot?.hafalan?.total || 0);
  const wajibAman = wajib.length ? wajib.filter((w) => w.skor === 4).length : Number(snapshot?.hafalan?.lulus || 0);

  return {
    namaLengkap: String(profile.nama_lengkap || '').trim(),
    panggilan: panggilanOf(profile),
    jilid: profile.jilid || snapshot?.jilid || '',
    poin: Number(profile.poin || 0),
    bulan: formatBulan(today),
    tanggal: formatTanggal(today),
    kehadiran: {
      hadir: Number.isFinite(hadir4) ? hadir4 : null,
      total: Number.isFinite(total4) ? total4 : null,
      persen: Number.isFinite(hadir4) && total4 > 0 ? Math.round((hadir4 / total4) * 100) : null,
      sesi: sesi.slice(-10).map((s) => s.s),
    },
    hafalan: {
      wajibTotal,
      wajibAman,
      persen: wajibTotal > 0 ? Math.round((wajibAman / wajibTotal) * 100) : null,
      sudahHafal,
      dilatih,
      belumDinilai: wajib.filter((w) => w.skor === null).length,
      belumDinilaiList: wajib.filter((w) => w.skor === null).map((w) => w.materi).filter(Boolean),
    },
  };
};

// Batasi daftar chip agar kartu tetap rapi: tampilkan n pertama dan sisanya sebagai "+x lainnya".
export const limitList = (list = [], n = 10) => ({ shown: list.slice(0, n), more: Math.max(0, list.length - n) });

export const cardFileName = (jenis, nama, tanggal = new Date()) => {
  const slug = String(nama || 'santri').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'santri';
  const d = tanggal instanceof Date ? tanggal : new Date(tanggal);
  const stamp = Number.isNaN(d.getTime()) ? '' : `-${d.toISOString().slice(0, 10)}`;
  return `kartu-${jenis === 'jilid' ? 'naik-jilid' : 'profil'}-${slug}${stamp}.png`;
};
