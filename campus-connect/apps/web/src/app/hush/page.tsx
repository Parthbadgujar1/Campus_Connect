'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUp, MessageCircle, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { Field, Switch, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { authorName, hushQuestions, hushTopics, type HushQuestion } from '@/data/hush';
import { me } from '@/data/people';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type Sort = 'Top' | 'New' | 'Unanswered';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'Top', label: 'Top' },
  { value: 'New', label: 'New' },
  { value: 'Unanswered', label: 'Unanswered' },
];

export default function HushPage() {
  const toast = useToast();
  const [sort, setSort] = useState<Sort>('Top');
  const [topic, setTopic] = useState('All');
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState({ body: '', topic: hushTopics[0] ?? 'DBMS', anonymous: true });
  const [questions, setQuestions] = useState<HushQuestion[]>(hushQuestions);
  const [voted, setVoted] = useState<string[]>([]);

  const visible = useMemo(() => {
    const filtered = questions.filter((q) => (topic === 'All' || q.topic === topic) && (sort !== 'Unanswered' || q.answers.length === 0));
    return [...filtered].sort((a, b) => (sort === 'New' ? b.at.localeCompare(a.at) : b.votes - a.votes));
  }, [questions, sort, topic]);

  const vote = (id: string) => {
    if (voted.includes(id)) return;
    setVoted((v) => [...v, id]);
    setQuestions((list) => list.map((q) => (q.id === id ? { ...q, votes: q.votes + 1 } : q)));
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Hush"
        subtitle="Anonymous questions, answered by people who know"
        back
        backHref="/discover"
        actions={
          <Button size="sm" onClick={() => setAsking(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ask
          </Button>
        }
      />

      <div className="mt-4">
        <UnderlineTabs<Sort> label="Sort questions" value={sort} onChange={setSort} options={SORTS} />
      </div>

      <ChipRow className="mt-4">
        {['All', ...hushTopics].map((item) => (
          <Chip key={item} active={topic === item} onClick={() => setTopic(item)}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      <ul className="mt-5 space-y-3">
        {visible.map((question) => {
          const hasVoted = voted.includes(question.id);
          return (
            <li key={question.id} className="rounded-2xl border border-border bg-surface p-4">
              <Link href={`/hush/${question.id}`} className="block">
                <p className="text-[13px] font-semibold text-accent-soft-ink">{question.topic}</p>
                <p className="mt-1 text-[16px] font-semibold leading-snug">{question.body}</p>
              </Link>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => vote(question.id)}
                  aria-pressed={hasVoted}
                  aria-label={`Upvote, ${question.votes} votes`}
                  className={cn('flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold', hasVoted ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  {question.votes}
                </button>
                <Link href={`/hush/${question.id}`} className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[14px] font-semibold text-text-2 hover:text-text">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {question.answers.length} {question.answers.length === 1 ? 'answer' : 'answers'}
                </Link>
                <span className="ml-auto text-[13px] text-text-3">
                  {question.authorId === 'anonymous' ? 'Anonymous' : authorName(question.authorId)} · {relativeTime(question.at)}
                </span>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-[15px] text-text-3">No questions here yet. Be the first to ask.</li>}
      </ul>

      <Sheet
        open={asking}
        onClose={() => setAsking(false)}
        title="Ask a question"
        description="Your name is hidden unless you turn that off."
        footer={
          <Button
            full
            disabled={draft.body.trim().length < 12}
            onClick={() => {
              setQuestions((list) => [
                { id: `hq-new-${list.length}`, topic: draft.topic, body: draft.body.trim(), authorId: draft.anonymous ? 'anonymous' : 'me', votes: 1, at: new Date().toISOString(), answers: [] },
                ...list,
              ]);
              setAsking(false);
              setDraft({ body: '', topic: hushTopics[0] ?? 'DBMS', anonymous: true });
              toast('Question posted');
            }}
          >
            Post question
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Your question" htmlFor="hush-q">
            <Textarea id="hush-q" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="What do you want to know? Add the context people need." />
          </Field>
          <Field label="Topic" htmlFor="hush-topic">
            <select
              id="hush-topic"
              value={draft.topic}
              onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-[15px] focus:border-accent focus:outline-none"
            >
              {hushTopics.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <Switch checked={draft.anonymous} onChange={(value) => setDraft({ ...draft, anonymous: value })} label="Ask anonymously" description="Only the Hush moderators can see who asked, and only for safety reports." />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-text-3">
            <Avatar name={draft.anonymous ? 'Anonymous' : me.name} seed={draft.anonymous ? 'anon' : me.id} size="xs" />
            Posting as {draft.anonymous ? 'Anonymous' : me.name}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
