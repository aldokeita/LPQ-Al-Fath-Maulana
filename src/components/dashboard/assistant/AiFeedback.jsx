import React, { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { fetchMyAiFeedback, saveAiFeedback } from '@/lib/assistantAlertAdapters';

// Penilaian 👍/👎 untuk satu hasil AI (rekomendasi, gambaran kelas, jawaban chat, rapor).
// `initial` boleh diisi dari pemuatan massal; bila undefined, komponen memuat sendiri.
const AiFeedback = ({ jenis, targetId, initial, onChange, className }) => {
  const { user } = useAuth();
  const [nilai, setNilai] = useState(initial?.nilai ?? 0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initial !== undefined) { setNilai(initial?.nilai ?? 0); return undefined; }
    if (!targetId) return undefined;
    let active = true;
    fetchMyAiFeedback(jenis, [targetId])
      .then((map) => { if (active) setNilai(map[targetId]?.nilai ?? 0); })
      .catch(() => {});
    return () => { active = false; };
  }, [jenis, targetId, initial]);

  if (!targetId || !user?.id) return null;

  const rate = async (value) => {
    const next = nilai === value ? 0 : value;
    const prev = nilai;
    setNilai(next);
    setIsSaving(true);
    try {
      await saveAiFeedback({ userId: user.id, jenis, targetId, nilai: next });
      onChange?.(next ? { nilai: next } : null);
    } catch (err) {
      setNilai(prev);
      toast({ title: 'Penilaian gagal disimpan', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const button = (value, Icon, label) => (
    <button type="button" onClick={() => rate(value)} disabled={isSaving} aria-pressed={nilai === value} aria-label={label} title={label}
      className={cn('flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        nilai === value
          ? (value > 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300')
          : 'text-foreground/55 hover:bg-muted hover:text-foreground')}>
      <Icon className="h-4 w-4" aria-hidden="true" fill={nilai === value ? 'currentColor' : 'none'} fillOpacity={0.2} />
    </button>
  );

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="group" aria-label="Nilai hasil AI">
      {button(1, ThumbsUp, 'Bermanfaat')}
      {button(-1, ThumbsDown, 'Kurang tepat')}
    </span>
  );
};

export default AiFeedback;
