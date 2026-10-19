'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark, Ellipsis, Ghost, Heart, MessageCircle, Send } from 'lucide-react';
import { Avatar, VerifiedMark } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { getPerson } from '@/data/people';
import type { Post } from '@/lib/types';
import { appActions, useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { gradientFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

const SCOPE_LABEL: Record<Post['scope'], string> = {
  college: 'Whole campus',
  department: 'Department',
  year: 'Your year',
  division: 'Your division',
  community: 'Space',
};

/** Like button with a small ripple on tap. */
function LikeButton({ active, count, onToggle }: { active: boolean; count: number; onToggle: () => void }) {
  const [pulse, setPulse] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        onToggle();
        setPulse((p) => p + 1);
      }}
      aria-pressed={active}
      aria-label={active ? `Liked, ${count}` : `Like, ${count}`}
      className={cn(
        'press relative flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-300',
        active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text',
      )}
    >
      {pulse > 0 && active && (
        <span key={pulse} aria-hidden="true" className="animate-ripple pointer-events-none absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-accent" />
      )}
      <Heart className={cn('relative h-[18px] w-[18px]', active && 'fill-current')} aria-hidden="true" />
      <span className="relative tabular-nums">{count.toLocaleString('en-IN')}</span>
    </button>
  );
}

export function PostCard({ post, detailed = false }: { post: Post; detailed?: boolean }) {
  const toast = useToast();
  const liked = useAppState((s) => s.liked.includes(post.id));
  const saved = useAppState((s) => s.saved.includes(post.id));
  const [vote, setVote] = useState<number | null>(null);
  const anonymous = post.authorId === 'anonymous';
  const author = anonymous ? null : getPerson(post.authorId);

  const totalVotes = post.poll
    ? post.poll.options.reduce((sum, option, index) => sum + option.votes + (vote === index ? 1 : 0), 0)
    : 0;

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <header className="flex items-center gap-3">
        {anonymous ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-3 text-text-2">
            <Ghost className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : (
          <Link href={`/profile/${author?.username ?? 'me'}`} aria-label={`View ${author?.name}`} className="press">
            <Avatar name={author?.name ?? 'Member'} seed={author?.id} size="md" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px]">
            {anonymous ? (
              <span className="font-semibold">Someone on campus</span>
            ) : (
              <Link href={`/profile/${author?.username ?? 'me'}`} className="flex min-w-0 items-center gap-1 font-semibold hover:underline">
                <span className="truncate">{author?.name}</span>
                {author?.verified && <VerifiedMark />}
              </Link>
            )}
          </div>
          <p className="truncate text-[12.5px] text-text-3">
            {relativeTime(post.createdAt)} · {post.scopeLabel ?? SCOPE_LABEL[post.scope]}
            {anonymous && ' · identity hidden'}
          </p>
        </div>
        <IconButton label="More options" onClick={() => toast('Report, hide or copy link (preview)')} className="-mr-2 h-9 w-9">
          <Ellipsis className="h-5 w-5" />
        </IconButton>
      </header>

      <div className="mt-4">
        {post.pinned && (
          <Badge tone="accent" className="mb-2.5">
            Pinned by organiser
          </Badge>
        )}
        <Link href={`/post/${post.id}`} className="block whitespace-pre-line text-[15.5px] leading-relaxed text-text text-pretty">
          {detailed ? post.body : <span className="line-clamp-5">{post.body}</span>}
        </Link>
        {post.tags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Link key={tag} href="/search" className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-2 hover:text-text">
                #{tag}
              </Link>
            ))}
          </p>
        )}
      </div>

      {post.media && (
        <div
          className="relative mt-4 flex aspect-[4/3] items-end overflow-hidden rounded-2xl p-4 text-white md:aspect-video"
          style={{ background: gradientFor(post.media.seed) }}
          role="img"
          aria-label={post.media.label}
        >
          <span className="relative rounded-full bg-black/25 px-3 py-1.5 text-sm font-semibold">{post.media.label}</span>
        </div>
      )}

      {post.poll && (
        <div className="mt-4 space-y-2 rounded-2xl bg-surface-2 p-3.5">
          <p className="text-sm font-semibold">{post.poll.question}</p>
          {post.poll.options.map((option, index) => {
            const votes = option.votes + (vote === index ? 1 : 0);
            const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
            const chosen = vote === index;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  if (vote === null) setVote(index);
                }}
                disabled={vote !== null}
                className={cn(
                  'press relative flex w-full items-center justify-between overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-100',
                  chosen ? 'border-accent bg-surface' : 'border-border bg-surface',
                )}
              >
                {vote !== null && (
                  <span
                    className="animate-grow-x absolute inset-y-0 left-0 bg-accent-soft"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative font-semibold">{option.label}</span>
                {vote !== null && <span className="relative text-xs font-bold text-text-2">{pct}%</span>}
              </button>
            );
          })}
          <p className="px-1 text-xs text-text-3">
            {totalVotes.toLocaleString('en-IN')} votes {vote === null ? '· tap to vote' : '· thanks for voting'}
          </p>
        </div>
      )}

      <footer className="mt-4 flex items-center gap-1.5">
        <LikeButton active={liked} count={post.likes + (liked ? 1 : 0)} onToggle={() => appActions.toggleLiked(post.id)} />
        <Link
          href={`/post/${post.id}`}
          aria-label={`Reply, ${post.comments} replies`}
          className="press flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
        >
          <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          {post.comments}
        </Link>
        <button
          type="button"
          onClick={() => toast('Link ready to pass on (preview)')}
          aria-label="Share"
          className="press flex h-10 items-center rounded-full px-3 text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Send className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => appActions.toggleSaved(post.id)}
          aria-pressed={saved}
          aria-label={saved ? 'Saved. Tap to remove' : 'Save this post'}
          className={cn(
            'press ml-auto flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-surface-2',
            saved ? 'text-accent' : 'text-text-2',
          )}
        >
          <Bookmark className={cn('h-[18px] w-[18px]', saved && 'fill-current')} aria-hidden="true" />
          <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
        </button>
      </footer>
    </article>
  );
}
