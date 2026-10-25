'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/fields';
import { Card, PageHeader } from '@/components/ui/layout';
import { cn } from '@/lib/utils';

// Each word comes with its scrambled letters, so every round is the same on every load.
const ROUNDS = [
  { word: 'LIBRARY', scrambled: 'RYLBRAI', hint: 'Where you borrow books' },
  { word: 'HOSTEL', scrambled: 'LTSOHE', hint: 'Where you stay on campus' },
  { word: 'SEMINAR', scrambled: 'RAMSEIN', hint: 'A talk by a speaker' },
  { word: 'LECTURE', scrambled: 'UCRETEL', hint: 'A class in a hall' },
  { word: 'CANTEEN', scrambled: 'NECTNAE', hint: 'Where you eat between classes' },
  { word: 'PROJECT', scrambled: 'TOCJRPE', hint: 'Work you build over weeks' },
];

export default function ScramblePage() {
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<'right' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const finished = round >= ROUNDS.length;
  const current = ROUNDS[round];

  const check = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!current || result) return;
    const right = guess.trim().toUpperCase() === current.word;
    setResult(right ? 'right' : 'wrong');
    if (right) setScore((value) => value + 1);
  };

  const next = () => {
    setRound((value) => value + 1);
    setGuess('');
    setResult(null);
  };

  const restart = () => {
    setRound(0);
    setGuess('');
    setResult(null);
    setScore(0);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Word scramble" back backHref="/games" />

      {finished || !current ? (
        <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent-soft-ink">
            <Trophy className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-semibold">
              {score} of {ROUNDS.length} unscrambled
            </p>
            <p className="mt-1 text-[15px] text-text-3">Campus words, one round at a time.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Play again
            </Button>
            <Link href="/games" className={buttonClass({ variant: 'primary' })}>
              Back to Playroom
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 p-6 md:p-8">
          <p className="text-[13px] font-semibold text-text-3">
            Round {round + 1} of {ROUNDS.length} · Score {score}
          </p>
          <p className="mt-4 text-center text-[32px] font-bold tracking-[0.3em] text-accent">{current.scrambled}</p>
          <p className="mt-2 text-center text-[14px] text-text-3">Hint: {current.hint}</p>
          <form onSubmit={check} className="mt-6 space-y-3">
            <Input
              aria-label="Your answer"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              disabled={result !== null}
              placeholder="Type the word"
              autoComplete="off"
              autoCapitalize="characters"
            />
            {result === null ? (
              <Button type="submit" full disabled={guess.trim() === ''}>
                Check
              </Button>
            ) : (
              <div className="space-y-3">
                <p className={cn('text-center text-[15px] font-semibold', result === 'right' ? 'text-success' : 'text-danger')}>
                  {result === 'right' ? 'Right!' : `The word was ${current.word}`}
                </p>
                <Button full onClick={next}>
                  {round + 1 === ROUNDS.length ? 'See score' : 'Next word'}
                </Button>
              </div>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}
