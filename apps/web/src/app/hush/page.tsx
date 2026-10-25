'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CheckCircle2, EyeOff, LifeBuoy, MessageCircle, MessageCircleQuestion, Plus, Search } from 'lucide-react';
import { get, post, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, type Page } from '@/lib/api/hooks';
import type { HushQuestionView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Reveal } from '@/components/motion';
import { TOPICS, VoteControl } from '@/components/hush/hush-ui';
import { ago } from '@/lib/live-time';

type Sort = 'new' | 'top' | 'unanswered' | 'mine';

function QuestionRow({ h, onChange }: { h: HushQuestionView; onChange: (next: HushQuestionView) => void }) {
  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <VoteControl path={`/hush/${h.id}/vote`} value={h.myVote} count={h.votesCount} onChange={(v, c) => onChange({ ...h, myVote: v, votesCount: c })} />
      <Link href={`/hush/${h.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{TOPICS[h.topic] ?? h.topic}</Badge>
          {h.acceptedAnswerId && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Answered</span>}
          {h.isMine && <span className="text-[12px] font-semibold text-accent">Yours</span>}
        </div>
        <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed">{h.body}</p>
        <p className="mt-2 flex items-center gap-3 text-[12px] text-text-3">
          <span>{h.anonymous ? 'Anonymous' : h.author?.displayName}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{h.answersCount} answer{h.answersCount === 1 ? '' : 's'}</span>
          <span>{ago(h.createdAt)}</span>
        </p>
      </Link>
    </article>
  );
}

function AskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [topic, setTopic] = useState('academics');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const send = useAction(async () => {
    const r = await post<{ id: string }>('/hush', { topic, body: body.trim(), anonymous });
    toast('Question posted');
    invalidate('hush:');
    setBody('');
    onClose();
    router.push(`/hush/${r.id}`);
  });
  return (
    <Sheet open={open} onClose={onClose} title="Ask a question" description="Nobody sees who asked, not even moderators. Be kind; the usual rules apply." footer={<Button full onClick={() => void send.run()} disabled={body.trim().length < 12 || send.pending}>{send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Post question</Button>}>
      <div className="space-y-4">
        <Field label="Topic" htmlFor="h-topic">
          <Select id="h-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {Object.entries(TOPICS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Your question" htmlFor="h-body" hint={`${body.trim().length}/2000 · at least 12 characters`}>
          <Textarea id="h-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} />
        </Field>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <Switch checked={anonymous} onChange={setAnonymous} label="Ask anonymously" description="On: your name is never shown or stored with the question" />
        </div>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

function HushInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const topic = params.get('topic');
  const sort = (params.get('sort') as Sort) || 'new';
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [asking, setAsking] = useState(false);
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { topic, sort: sort === 'new' ? null : sort, q: q || null, ...next }), { scroll: false });
  const list = useInfinite<HushQuestionView>(`hush:list:${topic}:${sort}:${q}`, (cursor, signal) =>
    get<Page<HushQuestionView>>('/hush', { topic: topic ?? undefined, sort: sort === 'mine' ? 'new' : sort, mine: sort === 'mine' ? 'true' : undefined, q: q || undefined, cursor: cursor ?? undefined, limit: 15 }, signal),
  );
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Hush" subtitle="Anonymous questions, answered by people who have been there" back backHref="/discover" actions={<Button size="sm" onClick={() => setAsking(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Ask</Button>} />
      <Reveal className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-text-2">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Anonymous here means anonymous: your name is not shown, and only a two-admin safety process can ever link a post to an account.</p>
        </div>
        <Segmented<Sort> label="Sort" value={sort} onChange={(v) => go({ sort: v === 'new' ? null : v })} options={[{ value: 'new', label: 'New' }, { value: 'top', label: 'Top' }, { value: 'unanswered', label: 'Unanswered' }, { value: 'mine', label: 'Mine' }]} />
        <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: search.trim() || null }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions" className="pl-10" aria-label="Search questions" enterKeyHint="search" />
        </form>
        <ChipRow>
          <Chip active={!topic} onClick={() => go({ topic: null })}>All topics</Chip>
          {Object.entries(TOPICS).map(([v, l]) => <Chip key={v} active={topic === v} onClick={() => go({ topic: v })}>{l}</Chip>)}
        </ChipRow>
        {topic === 'mental_health' && (
          <Link href="/safety" className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-[14px] font-semibold text-accent">
            <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Need to talk to someone now? Free, confidential helplines
          </Link>
        )}
      </Reveal>
      <div className="mt-4">
        <InfiniteList state={list} className="space-y-3" empty={{ icon: MessageCircleQuestion, title: sort === 'mine' ? 'You have not asked anything yet' : 'No questions here yet', description: 'Ask the first one. Nobody will know it was you.' }} endMessage="You’ve read every question" endHint="Know an answer? Open a question and help someone out." render={(h) => <QuestionRow h={h} onChange={(next) => list.setItems((items) => items.map((x) => (x.id === next.id ? next : x)))} />} />
      </div>
      <AskSheet open={asking} onClose={() => setAsking(false)} />
    </div>
  );
}

export default function HushPage() {
  return (
    <Suspense fallback={<SkeletonList count={3} className="mx-auto mt-24 max-w-2xl px-4" />}>
      <HushInner />
    </Suspense>
  );
}
