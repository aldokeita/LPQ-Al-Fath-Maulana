import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fillPesan, limitList } from '@/lib/santriCards';
import { OFFICIAL_CONTACT } from '@/lib/institutionContent';

// Kartu santri berukuran tetap 540×675 (diekspor 2× menjadi 1080×1350, rasio 4:5 untuk WhatsApp).
// Warna ditulis langsung (bukan token tema) agar hasil ekspor sama di mode terang maupun gelap.
export const CARD_W = 540;
export const CARD_H = 675;

const LOGO = '/logo-lpq-al-fath-maulana.webp';
const ARABIC = "'Amiri', 'Noto Naskh Arabic', 'Scheherazade New', serif";
const SANS = "'Outfit', 'Poppins', system-ui, sans-serif";

// Pola bintang delapan khas geometri Islam, sangat tipis sebagai tekstur.
const StarPattern = ({ id, color, opacity }) => (
  <svg width={CARD_W} height={CARD_H} style={{ position: 'absolute', inset: 0, opacity }} aria-hidden="true">
    <defs>
      <pattern id={id} width="54" height="54" patternUnits="userSpaceOnUse">
        <path d="M27 6l6 15 15 6-15 6-6 15-6-15-15-6 15-6z" fill="none" stroke={color} strokeWidth="1" />
        <rect x="18" y="18" width="18" height="18" fill="none" stroke={color} strokeWidth="0.8" transform="rotate(45 27 27)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

// Cahaya aurora sebagai gradien radial (tanpa filter blur, agar sama di semua browser saat diekspor).
const Blob = ({ style }) => {
  const { background, ...rest } = style;
  return <div aria-hidden="true" style={{ position: 'absolute', borderRadius: '9999px', ...rest, background: `radial-gradient(circle, ${background} 0%, transparent 70%)` }} />;
};

const Brand = ({ dark }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 46, height: 46, borderRadius: 9999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: dark ? '0 0 0 3px rgba(251,191,36,0.35)' : '0 0 0 3px rgba(13,148,136,0.18)' }}>
      <img src={LOGO} alt="" width={38} height={38} style={{ width: 38, height: 38, objectFit: 'contain' }} crossOrigin="anonymous" />
    </div>
    <div style={{ lineHeight: 1.15 }}>
      <div style={{ whiteSpace: 'nowrap', fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 15, letterSpacing: 0.6, color: dark ? '#fff' : '#0f2f36' }}>LPQ Al-Fath Maulana</div>
      <div style={{ whiteSpace: 'nowrap', fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase', color: dark ? '#fcd34d' : '#b7791f' }}>Metode Qiroati</div>
    </div>
  </div>
);

const ICONS = {
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9m0-18C9.5 5.6 8.3 8.6 8.3 12s1.2 6.4 3.7 9M3.5 9h17M3.5 15h17',
  ig: 'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm4.5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5-1.2h.01',
};

const ContactIcon = ({ name, color }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d={ICONS[name]} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const websiteLabel = (url) => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

// Footer kontak resmi lembaga: alamat, website, dan Instagram (bila tersedia).
const ContactFooter = ({ dark }) => {
  const text = dark ? 'rgba(255,255,255,0.72)' : '#3f5f64';
  const icon = dark ? '#5eead4' : '#0d9488';
  const items = [
    OFFICIAL_CONTACT.website && { k: 'web', icon: 'globe', label: websiteLabel(OFFICIAL_CONTACT.website) },
    OFFICIAL_CONTACT.instagram && { k: 'ig', icon: 'ig', label: `@${String(OFFICIAL_CONTACT.instagram).replace(/^@/, '')}` },
  ].filter(Boolean);
  return (
    <div style={{ flexShrink: 0, alignSelf: 'stretch', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,47,54,0.12)'}`,
      fontFamily: SANS, fontSize: 10, lineHeight: 1.35, color: text, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, maxWidth: '100%', textAlign: 'center' }}>
        <ContactIcon name="pin" color={icon} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{OFFICIAL_CONTACT.address}</span>
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontWeight: 700, fontSize: 10.5 }}>
          {items.map((it) => (
            <span key={it.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              <ContactIcon name={it.icon} color={icon} />{it.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const Signature = ({ guru, dark, label = 'Guru Pengajar' }) => (
  <div style={{ textAlign: 'right', minWidth: 170 }}>
    <div style={{ height: 1, background: dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,47,54,0.25)', marginBottom: 8 }} />
    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: dark ? '#fff' : '#0f2f36' }}>{guru || 'Guru LPQ Al-Fath Maulana'}</div>
    <div style={{ fontFamily: SANS, fontSize: 11, color: dark ? 'rgba(255,255,255,0.65)' : '#5b7479' }}>{label}</div>
  </div>
);

// Blur sudah dibakar ke file: filter CSS tidak andal saat diekspor di Safari/iPad (WebKit).
const BUILDING = '/institution/gedung-lpq-blur.webp';

// Foto gedung LPQ sebagai latar: diburamkan tipis lalu ditutup lapisan warna agar teks tetap kontras.
const BuildingBackdrop = ({ overlay, position = 'center 40%' }) => (
  <>
    <img src={BUILDING} alt="" aria-hidden="true" crossOrigin="anonymous"
      style={{ position: 'absolute', inset: 0, width: CARD_W, height: CARD_H, objectFit: 'cover', objectPosition: position }} />
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: overlay }} />
  </>
);

// Spasi tak terputus: label pendek seperti "Jilid 1B" tidak boleh terbelah saat diekspor di HP.
const nb = (text) => String(text || '').replace(/ /g, '\u00a0');

export const initialsOf = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

// Avatar bulat dengan cincin gradasi; tanpa foto memakai inisial.
const Avatar = ({ src, name, size, ring = 'linear-gradient(135deg, #fde68a, #5eead4 50%, #a78bfa)', ringWidth = 5, glow }) => (
  <div style={{ width: size, height: size, borderRadius: 9999, padding: ringWidth, background: ring, boxShadow: glow, boxSizing: 'border-box', flexShrink: 0 }}>
    <div style={{ width: '100%', height: '100%', borderRadius: 9999, overflow: 'hidden', background: 'linear-gradient(135deg, #0d9488, #6366f1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.9)' }}>
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: size * 0.34, color: '#fff', letterSpacing: 1 }}>{initialsOf(name)}</span>}
    </div>
  </div>
);

