import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { resolveSantriTier } from '@/lib/santriTier';

const TIER_SYMBOL_DIMENSION = 144;

const formatPoints = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(numericValue);
};

const TierEmblem = ({ levelInfo, points, tierProgress }) => {
  const tier = resolveSantriTier({ levelInfo, points });
  const [failedSource, setFailedSource] = useState(null);
  const isImageAvailable = Boolean(tier.assetSrc) && failedSource !== tier.assetSrc;
  const accentColor = levelInfo?.accentColor || levelInfo?.color || '#0ea5e9';
  const tierLabel = tier.label || 'Level belum tersedia';
  const currentPoints = formatPoints(tierProgress?.currentPoints ?? points);
  const nextPoints = formatPoints(tierProgress?.nextMin);
  const hasProgress = Boolean(
    tierProgress?.available
      && tierProgress?.nextLabel
      && Number.isFinite(Number(tierProgress?.nextMin))
      && Number.isFinite(Number(tierProgress?.ratio)),
  );
  const progressWidth = hasProgress
    ? `${Math.round(Math.min(1, Math.max(0, Number(tierProgress.ratio))) * 1000) / 10}%`
    : '0%';

  useEffect(() => {
    setFailedSource(null);
  }, [tier.assetSrc]);

  return (
    <figure
      className={`attendance-profile-card__tier-crest ${isImageAvailable ? '' : 'attendance-profile-card__tier-crest--fallback'}`}
      style={{ '--attendance-tier-accent': accentColor }}
      data-tier-key={tier.assetKey || 'unavailable'}
    >
      <div className="attendance-profile-card__tier-medallion">
        <div className="attendance-profile-card__tier-medallion-ring">
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
            </span>
          )}
        </div>
      </div>

      <figcaption className="attendance-profile-card__tier-info">
        <span className="attendance-profile-card__tier-kicker">Level santri</span>
        <strong className="attendance-profile-card__tier-label">{tierLabel}</strong>

        {tierProgress?.isHighest ? (
          <span className="attendance-profile-card__tier-highest">Tier Tertinggi</span>
        ) : hasProgress ? (
          <div className="attendance-profile-card__tier-progress" aria-label={`Progress menuju ${tierProgress.nextLabel}`}>
            <div className="attendance-profile-card__tier-progress-header">
              <span>Menuju {tierProgress.nextLabel}</span>
              <span>{currentPoints} / {nextPoints} poin</span>
            </div>
            <div
              className="attendance-profile-card__tier-progress-track"
              role="progressbar"
              aria-valuemin={Number(tierProgress.currentMin) || 0}
              aria-valuemax={Number(tierProgress.nextMin)}
              aria-valuenow={Math.min(Number(tierProgress.nextMin), Math.max(Number(tierProgress.currentMin) || 0, Number(tierProgress.currentPoints) || 0))}
              aria-valuetext={`${currentPoints} dari ${nextPoints} poin menuju ${tierProgress.nextLabel}`}
            >
              <span className="attendance-profile-card__tier-progress-fill" style={{ width: progressWidth }} />
            </div>
          </div>
        ) : (
          <span className="attendance-profile-card__tier-progress-fallback">Progress tier belum tersedia</span>
        )}
      </figcaption>
    </figure>
  );
};

export default TierEmblem;
