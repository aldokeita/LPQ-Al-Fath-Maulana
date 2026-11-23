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
const ContactFooter = ({ dark, iconColor, textColor }) => {
  const text = textColor || (dark ? 'rgba(255,255,255,0.72)' : '#3f5f64');
  const icon = iconColor || (dark ? '#5eead4' : '#0d9488');
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
const BuildingBackdrop = ({ overlay, position = 'center 40%', height = CARD_H }) => (
  <>
    <img src={BUILDING} alt="" aria-hidden="true" crossOrigin="anonymous"
      style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height, objectFit: 'cover', objectPosition: position }} />
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

// Nomor jilid tanpa kata "Jilid" untuk tipografi besar ("Jilid 3" → "3").
const jilidMark = (ke) => String(ke || '').replace(/^jilid\s*/i, '').trim() || String(ke || '');

// Pil "dari → ke" yang dipakai kedua varian terang.
const JilidStep = ({ dari, ke, muted, arrow, chipBg, chipText, border, bg }) => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', padding: '6px 8px 6px 14px', borderRadius: 9999,
    background: bg, border: `1px solid ${border}` }}>
    <span style={{ fontSize: 14, fontWeight: 700, color: muted, whiteSpace: 'nowrap', flexShrink: 0 }}>{nb(dari)}</span>
    <svg width="26" height="16" viewBox="0 0 34 20" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M2 10h26M21 3l8 7-8 7" fill="none" stroke={arrow} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '4px 12px', borderRadius: 9999, fontSize: 14, fontWeight: 800, color: chipText, background: chipBg }}>{nb(ke)}</span>
  </div>
);

// Titik-titik konfeti kecil; posisi tetap agar hasil ekspor selalu sama.
const Confetti = ({ dots }) => dots.map(([x, y, size, color, rotate], i) => (
  <span key={i} aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: size, height: size, background: color,
    borderRadius: rotate === 'round' ? 9999 : 2, transform: rotate === 'round' ? undefined : `rotate(${rotate}deg)` }} />
));

// ===== Varian biru: langit biru di atas, lembar putih di bawah, foto di perbatasan =====

