'use client';

import { useRef, useState } from 'react';
import { Card, PageHeader } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'waiting' | 'go' | 'result' | 'early';
const ROUNDS = 5;

function verdict(ms: number) {
  if (ms < 220) return 'Lightning. Are you a goalkeeper?';
  if (ms < 280) return 'Sharp and steady.';
  if (ms < 360) return 'Solid — right around average.';
  return 'Take a breath and try again.';
}

export default function ReflexGamePage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);

  const done = times.length >= ROUNDS;
  const average = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  const arm = () => {
    setPhase('waiting');
    setLast(null);
    const delay = 1200 + Math.random() * 2600;
    timer.current = window.setTimeout(() => {
      startedAt.current = performance.now();
      setPhase('go');
    }, delay);
  };

  const tap = () => {
    if (phase === 'idle' || phase === 'result' || phase === 'early') {
      if (done) setTimes([]);
      arm();
      return;
    }
    if (phase === 'waiting') {
      if (timer.current) window.clearTimeout(timer.current);
      setPhase('early');
      return;
    }
    const ms = Math.round(performance.now() - startedAt.current);
    setLast(ms);
    setTimes((t) => [...t, ms]);
    setPhase('result');
  };

  const label =
    phase === 'idle'
      ? 'Tap to begin'
      : phase === 'waiting'
        ? 'Wait for the glow…'
        : phase === 'go'
          ? 'Now!'
          : phase === 'early'
            ? 'Too soon. Tap to retry.'
            : done
              ? 'Round complete. Tap to play again.'
              : 'Tap for the next one';

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Reflex ripple" subtitle={`Best of ${ROUNDS} taps`} back backHref="/games" />

      <button
        type="button"
        onPointerDown={tap}
        aria-live="polite"
        aria-label={label}
        className={cn(
          'relative mt-4 grid aspect-square w-full place-items-center overflow-hidden rounded-3xl border border-border shadow-card transition-colors duration-200 select-none',
          phase === 'go' ? 'bg-accent-soft' : phase === 'early' ? 'bg-danger-soft' : 'bg-surface',
        )}
      >
        {phase === 'go' && (
          <>
            <span aria-hidden="true" className="animate-ripple absolute h-40 w-40 rounded-full bg-accent/40" />
            <span aria-hidden="true" className="animate-ripple absolute h-40 w-40 rounded-full bg-accent/30 [animation-delay:150ms]" />
          </>
        )}
        <span className="relative flex flex-col items-center gap-5">
          <span
            aria-hidden="true"
            className={cn(
              'h-36 w-36 rounded-full transition-all duration-150',
              phase === 'go' ? 'orb scale-110' : phase === 'waiting' ? 'breath-guide bg-surface-3' : 'bg-surface-2',
            )}
          />
          <span className="font-display text-2xl font-semibold">
            {phase === 'result' && last !== null ? `${last} ms` : label}
          </span>
          {phase === 'result' && last !== null && <span className="text-sm text-text-3">{done ? label : verdict(last)}</span>}
        </span>
      </button>

      <Card className="mt-5 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Your taps</p>
          <p className="text-sm text-text-3">{average !== null ? `Average ${average} ms` : 'No taps yet'}</p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'grid h-14 place-items-center rounded-2xl text-sm font-semibold tabular-nums',
                times[i] !== undefined ? 'animate-pop bg-accent-soft text-accent-soft-ink' : 'bg-surface-2 text-text-3',
              )}
            >
              {times[i] ?? '—'}
            </span>
          ))}
        </div>
        {done && average !== null && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-text-2">{verdict(average)}</p>
            <Button size="sm" onClick={() => { setTimes([]); arm(); }}>
              Play again
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
