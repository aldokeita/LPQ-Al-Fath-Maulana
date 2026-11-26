import { useCallback, useState } from 'react';

// The RFID kiosk theme and each theme's light/dark mode are stored per device (localStorage),
// so every monitor can keep its own look. "klasik" is the original page.
export const ATTENDANCE_THEMES = [
  { id: 'klasik', name: 'Klasik', swatch: 'linear-gradient(135deg,#ffffff,#22c55e)' },
  { id: 'glass', name: 'Liquid Glass', swatch: 'linear-gradient(135deg,#bfdbfe,#ffffff)' },
  { id: 'aurora', name: 'Aurora', swatch: 'linear-gradient(135deg,#7cc4ff,#a78bfa,#5eead4)' },
  { id: 'bento', name: 'Bento Grid', swatch: 'linear-gradient(135deg,#111318 50%,#2563eb 50%)' },
  { id: 'spatial', name: 'Spatial', swatch: 'linear-gradient(135deg,#06080d 40%,#3b82f6)' },
];

const THEME_KEY = 'lpq-tema-absensi';
const MODE_KEY = 'lpq-mode-absensi';
const DEFAULT_MODES = { glass: 'light', aurora: 'light', bento: 'light', spatial: 'dark' };

const readTheme = () => {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return ATTENDANCE_THEMES.some((t) => t.id === value) ? value : 'klasik';
  } catch {
    return 'klasik';
  }
};

const readModes = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(MODE_KEY) || 'null');
    return stored && typeof stored === 'object' ? { ...DEFAULT_MODES, ...stored } : { ...DEFAULT_MODES };
  } catch {
    return { ...DEFAULT_MODES };
  }
};

export const useAttendanceThemePreference = () => {
  const [theme, setThemeState] = useState(readTheme);
  const [modes, setModes] = useState(readModes);

  const setTheme = useCallback((id) => {
    if (!ATTENDANCE_THEMES.some((t) => t.id === id)) return;
    setThemeState(id);
    try { window.localStorage.setItem(THEME_KEY, id); } catch { /* storage off: keep in memory */ }
  }, []);

  const toggleMode = useCallback(() => {
    setModes((current) => {
      const next = { ...current, [theme]: current[theme] === 'dark' ? 'light' : 'dark' };
      try { window.localStorage.setItem(MODE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [theme]);

  return { theme, mode: modes[theme] || 'light', setTheme, toggleMode };
};
