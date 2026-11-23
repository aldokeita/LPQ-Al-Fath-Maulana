import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { getPublicContentErrorMessage, saveWebsiteContentItem } from '@/lib/publicContentAdapters';
import {
  BADGE_GENDERS, getBadgeWinner, listBadgeSessions, normalizeBadgeConfig, normalizeBadgeGender,
  resolveSantriBadgeSession, SANTRI_BADGES, SANTRI_BADGES_KEY, setBadgeWinner,
} from '@/lib/santriBadges';
import SantriAchievementBadge from '@/components/dashboard/shared/SantriAchievementBadge';

const NONE = '__none__';

const loadBadgeData = async () => {
  const [santriResult, configResult] = await Promise.all([
    supabase
      .from('santri')
      .select('id, nama_lengkap, jenis_kelamin, sesi_mengaji, kategori, class:current_class_id(sesi)')
      .eq('status', 'Aktif')
      .order('nama_lengkap', { ascending: true }),
    supabase.from('website_content').select('content').eq('key', SANTRI_BADGES_KEY).maybeSingle(),
  ]);
  if (santriResult.error) throw santriResult.error;
  if (configResult.error) throw configResult.error;
  const santri = (santriResult.data || []).filter((row) => row.kategori !== 'Dewasa');
  return { santri, config: normalizeBadgeConfig(configResult.data?.content) };
};

const SantriBadgeManager = () => {
  const [santri, setSantri] = useState([]);
  const [saved, setSaved] = useState({ awards: {} });
  const [draft, setDraft] = useState({ awards: {} });
  const [sesi, setSesi] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await loadBadgeData();
      setSantri(data.santri);
      setSaved(data.config);
      setDraft(data.config);
      setStatus('ready');
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
        <div className="flex shrink-0 gap-2">
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
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default SantriBadgeManager;
