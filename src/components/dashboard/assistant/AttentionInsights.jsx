import React from 'react';
import { BookOpen, CalendarCheck2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSchoolDate, getHafalanRing, getJilidMeter, percentOf, summarizePulse } from '@/lib/assistantAlerts';

const PULSE_LABEL = { hadir: 'Hadir', terlambat: 'Terlambat', koreksi: 'Hadir (dikoreksi)', absen: 'Tidak hadir' };

// Bentuk berbeda untuk tidak hadir (cincin kosong) agar tidak bergantung pada warna saja.
const PULSE_DOT = {
  hadir: 'bg-emerald-500 dark:bg-emerald-400',
  terlambat: 'bg-amber-400 dark:bg-amber-300',
  koreksi: 'bg-sky-400 dark:bg-sky-300',
  absen: 'border-2 border-rose-500 bg-transparent dark:border-rose-400',
};

const Tile = ({ icon: Icon, label, tone, children }) => (
  <div className="attention-tile min-w-0 rounded-xl p-3">
    <p className={cn('mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]', tone)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
    </p>
    {children}
  </div>
);

const EmptyNote = ({ children }) => <p className="text-xs text-muted-foreground">{children}</p>;

export const AttendancePulse = ({ snapshot }) => {
  const sessions = snapshot?.sesi_terakhir || [];
  const { total, hadir } = summarizePulse(sessions);
  const pct = percentOf(snapshot?.hadir_4pekan, snapshot?.sesi_4pekan);

  return (
    <Tile icon={CalendarCheck2} label="Kehadiran" tone="text-rose-700 dark:text-rose-300">
      {total === 0 ? <EmptyNote>Belum ada sesi terjadwal.</EmptyNote> : (
        <>
          <ol className="flex items-center gap-1" aria-label={`${hadir} hadir dari ${total} sesi terakhir`}>
            {sessions.map((s) => (
              <li key={s.t} title={`${formatSchoolDate(s.t)}: ${PULSE_LABEL[s.s] || s.s}`}
                className={cn('h-3 w-3 shrink-0 rounded-full sm:h-3.5 sm:w-3.5', PULSE_DOT[s.s] || PULSE_DOT.hadir)}>
                <span className="sr-only">{formatSchoolDate(s.t)}: {PULSE_LABEL[s.s] || s.s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{hadir}/{total}</span> sesi terakhir
            {pct !== null && <> · <span className={cn('font-semibold tabular-nums', pct < 75 ? 'text-rose-700 dark:text-rose-300' : 'text-foreground')}>{pct}%</span> 4 pekan</>}
          </p>
        </>
      )}
    </Tile>
  );
};

export const JilidMeter = ({ snapshot }) => {
  const meter = getJilidMeter(snapshot);
  return (
    <Tile icon={BookOpen} label={snapshot?.jilid || 'Jilid'} tone="text-amber-700 dark:text-amber-300">
      {!meter ? <EmptyNote>Data jilid belum lengkap.</EmptyNote> : (
        <>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted" role="img"
            aria-label={`${meter.days} hari di jilid ini, batas ${meter.limit} hari${meter.over ? `, lewat ${meter.over} hari` : ''}`}>
            <div className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${meter.withinPct}%` }} />
            {meter.over > 0 && (
              <div className="absolute inset-y-0 rounded-r-full bg-rose-500 dark:bg-rose-400" style={{ left: `${meter.markerPct}%`, width: `${meter.overPct}%` }} />
            )}
            <div className="absolute inset-y-[-2px] w-0.5 bg-foreground/70" style={{ left: `calc(${meter.markerPct}% - 1px)` }} aria-hidden="true" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{meter.days}</span> / {meter.limit} hari
            {meter.over > 0 && <> · <span className="font-semibold text-rose-700 dark:text-rose-300">lewat {meter.over}</span></>}
          </p>
        </>
      )}
    </Tile>
  );
};

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

export const HafalanRing = ({ snapshot }) => {
  const ring = getHafalanRing(snapshot?.hafalan);
  const recorded = ring && ring.dicatat > 0;
  return (
    <Tile icon={Sparkles} label="Hafalan jilid" tone="text-violet-700 dark:text-violet-300">
      {!ring ? <EmptyNote>Tidak ada daftar hafalan untuk jilid ini.</EmptyNote> : (
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0 -rotate-90" role="img" aria-label={`${ring.lulus} dari ${ring.total} hafalan lulus`}>
            <circle cx="20" cy="20" r={RING_R} fill="none" strokeWidth="5" className="stroke-muted" />
            <circle cx="20" cy="20" r={RING_R} fill="none" strokeWidth="5" strokeLinecap="round"
              className="stroke-violet-500 transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none dark:stroke-violet-400"
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - (ring.pct || 0) / 100)} />
          </svg>
          <p className="min-w-0 text-xs text-muted-foreground">
            <span className="block text-sm font-semibold tabular-nums text-foreground">{ring.lulus}/{ring.total} lulus</span>
            {recorded ? (ring.proses > 0 ? `${ring.proses} sedang diproses` : 'Belum ada yang tertunda') : 'Belum mulai dicatat'}
          </p>
        </div>
      )}
    </Tile>
  );
};

const AttentionInsights = ({ snapshot }) => {
  if (!snapshot) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <AttendancePulse snapshot={snapshot} />
      <JilidMeter snapshot={snapshot} />
      <HafalanRing snapshot={snapshot} />
    </div>
  );
};

export default AttentionInsights;
