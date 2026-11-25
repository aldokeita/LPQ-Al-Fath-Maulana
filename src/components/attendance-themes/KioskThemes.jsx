import React from 'react';
import {
  I, Avatar, Award, Badges, Bar, CountUp, Days, HackFx, Legend, ScanIcon, ScanInput, StatusChip, TierImg,
  dateParts, fmtD, fmtS, fmtT, monthName, nf, tierNextText,
} from './kioskParts';

// Each theme keeps the composition approved in the mockup (revision 8). Props shared by all:
// { view, now, session, stats, input, head }.

const readyStats = (stats) => [
  [stats?.present ?? '–', 'Santri sudah hadir', 'Hadir'],
  [stats?.notYet ?? '–', 'Belum hadir', 'Belum hadir'],
  [stats?.onTimePercent == null ? '–' : `${stats.onTimePercent}%`, 'Tepat waktu hari ini', 'Tepat waktu'],
];
const sessionText = (session) => (session ? `Sesi ${session.name}${session.range ? ` · ${session.range}` : ''}` : 'Tidak ada sesi');
const readyTitle = (view, normal) => (view.processing ? 'Memproses kartu…' : normal);
const MsgIcon = ({ tone }) => (tone === 'warning' ? <I.warn /> : tone === 'info' ? <I.info /> : <I.x />);

const ListBody = ({ view, className }) => (
  <div className={`${className} atk-list fadein`}>
    <h3>{view.title}</h3>
    {view.items.length ? (
      <div className="atk-list-rows">
        {view.items.map((item) => (
          <div key={item.id} className="atk-list-row">
            <div className="atk-list-top"><b>{item.title}</b><span>{item.side}</span></div>
            {item.chips.length > 0 && <div className="atk-list-chips">{item.chips.slice(0, 12).map((c, i) => <span key={i}>{c}</span>)}{item.chips.length > 12 && <span>+{item.chips.length - 12}</span>}</div>}
          </div>
        ))}
      </div>
    ) : <p className="atk-list-empty">{view.empty}</p>}
  </div>
);

