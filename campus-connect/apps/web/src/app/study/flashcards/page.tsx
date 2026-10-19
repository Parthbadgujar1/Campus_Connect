'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Layers, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { decks, type Deck, type Flashcard } from '@/data/study';
import { gradientFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

type Grade = 'again' | 'hard' | 'good' | 'easy';
const GRADES: { value: Grade; label: string; hint: string; tone: string }[] = [
  { value: 'again', label: 'Again', hint: 'see soon', tone: 'bg-danger-soft text-danger' },
  { value: 'hard', label: 'Hard', hint: 'tomorrow', tone: 'bg-warning-soft text-warning' },
  { value: 'good', label: 'Good', hint: '3 days', tone: 'bg-accent-soft text-accent-soft-ink' },
  { value: 'easy', label: 'Easy', hint: '1 week', tone: 'bg-success-soft text-success' },
];

export default function FlashcardsPage() {
  const toast = useToast();
  const [deck, setDeck] = useState<Deck | null>(null);

  if (deck) return <Session key={deck.id} deck={deck} onExit={() => setDeck(null)} />;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Flashcards"
        subtitle="Short sessions, spaced over days"
        back
        backHref="/study"
        actions={
          <Button size="sm" onClick={() => toast('Deck builder arrives with sync (preview)')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Deck
          </Button>
        }
      />
      <SectionHeader title="Your decks" className="mt-2" />
      <div className="stagger grid gap-4 sm:grid-cols-2">
        {decks.map((d) => (
          <button key={d.id} type="button" onClick={() => setDeck(d)} className="press group relative h-44 text-left">
            {/* A little stack: two cards peeking behind the top one */}
            <span aria-hidden="true" className="absolute inset-x-6 top-0 h-full rotate-[-3deg] rounded-2xl opacity-40 transition-transform duration-500 ease-drift group-hover:rotate-[-6deg]" style={{ background: gradientFor(`${d.hue}-b`) }} />
            <span aria-hidden="true" className="absolute inset-x-3 top-1 h-full rotate-[2deg] rounded-2xl opacity-60 transition-transform duration-500 ease-drift group-hover:rotate-[5deg]" style={{ background: gradientFor(`${d.hue}-a`) }} />
            <span className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-card" style={{ background: gradientFor(d.hue) }}>
              <Layers className="h-6 w-6" aria-hidden="true" />
              <span>
                <span className="block font-display text-xl font-semibold leading-tight">{d.title}</span>
                <span className="mt-1 block text-sm text-white/85">
                  {d.cards.length} cards · {d.subject}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Session({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [queue, setQueue] = useState<Flashcard[]>(deck.cards);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const card = queue[0];
  const reviewed = tally.hard + tally.good + tally.easy;

  const grade = (g: Grade) => {
    if (!card) return;
    setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    setQueue((q) => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)));
    setFlipped(false);
  };

  const restart = () => {
    setQueue(deck.cards);
    setTally({ again: 0, hard: 0, good: 0, easy: 0 });
    setFlipped(false);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title={deck.title}
        subtitle={`${deck.subject} · ${Math.min(reviewed + 1, deck.cards.length)} of ${deck.cards.length}`}
        leading={
          <button type="button" aria-label="Back to decks" onClick={onExit} className="press -ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-text-2 shadow-card">
            <ArrowLeft className="h-5 w-5" />
          </button>
        }
      />
      <ProgressBar value={reviewed} max={deck.cards.length} label="Session progress" className="mt-2" />

      {card ? (
        <>
          <button
            key={card.id}
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="flip-scene animate-rise mt-6 block aspect-[4/3] w-full"
            aria-label={flipped ? 'Show question' : 'Reveal answer'}
          >
            <span data-flipped={flipped} className="flip-card relative block h-full w-full">
              <span className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-border bg-surface p-8 text-center shadow-float">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-3">Question</span>
                <span className="mt-3 font-display text-[24px] font-semibold leading-snug text-balance">{card.front}</span>
                <span className="mt-6 text-xs text-text-3">Tap to reveal</span>
              </span>
              <span className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-8 text-center text-white shadow-float" style={{ background: gradientFor(deck.hue) }}>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Answer</span>
                <span className="mt-3 text-[18px] font-semibold leading-relaxed text-balance">{card.back}</span>
              </span>
            </span>
          </button>

          <div className={cn('mt-6 grid grid-cols-4 gap-2 transition-opacity duration-300', flipped ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={!flipped}>
            {GRADES.map((g) => (
              <button key={g.value} type="button" tabIndex={flipped ? 0 : -1} onClick={() => grade(g.value)} className={cn('press flex flex-col items-center rounded-2xl py-3 font-semibold', g.tone)}>
                <span className="text-sm">{g.label}</span>
                <span className="text-[10px] opacity-75">{g.hint}</span>
              </button>
            ))}
          </div>
          {!flipped && <p className="mt-6 text-center text-sm text-text-3">Think of the answer first, then flip.</p>}
        </>
      ) : (
        <Card className="animate-rise mt-6 flex flex-col items-center gap-3 p-8 text-center">
          <span className="orb grid h-14 w-14 place-items-center rounded-full text-accent-ink">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-display text-2xl font-semibold">Deck done for today</p>
          <p className="text-sm text-text-3">
            {tally.easy + tally.good} remembered well · {tally.hard} hard · {tally.again} needed another look
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Again
            </Button>
            <Button onClick={onExit}>Other decks</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
