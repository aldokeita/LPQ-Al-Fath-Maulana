import React, { useId } from 'react';

const LOGO = '/logo-lpq-al-fath-maulana.webp';

// Bintang delapan sudut (dua persegi bertumpuk) seperti pin akrilik LPQ.
const starPoints = (cx, cy, outer) => {
  const inner = outer * Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);
  return Array.from({ length: 16 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 8) * index - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
};

const SIZES = {
  sm: { height: 38, star: 46, font: 11.5, gap: 2 },
  md: { height: 48, star: 58, font: 14.5, gap: 3 },
};

/**
 * Badge prestasi santri berbentuk plakat akrilik putih: bintang berlogo di kiri,
 * dua baris judul bergradasi di kanan. Warna dari definisi badge (from → to).
 */
const SantriAchievementBadge = ({ badge, size = 'sm', className }) => {
  const gradientId = useId();
  if (!badge) return null;
  const dims = SIZES[size] || SIZES.sm;
  const gradient = `linear-gradient(120deg, ${badge.from}, ${badge.to})`;

  return (
    <span
      role="listitem"
      aria-label={`Badge ${badge.title}`}
      title={badge.title}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', height: dims.star, paddingLeft: dims.star * 0.55, flexShrink: 0 }}
    >
      <svg
        width={dims.star}
        height={dims.star}
        viewBox="0 0 100 100"
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.18))' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={badge.from} />
            <stop offset="100%" stopColor={badge.to} />
          </linearGradient>
        </defs>
        <polygon points={starPoints(50, 50, 48)} fill="#fbfdff" stroke="rgba(148, 163, 184, 0.55)" strokeWidth="1.2" />
        <polygon points={starPoints(50, 50, 42)} fill="none" stroke={`url(#${gradientId})`} strokeWidth="4.5" strokeLinejoin="round" />
        <polygon points={starPoints(50, 50, 35)} fill="#ffffff" stroke={`url(#${gradientId})`} strokeWidth="1.6" strokeLinejoin="round" />
        <image href={LOGO} x="27" y="27" width="46" height="46" preserveAspectRatio="xMidYMid meet" />
      </svg>
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: dims.height,
          paddingLeft: dims.star * 0.55,
          paddingRight: dims.height * 0.32,
          borderRadius: dims.height * 0.24,
          background: 'linear-gradient(180deg, #ffffff 0%, #f3f7fb 100%)',
          border: '1px solid rgba(203, 213, 225, 0.9)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 0 rgba(148,163,184,0.18), 0 3px 10px rgba(15,23,42,0.12)',
          fontFamily: "'Outfit', 'Poppins', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: dims.font,
          lineHeight: 1,
          letterSpacing: 0.4,
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