/* ---------------- LIQUID GLASS ---------------- */
export const GlassTheme = ({ view, now, session, stats, input, head }) => {
  let body = null;
  if (view.kind === 'ready') {
    body = (
      <div className="g-ready fadein">
        <div className="g-disc gl"><ScanIcon theme="glass" /></div>
        <span className="salam">Assalamu&apos;alaikum</span>
        <h3>{readyTitle(view, 'Tempelkan kartu kamu')}</h3>
        <p>Dekatkan kartu ke pembaca di bawah layar.</p>
        <div className="g-pills">{readyStats(stats).map((s) => <div key={s[1]}><b>{s[0]}</b><span>{s[1]}</span></div>)}</div>
      </div>
    );
  } else if (view.kind === 'santri') {
    const C = 2 * Math.PI * 50;
    const m = view.monthly;
    const ratio = m.total ? m.attended / m.total : 0;
    body = (
      <div className="g-card gl sheen fadein">
        <div className="g-hero"><Avatar name={view.name} photo={view.photo} late={view.late} /><TierImg tier={view.tier} /></div>
        <h2 className="g-name">{view.name}</h2>
        <div className="g-meta">{view.meta}</div>
        <div className="g-chips"><StatusChip view={view} /><span className="chip"><I.clock />{view.time}</span></div>
        {view.notice && <div className="atk-notice">{view.notice}</div>}
        <div className="g-dock" style={view.tier ? undefined : { gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div><b><CountUp value={view.points} /><Award value={view.pointsAward} /></b><span>Poin</span></div>
          {view.tier && <div><b style={{ fontSize: 22 }}>{view.tier.label}</b><span>Tier</span></div>}
          <div><b>{view.jilid}</b><span>Jilid</span></div>
          <div><b>{view.hafalan}</b><span>Hafalan</span></div>
        </div>
        <div className="g-split">
          <div className="g-ring">
            <svg viewBox="0 0 120 120"><defs><linearGradient id="gring"><stop offset="0" stopColor="#4ade80" /><stop offset="1" stopColor="#16a34a" /></linearGradient></defs><circle cx="60" cy="60" r="50" fill="none" stroke="var(--ring-track,rgba(30,64,175,.12))" strokeWidth="11" /><circle cx="60" cy="60" r="50" fill="none" stroke="url(#gring)" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ratio)} /></svg>
            <div className="c"><div><b>{m.attended}</b><span>dari {m.total} hari</span></div></div>
          </div>
          <div className="g-side">
            {view.tier && <div><div className="lbl">{view.tier.highest ? 'Tier tertinggi' : `Menuju ${view.tier.next || 'tier berikutnya'}`}</div><Bar ratio={view.tier.ratio} /></div>}
            <Legend monthly={m} />
            <div className="row2">
              <div><div className="lbl">Karakter</div><div className="g-trait">{view.character || '–'}</div></div>
              <Badges badges={view.badges} />
            </div>
          </div>
        </div>
        {view.quote && <div className="g-quote">“{view.quote}”</div>}
      </div>
    );
  } else if (view.kind === 'guru') {
    body = (
      <div className="ctr">
        <div className="g-card gl sheen fadein" style={{ paddingTop: 40 }}>
          <div className="g-hero" style={{ marginBottom: 8 }}><Avatar name={view.name} photo={view.photo} late={view.late} showOk={view.success} /></div>
          <h2 className="g-name">{view.name}</h2><div className="g-meta">{view.meta}</div>
          <div className="g-chips"><StatusChip view={view} />{view.time && <span className="chip"><I.clock />{view.time}</span>}</div>
          {view.stats.length > 0 && (
            <div className="g-dock" style={{ gridTemplateColumns: `repeat(${view.stats.length},1fr)` }}>
              {view.stats.map(([k, v]) => <div key={k}><b style={String(v).length > 6 ? { fontSize: 20 } : undefined}>{v}</b><span>{k}</span></div>)}
            </div>
          )}
          <div className="g-quote">{view.note}</div>
        </div>
      </div>
    );
  } else if (view.kind === 'list') {
    body = <ListBody view={view} className="g-card gl" />;
  } else {
    body = (
      <div className={`g-err fadein tone-${view.tone}`}>
        <div className="g-card gl"><div className="ic"><MsgIcon tone={view.tone} /></div><h3>{view.title}</h3><p>{view.text}</p>{view.tag && <code>{view.tag}</code>}</div>
      </div>
    );
  }
  return {
    bg: <><div className="blobs" /><div className="photo" /><div className="caustic" /><div className="kh" /><div className="frost" /><div className="frost2" /></>,
    html: (
      <>
        {head}
        <div className="g-clock"><div className="t">{fmtT(now)}</div><div className="d">{fmtD(now)}</div><div className="s"><i />{sessionText(session)}</div></div>
        <div className="result">{body}</div>
        <div className="g-dockbar gl"><I.nfc /><ScanInput input={input} /><span className="go">TAP KARTU</span></div>
        <div className="g-foot">LPQ Al-Fath Maulana · Baturaja</div>
      </>
    ),
  };
};

