'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { PageHeader, SectionHeader } from '@/components/ui/layout';
import { Vote } from '@/components/spaces/vote';
import { getPerson } from '@/data/people';
import { spaces, threads, type Thread } from '@/data/spaces';
import { appActions, useAppState } from '@/lib/store';
import { NOW, relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type Sort = 'Hot' | 'New' | 'Top';
const SORTS: Sort[] = ['Hot', 'New', 'Top'];

// Boards: the reddit-style feed across every space you follow.
export default function BoardsPage() {
  const joined = useAppState((s) => s.joined);
  const votes = useAppState((s) => s.votes);
  const [sort, setSort] = useState<Sort>('Hot');
  const [scope, setScope] = useState<'Following' | 'Everywhere'>('Following');

  const feed = useMemo(() => {
    const list = threads.filter((t) => scope === 'Everywhere' || joined.includes(spaces.find((s) => s.slug === t.spaceSlug)?.id ?? ''));
    const age = (t: Thread) => Math.max(1, (NOW.getTime() - new Date(t.createdAt).getTime()) / 3_600_000);
    const score = (t: Thread) => t.score + (votes[t.id] ?? 0);
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === 'New') return b.createdAt.localeCompare(a.createdAt);
      if (sort === 'Top') return score(b) - score(a);
      return score(b) / Math.pow(age(b) + 2, 1.2) - score(a) / Math.pow(age(a) + 2, 1.2);
    });
  }, [joined, scope, sort, votes]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Boards"
        subtitle="Threads, votes and replies from your spaces"
        back
        backHref="/discover"
        actions={
          <Link href="/spaces/new" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[14px] font-semibold text-accent-ink">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Space
          </Link>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ChipRow className="md:flex-nowrap">
          {SORTS.map((item) => (
            <Chip key={item} active={sort === item} onClick={() => setSort(item)}>
              {item}
            </Chip>
          ))}
        </ChipRow>
        <div className="ml-auto flex rounded-full bg-surface-2 p-1 text-[14px] font-semibold" role="group" aria-label="Scope">
          {(['Following', 'Everywhere'] as const).map((item) => (
            <button key={item} type="button" aria-pressed={scope === item} onClick={() => setScope(item)} className={cn('h-8 rounded-full px-3', scope === item ? 'bg-surface text-text shadow-card' : 'text-text-2')}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {feed.map((thread) => {
          const space = spaces.find((s) => s.slug === thread.spaceSlug);
          const author = thread.authorId === 'me' ? 'You' : getPerson(thread.authorId).name.split(' ')[0];
          return (
            <li key={thread.id} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
              <Vote id={thread.id} base={thread.score} />
              <Link href={`/spaces/${thread.spaceSlug}/t/${thread.id}`} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[13px] text-text-3">
                  <span className="font-semibold text-text-2">{space?.name}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-px text-[12px] font-semibold text-text-2">{thread.flair}</span>
                  <span>
                    {author} · {relativeTime(thread.createdAt)}
                  </span>
                </span>
                <span className="mt-1.5 block text-[17px] font-semibold leading-snug">{thread.title}</span>
                <span className="mt-1 line-clamp-2 block text-[14px] text-text-2">{thread.body}</span>
                <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-3">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  {thread.comments} replies
                </span>
              </Link>
            </li>
          );
        })}
        {feed.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-[15px] font-semibold">No threads from your spaces yet</p>
            <p className="mt-1 text-[14px] text-text-3">Join a space to see its threads here.</p>
          </li>
        )}
      </ul>

      <section className="mt-10" aria-labelledby="browse-spaces">
        <SectionHeader title="Spaces to join" description="Clubs, classes and interests" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {spaces
            .filter((s) => !joined.includes(s.id))
            .slice(0, 6)
            .map((space) => (
              <li key={space.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-[15px] font-bold text-accent-soft-ink">{space.name.slice(0, 2).toUpperCase()}</span>
                <Link href={`/spaces/${space.slug}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{space.name}</span>
                  <span className="block truncate text-[13px] text-text-3">
                    {space.kind} · {space.members.toLocaleString('en-IN')} members
                  </span>
                </Link>
                <Button size="sm" variant="secondary" onClick={() => appActions.toggleJoined(space.id)}>
                  Join
                </Button>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
