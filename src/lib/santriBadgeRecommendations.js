import { normalizeBadgeGender, normalizeBadgeSession, resolveSantriBadgeSession } from './santriBadges.js';

// Rekomendasi badge dihitung dari data yang sudah ada, tanpa tabel baru:
// - Terdisiplin: urutan datang sendiri (tap RFID / wajah) yang konsisten paling awal di sesinya.
// - Hafalan terbanyak: jumlah item hafalan yang sudah tuntas (lulus / skor 4).

export const DISCIPLINE_WINDOW_DAYS = 60;
export const DISCIPLINE_MIN_RATE = 0.7;
export const DISCIPLINE_MIN_DAYS = 5;

const SELF_CHECK_IN = new Set(['rfid', 'face']);
const PRESENT = new Set(['hadir', 'terlambat']);

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const stdev = (values) => {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
};

const jakartaMinutes = (timestamp) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
};

const formatMinutes = (total) => {
  const rounded = Math.round(total);
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}.${String(rounded % 60).padStart(2, '0')}`;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Groups ranked candidates into { [sesi]: { putra: [...], putri: [...] } }, best first.
const groupTop = (candidates, limit) => {
  const grouped = {};
  candidates.forEach((candidate) => {
    const bucket = grouped[candidate.sesi] || (grouped[candidate.sesi] = { putra: [], putri: [] });
    if (bucket[candidate.gender].length < limit) bucket[candidate.gender].push(candidate);
  });
  return grouped;
};

const santriIndex = (santriList) => new Map((santriList || [])
  .map((row) => [row.id, { row, gender: normalizeBadgeGender(row.jenis_kelamin), sesi: resolveSantriBadgeSession(row) }])
  .filter(([, info]) => info.gender && info.sesi));

/**
 * Peringkat disiplin: setiap hari & sesi, santri yang absen sendiri diurutkan menurut jam datang
 * lalu diberi posisi 0 (pertama) sampai 1 (terakhir). Skor = rata-rata posisi + ½ simpangan baku,
 * sehingga yang selalu awal mengalahkan yang kadang sangat awal kadang terlambat. Hanya santri yang
 * hadir minimal DISCIPLINE_MIN_RATE dari hari sesinya (dan ≥ DISCIPLINE_MIN_DAYS hari) yang dinilai.
 */
export const rankDiscipline = ({ attendance = [], santri = [], limit = 3 } = {}) => {
  const known = santriIndex(santri);
  const groups = new Map();
  const sessionDays = new Map();

  attendance.forEach((source) => {
    const sesi = normalizeBadgeSession(source?.sesi);
    if (!sesi || !source.attendance_date) return;
    const row = { ...source, sesi };
    const days = sessionDays.get(sesi) || new Set();
    days.add(row.attendance_date);
    sessionDays.set(sesi, days);
    if (!known.has(row.user_id) || !row.check_in_timestamp) return;
    if (!SELF_CHECK_IN.has(String(row.source || '').toLowerCase())) return;
    if (!PRESENT.has(String(row.status || '').trim().toLowerCase())) return;
    const key = `${row.attendance_date}|${row.sesi}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  });

  const perSantri = new Map();
  groups.forEach((rows) => {
    if (rows.length < 2) return; // urutan tidak bermakna bila hanya satu santri
    rows.sort((a, b) => new Date(a.check_in_timestamp) - new Date(b.check_in_timestamp));
    rows.forEach((row, index) => {
      const entry = perSantri.get(row.user_id) || { positions: [], minutes: [], sesiRows: new Map() };
      entry.positions.push(index / (rows.length - 1));
      entry.minutes.push(jakartaMinutes(row.check_in_timestamp));
      entry.sesiRows.set(row.sesi, (entry.sesiRows.get(row.sesi) || 0) + 1);
      perSantri.set(row.user_id, entry);
    });
  });

  const candidates = [];
  perSantri.forEach((entry, santriId) => {
    const info = known.get(santriId);
    const days = sessionDays.get(info.sesi)?.size || 0;
    const attended = entry.sesiRows.get(info.sesi) || 0;
    if (!days || attended < DISCIPLINE_MIN_DAYS || attended / days < DISCIPLINE_MIN_RATE) return;
    const positions = entry.positions;
    candidates.push({
      santriId,
      name: info.row.nama_lengkap,
      sesi: info.sesi,
      gender: info.gender,
      score: mean(positions) + stdev(positions) / 2,
      averagePosition: mean(positions),
      attended,
      sessionDays: days,
      medianTime: formatMinutes(median(entry.minutes)),
    });
  });

  candidates.sort((a, b) => a.score - b.score || b.attended - a.attended || a.name.localeCompare(b.name, 'id'));
  return groupTop(candidates, limit);
};

/** Peringkat hafalan: jumlah item tuntas (lulus atau skor 4); seri dipecah dengan rata-rata skor. */
export const rankHafalan = ({ progress = [], santri = [], limit = 3 } = {}) => {
  const known = santriIndex(santri);
  const totals = new Map();
  progress.forEach((row) => {
    if (!known.has(row?.santri_id)) return;
    const score = Number(row.score);
    const entry = totals.get(row.santri_id) || { completed: 0, scoreSum: 0, scored: 0 };
    if (row.status === 'lulus' || score === 4) entry.completed += 1;
    if (score >= 1 && score <= 4) { entry.scoreSum += score; entry.scored += 1; }
    totals.set(row.santri_id, entry);
  });

  const candidates = [];
  totals.forEach((entry, santriId) => {
    if (!entry.completed) return;
    const info = known.get(santriId);
    candidates.push({
      santriId,
      name: info.row.nama_lengkap,
      sesi: info.sesi,
      gender: info.gender,
      completed: entry.completed,
      averageScore: entry.scored ? entry.scoreSum / entry.scored : null,
    });
  });

  candidates.sort((a, b) => b.completed - a.completed || (b.averageScore || 0) - (a.averageScore || 0) || a.name.localeCompare(b.name, 'id'));
  return groupTop(candidates, limit);
};
