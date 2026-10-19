'use client';

import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { appActions, useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Up/down vote control. Vertical on thread cards, horizontal on comments. */
export function Vote({ id, base, direction = 'vertical' }: { id: string; base: number; direction?: 'vertical' | 'horizontal' }) {
  const vote = useAppState((s) => s.votes[id] ?? 0);
  const score = base + vote;
  return (
    <div
      className={cn(
        'flex shrink-0 items-center rounded-full bg-surface-2',
        direction === 'vertical' ? 'w-12 flex-col rounded-2xl py-1.5' : 'h-8 gap-0.5 px-1',
      )}
      role="group"
      aria-label={`Score ${score}`}
    >
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={vote === 1}
        onClick={(e) => {
          e.preventDefault();
          appActions.vote(id, 1);
        }}
        className={cn('press grid place-items-center rounded-full', direction === 'vertical' ? 'h-8 w-8' : 'h-7 w-7', vote === 1 ? 'text-accent' : 'text-text-3 hover:text-text')}
      >
        <ArrowBigUp className={cn('h-5 w-5', vote === 1 && 'fill-current')} aria-hidden="true" />
      </button>
      <span className={cn('min-w-6 text-center text-sm font-bold tabular-nums', vote === 1 && 'text-accent', vote === -1 && 'text-danger')}>{score}</span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={vote === -1}
        onClick={(e) => {
          e.preventDefault();
          appActions.vote(id, -1);
        }}
        className={cn('press grid place-items-center rounded-full', direction === 'vertical' ? 'h-8 w-8' : 'h-7 w-7', vote === -1 ? 'text-danger' : 'text-text-3 hover:text-text')}
      >
        <ArrowBigDown className={cn('h-5 w-5', vote === -1 && 'fill-current')} aria-hidden="true" />
      </button>
    </div>
  );
}
