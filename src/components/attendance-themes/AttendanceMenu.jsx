import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Check, Dices, Gamepad2, Library, Moon, MoreHorizontal, Music, Sun, Trophy, Tv,
} from 'lucide-react';
import { enableGameFeatures } from '@/lib/featureFlags';
import { facePilotEnabled } from '@/lib/faceAttendanceApi';
import { ATTENDANCE_THEMES } from './useAttendanceThemePreference';

// The one small menu that holds the theme picker, light/dark mode and every shortcut that used to
// sit in the header. `variant="kiosk"` is styled by the active theme; "klasik" by the old page.
const AttendanceMenu = ({
  variant = 'kiosk', theme, setTheme, isDark, onToggleMode, mediaOpen, onToggleMedia, buttonClassName,
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (path) => () => { setOpen(false); navigate(path); };
  const shortcuts = [
    facePilotEnabled && { key: 'face', label: 'Absensi Wajah', icon: Camera, onClick: go('/absensi-wajah') },
    enableGameFeatures && { key: 'gatcha', label: 'Gatcha', icon: Gamepad2, onClick: go('/gatcha-game') },
    enableGameFeatures && { key: 'quiz', label: 'Quiz Hafalan', icon: Library, onClick: go('/quiz-hafalan') },
    enableGameFeatures && { key: 'random', label: 'Acak Nama', icon: Dices, onClick: go('/random-name') },
    enableGameFeatures && { key: 'top', label: 'Leaderboard', icon: Trophy, onClick: go('/top-score') },
    { key: 'tv', label: 'TV Display', icon: Tv, onClick: go('/tv-display-mode') },
  ].filter(Boolean);

  return (
    <div ref={rootRef} className={variant === 'klasik' ? 'atk-klasik-menu-wrap' : 'atk-menu-wrap'}>
      <button
        type="button"
        className={buttonClassName || 'k-btn'}
        aria-label="Buka menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
      </button>
      {open && (
        <div className={variant === 'klasik' ? 'atk-klasik-menu' : 'menu'} role="menu">
          <h6>Tema layar ini</h6>
          {ATTENDANCE_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === theme}
              onClick={() => { setTheme(t.id); setOpen(false); }}
            >
              <span className="dot" style={{ background: t.swatch }} aria-hidden="true" />
              {t.name}
              <Check className="ck" aria-hidden="true" />
            </button>
          ))}
          <p className="note">Tema dan mode terang/gelap disimpan di perangkat ini saja.</p>
          <hr />
          <h6>Pintasan</h6>
          {shortcuts.map(({ key, label, icon: Icon, onClick }) => (
            <button key={key} type="button" role="menuitem" onClick={onClick}>
              <Icon aria-hidden="true" />{label}
            </button>
          ))}
          <hr />
          <button type="button" role="menuitem" onClick={() => { onToggleMode(); setOpen(false); }}>
            {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            {isDark ? 'Pakai mode terang' : 'Pakai mode gelap'}
          </button>
          {onToggleMedia && (
            <button type="button" role="menuitem" onClick={() => { onToggleMedia(); setOpen(false); }}>
              <Music aria-hidden="true" />{mediaOpen ? 'Sembunyikan pemutar audio' : 'Tampilkan pemutar audio'}
            </button>
          )}
          {variant !== 'klasik' && (
            <button type="button" role="menuitem" onClick={go('/dashboard')}>
              <ArrowLeft aria-hidden="true" />Kembali ke dashboard
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceMenu;
