import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEVELOPMENT_SCORE_OPTIONS, getDevelopmentScoreMeta } from '@/lib/academicAdapters';

const toneClasses = {
  slate: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  amber: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  sky: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
  emerald: 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
};

const DevelopmentScoreSelector = ({ value, onChange, disabled = false, compact = false }) => {
  const selected = value ? getDevelopmentScoreMeta(value) : null;

  if (!onChange) {
    if (!selected) return <span className="text-xs text-muted-foreground">Belum dinilai</span>;
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', toneClasses[selected.tone])}
        title={selected.label}
      >
        {selected.score === 4 && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        {selected.score} · {selected.code}
      </span>
    );
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-4 gap-1" role="group" aria-label="Pilih skor perkembangan">
      {DEVELOPMENT_SCORE_OPTIONS.map((option) => {
        const isSelected = Number(value) === option.score;
        return (
          <button
            key={option.score}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.score)}
            className={cn(
              'min-h-9 rounded-md border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
              compact ? 'w-full min-w-0 px-1' : 'w-full min-w-0 px-2',
              isSelected ? toneClasses[option.tone] : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
            aria-pressed={isSelected}
            aria-label={`${option.score}, ${option.label}`}
            title={`${option.score} — ${option.code}: ${option.label}`}
          >
            {option.score}
          </button>
        );
      })}
    </div>
  );
};

export default DevelopmentScoreSelector;