/* ---------------- AURORA ---------------- */
export const AuroraTheme = ({ view, now, session, stats, input, head }) => {
  let body = null;
  if (view.kind === 'ready') {
    body = (
      <div className="a-ready fadein">
        <h3>{view.processing ? 'Memproses kartu…' : <>Assalamu&apos;alaikum,<br /><em>selamat datang.</em></>}</h3>
        <p>Tempelkan kartu kamu ke pembaca di bawah layar untuk mencatat kehadiran.</p>
        <div className="ill"><ScanIcon theme="aurora" /></div>
        <div className="a-nums">{readyStats(stats).map((s) => <div key={s[1]}><b>{s[0]}</b><span>{s[1]}</span></div>)}</div>
      </div>
    );
  } else if (view.kind === 'santri') {
    const m = view.monthly;
    body = (
      <div className="a-panel fadein">
        <div className="a-hero">
          <div className="a-portrait"><Avatar name={view.name} photo={view.photo} late={view.late} /><TierImg tier={view.tier} /></div>
          <div>
            <div className="a-eyebrow"><span className={`ok${view.late ? ' late' : ''}`}><i />Tercatat {view.time}</span></div>
            <h2 className="a-name">{view.name}</h2>
            <div className="a-meta">{view.meta}<br />{view.statusLabel}{view.tier ? ` · ${view.tier.label}` : ''}</div>
          </div>
        </div>
        {view.notice && <div className="atk-notice">{view.notice}</div>}
        <dl className="a-spec">
          <div><dt>Poin</dt><dd><CountUp value={view.points} /><Award value={view.pointsAward} /></dd></div>
          <div><dt>Tier</dt><dd>{view.tier?.label || '–'}</dd></div>
          <div><dt>Jilid</dt><dd>{view.jilid}</dd></div>
          <div><dt>{view.tier ? (view.tier.highest ? 'Tier puncak' : `Ke ${view.tier.next || 'tier berikutnya'}`) : 'Sesi'}</dt><dd>{view.tier ? <Bar ratio={view.tier.ratio} /> : (view.meta.split(' · ')[1] || '–')}</dd></div>
          <div><dt>Total hafalan</dt><dd>{view.hafalan} {view.hafalanBreakdown && <span style={{ fontSize: 13, opacity: 0.5, fontWeight: 500 }}>{view.hafalanBreakdown}</span>}</dd></div>
          <div><dt>Karakter</dt><dd>{view.character || '–'}</dd></div>
          <div className="full"><div className="top"><dt>Kehadiran {monthName(now)}</dt><dd>{m.attended} / {m.total}</dd></div><Days days={m.days} /><Legend monthly={m} /></div>
          <div className="full" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><dt>Badge</dt><Badges badges={view.badges} /></div>
        </dl>
        {view.quote && <div className="a-quote">{view.quote}</div>}
      </div>
    );
  } else if (view.kind === 'guru') {
    body = (
      <div className="ctr">
        <div className="a-panel a-guru fadein">
          <div className="a-portrait"><Avatar name={view.name} photo={view.photo} late={view.late} showOk={view.success} /></div>
          <div className="a-eyebrow"><span className={`ok${view.late ? ' late' : ''}${view.success ? '' : ' off'}`}><i />{view.success ? `Tercatat ${view.time}` : view.statusLabel}</span></div>
          <h2 className="a-name">{view.name}</h2><div className="a-meta">{view.meta}</div>
          {view.stats.length > 0 && <dl className="a-spec">{view.stats.map(([k, v, unit]) => <div key={k}><dt>{k}</dt><dd>{v}{unit ? ` ${unit}` : ''}</dd></div>)}</dl>}
          <div className="a-quote">{view.note}</div>
        </div>
      </div>
    );
  } else if (view.kind === 'list') {
    body = <ListBody view={view} className="a-panel" />;
  } else {
    body = (
      <div className="ctr">
        <div className={`a-panel a-err fadein tone-${view.tone}`}>
          <div className="a-eyebrow eb">● {view.eyebrow}</div><h3>{view.title}</h3><p>{view.text}</p>{view.tag && <span className="tag">{view.tag}</span>}
        </div>
      </div>
    );
  }
  return {
    bg: <><div className="aur"><span /><span /><span /><span /></div><div className="fade" /><div className="gr" /></>,
    html: (
      <>
        {head}
        <div className="a-clock"><div className="t">{fmtT(now)}</div><div className="r"><div className="d">{fmtD(now)}</div><div className="s"><i />{sessionText(session)}</div></div></div>
        <div className="result">
          {body}
          <div className="a-input"><I.nfc /><ScanInput input={input} /><kbd>Tap kartu</kbd></div>
        </div>
        <div className="a-foot"><span>LPQ Al-Fath Maulana · Baturaja</span><span>Absensi Digital</span></div>
      </>
    ),
  };
};

