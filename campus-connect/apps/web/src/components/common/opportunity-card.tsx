'use client';

import Link from 'next/link';
import { Bookmark, Clock, MapPin } from 'lucide-react';
import type { Opportunity } from '@/lib/types';
import { appActions, useAppState } from '@/lib/store';
import { daysUntil, deadlineLabel } from '@/lib/time';
import { gradientFor, initials } from '@/lib/visuals';
import { cn } from '@/lib/utils';

export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const saved = useAppState((s) => s.saved.includes(opportunity.id));
  const stage = useAppState((s) => s.applications[opportunity.id]);
  const left = daysUntil(opportunity.deadline);
  const urgent = left <= 3;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/40">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-base font-semibold text-white"
          style={{ background: `${gradientFor(opportunity.seed)}` }}
        >
          {initials(opportunity.org)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-text-3">{opportunity.org}</p>
          <Link href={`/opportunities/${opportunity.id}`} className="line-clamp-2 text-[16px] font-semibold leading-snug after:absolute after:inset-0 hover:underline">
            {opportunity.title}
          </Link>
        </div>
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save opportunity'}
          onClick={() => appActions.toggleSaved(opportunity.id)}
          className={cn('press relative z-10 -mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface-2', saved ? 'text-accent' : 'text-text-3')}
        >
          <Bookmark className={cn('h-5 w-5', saved && 'fill-current')} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-semibold">
        <span className="hand-label bg-mark-soft px-2.5 py-1 text-mark">{opportunity.kind}</span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-text-2">{opportunity.mode}</span>
        <span className="rounded-full bg-success-soft px-2.5 py-1 text-success">{opportunity.pay}</span>
        {stage && <span className="rounded-full bg-info-soft px-2.5 py-1 text-info">{stage}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-text-3">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {opportunity.location}
        </span>
        <span className={cn('flex items-center gap-1.5', urgent && 'font-semibold text-danger')}>
          {urgent && left >= 0 ? <span className="animate-breathe h-2 w-2 rounded-full bg-danger" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
          {deadlineLabel(opportunity.deadline)}
        </span>
      </div>
    </article>
  );
}
