import React, { useEffect, useId, useState } from 'react';
import { initialsOf } from './kioskView';

// Small inline icons and shared pieces used by every kiosk theme (ported from the approved mockup).
const svg = (children, extra = {}) => (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra} {...props}>{children}</svg>
);
export const I = {
  logo: svg(<><path d="M12 3l2.6 2.6H18v3.4L20.6 12 18 14.6V18h-3.4L12 20.6 9.4 18H6v-3.4L3.4 12 6 9.4V6h3.4z" /><path d="M9 13.5c0-1.7 1.3-3 3-3s3 1.3 3 3" /><path d="M12 8v2.5" /></>, { strokeWidth: 1.8 }),
  nfc: svg(<><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="M5.5 10.5h3M5.5 13.5h5" /><path d="M18 9.5a3.5 3.5 0 010 5M20.5 7.5a6.5 6.5 0 010 9" /></>),
  check: svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, { strokeWidth: 3 }),
  tick: svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, { strokeWidth: 2.5, width: 16, height: 16 }),
  alert: svg(<><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>, { width: 16, height: 16 }),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  star: svg(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />),
  book: svg(<><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" /><path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5" /></>),
  cal: svg(<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  spark: svg(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />),
  medal: svg(<><circle cx="12" cy="15" r="6" /><path d="M8.5 3h7L14 9.5h-4z" /></>),
  x: svg(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" /></>),
  warn: svg(<><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5h.01" /></>),
  info: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  users: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M21.5 20a6.5 6.5 0 00-4-6" /></>),
  fire: svg(<path d="M12 21c-4 0-7-2.7-7-6.5 0-3 2-5.2 3.5-7 .3 2 1.4 3.2 2.5 3.5C11 7.5 12.5 5 15 3c0 3.5 4 5.5 4 11 0 4-3 7-7 7z" />),
};

export const TZ = 'Asia/Jakarta';
export const nf = (n) => Number(n || 0).toLocaleString('id-ID');
export const fmtT = (d) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).replace('.', ':');
export const fmtS = (d) => String(new Intl.DateTimeFormat('en-GB', { second: '2-digit', timeZone: TZ }).format(d)).padStart(2, '0');
export const fmtD = (d) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
export const dateParts = (d) => Object.fromEntries(new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).formatToParts(d).map((p) => [p.type, p.value]));
export const monthName = (d) => new Intl.DateTimeFormat('id-ID', { month: 'long', timeZone: TZ }).format(d);

export const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};

// Counts the last few points up so the new total visibly ticks over.
export const CountUp = ({ value }) => {
  const end = Number(value) || 0;
  const [shown, setShown] = useState(end);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || end < 10) { setShown(end); return undefined; }
    let v = end - 10;
    setShown(v);
    const id = setInterval(() => { v += 1; setShown(v); if (v >= end) clearInterval(id); }, 70);
    return () => clearInterval(id);
  }, [end]);
  return <>{nf(shown)}</>;
};

export const Award = ({ value }) => (value > 0 ? <span className="award">+{value}</span> : null);

export const Avatar = ({ name, photo, late, showOk = true }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="ava">
      <div className="pic">
        {photo && !failed
          ? <img src={photo} alt={`Foto ${name || ''}`} onError={() => setFailed(true)} />
          : <span className="atk-initials" aria-hidden="true">{initialsOf(name)}</span>}
      </div>
      {showOk && <span className={`ok-dot${late ? ' late' : ''}`}>{late ? <I.alert /> : <I.check />}</span>}
    </div>
  );
};

export const TierImg = ({ tier }) => (tier?.src ? <img className="tier" src={tier.src} alt={`Lencana tier ${tier.label}`} /> : null);

export const StatusChip = ({ view, upper = false }) => {
  const label = upper ? view.statusLabel.toUpperCase() : view.statusLabel;
  if (!view.success && view.kind === 'guru') return <span className="chip">{label}</span>;
  return <span className={`chip ${view.late ? 'late' : 'ok'}`}>{view.late ? <I.alert /> : <I.tick />}{label}</span>;
};

