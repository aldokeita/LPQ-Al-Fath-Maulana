import { useCallback, useEffect, useRef } from 'react';
import './BorderGlow.css';

const COLOR_PRESETS = {
  emerald: {
    glowColor: '158 68 58',
    colors: ['#dffcf0', '#8feec8', '#13b981'],
  },
  cyan: {
    glowColor: '190 80 64',
    colors: ['#e1f8ff', '#8bdff2', '#22b8cf'],
  },
  amber: {
    glowColor: '41 83 64',
    colors: ['#fff4d5', '#f1c971', '#d99d2b'],
  },
};

const parseHSL = (hslStr) => {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 158, s: 68, l: 58 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
};

const buildGlowVars = (glowColor, intensity) => {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const vars = {};

  for (let i = 0; i < opacities.length; i += 1) {
    vars[`--rb-glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
  }

  return vars;
};

const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const GRADIENT_KEYS = [
  '--rb-gradient-one',
  '--rb-gradient-two',
  '--rb-gradient-three',
  '--rb-gradient-four',
  '--rb-gradient-five',
  '--rb-gradient-six',
  '--rb-gradient-seven',
];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

const buildGradientVars = (colors) => {
  const vars = {};

  for (let i = 0; i < 7; i += 1) {
    const color = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${color} 0px, transparent 50%)`;
  }

  vars['--rb-gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
  return vars;
};

const getElementCenter = (element) => {
  const { width, height } = element.getBoundingClientRect();
  return [width / 2, height / 2];
};

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;

const animateValue = ({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }) => {
  const t0 = performance.now() + delay;
  const tick = () => {
    const elapsed = performance.now() - t0;
    if (elapsed < 0) { requestAnimationFrame(tick); return; }
    const t = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(t));
    if (t < 1) requestAnimationFrame(tick);
    else if (onEnd) onEnd();
  };
  setTimeout(() => requestAnimationFrame(tick), delay);
};

const BorderGlow = ({
  children,
  color = 'emerald',
  className = '',
  edgeSensitivity = 42,
  glowColor,
  backgroundColor = 'rgba(255, 255, 255, 0.84)',
  borderRadius = 26,
  glowRadius = 26,
  glowIntensity = 0.38,
  coneSpread = 18,
  colors,
  fillOpacity = 0.16,
  animated = false,
}) => {
  const cardRef = useRef(null);
  const preset = COLOR_PRESETS[color] || COLOR_PRESETS.emerald;
  const resolvedGlowColor = glowColor || preset.glowColor;
  const resolvedColors = colors || preset.colors;

  const updatePointerPosition = useCallback((event) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const [centerX, centerY] = getElementCenter(card);
    const dx = x - centerX;
    const dy = y - centerY;
    const kx = dx === 0 ? Infinity : centerX / Math.abs(dx);
    const ky = dy === 0 ? Infinity : centerY / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    const radians = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
    const degrees = (radians * (180 / Math.PI) + 450) % 360;

    card.style.setProperty('--rb-edge-proximity', `${(edge * 100).toFixed(3)}`);
    card.style.setProperty('--rb-cursor-angle', `${degrees.toFixed(3)}deg`);
  }, []);

  const resetPointerPosition = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--rb-edge-proximity', '0');
  }, []);

  useEffect(() => resetPointerPosition, [resetPointerPosition]);

  useEffect(() => {
    if (!animated || !cardRef.current) return;
    const card = cardRef.current;
    const angleStart = 110;
    const angleEnd = 465;
    card.classList.add('rb-sweep-active');
    card.style.setProperty('--rb-cursor-angle', `${angleStart}deg`);

    animateValue({ duration: 500, onUpdate: (v) => card.style.setProperty('--rb-edge-proximity', v) });
    animateValue({
      ease: easeInCubic, duration: 1500, end: 50,
      onUpdate: (v) => card.style.setProperty('--rb-cursor-angle', `${((angleEnd - angleStart) * (v / 100)) + angleStart}deg`),
    });
    animateValue({
      ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100,
      onUpdate: (v) => card.style.setProperty('--rb-cursor-angle', `${((angleEnd - angleStart) * (v / 100)) + angleStart}deg`),
    });
    animateValue({
      ease: easeInCubic, delay: 2500, duration: 1500, start: 100, end: 0,
      onUpdate: (v) => card.style.setProperty('--rb-edge-proximity', v),
      onEnd: () => card.classList.remove('rb-sweep-active'),
    });
  }, [animated]);

  return (
    <div
      ref={cardRef}
      onPointerMove={updatePointerPosition}
      onPointerLeave={resetPointerPosition}
      className={`rb-border-glow ${className}`}
      style={{
        '--rb-card-bg': backgroundColor,
        '--rb-edge-sensitivity': edgeSensitivity,
        '--rb-border-radius': `${borderRadius}px`,
        '--rb-glow-padding': `${glowRadius}px`,
        '--rb-cone-spread': coneSpread,
        '--rb-fill-opacity': fillOpacity,
        ...buildGlowVars(resolvedGlowColor, glowIntensity),
        ...buildGradientVars(resolvedColors),
      }}
    >
      <span className="rb-border-glow__edge-light" aria-hidden="true" />
      <div className="rb-border-glow__inner">{children}</div>
    </div>
  );
};

export default BorderGlow;
