import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, Check, Loader2, Printer, RotateCcw, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { getPublicContentErrorMessage, saveWebsiteContentItem } from '@/lib/publicContentAdapters';
import {
  BADGE_GENDERS, getBadgeWinner, listBadgeSessions, normalizeBadgeConfig, normalizeBadgeGender, normalizeBadgePrivileges,
  resolveSantriBadgeSession, SANTRI_BADGE_PRIVILEGES_KEY, SANTRI_BADGES, SANTRI_BADGES_KEY, setBadgeWinner,
} from '@/lib/santriBadges';
import SantriBadgePrivilegesEditor from '@/components/dashboard/admin/SantriBadgePrivilegesEditor';
import SantriAchievementBadge from '@/components/dashboard/shared/SantriAchievementBadge';
import { buildBadgePosterHtml, collectPosterPages } from '@/lib/santriBadgePoster';
import { OFFICIAL_CONTACT } from '@/lib/institutionContent';
import { loadAvatar } from '@/components/dashboard/assistant/cardExport';
import { DISCIPLINE_MIN_RATE, DISCIPLINE_WINDOW_DAYS, rankDiscipline, rankHafalan } from '@/lib/santriBadgeRecommendations';

const NONE = '__none__';

// Gambar ditanam sebagai data URL agar berkas HTML cetak tetap lengkap saat disimpan dan dibuka tanpa internet.
const toDataUrl = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const loadBadgeData = async () => {
  const [santriResult, configResult, privilegesResult] = await Promise.all([
    supabase
      .from('santri')
      .select('id, nama_lengkap, jenis_kelamin, sesi_mengaji, kategori, class:current_class_id(sesi)')
      .eq('status', 'Aktif')
      .order('nama_lengkap', { ascending: true }),
    supabase.from('website_content').select('content').eq('key', SANTRI_BADGES_KEY).maybeSingle(),
    supabase.from('website_content').select('content').eq('key', SANTRI_BADGE_PRIVILEGES_KEY).maybeSingle(),
  ]);
  if (santriResult.error) throw santriResult.error;
  if (configResult.error) throw configResult.error;
  const santri = (santriResult.data || []).filter((row) => row.kategori !== 'Dewasa');
  // Hak istimewa belum pernah disimpan atau gagal dibaca → contoh bawaan.
  const privileges = normalizeBadgePrivileges(privilegesResult.error ? null : privilegesResult.data?.content);
  return { santri, config: normalizeBadgeConfig(configResult.data?.content), privileges };
};

const PAGE_SIZE = 1000;

// Supabase membatasi 1000 baris per permintaan, jadi data diambil per halaman.
const fetchAllRows = async (buildQuery) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
};

