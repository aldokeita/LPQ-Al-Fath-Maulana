import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookHeart, CalendarDays, CheckCircle2, ClipboardList, Loader2, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import DevelopmentScoreSelector from '@/components/dashboard/shared/DevelopmentScoreSelector';
import DashboardDisclosure from '@/components/dashboard/shared/DashboardDisclosure';
import {
  CHARACTER_STRENGTH_OPTIONS,
  DEVELOPMENT_SCORE_OPTIONS,
  VIOLATION_LEVELS,
  fetchCharacterAssessmentItems,
  fetchSantriBehaviorRecords,
  fetchSantriCharacterScores,
  fetchSantriCharacterStrengths,
  getAcademicErrorMessage,
  getDevelopmentScoreMeta,
  saveSantriBehaviorRecord,
  setSantriCharacterStrength,
  upsertSantriCharacterScore
} from '@/lib/academicAdapters';
import { cn } from '@/lib/utils';

const today = () => new Date().toLocaleDateString('en-CA');

const levelStyles = {
  Ringan: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  Sedang: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200',
  Berat: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
};

const scoreTone = {
  slate: 'bg-slate-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500'
};

const createBehaviorForm = () => ({
  incidentDate: today(),
  level: 'Ringan',
  behavior: '',
  followUp: VIOLATION_LEVELS.Ringan.followUp,
  teacherNote: ''
});

