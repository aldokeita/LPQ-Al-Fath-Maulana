import React, { useLayoutEffect, useRef, useState } from 'react';

// Lays its child out at a fixed design width, then scales it to fit the box it is given, both ways.
// A transform keeps the measured size unscaled, so the fit does not feed back into itself.
export default function FitToBox({ width, maxScale = 1.6, className = '', children }) {
  const box = useRef(null); const inner = useRef(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const fit = () => {
      const available = box.current?.getBoundingClientRect(); const height = inner.current?.offsetHeight;
      if (!available || !height || !available.width || !available.height) return;
      setScale(Math.min(maxScale, available.width / width, available.height / height));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box.current); observer.observe(inner.current);
    return () => observer.disconnect();
  }, [width, maxScale]);
  return <div ref={box} className={`fit-to-box ${className}`}>
    <div ref={inner} className="fit-to-box__inner" style={{ width, transform: `translate(-50%, -50%) scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
      {children}
    </div>
  </div>;
}
