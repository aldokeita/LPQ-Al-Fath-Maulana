import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { resolveSantriTier } from '@/lib/santriTier';

const TIER_SYMBOL_DIMENSION = 76;

const TierEmblem = ({ levelInfo, points }) => {
  const tier = resolveSantriTier({ levelInfo, points });
  const [failedSource, setFailedSource] = useState(null);
  const isImageAvailable = Boolean(tier.assetSrc) && failedSource !== tier.assetSrc;

  useEffect(() => {
    setFailedSource(null);
  }, [tier.assetSrc]);

  return (
    <div
      className={`attendance-profile-card__tier-emblem ${isImageAvailable ? '' : 'attendance-profile-card__tier-emblem--fallback'}`}
      data-tier-key={tier.assetKey || 'unavailable'}
      title={tier.label ? `Tier ${tier.label}` : 'Tier belum tersedia'}
    >
      {isImageAvailable ? (
        <img
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
          <span className="sr-only">{tier.alt}</span>
        </span>
      )}
    </div>
  );
};

export default TierEmblem;