const SantriDevelopmentProfile = ({ santriId, userId, editable = false, showBehavior = false, collapsible = false }) => {
  const [items, setItems] = useState([]);
  const [scores, setScores] = useState({});
  const [strengths, setStrengths] = useState(new Set());
  const [behaviorRecords, setBehaviorRecords] = useState([]);
  const [behaviorForm, setBehaviorForm] = useState(createBehaviorForm);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!santriId) return;
    setLoading(true);
    setError('');
    try {
      const [assessmentItems, scoreRows, strengthRows, records] = await Promise.all([
        fetchCharacterAssessmentItems(),
        fetchSantriCharacterScores(santriId),
        fetchSantriCharacterStrengths(santriId),
        showBehavior ? fetchSantriBehaviorRecords(santriId) : Promise.resolve([])
      ]);
      setItems(assessmentItems);
      setScores(Object.fromEntries(scoreRows.map((row) => [row.item_id, Number(row.score)])));
      setStrengths(new Set(strengthRows.map((row) => row.strength_key)));
      setBehaviorRecords(records);
    } catch (loadError) {
      setError(getAcademicErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [santriId, showBehavior]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scoredValues = useMemo(() => Object.values(scores).filter(Boolean), [scores]);
  const averageScore = scoredValues.length
    ? scoredValues.reduce((total, score) => total + score, 0) / scoredValues.length
    : 0;
  const averageMeta = averageScore ? getDevelopmentScoreMeta(Math.max(1, Math.round(averageScore))) : null;

  const handleScoreChange = async (itemId, score) => {
    const previousScore = scores[itemId];
    setScores((current) => ({ ...current, [itemId]: score }));
    setSavingKey(`score-${itemId}`);
    try {
      await upsertSantriCharacterScore({ santriId, itemId, score, userId });
    } catch (saveError) {
      setScores((current) => ({ ...current, [itemId]: previousScore }));
      toast({ title: 'Skor tidak tersimpan', description: getAcademicErrorMessage(saveError), variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const handleStrengthChange = async (strengthKey, selected) => {
    const previous = new Set(strengths);
    const next = new Set(strengths);
    if (selected) next.add(strengthKey);
    else next.delete(strengthKey);
    setStrengths(next);
    setSavingKey(`strength-${strengthKey}`);
    try {
      await setSantriCharacterStrength({ santriId, strengthKey, selected, userId });
    } catch (saveError) {
      setStrengths(previous);
      toast({ title: 'Karakter unggulan tidak tersimpan', description: getAcademicErrorMessage(saveError), variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const handleLevelChange = (level) => {
    setBehaviorForm((current) => ({ ...current, level, followUp: VIOLATION_LEVELS[level].followUp }));
  };

  const handleSaveBehavior = async () => {
    setSavingKey('behavior');
    try {
      await saveSantriBehaviorRecord({
        santriId,
        incidentDate: behaviorForm.incidentDate,
        level: behaviorForm.level,
        behavior: behaviorForm.behavior,
        followUp: behaviorForm.followUp,
        teacherNote: behaviorForm.teacherNote,
        userId
      });
      toast({ title: 'Catatan pelanggaran tersimpan' });
      setBehaviorForm(createBehaviorForm());
      await loadData();
    } catch (saveError) {
      toast({ title: 'Catatan tidak tersimpan', description: getAcademicErrorMessage(saveError), variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat perkembangan santri...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <DashboardDisclosure
        title="Perkembangan Karakter"
        description="Skala 1–4 membantu wali memahami proses perkembangan secara bertahap."
        icon={BookHeart}
        tone="emerald"
        collapsible={collapsible}
        summary={(
          <div className="min-w-[112px] rounded-md border bg-background/80 px-3 py-1.5 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Rata-rata</p>
            <p className="text-base font-black text-foreground">{averageScore ? averageScore.toFixed(1) : '—'}<span className="text-[10px] font-medium text-muted-foreground"> / 4</span></p>
            {averageMeta && <p className="text-[10px] font-semibold text-primary">{averageMeta.code} · {averageMeta.label}</p>}
          </div>
        )}
        contentClassName="p-0 sm:p-0"
      >
        <div className="grid grid-cols-2 gap-2 border-b bg-muted/20 p-4 sm:grid-cols-4">
            {DEVELOPMENT_SCORE_OPTIONS.map((option) => (
              <div key={option.score} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('h-2.5 w-2.5 rounded-full', scoreTone[option.tone])} aria-hidden="true" />
                <span><strong className="text-foreground">{option.score} {option.code}</strong> · {option.label}</span>
              </div>
            ))}
        </div>
        {items.length ? (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{item.item_order}</span>
                  <p className="pt-1 text-sm font-medium leading-snug">{item.item_name}</p>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <DevelopmentScoreSelector
                    value={scores[item.id]}
                    onChange={editable ? (score) => handleScoreChange(item.id, score) : undefined}
                    disabled={savingKey === `score-${item.id}`}
                    compact
                  />
                  {savingKey === `score-${item.id}` && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="p-6 text-center text-sm text-muted-foreground">Belum ada indikator karakter.</p>}
      </DashboardDisclosure>

      <DashboardDisclosure
        title="Karakter Unggulan"
        description="Kekuatan yang paling menonjol dalam keseharian santri."
        icon={Sparkles}
        tone="violet"
        collapsible={collapsible}
        summary={<span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">{strengths.size} karakter terpilih</span>}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHARACTER_STRENGTH_OPTIONS.map((strength) => {
            const selected = strengths.has(strength);
            return editable ? (
              <label key={strength} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors', selected ? 'border-violet-300 bg-violet-50 dark:border-violet-400/30 dark:bg-slate-900/70' : 'hover:bg-muted/50')}>
                <Checkbox checked={selected} onCheckedChange={(checked) => handleStrengthChange(strength, Boolean(checked))} disabled={savingKey === `strength-${strength}`} />
                <span className="text-sm font-medium">{strength}</span>
              </label>
            ) : selected ? (
              <div key={strength} className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 dark:border-violet-400/30 dark:bg-slate-900/70 dark:text-violet-200">
                <CheckCircle2 className="h-4 w-4" />{strength}
              </div>
            ) : null;
          })}
          {!editable && strengths.size === 0 && <p className="col-span-full py-4 text-center text-sm text-muted-foreground">Karakter unggulan belum ditetapkan oleh guru.</p>}
        </div>
      </DashboardDisclosure>

      {showBehavior && editable && (
        <Card className="border-orange-200/70 shadow-sm dark:border-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-orange-500" />Catatan Pelanggaran</CardTitle>
            <p className="text-sm text-muted-foreground">Catatan internal untuk pembinaan yang terarah dan dapat ditindaklanjuti.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="behavior-date">Tanggal kejadian</label>
                <Input id="behavior-date" type="date" value={behaviorForm.incidentDate} onChange={(event) => setBehaviorForm((current) => ({ ...current, incidentDate: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tingkat</label>
                <Select value={behaviorForm.level} onValueChange={handleLevelChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(VIOLATION_LEVELS).map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="behavior-description">Bentuk perilaku</label>
                <Textarea id="behavior-description" value={behaviorForm.behavior} onChange={(event) => setBehaviorForm((current) => ({ ...current, behavior: event.target.value }))} placeholder={VIOLATION_LEVELS[behaviorForm.level].examples} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="behavior-follow-up">Tindak lanjut</label>
                <Textarea id="behavior-follow-up" value={behaviorForm.followUp} onChange={(event) => setBehaviorForm((current) => ({ ...current, followUp: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="behavior-note">Catatan tambahan</label>
                <Textarea id="behavior-note" value={behaviorForm.teacherNote} onChange={(event) => setBehaviorForm((current) => ({ ...current, teacherNote: event.target.value }))} placeholder="Konteks atau perkembangan setelah pembinaan (opsional)" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={handleSaveBehavior} disabled={savingKey === 'behavior' || !behaviorForm.behavior.trim() || !behaviorForm.followUp.trim()}>
                  {savingKey === 'behavior' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Simpan Catatan
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {behaviorRecords.map((record) => (
                <article key={record.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className={levelStyles[record.level]}>{record.level}</Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{new Date(`${record.incident_date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{record.behavior}</p>
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div><p className="text-xs font-bold uppercase text-muted-foreground">Tindak lanjut</p><p className="mt-1">{record.follow_up}</p></div>
                    <div><p className="text-xs font-bold uppercase text-muted-foreground">Catatan guru</p><p className="mt-1">{record.teacher_note || 'Tidak ada catatan tambahan.'}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Dicatat oleh {record.guru?.nama || 'Guru pengampu'}</p>
                </article>
              ))}
              {!behaviorRecords.length && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-6 w-6" />Belum ada catatan pelanggaran.</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SantriDevelopmentProfile;