const loadRecommendationData = async () => {
  const since = new Date(Date.now() - DISCIPLINE_WINDOW_DAYS * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [attendance, progress] = await Promise.all([
    fetchAllRows(() => supabase
      .from('attendance')
      .select('id, user_id, attendance_date, check_in_timestamp, sesi, status, source')
      .eq('role', 'santri')
      .gte('attendance_date', since)
      .order('id', { ascending: true })),
    fetchAllRows(() => supabase
      .from('hafalan_progress')
      .select('id, santri_id, status, score')
      .order('id', { ascending: true })),
  ]);
  return { attendance, progress };
};

const RECOMMENDED_BADGES = {
  terdisiplin: {
    hint: `Konsisten paling awal datang (tap RFID / wajah) dalam ${DISCIPLINE_WINDOW_DAYS} hari terakhir, hadir minimal ${Math.round(DISCIPLINE_MIN_RATE * 100)}% hari sesinya.`,
    detail: (c) => `Median datang ${c.medianTime} · hadir ${c.attended}/${c.sessionDays} hari`,
  },
  hafalan: {
    hint: 'Jumlah item hafalan yang sudah tuntas (lulus atau skor 4).',
    detail: (c) => `${c.completed} hafalan tuntas${c.averageScore ? ` · rata-rata skor ${c.averageScore.toFixed(1)}` : ''}`,
  },
};

const SantriBadgeManager = () => {
  const [santri, setSantri] = useState([]);
  const [saved, setSaved] = useState({ awards: {} });
  const [draft, setDraft] = useState({ awards: {} });
  const [sesi, setSesi] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [recs, setRecs] = useState({ status: 'idle', terdisiplin: {}, hafalan: {} });
  const [isPrinting, setIsPrinting] = useState(false);
  const [privileges, setPrivileges] = useState(() => normalizeBadgePrivileges(null));

  const loadRecommendations = async (santriList) => {
    setRecs((current) => ({ ...current, status: 'loading' }));
    try {
      const { attendance, progress } = await loadRecommendationData();
      setRecs({
        status: 'ready',
        terdisiplin: rankDiscipline({ attendance, santri: santriList }),
        hafalan: rankHafalan({ progress, santri: santriList }),
      });
    } catch (recError) {
      setRecs({ status: 'error', terdisiplin: {}, hafalan: {}, message: getPublicContentErrorMessage(recError) });
    }
  };

  const load = async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await loadBadgeData();
      setSantri(data.santri);
      setSaved(data.config);
      setDraft(data.config);
      setPrivileges(data.privileges);
      setStatus('ready');
      loadRecommendations(data.santri);
    } catch (loadError) {
      setError(getPublicContentErrorMessage(loadError));
      setStatus('error');
    }
  };

  useEffect(() => { load(); }, []);

  const sessions = useMemo(() => listBadgeSessions(santri), [santri]);
  useEffect(() => {
    if (sessions.length && !sessions.includes(sesi)) setSesi(sessions[0]);
  }, [sessions, sesi]);

  const byId = useMemo(() => new Map(santri.map((row) => [row.id, row])), [santri]);
  const options = useMemo(() => {
    const grouped = { putra: [], putri: [] };
    santri.forEach((row) => {
      const gender = normalizeBadgeGender(row.jenis_kelamin);
      if (gender && resolveSantriBadgeSession(row) === sesi) grouped[gender].push(row);
    });
    return grouped;
  }, [santri, sesi]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const posterPages = useMemo(() => collectPosterPages({ config: saved, sessions, santriById: byId }), [saved, sessions, byId]);

  // Membuka tab baru berisi halaman A4 per sesi untuk santri yang sudah disimpan sebagai pemenang badge.
  const printPoster = async () => {
    if (!posterPages.length) return;
    const win = window.open('', '_blank');
    if (!win) {
      toast({ title: 'Tab cetak diblokir', description: 'Izinkan pop-up untuk situs ini, lalu tekan Cetak A4 lagi.', variant: 'destructive' });
      return;
    }
    win.document.write('<p style="font-family:system-ui,sans-serif;padding:32px;color:#0f2f36">Menyiapkan halaman cetak…</p>');
    setIsPrinting(true);
    try {
      // Slot kosong (santri null) dilewati di sini; poster mencetaknya sebagai siluet "???".
      const ids = [...new Set(posterPages
        .flatMap((page) => page.badges.flatMap((entry) => entry.winners.map((w) => w.santri?.id)))
        .filter(Boolean))];
      const [logo, logoHalo, building, ...photoList] = await Promise.all([
        toDataUrl('/logo-lpq-al-fath-maulana.webp'),
        toDataUrl('/logo-lpq-al-fath-maulana-halo.webp'),
        toDataUrl('/institution/gedung-lpq-blur.webp'),
        ...ids.map((id) => loadAvatar(id).catch(() => null)),
      ]);
      const photos = new Map(ids.map((id, index) => [id, photoList[index]]).filter(([, url]) => url));
      const html = buildBadgePosterHtml({ pages: posterPages, photos, assets: { logo, logoHalo, building }, address: OFFICIAL_CONTACT.address, privileges });
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (printError) {
      win.close();
      toast({ title: 'Halaman cetak gagal dibuat', description: printError.message, variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };
  const filledCount = SANTRI_BADGES.reduce((total, badge) => total + BADGE_GENDERS
    .filter((gender) => getBadgeWinner(draft, { badgeId: badge.id, sesi, gender: gender.id })).length, 0);

  const choose = (badgeId, gender, value) => {
    setDraft((current) => setBadgeWinner(current, { badgeId, sesi, gender, santriId: value === NONE ? null : value }));
  };

  const save = async () => {
    setIsSaving(true);
    try {
      // Public so the attendance kiosk can show badges; it holds santri ids only, no names.
      await saveWebsiteContentItem({ key: SANTRI_BADGES_KEY, content: { ...draft, updatedAt: new Date().toISOString() }, isPublic: true });
      setSaved(draft);
      toast({ title: 'Badge tersimpan', description: 'Badge langsung tampil di profil absensi santri berikutnya.' });
    } catch (saveError) {
      toast({ title: 'Badge gagal disimpan', description: getPublicContentErrorMessage(saveError), variant: 'destructive' });
    }
    setIsSaving(false);
  };

  return (
    <section className="admin-card space-y-5 p-4 sm:p-6" aria-labelledby="santri-badge-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id="santri-badge-title" className="flex items-center gap-2 text-xl font-bold">
            <Award className="h-6 w-6 text-sky-500" aria-hidden="true" /> Badge Santri
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tiap sesi, setiap badge diberikan kepada satu santri putra dan satu santri putri. Badge tampil di profil absensi santri saat tap RFID atau absen wajah.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={printPoster} disabled={status !== 'ready' || isPrinting || posterPages.length === 0}
            title={isDirty ? 'Mencetak badge yang sudah disimpan; perubahan yang belum disimpan tidak ikut' : 'Cetak santri berprestasi per sesi dalam ukuran A4; badge yang belum dipilih tampil sebagai ???'}>
            {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="mr-2 h-4 w-4" aria-hidden="true" />}
            Cetak A4
          </Button>
          <Button type="button" variant="outline" onClick={() => setDraft(saved)} disabled={!isDirty || isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Batalkan
          </Button>
          <Button type="button" onClick={save} disabled={!isDirty || isSaving || status !== 'ready'}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
            Simpan Badge
          </Button>
        </div>
      </div>

      {status === 'loading' && (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat data santri…
        </p>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error || 'Data badge belum bisa dimuat.'}</p>
          <Button type="button" size="sm" variant="outline" onClick={load}>Coba lagi</Button>
        </div>
      )}

      {status === 'ready' && sessions.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada santri aktif yang memiliki sesi mengaji. Atur sesi santri atau kelas terlebih dahulu.
        </p>
      )}

      {status === 'ready' && sessions.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex max-w-full overflow-x-auto rounded-xl bg-muted/60 p-1" role="tablist" aria-label="Pilih sesi">
              {sessions.map((item) => (
                <button key={item} type="button" role="tab" aria-selected={sesi === item} onClick={() => setSesi(item)}
                  className={cn('min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    sesi === item ? 'bg-background text-foreground shadow-sm' : 'text-foreground/70 hover:text-foreground')}>
                  Sesi {item}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filledCount} dari {SANTRI_BADGES.length * BADGE_GENDERS.length} badge sesi {sesi} terisi{isDirty ? ' · belum disimpan' : ''}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SANTRI_BADGES.map((badge) => (
              <article key={badge.id} className="space-y-4 rounded-xl border bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div role="list" aria-label={badge.title}><SantriAchievementBadge badge={badge} size="md" /></div>
                  <h4 className="text-sm font-semibold text-foreground">{badge.title}</h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {BADGE_GENDERS.map((gender) => {
                    const fieldId = `badge-${badge.id}-${gender.id}`;
                    const winner = getBadgeWinner(draft, { badgeId: badge.id, sesi, gender: gender.id });
                    const winnerRow = winner ? byId.get(winner) : null;
                    const list = options[gender.id];
                    // Keep a saved winner selectable even if their sesi or status changed since.
                    const extra = winner && !list.some((row) => row.id === winner)
                      ? [{ id: winner, nama_lengkap: winnerRow ? `${winnerRow.nama_lengkap} (beda sesi)` : 'Santri tidak aktif' }]
                      : [];
                    return (
                      <div key={gender.id} className="grid gap-1.5">
                        <Label htmlFor={fieldId}>{gender.label}</Label>
                        <Select value={winner || NONE} onValueChange={(value) => choose(badge.id, gender.id, value)}>
                          <SelectTrigger id={fieldId} className={cn(winner && 'border-sky-400/60')}>
                            <SelectValue placeholder="Belum dipilih" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Belum dipilih</SelectItem>
                            {[...extra, ...list].map((row) => <SelectItem key={row.id} value={row.id}>{row.nama_lengkap}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {list.length === 0 && (
                          <p className="text-xs text-muted-foreground">Belum ada {gender.label.toLowerCase()} di sesi {sesi}.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {RECOMMENDED_BADGES[badge.id] && (
                  <Recommendations
                    badge={badge}
                    config={RECOMMENDED_BADGES[badge.id]}
                    recs={recs}
                    sesi={sesi}
                    draft={draft}
                    onPick={(gender, santriId) => choose(badge.id, gender, santriId)}
                    onRetry={() => loadRecommendations(santri)}
                  />
                )}
              </article>
            ))}
          </div>

          <SantriBadgePrivilegesEditor value={privileges} onSaved={setPrivileges} />
        </>
      )}
    </section>
  );
};

const Recommendations = ({ badge, config, recs, sesi, draft, onPick, onRetry }) => {
  const ranked = recs[badge.id]?.[sesi] || { putra: [], putri: [] };
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" /> Rekomendasi sesi {sesi}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{config.hint}</p>

      {recs.status === 'loading' && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Menghitung rekomendasi…
        </p>
      )}
      {recs.status === 'error' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert">
          <span>{recs.message || 'Rekomendasi belum bisa dihitung.'}</span>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={onRetry}>Coba lagi</Button>
        </div>
      )}
      {recs.status === 'ready' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BADGE_GENDERS.map((gender) => {
            const list = ranked[gender.id] || [];
            const current = getBadgeWinner(draft, { badgeId: badge.id, sesi, gender: gender.id });
            return (
              <div key={gender.id}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{gender.label}</p>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada yang memenuhi syarat.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {list.map((candidate, index) => {
                      const picked = current === candidate.santriId;
                      return (
                        <li key={candidate.santriId} className="flex items-center gap-2 rounded-md bg-background/80 px-2 py-1.5">
                          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                            index === 0 ? 'bg-amber-400 text-amber-950' : 'bg-muted text-muted-foreground')}>{index + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium" title={candidate.name}>{candidate.name}</span>
                            <span className="block text-[11px] text-muted-foreground">{config.detail(candidate)}</span>
                          </span>
                          <Button type="button" size="sm" variant={picked ? 'secondary' : 'outline'} className="h-7 shrink-0 px-2 text-xs"
                            disabled={picked} onClick={() => onPick(gender.id, candidate.santriId)}
                            aria-label={picked ? `${candidate.name} sudah dipilih` : `Pilih ${candidate.name} sebagai ${gender.label.toLowerCase()}`}>
                            {picked ? <><Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Dipilih</> : 'Pilih'}
                          </Button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SantriBadgeManager;
