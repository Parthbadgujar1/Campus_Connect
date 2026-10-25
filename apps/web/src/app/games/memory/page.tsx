'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, PageHeader } from '@/components/ui/layout';
import { cn } from '@/lib/utils';

const GLYPHS = ['📚', '☕', '🎧', '🧪', '💡', '🎨', '🏀', '🌿'];

/** Deterministic shuffle so a round is pure to compute from its number. */
function deal(round: number): string[] {
  const cards = [...GLYPHS, ...GLYPHS];
  let seed = 2166136261 ^ (round * 7919);
  for (let i = cards.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export default function MemoryGamePage() {
  const [round, setRound] = useState(1);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const busy = useRef(false);

  const deck = deal(round);
  const won = matched.length === deck.length;
  const started = moves > 0;

  useEffect(() => {
    if (!started || won) return;
    const handle = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(handle);
  }, [started, won]);

  const flip = (index: number) => {
    if (busy.current || open.includes(index) || matched.includes(index)) return;
    if (open.length === 0) {
      setOpen([index]);
      return;
    }
    const first = open[0];
    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setOpen([first, index]);
    if (deck[first] === deck[index]) {
      const nextMatched = [...matched, first, index];
      setMatched(nextMatched);
      setOpen([]);
      if (nextMatched.length === deck.length) setBest((b) => (b === null ? nextMoves : Math.min(b, nextMoves)));
    } else {
      busy.current = true;
      window.setTimeout(() => {
        setOpen([]);
        busy.current = false;
      }, 850);
    }
  };

  const restart = () => {
    setRound((r) => r + 1);
    setOpen([]);
    setMatched([]);
    setMoves(0);
    setSeconds(0);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Memory garden" subtitle="Match all eight pairs" back backHref="/games" />

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Stat label="Moves" value={moves} />
          <Stat label="Time" value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`} />
          {best !== null && <Stat label="Best" value={best} />}
        </div>
        <Button size="sm" variant="secondary" onClick={restart}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          New
        </Button>
      </div>

      <div key={round} className="stagger mt-5 grid grid-cols-4 gap-2.5 sm:gap-3" role="group" aria-label="Cards">
        {deck.map((glyph, index) => {
          const faceUp = open.includes(index) || matched.includes(index);
          const isMatched = matched.includes(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => flip(index)}
              aria-label={faceUp ? glyph : `Card ${index + 1}, face down`}
              className="flip-scene aspect-square"
            >
              <span data-flipped={faceUp} className="flip-card relative block h-full w-full">
                <span className="flip-face orb absolute inset-0 grid place-items-center rounded-2xl shadow-card">
                  <span className="h-3 w-3 rounded-full bg-white/60" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    'flip-face flip-back absolute inset-0 grid place-items-center rounded-2xl border bg-surface text-3xl shadow-card sm:text-4xl',
                    isMatched ? 'border-success bg-success-soft' : 'border-border',
                  )}
                >
                  <span className={cn(isMatched && 'animate-pop')}>{glyph}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {won && (
        <Card className="animate-rise mt-6 flex flex-col items-center gap-3 p-6 text-center">
          <span className="orb grid h-14 w-14 place-items-center rounded-full text-accent-ink">
            <Trophy className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-display text-2xl font-semibold">Garden complete</p>
          <p className="text-sm text-text-3">
            {moves} moves in {seconds}s. {moves <= 10 ? 'Remarkable memory.' : 'Try for fewer moves next round.'}
          </p>
          <Button onClick={restart}>Play again</Button>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="rounded-2xl border border-border bg-surface px-3 py-1.5 shadow-card">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-3">{label}</span>
      <span className="block font-display text-lg font-semibold tabular-nums leading-tight">{value}</span>
    </span>
  );
}