export const JilidCardBiru = React.forwardRef(({ data, pesan, guru, avatar }, ref) => {
  const name = data.namaLengkap || data.panggilan;
  const longName = isLongName(name);
  const mark = jilidMark(data.ke);
  return (
    <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28, background: '#f8fbff', color: '#0b1f4d', fontFamily: SANS }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: 318, overflow: 'hidden' }}>
        {/* Header berproporsi sama dengan foto, sehingga seluruh gedung terlihat (bukan hanya atap). */}
        <BuildingBackdrop height={318} position="center 55%"
          overlay="linear-gradient(100deg, rgba(11,31,77,0.86) 0%, rgba(23,60,170,0.62) 42%, rgba(29,78,216,0.28) 72%, rgba(56,189,248,0.16) 100%)" />
      </div>
      <Blob style={{ width: 300, height: 300, top: -110, left: -90, background: 'rgba(125,211,252,0.35)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: 318, overflow: 'hidden' }}>
        <StarPattern id="star-jilid-biru" color="#ffffff" opacity={0.05} />
        <div style={{ position: 'absolute', right: 26, top: 74, fontFamily: SANS, fontWeight: 900, lineHeight: 1, letterSpacing: 0,
          fontSize: mark.length > 3 ? 92 : mark.length > 1 ? 150 : 190, color: 'rgba(255,255,255,0.92)', textShadow: '0 4px 0 rgba(29,78,216,0.55), 0 10px 30px rgba(11,31,77,0.55)' }}>
          {mark}
        </div>
      </div>
      <Confetti dots={[[62, 236, 8, '#fde68a', 45], [118, 268, 6, '#ffffff', 'round'], [420, 250, 9, '#7dd3fc', 20], [470, 210, 6, '#fde68a', 'round'], [196, 232, 5, '#bae6fd', 'round']]} />

      {/* Lembar putih dengan lengkung lembut di bagian atas. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 300, width: CARD_W, height: CARD_H - 300, background: '#f8fbff',
        borderTopLeftRadius: 40, borderTopRightRadius: 40, boxShadow: '0 -10px 30px rgba(11,31,77,0.18)' }} />

      <div style={{ position: 'relative', height: '100%', padding: '26px 34px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand dark />
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '6px 12px', borderRadius: 9999, fontSize: 10.5, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase',
            color: '#0b1f4d', background: '#fde68a' }}>
            Naik Jilid
          </span>
        </div>

        <div dir="rtl" lang="ar" style={{ alignSelf: 'flex-start', flexShrink: 0, fontFamily: ARABIC, fontSize: 36, lineHeight: 1.3, marginTop: 18, color: '#ffffff', textShadow: '0 4px 18px rgba(11,31,77,0.45)' }}>
          مَا شَاءَ اللهُ
        </div>
        <div style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.78)' }}>
          Selamat, kini di
        </div>
        <div style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 30, fontWeight: 900, lineHeight: '36px', color: '#fde68a', letterSpacing: -0.5 }}>{nb(data.ke)}</div>

        <div style={{ position: 'absolute', top: longName ? 238 : 228, left: '50%', transform: 'translateX(-50%)' }}>
          <Avatar src={avatar} name={name} size={longName ? 132 : 148} ringWidth={5}
            ring="linear-gradient(135deg, #fde68a, #38bdf8 55%, #6366f1)"
            glow="0 0 0 7px #f8fbff, 0 16px 36px rgba(29,78,216,0.35)" />
        </div>

        <div style={{ flexShrink: 0, marginTop: longName ? 214 : 220, fontSize: 12.5, fontWeight: 800, letterSpacing: 2.4, textTransform: 'uppercase', color: '#2563eb' }}>
          Selamat naik jilid
        </div>
        <div style={{ flexShrink: 0, fontSize: longName ? 24 : 30, fontWeight: 800, lineHeight: longName ? '30px' : '38px', marginTop: 2, letterSpacing: -0.4, textAlign: 'center', maxWidth: '100%',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#0b1f4d' }}>
          {name}
        </div>

        {data.dari && (
          <div style={{ marginTop: 8 }}>
            <JilidStep dari={data.dari} ke={data.ke} muted="#47608f" arrow="#2563eb" chipBg="#1d4ed8" chipText="#ffffff" border="#dbeafe" bg="#eff6ff" />
          </div>
        )}

        <p style={{ flexShrink: 0, marginTop: 10, marginBottom: 0, fontSize: 13, lineHeight: '20px', textAlign: 'center', color: '#334a73', padding: '0 6px',
          display: '-webkit-box', WebkitLineClamp: longName || data.dari ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {fillPesan(pesan, { nama: data.panggilan, ke: data.ke })}
        </p>

        <div style={{ flexShrink: 0, alignSelf: 'stretch', marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingTop: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: '#5b6f96' }}>{data.adaRiwayat ? 'Tanggal naik' : 'Tanggal'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: '#0b1f4d' }}>{data.tanggal}</div>
          </div>
          <Signature guru={guru} />
        </div>
        <ContactFooter iconColor="#2563eb" textColor="#47608f" />
      </div>
    </div>
  );
});
JilidCardBiru.displayName = 'JilidCardBiru';

// ===== Varian pink: nuansa merah muda & emas mawar, foto dalam bingkai mihrab =====

const ArchPhoto = ({ src, name, width, height }) => {
  const radius = width / 2;
  const shape = { borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 };
  const inner = width - 12;
  return (
    <div style={{ width, height, padding: 6, boxSizing: 'border-box', ...shape,
      background: 'linear-gradient(160deg, #f9a8d4 0%, #db2777 45%, #f5c48a 100%)', boxShadow: '0 0 0 8px rgba(255,255,255,0.65), 0 22px 44px rgba(190,24,93,0.28)' }}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(160deg, #ec4899, #a855f7)',
        borderTopLeftRadius: inner / 2, borderTopRightRadius: inner / 2, borderBottomLeftRadius: 21, borderBottomRightRadius: 21,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.9)' }}>
        {src
          ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: width * 0.3, color: '#fff', letterSpacing: 1 }}>{initialsOf(name)}</span>}
      </div>
    </div>
  );
};

export const JilidCardPink = React.forwardRef(({ data, pesan, guru, avatar }, ref) => {
  const name = data.namaLengkap || data.panggilan;
  const longName = isLongName(name);
  return (
    <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28, color: '#4a1238', fontFamily: SANS, background: '#f9a8d4' }}>
      {/* Gedung LPQ penuh di belakang, diwarnai merah muda; konten berada di panel putih di atasnya. */}
      <BuildingBackdrop position="center 50%"
        overlay="linear-gradient(160deg, rgba(219,39,119,0.55) 0%, rgba(236,72,153,0.38) 45%, rgba(147,51,234,0.50) 100%)" />
      <StarPattern id="star-jilid-pink" color="#ffffff" opacity={0.08} />
      <Confetti dots={[[18, 120, 9, '#fde68a', 45], [508, 90, 7, '#ffffff', 'round'], [24, 470, 6, '#ffffff', 'round'], [510, 520, 9, '#fde68a', 20]]} />

      <div style={{ position: 'absolute', inset: 18, borderRadius: 24, background: 'rgba(255,250,252,0.80)', border: '1px solid rgba(255,255,255,0.9)',
        boxShadow: '0 24px 50px rgba(131,24,67,0.30)' }} />
      {/* Pita sudut */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 18, right: 18, width: 120, height: 120, overflow: 'hidden', borderTopRightRadius: 24 }}>
        <div style={{ position: 'absolute', top: 26, right: -34, width: 170, transform: 'rotate(45deg)', textAlign: 'center', padding: '6px 0',
          background: 'linear-gradient(90deg, #db2777, #9333ea)', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 2.4, textTransform: 'uppercase',
          boxShadow: '0 6px 14px rgba(131,24,67,0.35)' }}>
          Naik Jilid
        </div>
      </div>

      <div style={{ position: 'relative', height: '100%', padding: '40px 42px 34px', display: 'flex', flexDirection: 'column' }}>
        <Brand />

        <div style={{ flexShrink: 0, marginTop: 26, display: 'flex', alignItems: 'center', gap: 24 }}>
          <ArchPhoto src={avatar} name={name} width={172} height={222} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC, fontSize: 30, lineHeight: 1.25, color: '#be185d', textAlign: 'left' }}>مَا شَاءَ اللهُ</div>
            <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase', color: '#db2777' }}>Selamat naik jilid</div>
            <div style={{ marginTop: 4, fontSize: longName ? 22 : 27, fontWeight: 800, lineHeight: longName ? '27px' : '32px', letterSpacing: -0.4, color: '#4a1238',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {String(name || '').replace(/-/g, '\u2011')}
            </div>
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '6px 14px', borderRadius: 14,
              background: 'linear-gradient(135deg, #db2777 0%, #9333ea 100%)', color: '#fff', boxShadow: '0 8px 18px rgba(157,23,77,0.30)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.85 }}>Kini</span>
              <span style={{ fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap' }}>{nb(data.ke)}</span>
            </div>
          </div>
        </div>

        <div aria-hidden="true" style={{ flexShrink: 0, marginTop: 26, height: 1, background: 'linear-gradient(90deg, transparent, rgba(219,39,119,0.35), transparent)' }} />

        {data.dari && (
          <div style={{ flexShrink: 0, marginTop: 14, alignSelf: 'flex-start' }}>
            <JilidStep dari={data.dari} ke={data.ke} muted="#8a4a6d" arrow="#db2777" chipBg="#fbcfe8" chipText="#831843" border="rgba(219,39,119,0.22)" bg="#fff" />
          </div>
        )}

        <p style={{ flexShrink: 0, marginTop: 14, marginBottom: 0, fontSize: 15, lineHeight: '24px', color: '#6b2a52',
          display: '-webkit-box', WebkitLineClamp: data.dari ? 3 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {fillPesan(pesan, { nama: data.panggilan, ke: data.ke })}
        </p>

        <div style={{ flexShrink: 0, alignSelf: 'stretch', marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingTop: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: '#9a5a7d' }}>{data.adaRiwayat ? 'Tanggal naik' : 'Tanggal'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: '#4a1238' }}>{data.tanggal}</div>
          </div>
          <Signature guru={guru} />
        </div>
        <ContactFooter iconColor="#db2777" textColor="#8a4a6d" />
      </div>
    </div>
  );
});
JilidCardPink.displayName = 'JilidCardPink';

export const JILID_DESIGNS = [
  { id: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg, #0f3d45, #312e81)', Card: JilidCard },
  { id: 'biru', label: 'Biru', swatch: 'linear-gradient(135deg, #0b1f4d, #1d4ed8 55%, #38bdf8)', Card: JilidCardBiru },
  { id: 'pink', label: 'Pink', swatch: 'linear-gradient(135deg, #fbcfe8, #db2777 60%, #f5c48a)', Card: JilidCardPink },
];

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

// ===== Kartu ucapan ulang tahun =====

// Balon dengan kilap dan tali; posisi tetap agar hasil ekspor selalu sama.
const Balloon = ({ x, y, size = 46, color, shine = 'rgba(255,255,255,0.55)', string = 'rgba(255,255,255,0.55)', tilt = 0 }) => (
  <svg aria-hidden="true" width={size} height={size * 2} viewBox="0 0 40 80"
    style={{ position: 'absolute', left: x, top: y, transform: `rotate(${tilt}deg)`, transformOrigin: '50% 30%', overflow: 'visible' }}>
    <path d="M20 50 C 17 58, 24 64, 19 72 C 15 78, 22 80, 20 84" fill="none" stroke={string} strokeWidth="1.2" />
    <path d="M20 2 C 33 2, 39 13, 39 24 C 39 37, 28 47, 20 50 C 12 47, 1 37, 1 24 C 1 13, 7 2, 20 2 Z" fill={color} />
    <path d="M17 50 L 23 50 L 20 54 Z" fill={color} />
    <ellipse cx="12.5" cy="15" rx="4.5" ry="7.5" fill={shine} transform="rotate(-24 12.5 15)" />
  </svg>
);

// Panji segitiga kecil berwarna-warni di bagian atas kartu.
const Bunting = ({ y = 0, colors, width = CARD_W, count = 11, opacity = 1 }) => {
  const step = width / count;
  return (
    <svg aria-hidden="true" width={width} height={46} style={{ position: 'absolute', left: 0, top: y, opacity }}>
      <path d={`M0 6 Q ${width / 2} 26 ${width} 6`} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" />
      {Array.from({ length: count }, (_, i) => {
        const x = i * step + step * 0.12;
        const t = (i + 0.5) / count;
        const sag = 6 + 20 * 4 * t * (1 - t) * 0.5;
        return <path key={i} d={`M${x} ${sag} L ${x + step * 0.76} ${sag} L ${x + step * 0.38} ${sag + 22} Z`} fill={colors[i % colors.length]} />;
      })}
    </svg>
  );
};

const nameText = (data) => String(data.namaLengkap || data.panggilan || '').replace(/-/g, '‑');
const pesanText = (pesan, data) => fillPesan(pesan, { nama: data.panggilan, usia: data.usia, shalih: data.shalih });

// --- Desain 1: Aurora (latar gedung gelap, aksen emas) ---
export const UltahCardAurora = React.forwardRef(({ data, pesan, guru, avatar }, ref) => {
  const longName = isLongName(data.namaLengkap || data.panggilan);
  return (
    <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28, background: '#1a1240', color: '#fff', fontFamily: SANS }}>
      <BuildingBackdrop position="center 45%"
        overlay="linear-gradient(180deg, rgba(20,16,64,0.74) 0%, rgba(49,22,92,0.66) 36%, rgba(30,18,70,0.90) 68%, rgba(14,10,40,0.97) 100%)" />
      <Blob style={{ width: 320, height: 320, top: 60, left: 110, background: 'rgba(244,114,182,0.30)' }} />
      <Blob style={{ width: 260, height: 260, bottom: -90, right: -70, background: 'rgba(45,212,191,0.32)' }} />
      <Blob style={{ width: 220, height: 220, top: -90, right: -40, background: 'rgba(251,191,36,0.26)' }} />
      <StarPattern id="star-ultah-aurora" color="#ffffff" opacity={0.05} />
      <Bunting y={0} colors={['#fcd34d', '#f472b6', '#5eead4', '#a78bfa']} opacity={0.9} />
      <Balloon x={22} y={118} size={50} color="#f472b6" tilt={-10} />
      <Balloon x={60} y={168} size={36} color="#fcd34d" tilt={6} />
      <Balloon x={462} y={128} size={48} color="#5eead4" tilt={10} />
      <Balloon x={430} y={186} size={34} color="#a78bfa" tilt={-6} />
      <Confetti dots={[[120, 210, 7, '#fcd34d', 45], [400, 250, 6, '#f9a8d4', 'round'], [90, 300, 5, '#5eead4', 'round'], [450, 330, 8, '#fde68a', 20]]} />

      <div style={{ position: 'relative', height: '100%', padding: '30px 34px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand dark />
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '6px 12px', borderRadius: 9999, fontSize: 10.5, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase',
            color: '#fde68a', background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.4)' }}>
            Kartu Ucapan
          </span>
        </div>

        <div dir="rtl" lang="ar" style={{ flexShrink: 0, fontFamily: ARABIC, fontSize: 32, lineHeight: 1.35, marginTop: 8, color: '#fcd34d', textShadow: '0 4px 22px rgba(251,191,36,0.45)' }}>
          {data.doa}
        </div>

        <div style={{ position: 'relative', marginTop: 6, flexShrink: 0 }}>
          <Avatar src={avatar} name={data.namaLengkap || data.panggilan} size={longName ? 150 : 172} ringWidth={6}
            ring="linear-gradient(135deg, #fde68a, #f472b6 50%, #5eead4)"
            glow="0 0 0 8px rgba(255,255,255,0.06), 0 18px 50px rgba(244,114,182,0.35)" />
          {data.usia && (
            <span style={{ position: 'absolute', left: '50%', bottom: -14, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
              padding: '7px 16px', borderRadius: 9999, fontSize: 15, fontWeight: 800, color: '#2a0f3d',
              background: 'linear-gradient(135deg, #fde68a 0%, #f9a8d4 100%)', boxShadow: '0 8px 22px rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.85)' }}>
              {nb(`★ ${data.usia} Tahun`)}
            </span>
          )}
        </div>

        <div style={{ flexShrink: 0, marginTop: 26, fontSize: 13, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>Selamat ulang tahun</div>
        <div style={{ flexShrink: 0, fontSize: longName ? 26 : 32, fontWeight: 800, lineHeight: longName ? '33px' : '42px', padding: '0 4px', marginTop: 2, letterSpacing: -0.4, textAlign: 'center', maxWidth: '100%',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {nameText(data)}
        </div>

        <p style={{ flexShrink: 0, marginTop: 12, marginBottom: 0, fontSize: 13.5, lineHeight: '21px', textAlign: 'center', color: 'rgba(255,255,255,0.9)', padding: '0 6px',
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {pesanText(pesan, data)}
        </p>

        <div style={{ flexShrink: 0, alignSelf: 'stretch', marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingTop: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Tanggal</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{data.tanggal}</div>
          </div>
          <Signature guru={guru} dark />
        </div>
        <ContactFooter dark />
      </div>
    </div>
  );
});
UltahCardAurora.displayName = 'UltahCardAurora';

// --- Desain 2: Biru (langit biru dengan gedung, angka usia besar, lembar putih) ---
export const UltahCardBiru = React.forwardRef(({ data, pesan, guru, avatar }, ref) => {
  const name = data.namaLengkap || data.panggilan;
  const longName = isLongName(name);
  return (
    <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28, background: '#f8fbff', color: '#0b1f4d', fontFamily: SANS }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: 318, overflow: 'hidden' }}>
        <BuildingBackdrop height={318} position="center 55%"
          overlay="linear-gradient(100deg, rgba(11,31,77,0.86) 0%, rgba(23,60,170,0.62) 42%, rgba(29,78,216,0.28) 72%, rgba(56,189,248,0.16) 100%)" />
        <StarPattern id="star-ultah-biru" color="#ffffff" opacity={0.05} />
        {data.usia ? (
          <div style={{ position: 'absolute', right: 30, top: 70, fontFamily: SANS, fontWeight: 900, lineHeight: 1,
            fontSize: String(data.usia).length > 1 ? 150 : 190, color: 'rgba(255,255,255,0.92)', textShadow: '0 4px 0 rgba(29,78,216,0.55), 0 10px 30px rgba(11,31,77,0.55)' }}>
            {data.usia}
          </div>
        ) : null}
      </div>
      <Bunting y={0} colors={['#fde68a', '#ffffff', '#7dd3fc', '#f9a8d4']} />
      <Balloon x={data.usia ? 330 : 420} y={80} size={40} color="#fde68a" tilt={-8} />
      <Balloon x={data.usia ? 372 : 466} y={128} size={30} color="#f9a8d4" tilt={8} />
      <Confetti dots={[[62, 236, 8, '#fde68a', 45], [118, 268, 6, '#ffffff', 'round'], [196, 232, 5, '#bae6fd', 'round'], [300, 260, 7, '#f9a8d4', 30]]} />

      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 300, width: CARD_W, height: CARD_H - 300, background: '#f8fbff',
        borderTopLeftRadius: 40, borderTopRightRadius: 40, boxShadow: '0 -10px 30px rgba(11,31,77,0.18)' }} />

      <div style={{ position: 'relative', height: '100%', padding: '30px 34px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand dark />
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '6px 12px', borderRadius: 9999, fontSize: 10.5, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase',
            color: '#0b1f4d', background: '#fde68a' }}>
            Selamat Milad
          </span>
        </div>

        <div dir="rtl" lang="ar" style={{ alignSelf: 'flex-start', flexShrink: 0, fontFamily: ARABIC, fontSize: 30, lineHeight: 1.35, marginTop: 14, color: '#ffffff', textShadow: '0 4px 18px rgba(11,31,77,0.45)' }}>
          {data.doa}
        </div>
        <div style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>
          Selamat ulang tahun
        </div>
        <div style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 30, fontWeight: 900, lineHeight: '36px', color: '#fde68a', letterSpacing: -0.5 }}>
          {data.usia ? nb(`ke-${data.usia}`) : 'Barakallah'}
        </div>

        <div style={{ position: 'absolute', top: longName ? 238 : 228, left: '50%', transform: 'translateX(-50%)' }}>
          <Avatar src={avatar} name={name} size={longName ? 132 : 148} ringWidth={5}
            ring="linear-gradient(135deg, #fde68a, #38bdf8 55%, #f9a8d4)"
            glow="0 0 0 7px #f8fbff, 0 16px 36px rgba(29,78,216,0.35)" />
        </div>

        <div style={{ flexShrink: 0, marginTop: longName ? 214 : 220, fontSize: 12.5, fontWeight: 800, letterSpacing: 2.4, textTransform: 'uppercase', color: '#2563eb' }}>
          Barakallahu fii umrik
        </div>
        <div style={{ flexShrink: 0, fontSize: longName ? 24 : 30, fontWeight: 800, lineHeight: longName ? '30px' : '38px', marginTop: 2, letterSpacing: -0.4, textAlign: 'center', maxWidth: '100%',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#0b1f4d' }}>
          {nameText(data)}
        </div>

        <p style={{ flexShrink: 0, marginTop: 10, marginBottom: 0, fontSize: 13, lineHeight: '20px', textAlign: 'center', color: '#334a73', padding: '0 6px',
          display: '-webkit-box', WebkitLineClamp: longName ? 3 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {pesanText(pesan, data)}
        </p>

        <div style={{ flexShrink: 0, alignSelf: 'stretch', marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingTop: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: '#5b6f96' }}>Tanggal</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: '#0b1f4d' }}>{data.tanggal}</div>
          </div>
          <Signature guru={guru} />
        </div>
        <ContactFooter iconColor="#2563eb" textColor="#47608f" />
      </div>
    </div>
  );
});
UltahCardBiru.displayName = 'UltahCardBiru';

// --- Desain 3: Pink (gedung bernuansa merah muda, panel bingkai, foto mihrab, pita sudut) ---
export const UltahCardPink = React.forwardRef(({ data, pesan, guru, avatar }, ref) => {
  const name = data.namaLengkap || data.panggilan;
  const longName = isLongName(name);
  return (
    <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28, color: '#4a1238', fontFamily: SANS, background: '#f9a8d4' }}>
      <BuildingBackdrop position="center 50%"
        overlay="linear-gradient(160deg, rgba(219,39,119,0.55) 0%, rgba(236,72,153,0.38) 45%, rgba(147,51,234,0.50) 100%)" />
      <StarPattern id="star-ultah-pink" color="#ffffff" opacity={0.08} />

      <div style={{ position: 'absolute', inset: 18, borderRadius: 24, background: 'rgba(255,250,252,0.82)', border: '1px solid rgba(255,255,255,0.9)',
        boxShadow: '0 24px 50px rgba(131,24,67,0.30)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: 18, right: 18, width: 128, height: 128, overflow: 'hidden', borderTopRightRadius: 24 }}>
        <div style={{ position: 'absolute', top: 28, right: -36, width: 180, transform: 'rotate(45deg)', textAlign: 'center', padding: '6px 0',
          background: 'linear-gradient(90deg, #db2777, #9333ea)', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase',
          boxShadow: '0 6px 14px rgba(131,24,67,0.35)' }}>
          Selamat Milad
        </div>
      </div>
      <Balloon x={26} y={210} size={34} color="#f472b6" string="rgba(157,23,77,0.35)" tilt={-8} />
      <Balloon x={470} y={300} size={30} color="#c084fc" string="rgba(157,23,77,0.35)" tilt={8} />
      <Confetti dots={[[60, 520, 7, '#f5c48a', 45], [480, 470, 6, '#ec4899', 'round'], [250, 360, 5, '#c084fc', 'round']]} />

      <div style={{ position: 'relative', height: '100%', padding: '40px 42px 34px', display: 'flex', flexDirection: 'column' }}>
        <Brand />

        <div style={{ flexShrink: 0, marginTop: 26, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ArchPhoto src={avatar} name={name} width={172} height={222} />
            {data.usia && (
              <span style={{ position: 'absolute', right: -14, top: -10, width: 62, height: 62, borderRadius: 9999, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg, #f59e0b, #db2777)',
                border: '3px solid #ffffff', boxShadow: '0 10px 20px rgba(157,23,77,0.35)', lineHeight: 1 }}>
                <span style={{ fontSize: 24, fontWeight: 900 }}>{data.usia}</span>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 }}>tahun</span>
              </span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC, fontSize: 26, lineHeight: 1.35, color: '#be185d', textAlign: 'left' }}>{data.doa}</div>
            <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase', color: '#db2777' }}>Selamat ulang tahun</div>
            <div style={{ marginTop: 4, fontSize: longName ? 22 : 27, fontWeight: 800, lineHeight: longName ? '27px' : '32px', letterSpacing: -0.4, color: '#4a1238',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {nameText(data)}
            </div>
            {data.usia && (
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '6px 14px', borderRadius: 14,
                background: 'linear-gradient(135deg, #db2777 0%, #9333ea 100%)', color: '#fff', boxShadow: '0 8px 18px rgba(157,23,77,0.30)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.85 }}>Usia</span>
                <span style={{ fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap' }}>{nb(`${data.usia} tahun`)}</span>
              </div>
            )}
          </div>
        </div>

        <div aria-hidden="true" style={{ flexShrink: 0, marginTop: 26, height: 1, background: 'linear-gradient(90deg, transparent, rgba(219,39,119,0.35), transparent)' }} />

        <p style={{ flexShrink: 0, marginTop: 16, marginBottom: 0, fontSize: 15, lineHeight: '24px', color: '#6b2a52',
          display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {pesanText(pesan, data)}
        </p>

        <div style={{ flexShrink: 0, alignSelf: 'stretch', marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingTop: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: '#9a5a7d' }}>Tanggal</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: '#4a1238' }}>{data.tanggal}</div>
          </div>
          <Signature guru={guru} />
        </div>
        <ContactFooter iconColor="#db2777" textColor="#8a4a6d" />
      </div>
    </div>
  );
});
UltahCardPink.displayName = 'UltahCardPink';

export const ULTAH_DESIGNS = [
  { id: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg, #1a1240, #6d28d9 55%, #f472b6)', Card: UltahCardAurora },
  { id: 'biru', label: 'Biru', swatch: 'linear-gradient(135deg, #0b1f4d, #1d4ed8 55%, #38bdf8)', Card: UltahCardBiru },
  { id: 'pink', label: 'Pink', swatch: 'linear-gradient(135deg, #fbcfe8, #db2777 60%, #f5c48a)', Card: UltahCardPink },
];
