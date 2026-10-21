'use client';

import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { useState } from 'react';
import { put } from '@/lib/api/client';
import { motion } from '@/components/motion';
import { cn } from '@/lib/utils';

export const TOPICS: Record<string, string> = {
  academics: 'Academics',
  placements: 'Placements',
  hostel: 'Hostel',
  mental_health: 'Feeling low',
  relationships: 'Relationships',
  faculty: 'Faculty',
  campus: 'Campus',
  career: 'Career',
  other: 'Other',
};

/** Up and down votes that update at once and settle on the server's count. */
export function VoteControl({ path, value, count, onChange, field = 'votesCount' }: { path: string; value: number; count: number; onChange: (v: number, count: number) => void; field?: 'votesCount' | 'score' }) {
  const [busy, setBusy] = useState(false);
  const cast = async (next: number) => {
    if (busy) return;
    const target = value === next ? 0 : next;
    const optimistic = count - value + target;
    onChange(target, optimistic);
    setBusy(true);
    try {
      const r = await put<Record<string, number>>(path, { value: target });
      onChange(target, r[field] ?? optimistic);
    } catch {
      onChange(value, count);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-center gap-0.5" role="group" aria-label="Vote">
      <motion.button type="button" whileTap={{ scale: 0.8 }} onClick={() => void cast(1)} aria-pressed={value === 1} aria-label="Vote up" className={cn('grid h-8 w-8 place-items-center rounded-full', value === 1 ? 'text-accent' : 'text-text-3 hover:bg-surface-2')}>
        <ArrowBigUp className={cn('h-6 w-6', value === 1 && 'fill-current')} aria-hidden="true" />
      </motion.button>
      <motion.span key={count} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-[14px] font-bold tabular-nums">{count}</motion.span>
      <motion.button type="button" whileTap={{ scale: 0.8 }} onClick={() => void cast(-1)} aria-pressed={value === -1} aria-label="Vote down" className={cn('grid h-8 w-8 place-items-center rounded-full', value === -1 ? 'text-danger' : 'text-text-3 hover:bg-surface-2')}>
        <ArrowBigDown className={cn('h-6 w-6', value === -1 && 'fill-current')} aria-hidden="true" />
      </motion.button>
    </div>
  );
}
