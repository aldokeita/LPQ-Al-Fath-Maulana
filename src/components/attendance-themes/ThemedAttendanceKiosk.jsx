import React, { useLayoutEffect, useRef, useState } from 'react';
import AttendanceMenu from './AttendanceMenu';
import { THEME_RENDERERS } from './KioskThemes';
import { useNow } from './kioskParts';
import { resolveActiveSession } from '@/lib/attendanceKioskStats';
import '@/styles/attendance-themes.css';

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap';

// Each theme is drawn on a design canvas at least 720 wide and 1280 tall, then scaled so the
// canvas fills the whole screen: on a 1080x1920 monitor that is exactly 720x1280, on a tablet or
// phone the canvas grows wider or taller to match the screen, so there are never empty side bars.
const MIN_W = 720;
const MIN_H = 1280;

const ThemedAttendanceKiosk = ({ theme, mode, view, sessionTimes, stats, input, menu }) => {
  const now = useNow();
  const session = resolveActiveSession(sessionTimes, now);
  const stageRef = useRef(null);
  const [box, setBox] = useState({ scale: 1, w: MIN_W, h: 1280 });

  useLayoutEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (!vw || !vh) return;
      const scale = Math.min(vw / MIN_W, vh / MIN_H);
      setBox({ scale, w: vw / scale, h: vh / scale });
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    observer?.observe(stageRef.current);
    window.addEventListener('resize', fit);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); };
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
        <div className="brand-mark atk-logo"><img src="/logo-lpq-al-fath-maulana.webp" alt="Logo LPQ Al-Fath Maulana" /></div>
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
      <div className="atk-frame">
        <div className={`kiosk t-${theme} m-${mode}`} style={{ width: box.w, height: box.h, transform: `scale(${box.scale})` }}>
          <div className="bg">{out.bg}</div>
          <div className="k-inner">{out.html}</div>
        </div>
      </div>
    </div>
  );
};

export default ThemedAttendanceKiosk;
