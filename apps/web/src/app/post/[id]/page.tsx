'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CornerDownRight, Flag, Ghost, MessageCircle, Trash2 } from 'lucide-react';
import { LivePostCard } from '@/components/feed/live-post-card';
import { ReportSheet } from '@/components/common/report-sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { ConfirmDialog, ErrorState, FormAlert, LoadMore, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, get, post } from '@/lib/api/client';
import { invalidate, useInfinite, useQuery } from '@/lib/api/hooks';
import type { CommentView, PostView } from '@/lib/api/types';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

function CommentBox({ postId, parentId, onPosted, onCancel, autoFocus = false }: { postId: string; parentId?: string; onPosted: (c: CommentView) => void; onCancel?: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `reply-${parentId ?? 'root'}`;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const c = await post<CommentView>(`/posts/${postId}/comments`, { body: body.trim(), parentId });
      onPosted(c);
      setBody('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      {error && <FormAlert>{error}</FormAlert>}
      <label htmlFor={id} className="sr-only">{parentId ? 'Write a reply' : 'Write a comment'}</label>
      <Textarea id={id} autoFocus={autoFocus} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder={parentId ? 'Write a reply' : 'Add a comment'} className="min-h-20" />
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" size="sm" disabled={!body.trim() || pending} aria-busy={pending}>
          {pending && <Spinner />} {parentId ? 'Reply' : 'Comment'}
        </Button>
      </div>
    </form>
  );
}

function Comment({ c, depth, children, postId, onPosted, onDeleted }: { c: CommentView; depth: number; children: React.ReactNode; postId: string; onPosted: (c: CommentView) => void; onDeleted: (id: string) => void }) {
  const toast = useToast();
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await del(`/comments/${c.id}`);
      onDeleted(c.id);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  return (
    <li className={cn(depth > 0 && 'ml-5 border-l-2 border-border pl-4')}>
      <div className="flex gap-3 py-3">
        {c.byOriginalPoster || !c.author ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-text-2"><Ghost className="h-4 w-4" aria-hidden="true" /></span>
        ) : (
          <PersonAvatar person={c.author} size="sm" link />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px]">
            {c.deleted ? <span className="text-text-3">Deleted comment</span> : c.byOriginalPoster ? <span className="font-semibold">Original poster</span> : <PersonName person={c.author} />}
            <span className="font-sans ml-2 text-[12px] text-text-3">{ago(c.createdAt)}</span>
          </p>
          {c.deleted ? <p className="text-[14px] italic text-text-3">This comment was deleted.</p> : <p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed">{c.body}</p>}
          {!c.deleted && (
            <div className="font-sans mt-1 flex gap-1">
              {depth < 4 && (
                <button type="button" onClick={() => setReplying((r) => !r)} className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-text-2 hover:bg-surface-2">
                  <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" /> Reply
                </button>
              )}
              {c.isMine ? (
                <button type="button" onClick={() => setConfirm(true)} className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-danger hover:bg-danger-soft">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                </button>
              ) : (
                <button type="button" onClick={() => setReporting(true)} className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-text-3 hover:bg-surface-2">
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Report
                </button>
              )}
            </div>
          )}
          {replying && (
            <div className="mt-2">
              <CommentBox postId={postId} parentId={c.id} autoFocus onCancel={() => setReplying(false)} onPosted={(r) => { onPosted(r); setReplying(false); }} />
            </div>
          )}
        </div>
      </div>
      {children}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} title="Delete this comment?" description="Replies to it stay, under a “deleted comment” placeholder." confirmLabel="Delete" danger pending={busy} />
      <ReportSheet open={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={c.id} label="this comment" />
    </li>
  );
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const postQ = useQuery<PostView>(`post:${id}`, (s) => get(`/posts/${id}`, undefined, s));
  const comments = useInfinite<CommentView>(`post:${id}:comments`, (cursor, s) => get(`/posts/${id}/comments`, { cursor: cursor ?? undefined, limit: 50 }, s));

  const added = (c: CommentView) => {
    comments.setItems((all) => [...all, c]);
    postQ.setData((p) => (p ? { ...p, commentsCount: p.commentsCount + 1 } : p!));
    invalidate('feed:');
  };
  const deleted = (cid: string) => comments.setItems((all) => all.map((c) => (c.id === cid ? { ...c, deleted: true, body: null, author: null } : c)));

  const render = (parentId: string | null, depth: number): React.ReactNode => {
    const level = comments.items.filter((c) => c.parentId === parentId);
    if (!level.length) return null;
    return (
      <ul className={cn(depth === 0 && 'divide-y divide-border')}>
        {level.map((c) => (
          <Comment key={c.id} c={c} depth={depth} postId={id} onPosted={added} onDeleted={deleted}>
            {render(c.id, depth + 1)}
          </Comment>
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Post" back backHref="/" />
      {postQ.loading ? (
        <SkeletonList count={1} />
      ) : postQ.error ? (
        <ErrorState error={postQ.error} onRetry={postQ.reload} />
      ) : (
        <>
          <LivePostCard post={postQ.data!} detailed onChange={(p) => postQ.setData(p)} onRemove={() => router.replace('/')} />
          <section aria-label="Comments" className="mt-6 rounded-2xl border border-border bg-surface p-4 md:p-5">
            <h2 className="text-[18px] font-semibold">Comments ({postQ.data!.commentsCount})</h2>
            <div className="mt-3">
              <CommentBox postId={id} onPosted={added} />
            </div>
            <div className="mt-2">
              {comments.loading ? (
                <SkeletonList variant="row" count={3} />
              ) : comments.error ? (
                <ErrorState compact error={comments.error} onRetry={comments.reload} />
              ) : comments.items.length ? (
                render(null, 0)
              ) : (
                <EmptyState icon={MessageCircle} title="No comments yet" description="Start the conversation." className="mt-3 py-8" />
              )}
              <LoadMore hasMore={comments.hasMore} loading={comments.loadingMore} onClick={comments.loadMore} label="More comments" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
