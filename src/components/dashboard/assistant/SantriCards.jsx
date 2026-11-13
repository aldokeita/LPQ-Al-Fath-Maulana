import React from 'react';
import { fillPesan, limitList } from '@/lib/santriCards';

// Kartu santri berukuran tetap 540×675 (diekspor 2× menjadi 1080×1350, rasio 4:5 untuk WhatsApp).
// Warna ditulis langsung (bukan token tema) agar hasil ekspor sama di mode terang maupun gelap.
export const CARD_W = 540;
export const CARD_H = 675;

const LOGO = '/logo-lpq-al-fath-maulana.webp';
const ARABIC = "'Amiri', 'Noto Naskh Arabic', 'Scheherazade New', serif";
const SANS = "'Outfit', 'Poppins', system-ui, sans-serif";

// Pola bintang delapan khas geometri Islam, sangat tipis sebagai tekstur.
const StarPattern = ({ id, color, opacity }) => (
  <svg width={CARD_W} height={CARD_H} style={{ position: 'absolute', inset: 0, opacity }} aria-hidden="true">
    <defs>
      <pattern id={id} width="54" height="54" patternUnits="userSpaceOnUse">
        <path d="M27 6l6 15 15 6-15 6-6 15-6-15-15-6 15-6z" fill="none" stroke={color} strokeWidth="1" />
        <rect x="18" y="18" width="18" height="18" fill="none" stroke={color} strokeWidth="0.8" transform="rotate(45 27 27)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

const Blob = ({ style }) => <div aria-hidden="true" style={{ position: 'absolute', borderRadius: '9999px', filter: 'blur(60px)', ...style }} />;

const Brand = ({ dark }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 46, height: 46, borderRadius: 9999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: dark ? '0 0 0 3px rgba(251,191,36,0.35)' : '0 0 0 3px rgba(13,148,136,0.18)' }}>
      <img src={LOGO} alt="" width={38} height={38} style={{ width: 38, height: 38, objectFit: 'contain' }} crossOrigin="anonymous" />
    </div>
    <div style={{ lineHeight: 1.15 }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 15, letterSpacing: 0.6, color: dark ? '#fff' : '#0f2f36' }}>LPQ Al-Fath Maulana</div>
      <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase', color: dark ? '#fcd34d' : '#b7791f' }}>Metode Qiroati</div>
    </div>
  </div>
);

const Signature = ({ guru, dark, label = 'Guru Pengajar' }) => (
  <div style={{ textAlign: 'right', minWidth: 170 }}>
    <div style={{ height: 1, background: dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,47,54,0.25)', marginBottom: 8 }} />
    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: dark ? '#fff' : '#0f2f36' }}>{guru || 'Guru LPQ Al-Fath Maulana'}</div>
    <div style={{ fontFamily: SANS, fontSize: 11, color: dark ? 'rgba(255,255,255,0.65)' : '#5b7479' }}>{label}</div>
  </div>
);

// ===== Kartu apresiasi kenaikan jilid =====

