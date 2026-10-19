'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Trophy, RotateCcw } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, PageHeader, ProgressBar } from '@/components/ui/layout';
import { quizQuestions } from '@/data/fun';
import { cn } from '@/lib/utils';

const SECONDS = 15;

export default function QuizPage() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const finished = index >= quizQuestions.length;
  const question = quizQuestions[index];
  const timedOut = selected === null && timeLeft === 0;
  const reveal = selected !== null || timedOut;

  // Tick once a second while the question is open. Running out of time reveals
  // the answer with no point awarded (derived above, no state set inside the effect).
  useEffect(() => {
    if (finished || reveal) return;
    const id = window.setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => window.clearInterval(id);
  }, [finished, reveal]);

  const answer = (choice: number) => {
    if (reveal || !question) return;
    setSelected(choice);
    if (question && choice === question.answer) setScore((s) => s + 1);
  };

  const next = () => {
    setIndex((i) => i + 1);
    setSelected(null);
    setTimeLeft(SECONDS);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setTimeLeft(SECONDS);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Campus trivia" back backHref="/games" />

      {finished ? (
        <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center">
          <span className="orb grid h-16 w-16 place-items-center rounded-full text-accent-ink">
            <Trophy className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-3xl font-semibold">
              {score} / {quizQuestions.length}
            </p>
            <p className="mt-1 text-sm text-text-3">
              {score === quizQuestions.length ? 'Perfect round. Your name goes on the weekly board.' : 'Nice effort. Try again to beat your score.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Play again
            </Button>
            <Link href="/games" className={buttonClass({ variant: 'ghost' })}>
              Back to games
            </Link>
          </div>
        </Card>
      ) : (
        question && (
          <section className="mt-5 space-y-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-text-2">
                Question {index + 1} of {quizQuestions.length}
              </span>
              <span className="relative grid h-12 w-12 place-items-center" aria-live="polite" aria-label={`${timeLeft} seconds left`}>
                <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden="true">
                  <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" className="stroke-surface-3" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className={cn('transition-[stroke-dasharray] duration-1000 ease-linear', timeLeft <= 5 ? 'stroke-danger' : 'stroke-accent')}
                    strokeDasharray={`${(timeLeft / SECONDS) * 125.6} 125.6`}
                  />
                </svg>
                <span className={cn('text-sm font-bold tabular-nums', timeLeft <= 5 ? 'text-danger' : 'text-text-2')}>{timeLeft}</span>
              </span>
            </div>
            <ProgressBar value={index} max={quizQuestions.length} label="Quiz progress" />

            <Card key={index} className="animate-rise p-6">
              <p className="font-display text-[22px] font-semibold leading-snug text-balance">{question.q}</p>
            </Card>

            <div key={index} className="stagger grid gap-3" role="group" aria-label="Answers">
              {question.options.map((option, i) => {
                const correct = i === question.answer;
                const chosen = selected === i;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={reveal}
                    onClick={() => answer(i)}
                    className={cn(
                      'press flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold shadow-card transition-colors duration-300',
                      !reveal && 'border-border bg-surface hover:border-accent/50',
                      reveal && correct && 'border-success bg-success-soft text-success',
                      reveal && chosen && !correct && 'border-danger bg-danger-soft text-danger',
                      reveal && !chosen && !correct && 'border-border bg-surface text-text-3',
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-text-2">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            {reveal && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-2">
                  {timedOut ? 'Time is up.' : selected === question.answer ? 'Correct!' : 'Not quite.'}
                </p>
                <Button onClick={next}>{index === quizQuestions.length - 1 ? 'See results' : 'Next'}</Button>
              </div>
            )}
          </section>
        )
      )}
    </div>
  );
}
