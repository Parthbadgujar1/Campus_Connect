'use client';

import { useState } from 'react';
import { Lock, Star, Vote, MessageSquareText, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Field, Select, Textarea } from '@/components/ui/fields';
import { Card, PageHeader, ProgressBar } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/fields';
import { useToast } from '@/components/ui/toast';
import { surveys, type Survey } from '@/data/campus';
import { daysUntil, formatDay } from '@/lib/time';

type Tab = 'Surveys' | 'Suggestions' | 'Polls';

export default function FeedbackPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Surveys');
  const [active, setActive] = useState<Survey | null>(null);
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [suggestion, setSuggestion] = useState('');
  const [suggestionTopic, setSuggestionTopic] = useState('Facilities');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Student feedback" subtitle="Courses, facilities, clubs and events" back backHref="/campus" />

      <div className="mt-4">
        <Segmented<Tab>
          label="Feedback sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Surveys', label: 'Surveys' },
            { value: 'Suggestions', label: 'Suggestions' },
            { value: 'Polls', label: 'Polls' },
          ]}
        />
      </div>

      {tab === 'Surveys' && (
        <section className="mt-5 space-y-3">
          {surveys.map((s) => {
            const pct = Math.min(100, Math.round((s.responses / s.target) * 100));
            const left = daysUntil(s.deadline);
            return (
              <Card key={s.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{s.title}</p>
                    <p className="text-xs text-text-3">
                      {s.questions} questions · closes {formatDay(s.deadline)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge>{s.type}</Badge>
                    {s.anonymous && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-text-3">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        Anonymous
                      </span>
                    )}
                  </div>
                </div>
                <ProgressBar value={pct} label={`${s.title} response rate`} />
                <div className="flex items-center justify-between gap-3 text-xs text-text-3">
                  <span>
                    {s.responses.toLocaleString('en-IN')} of {s.target.toLocaleString('en-IN')} responses · {left} days left
                  </span>
                  <Button size="sm" onClick={() => { setActive(s); setRating(4); setComment(''); }}>
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    Respond
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {tab === 'Suggestions' && (
        <section className="mt-5 space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-semibold">Suggestion box</p>
                <p className="text-sm text-text-3">Goes to the relevant office. Anonymous by default.</p>
              </div>
            </div>
            <Field label="Topic" htmlFor="sg-topic">
              <Select id="sg-topic" value={suggestionTopic} onChange={(e) => setSuggestionTopic(e.target.value)}>
                <option>Facilities</option>
                <option>Canteen</option>
                <option>Labs</option>
                <option>Transport</option>
                <option>Events</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Your suggestion" htmlFor="sg-text" hint={`${suggestion.length}/500`}>
              <Textarea id="sg-text" maxLength={500} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="Be specific: where, when and what would help" />
            </Field>
            <Button
              disabled={suggestion.trim().length < 10}
              onClick={() => {
                setSuggestion('');
                toast('Suggestion sent to the office anonymously');
              }}
            >
              Send anonymously
            </Button>
          </Card>
        </section>
      )}

      {tab === 'Polls' && (
        <section className="mt-5 space-y-4">
          <Card className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-accent" aria-hidden="true" />
              <p className="font-semibold">Should the canteen add a healthy-meal counter?</p>
            </div>
            {['Yes, at lunch', 'Yes, at dinner too', 'No change needed'].map((opt, i) => (
              <button key={opt} type="button" onClick={() => toast(`Voted: ${opt}`)} className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm font-medium hover:border-accent/50">
                {opt}
                <span className="text-xs text-text-3">{[62, 21, 17][i]}%</span>
              </button>
            ))}
          </Card>
        </section>
      )}

      <Sheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={active?.title ?? 'Survey'}
        description={active ? `${active.type} · ${active.questions} questions` : undefined}
        footer={
          <Button
            full
            onClick={() => {
              setActive(null);
              toast('Thanks! Your response is recorded.');
            }}
          >
            Submit response
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Overall rating</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2">
                  <Star className={n <= rating ? 'h-5 w-5 fill-warning text-warning' : 'h-5 w-5 text-text-3'} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <Field label="Comments (optional)" htmlFor="sv-comment">
            <Textarea id="sv-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div className="overflow-hidden rounded-2xl border border-border">
            <Switch label="Submit anonymously" description="Your name is not attached to this response" checked={anonymous} onChange={setAnonymous} />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