export const Days = ({ days = [] }) => (
  <div className="days" style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)},1fr)` }}>
    {days.map((d, i) => <i key={i} className={d} title={{ on: 'Hadir', late: 'Terlambat', absent: 'Tidak hadir' }[d]} />)}
  </div>
);

export const Legend = ({ monthly }) => (
  <div className="legend">
    <span><i className="on" />Hadir {monthly.present}</span>
    <span><i className="late" />Terlambat {monthly.late}</span>
    <span><i className="absent" />Tidak hadir {monthly.absent}</span>
  </div>
);

export const Badges = ({ badges = [] }) => (
  badges.length ? (
    <div className="bdgs">
      {badges.slice(0, 4).map((b) => (
        <span key={b.id} className="bdg atk-bdg" title={b.title} style={{ '--b1': b.from, '--b2': b.to }}><I.star /></span>
      ))}
    </div>
  ) : <span className="atk-none">Belum ada</span>
);

export const Bar = ({ ratio }) => <div className="bar"><i style={{ '--w': `${Math.round((ratio || 0) * 100)}%` }} /></div>;

export const tierNextText = (tier, upper = false) => {
  if (!tier) return '';
  const text = tier.highest ? 'Tier tertinggi' : tier.toNext != null && tier.next ? `${nf(tier.toNext)} poin lagi ke ${tier.next}` : '';
  return upper ? text.toUpperCase() : text;
};

export const ScanIcon = ({ theme }) => {
  const id = useId().replace(/:/g, '');
  const card = (sw) => (<><rect x="26" y="40" width="44" height="32" rx="6" fill="none" strokeWidth={sw} /><rect x="33" y="48" width="10" height="8" rx="2" fill="none" strokeWidth={sw * 0.7} /><path d="M33 64h18" strokeWidth={sw * 0.7} /></>);
  const waves = (sw) => (<><path d="M80 50a10 10 0 010 12" strokeWidth={sw} /><path d="M87 44a19 19 0 010 24" strokeWidth={sw} opacity=".75" /><path d="M94 38a28 28 0 010 36" strokeWidth={sw} opacity=".5" /></>);
  if (theme === 'glass') {
    return (<div className="si si-glass"><svg viewBox="20 30 82 52" aria-label="Pemindai kartu"><defs><linearGradient id={`sg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#60a5fa" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient></defs><g fill="none" stroke={`url(#sg${id})`} strokeLinecap="round" strokeLinejoin="round">{card(5)}{waves(5)}</g></svg></div>);
  }
  if (theme === 'aurora') {
    return (<div className="si si-aurora"><svg viewBox="20 30 82 52" aria-label="Pemindai kartu"><defs><linearGradient id={`sa${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3b82f6" /><stop offset=".55" stopColor="#8b5cf6" /><stop offset="1" stopColor="#14b8a6" /></linearGradient></defs><g fill="none" stroke={`url(#sa${id})`} strokeLinecap="round" strokeLinejoin="round">{card(2.2)}{waves(2.2)}</g></svg></div>);
  }
  if (theme === 'bento') {
    return (<div className="si si-bento"><svg viewBox="0 0 120 120" aria-label="Pemindai kartu"><g fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 40V28a8 8 0 018-8h12M80 20h12a8 8 0 018 8v12M100 80v12a8 8 0 01-8 8H80M40 100H28a8 8 0 01-8-8V80" /></g><rect x="38" y="44" width="44" height="32" rx="6" fill="currentColor" /><rect x="45" y="51" width="10" height="8" rx="2" fill="var(--si-chip)" /><rect className="laser" x="14" y="58" width="92" height="5" rx="2.5" fill="#3b82f6" /></svg></div>);
  }
  return (<div className="si si-spatial"><svg viewBox="0 0 120 120" aria-label="Pemindai kartu"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M16 36V16h20M84 16h20v20M104 84v20H84M36 104H16V84" strokeWidth="3" /><rect x="36" y="44" width="48" height="32" rx="6" strokeWidth="2.4" opacity=".9" /><rect x="43" y="51" width="10" height="8" rx="2" strokeWidth="1.8" opacity=".8" /></g><g className="laser"><rect x="24" y="59" width="72" height="2" rx="1" fill="currentColor" /></g></svg></div>);
};

// Spatial's "hacking" frame: lock-on brackets, a slow scan line, data streams and mono labels.
export const HackFx = ({ a = 'ID', b = 'MATCH', bare = false }) => (
  <div className={`ofx hk${bare ? ' bare' : ''}`}>
    <div className="halo" /><div className="sl"><i /></div>
    <svg className="osvg" viewBox="0 0 300 300" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="square">
      <g className="brk" strokeWidth="2.2"><path d="M14 52V14h38M248 14h38v38M286 248v38h-38M52 286H14v-38" /></g>
      <g className="strm" strokeWidth="1.4"><path className="dn" d="M14 66V234" /><path className="up" d="M286 234V66" /></g>
      <g className="lbl" fill="currentColor" stroke="none"><text x="60" y="17">{a}</text><text x="240" y="289" textAnchor="end">{b}<tspan className="cur">_</tspan></text></g>
    </svg>
  </div>
);

// The visible RFID field. It is the real input the reader types into, so focus stays here.
export const ScanInput = ({ input, className = 'ph', placeholder = 'Menunggu kartu RFID…' }) => (
  <form onSubmit={input.onSubmit} className="atk-form">
    <input
      ref={input.ref}
      className={`${className} atk-input`}
      type="text"
      value={input.value}
      onChange={input.onChange}
      placeholder={input.isLoading ? 'Memproses kartu…' : placeholder}
      disabled={input.isLoading}
      autoFocus
      autoComplete="off"
      aria-label="Input RFID"
    />
  </form>
);
