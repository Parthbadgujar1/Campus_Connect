'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Bug, ChevronRight, ClipboardList, HeartHandshake, HelpCircle, Lightbulb, Lock, MessageSquareText, PartyPopper, Send, Star } from 'lucide-react';
import { get, post } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { FeedbackView, SurveyView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Textarea } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader } from '@/components/ui/layout';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable, Reveal, Stagger, StaggerItem, motion } from '@/components/motion';
import { ago, day } from '@/lib/live-time';
import { cn } from '@/lib/utils';

// Campus → Feedback (also Settings → Feedback): surveys from the college, and feedback about the
// app that goes straight to the admins.

type Tab = 'surveys' | 'send' | 'mine';

const CATEGORIES: Array<{ value: FeedbackView['category']; label: string; icon: typeof Bug; hint: string }> = [
  { value: 'idea', label: 'Idea', icon: Lightbulb, hint: 'Something you would like to see' },
  { value: 'bug', label: 'Problem', icon: Bug, hint: 'Something that did not work' },
  { value: 'praise', label: 'Praise', icon: PartyPopper, hint: 'Something you liked' },
  { value: 'question', label: 'Question', icon: HelpCircle, hint: 'Something you want to ask' },
  { value: 'other', label: 'Other', icon: MessageSquareText, hint: 'Anything else' },
];

const STATUS_LABEL: Record<FeedbackView['status'], { label: string; tone: 'neutral' | 'info' | 'accent' | 'success' }> = {
  new: { label: 'Sent', tone: 'neutral' },
  reviewed: { label: 'Read by the team', tone: 'info' },
  planned: { label: 'Planned', tone: 'accent' },
  done: { label: 'Done', tone: 'success' },
};

function SurveysTab() {
  const list = useQuery<{ items: SurveyView[] }>('surveys:list', (signal) => get('/surveys', undefined, signal));
  if (list.loading) return <SkeletonList variant="row" count={3} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const items = list.data?.items ?? [];
  if (!items.length) return <EmptyState icon={ClipboardList} title="No surveys right now" description="When your college asks for your opinion, the survey appears here (and as a notification)." />;
  const open = items.filter((s) => !s.answered);
  const answered = items.filter((s) => s.answered);
  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <Stagger className="space-y-3">
          {open.map((s) => (
            <StaggerItem key={s.id}>
              <Pressable>
                <Link href={`/surveys/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
                    <ClipboardList className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{s.title}</span>
                      {s.compulsory && <Badge tone="danger">Required</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-text-3">
                      {s.questionsCount ?? s.questions?.length ?? 0} questions{s.closesAt ? ` · closes ${day(s.closesAt)}` : ''}
                      {s.anonymous ? ' · anonymous' : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                </Link>
              </Pressable>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      {answered.length > 0 && (
        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-text-2">Answered</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {answered.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-[15px]">{s.title}</span>
                <Badge tone="success">Thank you</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SendTab({ onSent }: { onSent: () => void }) {
  const toast = useToast();
  const [category, setCategory] = useState<FeedbackView['category']>('idea');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const send = useAction(async () => {
    await post('/feedback', { category, rating: rating || undefined, message: message.trim(), page: '/feedback', appVersion: 'web' });
    toast('Thank you! The team reads every message.');
    setMessage('');
    setRating(0);
    invalidate('feedback:');
    onSent();
  });
  const fieldError = send.error && 'fields' in send.error ? (send.error as { fields: Record<string, string> }).fields.message : undefined;
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (message.trim().length >= 3) void send.run();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What is it about?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CATEGORIES.map((c) => (
            <motion.button key={c.value} type="button" whileTap={{ scale: 0.96 }} onClick={() => setCategory(c.value)} aria-pressed={category === c.value} className={cn('flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-[13px] font-semibold transition-colors', category === c.value ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border bg-surface text-text-2 hover:bg-surface-2')}>
              <c.icon className="h-5 w-5" aria-hidden="true" />
              {c.label}
            </motion.button>
          ))}
        </div>
        <p className="mt-1.5 text-[13px] text-text-3">{CATEGORIES.find((c) => c.value === category)?.hint}</p>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">How do you feel about CampusConnect? <span className="font-normal text-text-3">(optional)</span></legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} whileTap={{ scale: 0.85 }} onClick={() => setRating(rating === n ? 0 : n)} className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface">
              <Star className={cn('h-5 w-5', n <= rating ? 'fill-warning text-warning' : 'text-text-3')} aria-hidden="true" />
            </motion.button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor="feedback-message" className="text-sm font-semibold">Your message</label>
        <Textarea id="feedback-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={5} placeholder="Tell us what happened, or what would help you most." aria-invalid={Boolean(fieldError)} />
        <p className="text-right text-[12px] text-text-3">{message.length}/4000</p>
      </div>
      {send.error && <FormAlert>{fieldError ?? send.error.message}</FormAlert>}
      <Button type="submit" size="lg" full disabled={send.pending || message.trim().length < 3} aria-busy={send.pending}>
        {send.pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {send.pending ? 'Sending…' : 'Send feedback'}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-text-3">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Only the college admins read feedback. You will be told when its status changes.
      </p>
    </form>
  );
}

function MineTab() {
  const mine = useQuery<{ items: FeedbackView[] }>('feedback:mine', (signal) => get('/feedback/mine', undefined, signal));
  if (mine.loading) return <SkeletonList variant="row" count={3} />;
  if (mine.error) return <ErrorState error={mine.error} onRetry={mine.reload} />;
  const items = mine.data?.items ?? [];
  if (!items.length) return <EmptyState icon={HeartHandshake} title="Nothing sent yet" description="Your feedback and its progress will show here." />;
  return (
    <Stagger className="space-y-3">
      {items.map((f) => (
        <StaggerItem key={f.id}>
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold capitalize text-text-2">{CATEGORIES.find((c) => c.value === f.category)?.label ?? f.category}</span>
              <Badge tone={STATUS_LABEL[f.status].tone}>{STATUS_LABEL[f.status].label}</Badge>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[15px]">{f.message}</p>
            <p className="mt-2 text-[12px] text-text-3">
              Sent {ago(f.createdAt)}
              {f.rating ? ` · ${f.rating}/5` : ''}
            </p>
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function FeedbackInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'surveys');
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Feedback" subtitle="Surveys from your college, and your ideas for the app" back backHref="/campus" />
      <Reveal className="mt-4">
        <Segmented<Tab>
          label="Feedback sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'surveys', label: 'Surveys' },
            { value: 'send', label: 'Send feedback' },
            { value: 'mine', label: 'My feedback' },
          ]}
        />
      </Reveal>
      <div className="mt-5">
        {tab === 'surveys' && <SurveysTab />}
        {tab === 'send' && <SendTab onSent={() => setTab('mine')} />}
        {tab === 'mine' && <MineTab />}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<SkeletonList variant="row" count={3} className="mx-auto mt-24 max-w-3xl px-4" />}>
      <FeedbackInner />
    </Suspense>
  );
}