/* ---------------- BENTO GRID ---------------- */
export const BentoTheme = ({ view, now, session, stats, input, head }) => {
  const p = dateParts(now);
  let body = null;
  if (view.kind === 'ready') {
    body = (
      <div className="bn-grid fadein">
        <div className="tl bn-hero">
          <div style={{ display: 'grid', placeItems: 'center' }}><ScanIcon theme="bento" /></div>
          <div><span className="salam">Assalamu&apos;alaikum</span><h3>{readyTitle(view, 'Tempelkan kartu')}</h3><p>Dekatkan kartu RFID ke pembaca di bawah layar.</p></div>
        </div>
        {readyStats(stats).map((s, i) => (
          <div key={s[1]} className={`tl bn-stat ${i === 0 ? 'blue' : ''}`}><div className="b-k">{s[2]}</div><div className="b-v">{s[0]}</div><div style={{ fontSize: 13, opacity: 0.65 }}>{s[1]}</div></div>
        ))}
        <div className="tl bn-steps"><div><b>01</b>Ambil kartu santri atau kartu guru.</div><div><b>02</b>Tempelkan ke pembaca sampai lampu hijau.</div><div><b>03</b>Lihat kartu hasil di layar ini.</div></div>
      </div>
    );
  } else if (view.kind === 'santri') {
    const m = view.monthly;
    body = (
      <div className="bn-grid fadein">
        <div className="tl bn-id">
          <Avatar name={view.name} photo={view.photo} late={view.late} />
          <div><h2>{view.name}</h2><div className="meta">{view.meta}</div></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><StatusChip view={view} /><span className="chip"><I.clock />{view.time}</span></div>
          {view.notice && <div className="atk-notice">{view.notice}</div>}
        </div>
        <div className="tl bn-tier">
          <div className="b-k"><I.medal />Tier</div>
          {view.tier ? (
            <><TierImg tier={view.tier} /><div style={{ width: '100%' }}><div className="nm">{view.tier.label}</div><Bar ratio={view.tier.ratio} /><div className="nx" style={{ marginTop: 6 }}>{tierNextText(view.tier)}</div></div></>
          ) : <div className="nm">Santri dewasa</div>}
        </div>
        <div className="tl ink bn-pts"><div className="b-k"><I.star />Poin</div><div className="b-v"><CountUp value={view.points} /></div><Award value={view.pointsAward} /></div>
        <div className="tl bn-sm"><div className="b-k"><I.book />Jilid</div><div className="b-v">{view.jilid}</div></div>
        <div className="tl bn-sm"><div className="b-k"><I.medal />Total hafalan</div><div className="b-v">{view.hafalan}</div>{view.hafalanBreakdown && <div className="hb">{view.hafalanBreakdown}</div>}</div>
        <div className="tl bn-month"><div className="b-k"><I.cal />Kehadiran {monthName(now)}</div><div className="b-v">{m.attended}<small>/ {m.total} hari</small></div><Days days={m.days} /><Legend monthly={m} /></div>
        <div className="tl bn-bdg"><div className="b-k"><I.spark />{view.character || 'Badge'}</div><Badges badges={view.badges} /></div>
        {view.quote && <div className="tl blue bn-q"><span className="qm">“</span>{view.quote}</div>}
      </div>
    );
  } else if (view.kind === 'guru') {
    const icons = [I.cal, I.clock, I.fire, I.users];
    body = (
      <div className="ctr">
        <div className="bn-grid bn-g fadein">
          <div className="tl bn-gid">
            <Avatar name={view.name} photo={view.photo} late={view.late} showOk={view.success} />
            <h2>{view.name}</h2><div className="meta">{view.meta}</div>
            <div className="cr"><StatusChip view={view} />{view.time && <span className="chip"><I.clock />{view.time}</span>}</div>
          </div>
          {view.stats.map(([k, v, unit], i) => {
            const Icon = icons[i % icons.length];
            return <div key={k} className={`tl bn-h ${i === 0 ? 'ink' : ''}`}><div className="b-k"><Icon />{k}</div><div className="b-v" style={String(v).length > 6 ? { fontSize: 26 } : undefined}>{v}{unit && <small>{unit}</small>}</div></div>;
          })}
          <div className="tl blue bn-q"><span className="qm">“</span>{view.note}</div>
        </div>
      </div>
    );
  } else if (view.kind === 'list') {
    body = <div className="bn-grid"><ListBody view={view} className="tl" /></div>;
  } else {
    body = (
      <div className="ctr"><div className="bn-grid fadein">
        <div className={`tl bn-err tone-${view.tone}`}><div className="ic"><MsgIcon tone={view.tone} /></div><h3>{view.title}</h3><p>{view.text}</p>{view.tag && <span className="chip">{view.tag}</span>}</div>
      </div></div>
    );
  }
  return {
    bg: <><div className="dots" /><div className="gr" /></>,
    html: (
      <>
        {head}
        <div className="bn-top">
          <div className="tl bn-clock"><div className="b-k"><I.clock />Waktu Baturaja</div><div className="t">{fmtT(now)}</div></div>
          <div className="tl ink bn-date">
            <div className="b-k" style={{ opacity: 0.6 }}>{p.weekday}</div>
            <div><div className="day">{p.day}</div><div className="mo">{p.month} {p.year}</div></div>
            <div className="bn-sesi"><i />{session ? `Sesi ${session.name}` : 'Tidak ada sesi'}</div>
          </div>
        </div>
        <div className="result">{body}</div>
        <div className="tl bn-scan"><I.nfc /><ScanInput input={input} /><kbd>Tap kartu</kbd></div>
        <div className="bn-foot"><span>LPQ Al-Fath Maulana</span><span>Baturaja · v6</span></div>
      </>
    ),
  };
};

