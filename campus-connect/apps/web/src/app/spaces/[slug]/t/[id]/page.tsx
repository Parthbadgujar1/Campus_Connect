'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, MessageCircle, Reply, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, PageHeader } from '@/components/ui/layout';
import { Vote } from '@/components/spaces/vote';
import { getPerson, me } from '@/data/people';
import { getSpace, getThread, threadComments, type ThreadComment } from '@/data/spaces';
import { NOW, relativeTime } from '@/lib/time';
import { hueFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

function nameOf(id: string) {
  return id === 'me' ? 'You' : getPerson(id).name;
}

export default function ThreadPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const space = getSpace(slug);
  const thread = getThread(id);
  const [added, setAdded] = useState<ThreadComment[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (!space || !thread) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Thread" back backHref={space ? `/spaces/${space.slug}` : '/spaces'} />
        <EmptyState icon={MessageCircle} title="This thread is gone" className="mt-6" />
      </div>
    );
  }

  const comments = [...threadComments.filter((c) => c.threadId === thread.id), ...added];
  const author = thread.authorId === 'me' ? me : getPerson(thread.authorId);

  function submit() {
    const body = draft.trim();
    if (!body || !thread) return;
    setAdded((list) => [
      ...list,
      { id: `c-new-${list.length}`, threadId: thread.id, parentId: replyTo, authorId: 'me', body, score: 1, createdAt: NOW.toISOString() },
    ]);
    setDraft('');
    setReplyTo(null);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-44 md:px-8 md:pb-16">
      <PageHeader title={space.name} subtitle="Thread" back backHref={`/spaces/${space.slug}`} />

      <article className="animate-rise mt-2 flex gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <Vote id={thread.id} base={thread.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
            <Avatar name={author.name} seed={author.id} size="xs" />
            <Link href={`/profile/${author.username}`} className="font-semibold text-text-2 hover:underline">
              {thread.authorId === 'me' ? 'You' : author.name}
            </Link>
            <span>· {relativeTime(thread.createdAt)}</span>
            <Badge tone={thread.flair === 'Official' ? 'accent' : 'neutral'}>{thread.flair}</Badge>
          </div>
          <h2 className="mt-2 font-display text-[24px] font-semibold leading-tight tracking-tight text-balance md:text-[28px]">{thread.title}</h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-text-2">{thread.body}</p>
          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-text-3">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
          </p>
        </div>
      </article>

      <section className="mt-6" aria-label="Replies">
        {comments.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No replies yet" description="Be the first to add something useful." />
        ) : (
          <div className="stagger space-y-1">
            {comments
              .filter((c) => c.parentId === null)
              .map((comment) => (
                <CommentBranch key={comment.id} comment={comment} all={comments} depth={0} onReply={setReplyTo} />
              ))}
          </div>
        )}
      </section>

      {/* Reply dock */}
      <div className="fixed inset-x-0 bottom-[72px] z-30 px-4 md:bottom-6 md:left-[88px]">
        <Card className="glass mx-auto max-w-3xl p-2">
          {replyTo && (
            <p className="flex items-center justify-between gap-2 px-3 pb-1 pt-1 text-xs text-text-3">
              <span className="truncate">
                Replying to <span className="font-semibold text-text-2">{nameOf(comments.find((c) => c.id === replyTo)?.authorId ?? 'me')}</span>
              </span>
              <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-accent">
                Cancel
              </button>
            </p>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyTo ? 'Write a reply' : 'Add to the thread'}
              aria-label="Reply"
              className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-[15px] placeholder:text-text-3 focus:outline-none"
            />
            <Button type="submit" size="sm" disabled={!draft.trim()} aria-label="Send reply" className="h-11 w-11 px-0">
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

/** One comment and its replies, with a coloured thread line you can tap to fold. */
function CommentBranch({
  comment,
  all,
  depth,
  onReply,
}: {
  comment: ThreadComment;
  all: ThreadComment[];
  depth: number;
  onReply: (id: string) => void;
}) {
  const [folded, setFolded] = useState(false);
  const children = all.filter((c) => c.parentId === comment.id);
  const person = comment.authorId === 'me' ? me : getPerson(comment.authorId);
  const lane = comment.authorId === 'me' ? 'var(--accent)' : `hsl(${hueFor(comment.authorId)} 42% 58%)`;

  return (
    <div className={cn('relative', depth > 0 && 'ml-4 md:ml-6')}>
      <div className="flex gap-3 py-3">
        <div className="flex flex-col items-center">
          <Avatar name={person.name} seed={person.id} size="sm" />
          {(children.length > 0 || depth > 0) && !folded && (
            <button
              type="button"
              aria-label="Fold this conversation"
              onClick={() => setFolded(true)}
              className="mt-1.5 w-[3px] flex-1 rounded-full opacity-50 transition-opacity hover:opacity-100"
              style={{ background: lane }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-3">
            <span className="font-semibold text-text-2">{nameOf(comment.authorId)}</span> · {relativeTime(comment.createdAt)}
          </p>
          {folded ? (
            <button type="button" onClick={() => setFolded(false)} className="mt-1 flex items-center gap-1 text-sm font-semibold text-accent">
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              Show {children.length ? `${children.length + 1} messages` : 'message'}
            </button>
          ) : (
            <>
              <p className="mt-1 text-[15px] leading-relaxed text-text">{comment.body}</p>
              <div className="mt-2 flex items-center gap-2">
                <Vote id={comment.id} base={comment.score} direction="horizontal" />
                <button
                  type="button"
                  onClick={() => onReply(comment.id)}
                  className="press flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-text-3 hover:bg-surface-2 hover:text-text"
                >
                  <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                  Reply
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {!folded &&
        children.map((child) => <CommentBranch key={child.id} comment={child} all={all} depth={depth + 1} onReply={onReply} />)}
    </div>
  );
}
