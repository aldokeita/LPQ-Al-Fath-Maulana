import React, { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const toneClasses = {
  emerald: 'border-emerald-200/80 bg-emerald-50/50 text-emerald-700 dark:border-emerald-400/25 dark:bg-slate-900/70 dark:text-emerald-300',
  sky: 'border-sky-200/80 bg-sky-50/50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-300',
  violet: 'border-violet-200/80 bg-violet-50/50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-300',
  amber: 'border-amber-200/80 bg-amber-50/50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300'
};

const DashboardDisclosure = ({
  title,
  description,
  icon: Icon,
  summary,
  children,
  tone = 'emerald',
  collapsible = true,
  defaultOpen = false,
  className,
  contentClassName
}) => {
  const [isOpen, setIsOpen] = useState(collapsible ? defaultOpen : true);
  const contentId = useId();
  const prefersReducedMotion = useReducedMotion();
  const HeaderElement = collapsible ? 'button' : 'div';

  return (
    <section className={cn('overflow-hidden rounded-lg border bg-card shadow-sm', className)}>
      <HeaderElement
        {...(collapsible ? {
          type: 'button',
          'aria-expanded': isOpen,
          'aria-controls': contentId,
          onClick: () => setIsOpen((current) => !current)
        } : {})}
        className={cn(
          'flex w-full flex-col gap-4 p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-5',
          collapsible && 'cursor-pointer transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-lg border', toneClasses[tone])}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-base font-bold text-foreground sm:text-lg">{title}</span>
            {description && <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{description}</span>}
          </span>
        </div>

        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          {summary && <div className="min-w-0 flex-1 sm:flex-none">{summary}</div>}
          {collapsible && (
            <span className="flex flex-none items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="hidden sm:inline">{isOpen ? 'Tutup detail' : 'Lihat detail'}</span>
              <ChevronDown className={cn('h-5 w-5 transition-transform duration-200', isOpen && 'rotate-180')} aria-hidden="true" />
            </span>
          )}
        </div>
      </HeaderElement>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className={cn('border-t p-4 sm:p-5', contentClassName)}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default DashboardDisclosure;