// ===== Kartu apresiasi kenaikan jilid =====

// Nama panjang (dua baris) memakai huruf lebih kecil dan foto sedikit lebih kecil agar kartu tetap muat.
const isLongName = (name) => String(name || '').length > 20;

export const JilidCard = React.forwardRef(({ data, pesan, guru, avatar }, ref) => {
  const longName = isLongName(data.namaLengkap || data.panggilan);
  return (
  <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28, background: '#052e36', color: '#fff', fontFamily: SANS }}>
    <BuildingBackdrop position="center 45%"
      overlay="linear-gradient(180deg, rgba(4,32,42,0.70) 0%, rgba(7,48,66,0.58) 34%, rgba(14,30,72,0.88) 66%, rgba(22,16,58,0.96) 100%)" />
    <Blob style={{ width: 320, height: 320, top: 70, left: 110, background: 'rgba(45,212,191,0.32)' }} />
    <Blob style={{ width: 260, height: 260, bottom: -90, right: -70, background: 'rgba(139,92,246,0.45)' }} />
    <Blob style={{ width: 200, height: 200, top: -80, right: -40, background: 'rgba(251,191,36,0.22)' }} />
    <StarPattern id="star-jilid" color="#ffffff" opacity={0.05} />

    <div style={{ position: 'relative', height: '100%', padding: '26px 34px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Brand dark />
        <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '6px 12px', borderRadius: 9999, fontSize: 10.5, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase',
          color: '#fde68a', background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.4)', backdropFilter: 'blur(6px)' }}>
          Kartu Apresiasi
        </span>
      </div>

      <div dir="rtl" lang="ar" style={{ flexShrink: 0, fontFamily: ARABIC, fontSize: 38, lineHeight: 1.3, marginTop: 8, color: '#fcd34d', textShadow: '0 4px 22px rgba(251,191,36,0.45)' }}>
        مَا شَاءَ اللهُ
      </div>

      <div style={{ position: 'relative', marginTop: 6, flexShrink: 0 }}>
        <Avatar src={avatar} name={data.namaLengkap || data.panggilan} size={longName ? 156 : 184} ringWidth={6}
          glow="0 0 0 8px rgba(255,255,255,0.06), 0 18px 50px rgba(45,212,191,0.35)" />
        <span style={{ position: 'absolute', left: '50%', bottom: -14, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
          padding: '7px 16px', borderRadius: 9999, fontSize: 15, fontWeight: 800, color: '#06282f',
          background: 'linear-gradient(135deg, #fde68a 0%, #5eead4 100%)', boxShadow: '0 8px 22px rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.85)' }}>
          {nb(`★ ${data.ke}`)}
        </span>
      </div>

      <div style={{ flexShrink: 0, marginTop: 26, fontSize: 13, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Selamat naik jilid</div>
      <div style={{ flexShrink: 0, fontSize: longName ? 26 : 32, fontWeight: 800, lineHeight: longName ? '33px' : '42px', padding: '0 4px', marginTop: 2, letterSpacing: -0.4, textAlign: 'center', maxWidth: '100%',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {data.namaLengkap || data.panggilan}
      </div>

      {data.dari && (
        <div style={{ flexShrink: 0, marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', padding: '6px 8px 6px 14px', borderRadius: 9999,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}>
          <span style={{ display: 'inline-block', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', flexShrink: 0 }}>{nb(data.dari)}</span>
          <svg width="26" height="16" viewBox="0 0 34 20" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M2 10h26M21 3l8 7-8 7" fill="none" stroke="#fcd34d" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '4px 12px', borderRadius: 9999, fontSize: 14, fontWeight: 800, color: '#06282f', background: '#fde68a' }}>{nb(data.ke)}</span>
        </div>
      )}

      <p style={{ flexShrink: 0, marginTop: 14, marginBottom: 0, fontSize: 13.5, lineHeight: '21px', textAlign: 'center', color: 'rgba(255,255,255,0.9)', padding: '0 6px',
        display: '-webkit-box', WebkitLineClamp: data.dari ? 3 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {fillPesan(pesan, { nama: data.panggilan, ke: data.ke })}
      </p>

      <div style={{ flexShrink: 0, alignSelf: 'stretch', marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16,
        paddingTop: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>{data.adaRiwayat ? 'Tanggal naik' : 'Tanggal'}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{data.tanggal}</div>
        </div>
        <Signature guru={guru} dark />
      </div>
      <ContactFooter dark />
    </div>
  </div>
);
});
JilidCard.displayName = 'JilidCard';

// ===== Kartu profil kehadiran & hafalan =====

// Ikon per sesi: centang hijau = hadir tepat waktu (termasuk koreksi "sebenarnya hadir"),
// jam kuning = terlambat, silang merah = tidak hadir. Bentuk berbeda agar tidak bergantung pada warna saja.
const SESI_ICON = {
  hadir: { bg: '#10b981', d: 'M6.5 12.5l3.5 3.5 7.5-8' },
  koreksi: { bg: '#10b981', d: 'M6.5 12.5l3.5 3.5 7.5-8' },
  terlambat: { bg: '#f59e0b', d: 'M12 7v5.2l3.2 2' },
  absen: { bg: '#ef4444', d: 'M8 8l8 8M16 8l-8 8' },
};

const SesiIcon = ({ status, size = 20 }) => {
  const icon = SESI_ICON[status] || SESI_ICON.hadir;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="12" cy="12" r="12" fill={icon.bg} />
      {status === 'terlambat' && <circle cx="12" cy="12" r="6.6" fill="none" stroke="#fff" strokeWidth="2.2" />}
      <path d={icon.d} fill="none" stroke="#fff" strokeWidth={status === 'terlambat' ? 2.2 : 2.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const Ring = ({ pct }) => {
  const r = 28;
  const c = 2 * Math.PI * r;
  const value = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const color = pct === null ? '#cbd5e1' : pct >= 75 ? '#0d9488' : '#f43f5e';
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2eef0" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 36 36)" />
      <text x="36" y="41.5" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="16" fill="#0f2f36">
        {pct === null ? '–' : `${pct}%`}
      </text>
    </svg>
  );
};

const Panel = ({ title, children, style }) => (
  <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(219,234,236,0.9)', borderRadius: 18, padding: '11px 14px',
    boxShadow: '0 8px 24px rgba(15,47,54,0.06)', ...style }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: '#0f766e', marginBottom: 6 }}>{title}</div>
    {children}
  </div>
);

const CHIP_H = 26;
const CHIP = { display: 'inline-flex', alignItems: 'center', height: CHIP_H, boxSizing: 'border-box', padding: '0 10px', borderRadius: 9999,
  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 };
const CHIP_TONE = {
  hafal: { color: '#065f46', background: '#d1fae5' },
  latih: { color: '#92400e', background: '#fef3c7' },
  belum: { color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 500 },
  more: { color: '#64748b', background: 'transparent', fontWeight: 500 },
};

const ScoreDots = ({ skor }) => (
  <span style={{ display: 'inline-flex', gap: 3, marginLeft: 8, verticalAlign: 'middle' }}>
    {[1, 2, 3, 4].map((i) => (
      <span key={i} style={{ width: 7, height: 7, borderRadius: 9999, background: i <= skor ? '#f59e0b' : '#e2e8f0' }} />
    ))}
  </span>
);

const MSG_LINE = 19.5;
const MSG_PAD = 10;
const MSG_MAX_LINES = 7;
const CHIP_GAP = 6;
const CHIP_MAX_ROWS = 5;

export const ProfilCard = React.forwardRef(({ data, pesan, guru, avatar }, ref) => {
  const { kehadiran: k, hafalan: h } = data;
  // Tiga pertama berselang-seling sudah hafal (didahulukan) dan sedang dilatih agar keduanya selalu tampil,
  // sisanya menyusul, dan yang belum dinilai paling akhir.
  const hafalChips = h.sudahHafal.map((m) => ({ key: `h-${m}`, tone: 'hafal', label: m }));
  const latihChips = h.dilatih.map((d) => ({ key: `l-${d.materi}`, tone: 'latih', label: d.materi, skor: d.skor }));
  const all = [
    ...[0, 1, 2].flatMap((i) => [hafalChips[i], latihChips[i]]).filter(Boolean), ...hafalChips.slice(3), ...latihChips.slice(3),
    ...(h.belumDinilaiList || []).map((m) => ({ key: `b-${m}`, tone: 'belum', label: m })),
  ];
  // Ruang kosong kartu dibagi bertahap: pesan guru didahulukan (tambah baris selama masih terpotong),
  // lalu sisa ruang untuk baris chip hafalan yang masih tersembunyi. Selalu per baris utuh, jadi tidak ada teks terpotong.
  const layoutKey = JSON.stringify([data, pesan, Boolean(avatar)]);
  const [fitState, setFitState] = useState({ key: layoutKey, rows: 2, lines: 3 });
  const { rows: chipRows, lines: msgLines } = fitState.key === layoutKey ? fitState : { rows: 2, lines: 3 };
  const columnRef = useRef(null);
  const spacerRef = useRef(null);
  // Ukur ulang setelah font selesai dimuat; ukuran teks berubah saat font cadangan diganti.
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    let active = true;
    document.fonts?.ready?.then(() => { if (active) setFontTick((t) => t + 1); });
    return () => { active = false; };
  }, []);
  const chipBoxRef = useRef(null);
  const msgRef = useRef(null);
  useLayoutEffect(() => {
    // Sisa ruang dibagi dua celah yang sama besar (di atas dan di bawah panel hafalan).
    const free = (spacerRef.current?.clientHeight ?? 0) * 2;
    const chipBox = chipBoxRef.current;
    const msg = msgRef.current;
    const column = columnRef.current;
    let next = null;
    if (column && column.scrollHeight > column.clientHeight + 1) {
      // Isi melebihi kartu: kurangi baris chip dulu, lalu baris pesan, sampai batas minimum.
      if (chipRows > 2) next = { rows: chipRows - 1, lines: msgLines };
      else if (msgLines > 3) next = { rows: chipRows, lines: msgLines - 1 };
    } else if (msg && msg.scrollHeight > msg.clientHeight + 1 && msgLines < MSG_MAX_LINES) {
      // Pesan guru didahulukan: pakai ruang kosong, atau kurangi satu baris chip bila ruang belum cukup.
      if (free >= MSG_LINE) next = { rows: chipRows, lines: msgLines + 1 };
      else if (chipRows > 1) next = { rows: chipRows - 1, lines: msgLines };
    } else if (chipBox && chipBox.scrollHeight > chipBox.clientHeight + 1 && free >= CHIP_H + CHIP_GAP && chipRows < CHIP_MAX_ROWS) {
      next = { rows: chipRows + 1, lines: msgLines };
    }
    if (next) setFitState({ key: layoutKey, ...next });
    else if (fitState.key !== layoutKey) setFitState({ key: layoutKey, rows: chipRows, lines: msgLines });
  }, [layoutKey, chipRows, msgLines, fitState.key, fontTick]);
  const { shown, more } = limitList(all, 14);
  const chips = more > 0 ? [...shown, { key: 'more', tone: 'more', label: `+${more} lainnya` }] : shown;
  const longName = isLongName(data.namaLengkap || data.panggilan);
  return (
    <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28,
      background: '#f4fbfb', color: '#0f2f36', fontFamily: SANS }}>
      <BuildingBackdrop position="center 40%"
        overlay="linear-gradient(170deg, rgba(244,251,251,0.62) 0%, rgba(238,246,251,0.86) 32%, rgba(243,240,255,0.95) 100%)" />
      <Blob style={{ width: 300, height: 300, top: -140, right: -80, background: 'rgba(45,212,191,0.35)' }} />
      <Blob style={{ width: 260, height: 260, bottom: -120, left: -90, background: 'rgba(167,139,250,0.35)' }} />
      <StarPattern id="star-profil" color="#0f766e" opacity={0.05} />

      <div ref={columnRef} style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: '22px 30px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand />
          <div style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: '#5b7479', lineHeight: 1.4 }}>
            Profil Perkembangan<br /><span style={{ color: '#0f766e' }}>{data.bulan}</span>
          </div>
        </div>

        <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar src={avatar} name={data.namaLengkap || data.panggilan} size={88} ringWidth={4}
            glow="0 12px 30px rgba(13,148,136,0.25)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#0f766e' }}>Santri</div>
            <div style={{ fontSize: longName ? 21 : 25, fontWeight: 800, lineHeight: longName ? '27px' : '32px', letterSpacing: -0.3, marginTop: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {data.namaLengkap || data.panggilan}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {data.jilid && <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '5px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}>{nb(data.jilid)}</span>}
              <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '5px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 700, color: '#92400e', background: '#fef3c7' }}>★ {data.poin.toLocaleString('id-ID', { maximumFractionDigits: 1 })} poin</span>
            </div>
          </div>
        </div>

        <Panel title={k.judul}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Ring pct={k.persen} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{k.total ? `Hadir ${k.hadir} dari ${k.total} sesi` : 'Belum ada sesi tercatat'}</span>
                {k.sesi.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 9.5, color: '#5b7479' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><SesiIcon status="hadir" size={10} /> hadir</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><SesiIcon status="terlambat" size={10} /> terlambat</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><SesiIcon status="absen" size={10} /> absen</span>
                  </span>
                )}
              </div>
              {k.sesi.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 5px', marginTop: 8 }}>
                    {k.sesi.map((x, i) => (
                      <div key={i} style={{ width: 21, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <SesiIcon status={x.s} size={21} />
                        {x.tgl && <span style={{ fontSize: 8.5, lineHeight: '11px', color: '#5b7479', fontWeight: 600 }}>{x.tgl}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </Panel>

        <div aria-hidden="true" style={{ flex: '1 1 0', minHeight: 0 }} />
        <Panel title="Hafalan" style={{ flexShrink: 0 }}>
          {h.wajibTotal > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <span>Hafalan wajib {data.jilid}</span>
                <span>{h.wajibAman}/{h.wajibTotal} sudah hafal</span>
              </div>
              <div style={{ height: 9, borderRadius: 9999, background: '#e2eef0', marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${h.persen || 0}%`, height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg, #14b8a6, #8b5cf6)' }} />
              </div>
            </div>
          )}
          {chips.length === 0 ? (
            <div style={{ fontSize: 13, color: '#5b7479' }}>Belum ada hafalan yang tercatat.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: '#5b7479', marginBottom: 7, whiteSpace: 'nowrap' }}>
                <span><span style={{ color: '#10b981' }}>●</span> Sudah hafal</span>
                <span><span style={{ color: '#f59e0b' }}>●</span> Sedang dilatih</span>
                {h.belumDinilai > 0 && <span><span style={{ color: '#94a3b8' }}>●</span> Belum dinilai ({h.belumDinilai})</span>}
              </div>
              {/* Tinggi dibatasi sejumlah baris chip utuh agar tidak pernah terpotong di tengah baris. */}
              <div ref={chipBoxRef} style={{ display: 'flex', flexWrap: 'wrap', gap: CHIP_GAP, maxHeight: CHIP_H * chipRows + CHIP_GAP * (chipRows - 1), overflow: 'hidden' }}>
                {chips.map((c) => (
                  <span key={c.key} style={{ ...CHIP, ...CHIP_TONE[c.tone] }}>
                    {c.tone === 'hafal' ? `✓ ${c.label}` : c.label}{c.tone === 'latih' && <ScoreDots skor={c.skor} />}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <div ref={spacerRef} aria-hidden="true" style={{ flex: '1 1 0', minHeight: 0 }} />
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <p style={{ flex: 1, margin: 0, fontSize: 13, lineHeight: `${MSG_LINE}px`, color: '#134e4a', background: 'rgba(20,184,166,0.1)', borderRadius: 14,
            padding: `${MSG_PAD}px 12px`, overflow: 'hidden' }}>
            <span ref={msgRef} style={{ display: 'block', maxHeight: MSG_LINE * msgLines, overflow: 'hidden' }}>{fillPesan(pesan, { nama: data.panggilan })}</span>
          </p>
          <Signature guru={guru} label={data.tanggal} />
        </div>
        <ContactFooter />
      </div>
    </div>
  );
});
ProfilCard.displayName = 'ProfilCard';
