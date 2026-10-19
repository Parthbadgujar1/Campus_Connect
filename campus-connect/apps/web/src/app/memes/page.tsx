'use client';

import { useMemo, useState } from 'react';
import { ArrowBigUp, Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Field, Input } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { memeContest, memes } from '@/data/fun';
import { authorName } from '@/data/hush';
import { NOW, daysUntil } from '@/lib/time';
import { cn } from '@/lib/utils';

// Meme wall: campus humour, voted up by the people who live it, with one contest running.
const TAGS = ['All', 'Campus', 'Department', 'Exam', 'Lecture', 'Hostel', 'Anonymous'] as const;

export default function MemeWallPage() {
  const toast = useToast();
  const [tag, setTag] = useState<(typeof TAGS)[number]>('All');
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [caption, setCaption] = useState('');
  const [entries, setEntries] = useState(memes);

  const list = useMemo(
    () =>
      entries
        .filter((m) => tag === 'All' || m.tag === tag)
        .sort((a, b) => b.upvotes + (votes[b.id] ?? 0) - (a.upvotes + (votes[a.id] ?? 0))),
    [entries, tag, votes],
  );
  const daysLeft = Math.max(0, daysUntil(memeContest.ends));

  const upvote = (id: string) => {
    if (voted.includes(id)) return;
    setVoted((v) => [...v, id]);
    setVotes((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }));
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Meme wall"
        subtitle="Campus humour, voted up by the people who live it"
        back
        backHref="/discover"
        actions={
          <Button size="sm" onClick={() => setPosting(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Post
          </Button>
        }
      />

      <section aria-label="Contest" className="mt-5 flex items-center gap-4 rounded-2xl bg-highlight p-5 text-highlight-ink">
        <Trophy className="h-7 w-7 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">{memeContest.title}</p>
          <p className="text-[14px] opacity-85">
            {memeContest.entries} entries · {memeContest.prize} · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
          </p>
        </div>
      </section>

      <ChipRow className="mt-5">
        {TAGS.map((item) => (
          <Chip key={item} active={tag === item} onClick={() => setTag(item)}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      <ul className="mt-5 space-y-3">
        {list.map((meme) => {
          const hasVoted = voted.includes(meme.id);
          const total = meme.upvotes + (votes[meme.id] ?? 0);
          return (
            <li key={meme.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
              <button
                type="button"
                onClick={() => upvote(meme.id)}
                aria-pressed={hasVoted}
                aria-label={`Upvote, ${total} votes`}
                className={cn('flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[14px] font-semibold', hasVoted ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
              >
                <ArrowBigUp className="h-5 w-5" aria-hidden="true" />
                {total}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold leading-snug">{meme.caption}</p>
                <p className="mt-2 text-[13px] text-text-3">
                  {meme.tag} · {meme.authorId === 'anonymous' ? 'Anonymous' : authorName(meme.authorId)}
                </p>
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-[15px] text-text-3">Nothing in this tag yet.</li>}
      </ul>

      <Sheet
        open={posting}
        onClose={() => setPosting(false)}
        title="Post to the meme wall"
        description="Keep it kind. Reports go to the moderators."
        footer={
          <Button
            full
            disabled={caption.trim().length < 6}
            onClick={() => {
              setEntries((list) => [{ id: `meme-new-${list.length}`, authorId: 'anonymous', caption: caption.trim(), tag: 'Anonymous', upvotes: 1, seed: `new-${list.length}` }, ...list]);
              setCaption('');
              setPosting(false);
              toast('Posted to the meme wall');
            }}
          >
            Post
          </Button>
        }
      >
        <Field label="Caption" htmlFor="meme-caption" hint={`Posting at ${NOW.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`}>
          <Input id="meme-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="When the viva is on the syllabus you skipped" />
        </Field>
      </Sheet>
    </div>
  );
}
