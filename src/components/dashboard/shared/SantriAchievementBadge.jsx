import React from 'react';

// Logo LPQ sudah berbentuk bintang delapan sudut, jadi dipakai utuh sebagai "bintang" badge.
const LOGO = '/logo-lpq-al-fath-maulana.webp';
const DISPLAY = "'Fredoka', 'Outfit', 'Poppins', system-ui, sans-serif";

const SIZES = {
  sm: { height: 46, star: 60, kicker: 9.5, title: 17, pad: 15 },
  md: { height: 58, star: 76, kicker: 11.5, title: 22, pad: 19 },
};

// "#22c3d6" + alpha → "#22c3d6xx"; definisi badge selalu memakai hex 6 digit.
const withAlpha = (hex, alpha) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

/**
 * Badge prestasi santri: logo bintang LPQ utuh menempel di kiri, plakat kapsul berbingkai gradasi di kanan.
 * Baris pertama judul kecil berjarak lebar, baris kedua besar bergradasi dengan bayangan timbul.
 */
const SantriAchievementBadge = ({ badge, size = 'sm', className }) => {
  if (!badge) return null;
  const dims = SIZES[size] || SIZES.sm;
  const [kicker, ...rest] = badge.lines;
  const title = rest.join(' ') || kicker;

  return (
    <span
      role="listitem"
      aria-label={`Badge ${badge.title}`}
      title={badge.title}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', height: dims.star, paddingLeft: dims.star * 0.58, flexShrink: 0 }}
    >
      <img
        src={LOGO}
        alt=""
        aria-hidden="true"
        width={dims.star}
        height={dims.star}
        decoding="async"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 2,
          width: dims.star,
          height: dims.star,
          objectFit: 'contain',
          filter: `drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 6px 10px ${withAlpha(badge.to, 0.35)})`,
        }}
      />
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: dims.height,
          paddingLeft: dims.star * 0.5,
          paddingRight: dims.pad + 6,
          // Sisi kiri lurus dan bersembunyi di balik logo; sisi kanan tetap melengkung.
          borderRadius: '0 9999px 9999px 0',
          border: '2px solid transparent',
          // Lapisan putih buram di bawah rona tipis, agar warna bingkai tidak tembus ke isi plakat.
          background: `linear-gradient(180deg, #ffffff 30%, ${withAlpha(badge.from, 0.1)} 100%) padding-box, linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(120deg, ${badge.from}, ${badge.to}) border-box`,
          boxShadow: `0 8px 20px ${withAlpha(badge.to, 0.22)}, inset 0 1px 0 #ffffff`,
          fontFamily: DISPLAY,
          textTransform: 'uppercase',
        }}
      >
        <span style={{ fontSize: dims.kicker, fontWeight: 600, letterSpacing: dims.kicker * 0.28, lineHeight: 1, color: badge.from, whiteSpace: 'nowrap' }}>
          {kicker}
        </span>
        <span
          style={{
            marginTop: 2,
            fontSize: dims.title,
            fontWeight: 700,
            letterSpacing: 0.2,
            lineHeight: 0.95,
            whiteSpace: 'nowrap',
            backgroundImage: `linear-gradient(120deg, ${badge.from}, ${badge.to})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: `drop-shadow(0 1.5px 0 ${withAlpha(badge.to, 0.28)})`,
          }}
        >
          {title}
        </span>
        <svg
          aria-hidden="true"
          width={dims.kicker + 3}
          height={dims.kicker + 3}
          viewBox="0 0 24 24"
          style={{ position: 'absolute', top: dims.height * 0.14, right: dims.pad * 0.55 }}
        >
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill={badge.to} opacity="0.85" />
        </svg>
      </span>
    </span>
  );
};

export default SantriAchievementBadge;
