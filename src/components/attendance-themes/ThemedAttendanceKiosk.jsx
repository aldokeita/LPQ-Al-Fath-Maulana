import React, { useLayoutEffect, useRef, useState } from 'react';
import AttendanceMenu from './AttendanceMenu';
import { THEME_RENDERERS } from './KioskThemes';
import { I, useNow } from './kioskParts';
import { resolveActiveSession } from '@/lib/attendanceKioskStats';
import '@/styles/attendance-themes.css';

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap';

// Portrait kiosk drawn at 720x1280 (same ratio as a 1080x1920 monitor) and scaled to the screen.
const W = 720;
const H = 1280;

const ThemedAttendanceKiosk = ({ theme, mode, view, sessionTimes, stats, input, menu }) => {
  const now = useNow();
  const session = resolveActiveSession(sessionTimes, now);
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useLayoutEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  const head = (
    <div className="k-head">
      <div className="brand">
        <div className="brand-mark"><I.logo /></div>
        <div className="brand-txt"><b>LPQ Al-Fath Maulana</b><span>Absensi Digital</span></div>
      </div>
      <div className="k-head-r">
        <div className="online"><i />Online</div>
        <AttendanceMenu {...menu} />
      </div>
    </div>
  );

  const out = THEME_RENDERERS[theme]({ view, now, session, stats, input, head });

  return (
    <div className={`atk atk-stage atk-${theme} atk-${mode}`} ref={stageRef}>
      <div className="atk-frame" style={{ width: W * scale, height: H * scale }}>
        <div className={`kiosk t-${theme} m-${mode}`} style={{ transform: `scale(${scale})` }}>
          <div className="bg">{out.bg}</div>
          <div className="k-inner">{out.html}</div>
        </div>
      </div>
    </div>
  );
};

export default ThemedAttendanceKiosk;
