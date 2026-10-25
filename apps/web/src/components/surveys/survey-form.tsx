'use client';

// Answers one survey. Questions appear one after another with a progress bar; required ones
// must be answered before sending, and server-side checks (one answer per person, options
// only) come back as messages next to the question they belong to.

import { useMemo, useState } from 'react';
import { Check, Lock, Send, Star } from 'lucide-react';
import { post, isApiError } from '@/lib/api/client';
import type { SurveyAnswer, SurveyQuestion, SurveyView } from '@/lib/api/modules';
import { useAction } from '@/lib/api/hooks';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { FormAlert, Spinner } from '@/components/ui/states';
import { ProgressBar } from '@/components/ui/layout';
import { Stagger, StaggerItem, motion } from '@/components/motion';
import { cn } from '@/lib/utils';

function isAnswered(q: SurveyQuestion, v: SurveyAnswer | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

function QuestionInput({ q, value, onChange }: { q: SurveyQuestion; value: SurveyAnswer | undefined; onChange: (v: SurveyAnswer | undefined) => void }) {
  if (q.type === 'single' || q.type === 'multiple') {
    const selected = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return (
      <div role={q.type === 'single' ? 'radiogroup' : 'group'} aria-label={q.prompt} className="grid gap-2 sm:grid-cols-2">
        {q.options.map((option) => {
          const on = selected.includes(option);
          return (
            <motion.button
              key={option}
              type="button"
              role={q.type === 'single' ? 'radio' : 'checkbox'}
              aria-checked={on}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (q.type === 'single') onChange(on ? undefined : option);
                else onChange(on ? selected.filter((o) => o !== option) : [...selected, option]);
              }}
              className={cn('flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-medium transition-colors', on ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border bg-surface hover:bg-surface-2')}
            >
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center border-2', q.type === 'single' ? 'rounded-full' : 'rounded-md', on ? 'border-accent bg-accent text-accent-ink' : 'border-text-3')}>
                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className="min-w-0">{option}</span>
            </motion.button>
          );
        })}
      </div>
    );
  }
  if (q.type === 'rating') {
    const n = typeof value === 'number' ? value : 0;
    return (
      <div role="radiogroup" aria-label={q.prompt} className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button key={star} type="button" role="radio" aria-checked={n === star} aria-label={`${star} star${star === 1 ? '' : 's'}`} whileTap={{ scale: 0.85 }} whileHover={{ y: -2 }} onClick={() => onChange(star)} className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-surface">
            <Star className={cn('h-6 w-6 transition-colors', star <= n ? 'fill-warning text-warning' : 'text-text-3')} aria-hidden="true" />
          </motion.button>
        ))}
      </div>
    );
  }
  if (q.type === 'scale') {
    const n = typeof value === 'number' ? value : null;
    return (
      <div>
        <div role="radiogroup" aria-label={q.prompt} className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} type="button" role="radio" aria-checked={n === i} onClick={() => onChange(i)} className={cn('h-11 rounded-xl border text-[14px] font-semibold transition-colors', n === i ? 'border-accent bg-accent text-accent-ink' : 'border-border bg-surface hover:bg-surface-2')}>
              {i}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[12px] text-text-3">
          <span>Not likely</span>
          <span>Very likely</span>
        </div>
      </div>
    );
  }
  return <Textarea value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={2000} placeholder="Type your answer" aria-label={q.prompt} />;
}

export function SurveyForm({ survey, onDone }: { survey: SurveyView; onDone: () => void }) {
  const questions = useMemo(() => survey.questions ?? [], [survey.questions]);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer | undefined>>({});
  const [touched, setTouched] = useState(false);
  const submit = useAction(async () => {
    const body: Record<string, SurveyAnswer> = {};
    for (const q of questions) {
      const v = answers[q.id];
      if (isAnswered(q, v)) body[q.id] = typeof v === 'string' ? v.trim() : (v as SurveyAnswer);
    }
    await post(`/surveys/${survey.id}/responses`, { answers: body });
    onDone();
  });
  const fieldErrors = isApiError(submit.error) ? submit.error.fields : {};
  const missing = questions.filter((q) => q.required && !isAnswered(q, answers[q.id]));
  const done = questions.filter((q) => isAnswered(q, answers[q.id])).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!missing.length) void submit.run();
      }}
      className="space-y-6"
      noValidate
    >
      <div>
        <ProgressBar value={done} max={Math.max(1, questions.length)} label="Questions answered" tone="success" />
        <p className="mt-1.5 text-[13px] text-text-3">
          {done} of {questions.length} answered{survey.anonymous ? ' · your answers are anonymous' : ''}
        </p>
      </div>
      <Stagger className="space-y-6">
        {questions.map((q, i) => {
          const problem = fieldErrors[q.id] ?? (touched && q.required && !isAnswered(q, answers[q.id]) ? 'Please answer this question.' : undefined);
          return (
            <StaggerItem key={q.id}>
              <fieldset className="space-y-3">
                <legend className="text-[17px] font-semibold leading-snug">
                  <span className="mr-2 text-text-3">{i + 1}.</span>
                  {q.prompt}
                  {!q.required && <span className="ml-2 text-[13px] font-normal text-text-3">(optional)</span>}
                </legend>
                <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                {problem && <p className="font-sans text-[13px] font-medium text-danger">{problem}</p>}
              </fieldset>
            </StaggerItem>
          );
        })}
      </Stagger>
      {submit.error && !Object.keys(fieldErrors).length && <FormAlert>{submit.error.message}</FormAlert>}
      {touched && missing.length > 0 && <FormAlert tone="info">Answer the {missing.length === 1 ? 'question' : `${missing.length} questions`} marked above to send.</FormAlert>}
      <Button type="submit" size="lg" full disabled={submit.pending} aria-busy={submit.pending}>
        {submit.pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {submit.pending ? 'Sending…' : 'Send answers'}
      </Button>
      {survey.anonymous && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-text-3">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Nobody, including admins, can see who sent these answers.
        </p>
      )}
    </form>
  );
}
