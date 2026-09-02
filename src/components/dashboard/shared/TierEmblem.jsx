import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { resolveSantriTier } from '@/lib/santriTier';

const TIER_SYMBOL_DIMENSION = 144;

const TierEmblem = ({ levelInfo, points, hasTierData = true }) => {
  const tier = hasTierData
    ? resolveSantriTier({ levelInfo, points })
    : {
        label: null,
        assetKey: null,
        assetSrc: null,
        alt: 'Simbol tier belum tersedia',
      };
  const [failedSource, setFailedSource] = useState(null);
  const isImageAvailable = Boolean(tier.assetSrc) && failedSource !== tier.assetSrc;
  const accentColor = levelInfo?.accentColor || levelInfo?.color || '#94a3b8';

  useEffect(() => {
    setFailedSource(null);
  }, [tier.assetSrc]);

  return (
    <div
      className={`attendance-profile-card__tier-crest ${isImageAvailable ? '' : 'attendance-profile-card__tier-crest--fallback'}`}
      style={{ '--attendance-tier-accent': accentColor }}
      data-tier-key={tier.assetKey || 'unavailable'}
    >
      <span className="attendance-profile-card__tier-crest-aura" aria-hidden="true" />
      {isImageAvailable ? (
        <img
          className="attendance-profile-card__tier-crest-image"
          src={tier.assetSrc}
          alt={tier.alt}
          width={TIER_SYMBOL_DIMENSION}
          height={TIER_SYMBOL_DIMENSION}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={() => setFailedSource(tier.assetSrc)}
        />
      ) : (
        <span className="attendance-profile-card__tier-emblem-fallback" role="img" aria-label={tier.alt}>
          <Award aria-hidden="true" />
        </span>
      )}
    </div>
  );
};

export default TierEmblem;