/* ---------------- SPATIAL ---------------- */
const Seg = ({ n, total }) => <div className="seg">{Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</div>;
const SegAtt = ({ days }) => <div className="seg">{days.map((d, i) => <i key={i} className={`att ${d}`} />)}</div>;

export const SpatialTheme = ({ view, now, session, stats, input, head }) => {
  const dd = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Jakarta' }).format(now).replace('/', '.');
  const yy = new Intl.DateTimeFormat('id-ID', { year: 'numeric', timeZone: 'Asia/Jakarta' }).format(now);
  const recent = stats?.recent || [];
  const log = (
    <div className="d-log ed">
      <div className="hd"><span>LOG MASUK</span><span>{recent.length ? `${recent.length} TERAKHIR` : 'BELUM ADA'}</span></div>
      {recent.map((l) => <div key={`${l.id}-${l.time}`} className="ln"><span>{l.time}</span><span>{l.name}</span><span className={`st${l.late ? ' late' : ''}`}>{l.late ? 'TERLAMBAT' : 'HADIR'}</span></div>)}
    </div>
  );
  const col = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };
  let body = null;
  if (view.kind === 'ready') {
    body = (
      <div className="fadein" style={col}>
        <div className="d-center">
          <div className="d-radar"><HackFx a="RFID 13.56MHZ" b={view.processing ? 'READING' : 'STANDBY'} bare /><ScanIcon theme="spatial" /></div>
          <div className="d-ready"><span className="k">ASSALAMU&apos;ALAIKUM</span><h3>{readyTitle(view, 'Menunggu kartu')}</h3><p>Tempelkan kartu RFID ke pembaca di bawah layar.</p></div>
        </div>
        <div className="d-tele ed c3">{readyStats(stats).map((s) => <div key={s[1]}><span className="k">{s[2].toUpperCase()}</span><span className="v">{s[0]}</span></div>)}</div>
        {log}
      </div>
    );
  } else if (view.kind === 'santri') {
    const m = view.monthly;
    body = (
      <div className="fadein" style={col}>
        <div className="d-stage">
          <div className="d-hero">
            <div className="d-orbit"><HackFx a={`ID ${view.tag || '------'}`} b="VERIFIED" /><Avatar name={view.name} photo={view.photo} late={view.late} /></div>
            {view.tier && (
              <div className="d-rank ed">
                <span className="br c1" /><span className="br c2" /><span className="br c3" /><span className="br c4" />
                <span className="k">RANK SANTRI</span><TierImg tier={view.tier} /><b>{view.tier.label.toUpperCase()}</b>
                <Seg n={Math.round((view.tier.ratio || 0) * 10)} total={10} /><small>{tierNextText(view.tier, true)}</small>
              </div>
            )}
          </div>
          <h2 className="d-name">{view.name}</h2><div className="d-meta">{view.meta}</div>
          <div className="d-chips"><StatusChip view={view} upper /><span className="chip"><I.clock />{view.timeFull}</span></div>
          {view.notice && <div className="atk-notice">{view.notice}</div>}
        </div>
        <div className="d-tele ed c3">
          <div><span className="k">POIN</span><span className="v"><CountUp value={view.points} /><Award value={view.pointsAward} /></span></div>
          <div><span className="k">JILID</span><span className="v">{String(view.jilid).padStart(2, '0')}</span></div>
          <div><span className="k">TOTAL HAFALAN</span><span className="v">{view.hafalan}</span>{view.hafalanBreakdown && <span className="hb">{view.hafalanBreakdown.toUpperCase()}</span>}</div>
          <div><span className="k">KEHADIRAN {monthName(now).slice(0, 3).toUpperCase()}</span><span className="v">{m.attended}<small>/{m.total}</small></span><SegAtt days={m.days} /></div>
          <div><span className="k">KARAKTER</span><span className="v" style={{ fontSize: 18 }}>{(view.character || '–').toUpperCase()}</span></div>
          <div><span className="k">BADGE</span><Badges badges={view.badges} /></div>
        </div>
        {view.quote && <div className="d-quote ed"><b>&gt;</b> {view.quote}</div>}
        {log}
      </div>
    );
  } else if (view.kind === 'guru') {
    body = (
      <div className="fadein" style={col}>
        <div className="ctr">
          <div className="d-stage">
            <div className="d-orbit solo"><HackFx a={`ID ${view.tag || '------'}`} b={view.success ? 'VERIFIED' : 'OFF-SHIFT'} /><Avatar name={view.name} photo={view.photo} late={view.late} showOk={view.success} /></div>
            <h2 className="d-name">{view.name}</h2><div className="d-meta">{view.meta}</div>
            <div className="d-chips"><StatusChip view={view} upper />{view.timeFull && <span className="chip"><I.clock />{view.timeFull}</span>}</div>
          </div>
          {view.stats.length > 0 && (
            <div className="d-tele ed c2">
              {view.stats.map(([k, v, unit]) => (
                <div key={k}><span className="k">{k.toUpperCase()}</span><span className="v" style={String(v).length > 8 ? { fontSize: 18 } : undefined}>{String(v).toUpperCase()}{unit && <small>{unit.toUpperCase()}</small>}</span>{k === 'Streak' && <Seg n={Math.min(Number(v) || 0, 14)} total={14} />}</div>
              ))}
            </div>
          )}
          <div className="d-quote ed"><b>&gt;</b> {view.note}</div>
        </div>
        {log}
      </div>
    );
  } else if (view.kind === 'list') {
    body = <div className="fadein" style={col}><ListBody view={view} className="ed" />{log}</div>;
  } else {
    body = (
      <div className="fadein" style={col}>
        <div className="ctr"><div className={`d-err ed tone-${view.tone}`} style={{ marginTop: 0 }}><div className="ic"><MsgIcon tone={view.tone} /></div><span className="k">{view.eyebrow.toUpperCase()}</span><h3>{view.title}</h3><p>{view.text}</p>{view.tag && <span className="chip">{view.tag}</span>}</div></div>
        {log}
      </div>
    );
  }
  return {
    bg: <><div className="glow" /><div className="lines" /><div className="kh" /><div className="scan" /><div className="gr" /></>,
    html: (
      <>
        {head}
        <div className="d-strip ed">
          <div><span className="k">WAKTU · WIB</span><span className="v big"><span>{fmtT(now)}</span><small>:{fmtS(now)}</small></span></div>
          <div><span className="k">SESI AKTIF</span><span className="v">{session?.running ? session.name.toUpperCase() : '—'}</span></div>
          <div><span className="k">TANGGAL</span><span className="v">{dd}<small>.{yy}</small></span></div>
        </div>
        <div className="result">{body}</div>
        <div className="d-term ed"><span className="p">&gt;</span><ScanInput input={input} placeholder="menunggu_kartu" /><span className="tag">{input.isLoading ? 'RFID · BACA' : 'RFID · SIAP'}</span></div>
        <div className="d-foot"><span>LPQ AL-FATH MAULANA</span><span>SYS v6.0 · ONLINE</span></div>
      </>
    ),
  };
};

export const THEME_RENDERERS = { glass: GlassTheme, aurora: AuroraTheme, bento: BentoTheme, spatial: SpatialTheme };
export { nf };
