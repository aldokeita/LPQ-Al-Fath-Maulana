import React from 'react';

// Logo LPQ sudah berbentuk bintang delapan sudut, jadi dipakai utuh sebagai "bintang" badge.
const LOGO = '/logo-lpq-al-fath-maulana.webp';

const SIZES = {
  sm: { height: 40, star: 54, font: 13, gap: 2 },
  md: { height: 50, star: 68, font: 16.5, gap: 3 },
};

/**
 * Badge prestasi santri berbentuk stiker akrilik: logo bintang LPQ penuh di kiri,
 * plakat putih dengan dua baris judul bergradasi di kanan. Warna judul dari badge (from → to).
 */
const SantriAchievementBadge = ({ badge, size = 'sm', className }) => {
  if (!badge) return null;
  const dims = SIZES[size] || SIZES.sm;
  const gradient = `linear-gradient(120deg, ${badge.from}, ${badge.to})`;

  return (
    <span
      role="listitem"
      aria-label={`Badge ${badge.title}`}
      title={badge.title}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', height: dims.star, paddingLeft: dims.star * 0.62, flexShrink: 0 }}
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
          zIndex: 1,
          width: dims.star,
          height: dims.star,
          objectFit: 'contain',
          // Tepi putih seperti potongan stiker, lalu bayangan lembut.
          filter: 'drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 3px 5px rgba(15, 23, 42, 0.22))',
        }}
      />
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: dims.height,
          paddingLeft: dims.star * 0.48,
          paddingRight: dims.height * 0.34,
          borderRadius: dims.height * 0.22,
          background: 'linear-gradient(180deg, #ffffff 0%, #f3f7fb 100%)',
          border: '1px solid rgba(203, 213, 225, 0.9)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 0 rgba(148,163,184,0.18), 0 3px 10px rgba(15,23,42,0.12)',
          fontFamily: "'Outfit', 'Poppins', system-ui, sans-serif",
          fontWeight: 900,
          fontSize: dims.font,
          lineHeight: 0.98,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          gap: dims.gap,
        }}
      >
        {badge.lines.map((line) => (
          <span
            key={line}
            style={{ whiteSpace: 'nowrap', backgroundImage: gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
          >
            {line}
          </span>
        ))}
      </span>
    </span>
  );
};

export default SantriAchievementBadge;
