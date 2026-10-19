'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowUp, Check, MessageCircleQuestion, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch, Textarea } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { authorName, getHushQuestion, type HushAnswer } from '@/data/hush';
import { me } from '@/data/people';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

export default function HushQuestionPage() {
  const { id } = useParams<{ id: string }>();
  const question = getHushQuestion(id);
  const toast = useToast();
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState<string[]>([]);
  const [following, setFollowing] = useState(false);
  const [answers, setAnswers] = useState<HushAnswer[]>(question?.answers ?? []);
  const [reply, setReply] = useState('');
  const [anonymous, setAnonymous] = useState(true);

  if (!question) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Hush" back backHref="/hush" />
        <EmptyState icon={MessageCircleQuestion} title="This question is gone" className="mt-6" />
      </div>
    );
  }

  const score = (answer: HushAnswer) => answer.votes + (votes[answer.id] ?? 0);
  const ordered = [...answers].sort((a, b) => Number(!!b.accepted) - Number(!!a.accepted) || score(b) - score(a));
  const toggleVote = (answerId: string) => {
    if (voted.includes(answerId)) return;
    setVoted((v) => [...v, answerId]);
    setVotes((v) => ({ ...v, [answerId]: (v[answerId] ?? 0) + 1 }));
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Question" back backHref="/hush" />

      <article className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="hand-label bg-mark-soft px-2.5 py-0.5 text-[13px] text-mark">{question.topic}</span>
          <button
            type="button"
            aria-pressed={following}
            onClick={() => {
              setFollowing((f) => !f);
              toast(following ? `Stopped following ${question.topic}` : `Following ${question.topic}`);
            }}
            className={cn('h-9 rounded-full px-3.5 text-[14px] font-semibold', following ? 'bg-surface-2 text-text-2' : 'border border-border text-text hover:bg-surface-2')}
          >
            {following ? 'Following' : 'Follow topic'}
          </button>
        </div>
        <h1 className="mt-3 text-[22px] font-semibold leading-snug tracking-tight">{question.body}</h1>
        <p className="mt-3 text-[13px] text-text-3">
          {question.authorId === 'anonymous' ? 'Anonymous' : authorName(question.authorId)} · {relativeTime(question.at)}
        </p>
      </article>

      <section aria-labelledby="answers" className="mt-8">
        <h2 id="answers" className="text-[20px] font-semibold">
          {answers.length} {answers.length === 1 ? 'answer' : 'answers'}
        </h2>
        <ul className="mt-4 space-y-3">
          {ordered.map((answer) => {
            const hasVoted = voted.includes(answer.id);
            const who = answer.authorId === 'anonymous' ? 'Anonymous' : authorName(answer.authorId);
            return (
              <li key={answer.id} className="rounded-2xl border border-border bg-surface p-4">
                {answer.accepted && (
                  <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-success">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Accepted answer
                  </p>
                )}
                <p className="text-[15px] leading-relaxed">{answer.body}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleVote(answer.id)}
                    aria-pressed={hasVoted}
                    aria-label={`Upvote answer, ${score(answer)} votes`}
                    className={cn('flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold', hasVoted ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {score(answer)}
                  </button>
                  <span className="ml-auto flex items-center gap-2 text-[13px] text-text-3">
                    {answer.authorId === 'anonymous' ? <Avatar name="Anonymous" seed="anon" size="xs" /> : <Avatar name={who} seed={answer.authorId} size="xs" />}
                    {who} · {relativeTime(answer.at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <form
        className="mt-8 rounded-2xl border border-border bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const body = reply.trim();
          if (body.length < 10) return;
          setAnswers((list) => [...list, { id: `ha-new-${list.length}`, body, authorId: anonymous ? 'anonymous' : 'me', votes: 0, at: new Date().toISOString() }]);
          setReply('');
          toast('Answer posted');
        }}
      >
        <label htmlFor="answer" className="text-[15px] font-semibold">
          Your answer
        </label>
        <Textarea id="answer" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Explain it the way you wish someone had explained it to you" className="mt-2" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Switch checked={anonymous} onChange={setAnonymous} label="Answer anonymously" />
          </div>
          <Button type="submit" disabled={reply.trim().length < 10}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Post answer
          </Button>
        </div>
        <p className="mt-3 text-[13px] text-text-3">Posting as {anonymous ? 'Anonymous' : me.name}.</p>
      </form>
    </div>
  );
}
