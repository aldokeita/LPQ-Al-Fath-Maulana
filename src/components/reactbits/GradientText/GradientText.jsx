import React from 'react';
import './GradientText.css';

const GradientText = ({
  children,
  className = '',
  colors = ['#8af5cb', '#66d9ff', '#c6b8ff', '#f5c76a'],
  animationSpeed = 8,
  showBorder = false,
  direction = 'horizontal',
  pauseOnHover = false,
  yoyo = true,
}) => {
  const gradientAngle = direction === 'vertical' ? 'to bottom' : direction === 'diagonal' ? 'to bottom right' : 'to right';
  const gradientColors = [...colors, colors[0]].join(', ');
  const style = {
    '--rb-gradient-angle': gradientAngle,
    '--rb-gradient-colors': gradientColors,
    '--rb-gradient-speed': `${animationSpeed}s`,
    '--rb-gradient-size': direction === 'vertical' ? '100% 300%' : direction === 'diagonal' ? '300% 300%' : '300% 100%',
  };

  return (
    <span
      className={`animated-gradient-text rb-gradient-text ${showBorder ? 'with-border' : ''} ${pauseOnHover ? 'pause-on-hover' : ''} ${yoyo ? 'is-yoyo' : 'is-loop'} ${className}`}
      style={style}
    >
      {showBorder && <span className="gradient-overlay" aria-hidden="true" />}
      <span className="text-content">{children}</span>
    </span>
  );
};

export default GradientText;
