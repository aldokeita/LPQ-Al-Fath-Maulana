import React from 'react';
import './GlassSurface.css';

const GlassSurface = ({
  children,
  className = '',
  height,
  borderRadius = 24,
  blur = 10,
  opacity = 0.88,
  backgroundOpacity = 0.08,
  saturation = 1.25,
}) => {
  const style = {
    '--rb-glass-height': typeof height === 'number' ? `${height}px` : height,
    '--rb-glass-radius': typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    '--rb-glass-blur': `${blur}px`,
    '--rb-glass-opacity': opacity,
    '--rb-glass-bg-opacity': backgroundOpacity,
    '--rb-glass-saturation': saturation,
  };

  return (
    <div className={`rb-glass-surface ${className}`} style={style}>
      <div className="rb-glass-surface__shine" aria-hidden="true" />
      <div className="rb-glass-surface__content">{children}</div>
    </div>
  );
};

export default GlassSurface;
