// Turns a scan result from the RFID page into the plain data every kiosk theme renders.
import { resolveSantriTier, resolveSantriTierProgress } from '@/lib/santriTier';
import { getSantriBadgeById } from '@/lib/santriBadges';
import { isPentashihGuru } from '@/lib/guruAttendanceScan';

const isLate = (status) => String(status || '').trim().toLowerCase() === 'terlambat';
const short = (time) => String(time || '').slice(0, 5);
const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .trim()
  .replace(/\b\w/g, (c) => c.toUpperCase());

export const initialsOf = (name) => String(name || '?')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

const HAFALAN_ORDER = ['Doa', 'Sholat', 'Surat', 'Tahfizh'];
export const formatHafalanBreakdown = (breakdown = {}) => {
  const entries = Object.entries(breakdown || {}).filter(([, n]) => n > 0);
  entries.sort(([a], [b]) => {
    const ia = HAFALAN_ORDER.indexOf(a); const ib = HAFALAN_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return entries.map(([category, n]) => `${n} ${category.toLowerCase()}`).join(' · ');
};

const santriView = (scan, levelConfig) => {
  const adult = scan.kategori === 'Dewasa';
  const points = Number(scan.points) || 0;
  let tier = null;
  if (!adult) {
    const resolved = resolveSantriTier({ levelInfo: scan.levelInfo, points, gender: scan.gender, config: levelConfig });
    const progress = resolveSantriTierProgress({ points, gender: scan.gender, config: levelConfig, levelInfo: scan.levelInfo });
    tier = {
      label: resolved.label || scan.levelInfo?.label || 'Santri',
      src: resolved.assetSrc,
      ratio: progress.available ? progress.ratio : (progress.isHighest ? 1 : 0),
      next: progress.nextLabel,
      toNext: progress.available ? Math.max(Math.ceil(progress.nextMin - points), 0) : null,
      highest: progress.isHighest,
    };
  }
  const monthly = scan.monthlyStats || {};
  const days = (monthly.days || []).map((d) => (d === 'present' ? 'on' : d));
  const attended = (Number(monthly.present) || 0) + (Number(monthly.late) || 0);
  const message = String(scan.message || '');
  return {
    kind: 'santri',
    tag: String(scan.rfid || '').slice(-6).toUpperCase(),
    name: scan.name,
    photo: scan.photo,
    meta: [scan.jilid ? `Jilid ${scan.jilid}` : null, scan.sesi ? `Sesi ${scan.sesi}` : null, adult ? 'Santri dewasa' : null]
      .filter(Boolean).join(' · '),
    late: isLate(scan.status),
    statusLabel: isLate(scan.status) ? 'Terlambat' : 'Hadir tepat waktu',
    time: short(scan.time),
    timeFull: String(scan.time || '').slice(0, 8),
    notice: /sudah tercatat|tercatat untuk sesi/i.test(message) ? message : null,
    points,
    pointsAward: Number(scan.pointsAward) || 0,
    tier,
    jilid: scan.jilid || '-',
    hafalan: Number(scan.hafalanCount) || 0,
    hafalanBreakdown: formatHafalanBreakdown(scan.hafalanBreakdown),
    monthly: { attended, total: days.length || attended + (Number(monthly.absent) || 0), present: Number(monthly.present) || 0, late: Number(monthly.late) || 0, absent: Number(monthly.absent) || 0, days },
    character: scan.characterStrength ? titleCase(scan.characterStrength) : null,
    badges: (Array.isArray(scan.badges) ? scan.badges : []).map(getSantriBadgeById).filter(Boolean),
    quote: scan.quote || null,
  };
};

const guruView = (scan) => {
  const success = scan.type === 'success' || scan.type === 'mmq_success';
  const pentashih = success ? Boolean(scan.isPentashih) : isPentashihGuru(scan);
  const stats = [];
  if (scan.type === 'mmq_success') {
    stats.push(['Program', 'MMQ'], ['Status', scan.status || 'Hadir'], ['Jam', short(scan.time)]);
  } else if (success) {
    stats.push(['Sesi', scan.sesi || (pentashih ? 'Flex' : '-')]);
    if (scan.guruStats) stats.push(['Jam bulan ini', `${scan.guruStats.hours}`, 'jam'], ['Streak', `${scan.guruStats.streak}`, 'hari']);
    stats.push(['Status', scan.status || 'Hadir']);
  } else if (scan.stats) {
    stats.push(['Sesi terjadwal', `${scan.stats.sessions}`], ['Jam bulan ini', `${scan.stats.hours}`, 'jam'],
      ['Streak', `${scan.stats.streak}`, 'hari'], ['Sesi berikutnya', scan.stats.nextSession || '-']);
  }
  return {
    kind: 'guru',
    tag: String(scan.rfid || '').slice(-6).toUpperCase(),
    name: scan.name,
    photo: scan.photo,
    meta: [scan.jabatan || 'Guru', pentashih ? 'Pentashih' : null].filter(Boolean).join(' · '),
    success,
    late: isLate(scan.status),
    statusLabel: success ? (isLate(scan.status) ? 'Terlambat' : 'Hadir') : 'Di luar jadwal sesi',
    time: success ? short(scan.time) : '',
    timeFull: success ? String(scan.time || '').slice(0, 8) : '',
    stats,
    note: pentashih
      ? 'Tap kartu sekali lagi untuk melihat riwayat mutasi santri.'
      : 'Tap kartu sekali lagi untuk melihat daftar kelas Anda.',
    quote: scan.quote || scan.message || null,
  };
};

export const toKioskView = (scan, { levelConfig } = {}) => {
  if (!scan) return { kind: 'ready' };
  if (scan.type === 'scanning') return { kind: 'ready', processing: true };
  if (scan.type === 'confirmation') {
    return { kind: 'message', tone: 'info', name: scan.name, photo: scan.photo, eyebrow: scan.isMMQ ? 'MMQ · Sudah absen' : 'Sudah absen',
      title: scan.name || 'Sudah absen', text: 'Anda sudah absen hari ini. Tap kartu sekali lagi untuk memperbarui jam, atau biarkan untuk membatalkan.' };
  }
  if (scan.type === 'error') {
    const unknown = /tidak dikenal/i.test(scan.message || '');
    return { kind: 'message', tone: 'error', eyebrow: unknown ? 'Tidak dicatat' : 'Gagal',
      title: unknown ? 'Kartu belum terdaftar' : 'Absensi gagal',
      text: unknown ? 'Kartu ini belum terhubung ke santri atau guru mana pun. Absensi tidak dicatat, minta admin mendaftarkannya.' : (scan.message || 'Terjadi kesalahan.'),
      tag: unknown ? null : (scan.name && scan.name !== 'Error' && scan.name !== 'Tidak Dikenal' ? scan.name : null) };
  }
  if (scan.type === 'warning') {
    return { kind: 'message', tone: 'warning', name: scan.name, photo: scan.photo, eyebrow: 'Perhatian',
      title: scan.name || 'Belum bisa dicatat', text: scan.message || 'Absensi belum dapat dicatat.' };
  }
  if (scan.type === 'guru_schedule_detail') {
    return { kind: 'list', title: 'Kelas Anda', empty: 'Tidak ada kelas yang diampu.',
      items: (scan.classesData || []).map((cls) => ({ id: cls.id, title: cls.nama_kelas, side: cls.sesi,
        chips: (cls.santri || []).map((s) => s.nama_lengkap) })) };
  }
  if (scan.type === 'pentashih_history') {
    return { kind: 'list', title: 'Riwayat mutasi terkini', empty: 'Belum ada mutasi.',
      items: (scan.historyData || []).map((h, i) => ({ id: h.id || i, title: h.santri?.nama_lengkap || 'Santri',
        side: h.mutation_date ? new Date(h.mutation_date).toLocaleDateString('id-ID') : '',
        chips: [`${h.from_jilid || '?'} → ${h.to_jilid || '?'}`, `${h.from_class?.nama_kelas || '-'} → ${h.to_class?.nama_kelas || '-'}`] })) };
  }
  if (scan.type === 'mmq_success' || scan.type === 'guru_info' || (scan.type === 'success' && scan.role === 'guru')) {
    return guruView(scan);
  }
  if (scan.type === 'success' && scan.role === 'santri') return santriView(scan, levelConfig);
  return { kind: 'ready' };
};