export const JilidCard = React.forwardRef(({ data, pesan, guru }, ref) => (
  <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28,
    background: 'linear-gradient(160deg, #052e36 0%, #0b3a52 48%, #1e1b4b 100%)', color: '#fff', fontFamily: SANS }}>
    <Blob style={{ width: 340, height: 340, top: -120, right: -90, background: 'rgba(34,211,238,0.45)' }} />
    <Blob style={{ width: 300, height: 300, bottom: -110, left: -100, background: 'rgba(139,92,246,0.45)' }} />
    <Blob style={{ width: 220, height: 220, top: 250, left: 170, background: 'rgba(20,184,166,0.28)' }} />
    <StarPattern id="star-jilid" color="#ffffff" opacity={0.06} />

    <div style={{ position: 'relative', height: '100%', padding: 40, display: 'flex', flexDirection: 'column' }}>
      <Brand dark />

      <div style={{ marginTop: 34, textAlign: 'center' }}>
        <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 9999, fontSize: 11, fontWeight: 700, letterSpacing: 2.6,
          textTransform: 'uppercase', color: '#fde68a', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)' }}>
          Kartu Apresiasi
        </span>
        <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC, fontSize: 52, lineHeight: 1.5, marginTop: 10, color: '#fcd34d',
          textShadow: '0 4px 24px rgba(251,191,36,0.35)' }}>
          مَا شَاءَ اللهُ
        </div>
        <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Selamat naik jilid,</div>
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, marginTop: 6, letterSpacing: -0.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {data.namaLengkap || data.panggilan}
        </div>
      </div>

      <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        {data.dari && (
          <>
            <span style={{ padding: '10px 18px', borderRadius: 16, fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}>{data.dari}</span>
            <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">
              <path d="M2 10h26M21 3l8 7-8 7" fill="none" stroke="#fcd34d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
        <span style={{ padding: '12px 22px', borderRadius: 18, fontSize: 24, fontWeight: 800, color: '#06282f',
          background: 'linear-gradient(135deg, #fde68a 0%, #5eead4 100%)', boxShadow: '0 10px 30px rgba(94,234,212,0.35)' }}>
          {data.adaRiwayat ? data.ke : `Kini di ${data.ke}`}
        </span>
      </div>

      <p style={{ marginTop: 26, marginBottom: 0, fontSize: 15, lineHeight: 1.6, textAlign: 'center', color: 'rgba(255,255,255,0.88)',
        padding: '0 8px', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {fillPesan(pesan, { nama: data.panggilan, ke: data.ke })}
      </p>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>{data.adaRiwayat ? 'Tanggal naik' : 'Tanggal'}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{data.tanggal}</div>
        </div>
        <Signature guru={guru} dark />
      </div>
    </div>
  </div>
));
JilidCard.displayName = 'JilidCard';

// ===== Kartu profil kehadiran & hafalan =====

const DOT = {
  hadir: { background: '#10b981' },
  koreksi: { background: '#38bdf8' },
  terlambat: { background: '#f59e0b' },
  absen: { background: 'transparent', border: '2.5px solid #f43f5e' },
};

const Ring = ({ pct }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  const value = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const color = pct === null ? '#cbd5e1' : pct >= 75 ? '#0d9488' : '#f43f5e';
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e2eef0" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 44 44)" />
      <text x="44" y="50" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="19" fill="#0f2f36">
        {pct === null ? '–' : `${pct}%`}
      </text>
    </svg>
  );
};

const Panel = ({ title, children, style }) => (
  <div style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid #dbeaec', borderRadius: 20, padding: '14px 16px',
    boxShadow: '0 8px 24px rgba(15,47,54,0.06)', ...style }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: '#0f766e', marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);

const ScoreDots = ({ skor }) => (
  <span style={{ display: 'inline-flex', gap: 3, marginLeft: 8, verticalAlign: 'middle' }}>
    {[1, 2, 3, 4].map((i) => (
      <span key={i} style={{ width: 7, height: 7, borderRadius: 9999, background: i <= skor ? '#f59e0b' : '#e2e8f0' }} />
    ))}
  </span>
);

export const ProfilCard = React.forwardRef(({ data, pesan, guru }, ref) => {
  const { kehadiran: k, hafalan: h } = data;
  const hafal = limitList(h.sudahHafal, 9);
  const latih = limitList(h.dilatih, 4);
  const belum = limitList(h.belumDinilaiList || [], Math.max(0, Math.min(5, 8 - hafal.shown.length - latih.shown.length)));
  return (
    <div ref={ref} style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden', borderRadius: 28,
      background: 'linear-gradient(165deg, #f4fbfb 0%, #eef6fb 55%, #f3f0ff 100%)', color: '#0f2f36', fontFamily: SANS }}>
      <Blob style={{ width: 300, height: 300, top: -140, right: -80, background: 'rgba(45,212,191,0.35)' }} />
      <Blob style={{ width: 260, height: 260, bottom: -120, left: -90, background: 'rgba(167,139,250,0.35)' }} />
      <StarPattern id="star-profil" color="#0f766e" opacity={0.05} />

      <div style={{ position: 'relative', height: '100%', padding: '30px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand />
          <div style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: '#5b7479', lineHeight: 1.4 }}>
            Profil Perkembangan<br /><span style={{ color: '#0f766e' }}>{data.bulan}</span>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 27, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.namaLengkap || data.panggilan}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {data.jilid && <span style={{ padding: '5px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}>{data.jilid}</span>}
            <span style={{ padding: '5px 12px', borderRadius: 9999, fontSize: 12.5, fontWeight: 700, color: '#92400e', background: '#fef3c7' }}>★ {data.poin.toLocaleString('id-ID', { maximumFractionDigits: 1 })} poin</span>
          </div>
        </div>

        <Panel title="Kehadiran 4 pekan">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Ring pct={k.persen} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {k.total ? `Hadir ${k.hadir} dari ${k.total} sesi` : 'Belum ada sesi tercatat'}
              </div>
              {k.sesi.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {k.sesi.map((s, i) => <span key={i} style={{ width: 16, height: 16, borderRadius: 9999, boxSizing: 'border-box', ...(DOT[s] || DOT.hadir) }} />)}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#5b7479', marginTop: 6 }}>
                    10 sesi terakhir · <span style={{ color: '#10b981' }}>●</span> hadir · <span style={{ color: '#f59e0b' }}>●</span> terlambat · <span style={{ color: '#f43f5e' }}>○</span> tidak hadir
                  </div>
                </>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Hafalan" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {h.wajibTotal > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600 }}>
                <span>Hafalan wajib {data.jilid}</span>
                <span>{h.wajibAman}/{h.wajibTotal} sudah hafal</span>
              </div>
              <div style={{ height: 9, borderRadius: 9999, background: '#e2eef0', marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${h.persen || 0}%`, height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg, #14b8a6, #8b5cf6)' }} />
              </div>
            </div>
          )}
          {hafal.shown.length === 0 && latih.shown.length === 0 ? (
            <div style={{ fontSize: 13, color: '#5b7479' }}>Belum ada hafalan yang dinilai{h.belumDinilai ? `; ${h.belumDinilai} materi wajib menunggu dinilai.` : '.'}</div>
          ) : (
            <>
              {hafal.shown.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 6 }}>Sudah hafal</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {hafal.shown.map((m) => <span key={m} style={{ padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, color: '#065f46', background: '#d1fae5' }}>✓ {m}</span>)}
                    {hafal.more > 0 && <span style={{ padding: '4px 10px', borderRadius: 9999, fontSize: 12, color: '#065f46', background: '#ecfdf5' }}>+{hafal.more} lainnya</span>}
                  </div>
                </>
              )}
              {latih.shown.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', margin: '10px 0 4px' }}>Sedang dilatih</div>
                  {latih.shown.map((d) => (
                    <div key={d.materi} style={{ fontSize: 12.5, lineHeight: 1.7 }}>{d.materi}<ScoreDots skor={d.skor} /></div>
                  ))}
                  {latih.more > 0 && <div style={{ fontSize: 11.5, color: '#5b7479' }}>+{latih.more} materi lainnya</div>}
                </>
              )}
              {h.belumDinilai > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '10px 0 6px' }}>Belum dinilai ({h.belumDinilai})</div>
                  {belum.shown.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {belum.shown.map((m) => <span key={m} style={{ padding: '4px 10px', borderRadius: 9999, fontSize: 12, color: '#334155', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>{m}</span>)}
                      {belum.more > 0 && <span style={{ padding: '4px 10px', fontSize: 12, color: '#64748b' }}>+{belum.more} lainnya</span>}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Panel>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <p style={{ flex: 1, margin: 0, fontSize: 13, lineHeight: 1.5, color: '#134e4a', background: 'rgba(20,184,166,0.1)', borderRadius: 14,
            padding: '10px 12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {fillPesan(pesan, { nama: data.panggilan })}
          </p>
          <Signature guru={guru} label={data.tanggal} />
        </div>
      </div>
    </div>
  );
});
ProfilCard.displayName = 'ProfilCard';
