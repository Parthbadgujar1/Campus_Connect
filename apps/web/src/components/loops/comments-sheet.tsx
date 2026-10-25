'use client';

import { useMemo, useState } from 'react';
import { CornerDownRight, Flag, Ghost, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { del, errorMessage, get, post } from '@/lib/api/client';
import { useInfinite, type Page } from '@/lib/api/hooks';
import type { CommentView } from '@/lib/api/types';
import { Sheet } from '@/components/ui/sheet';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ConfirmDialog, ErrorState, SkeletonList, Spinner } from '@/components/ui/states';
import { EndOfList } from '@/components/ui/infinite';
import { useToast } from '@/components/ui/toast';
import { ReportSheet } from '@/components/common/report-sheet';
import { RichText } from '@/components/common/rich-text';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

/** Comments on a loop, in a sheet over the video (like Reels): read, reply, delete or report. */
export function CommentsSheet({ postId, count, onClose, onCountChange }: { postId: string; count: number; onClose: () => void; onCountChange: (n: number) => void }) {
  const toast = useToast();
  const list = useInfinite<CommentView>(`loops:comments:${postId}`, (cursor, signal) => get<Page<CommentView>>(`/posts/${postId}/comments`, { cursor: cursor ?? undefined, limit: 30 }, signal));
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<CommentView | null>(null);
  const [reporting, setReporting] = useState<CommentView | null>(null);

  // Replies sit under their parent comment.
  const ordered = useMemo(() => {
    const top = list.items.filter((c) => !c.parentId);
    const replies = new Map<string, CommentView[]>();
    for (const c of list.items) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
    const out: Array<{ c: CommentView; depth: number }> = [];
    const walk = (c: CommentView, depth: number) => {
      out.push({ c, depth });
      for (const r of replies.get(c.id) ?? []) walk(r, Math.min(depth + 1, 2));
    };
    top.forEach((c) => walk(c, 0));
    // Replies whose parent is not loaded yet still show.
    const shown = new Set(out.map((x) => x.c.id));
    for (const c of list.items) if (!shown.has(c.id)) out.push({ c, depth: 1 });
    return out;
  }, [list.items]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const c = await post<CommentView>(`/posts/${postId}/comments`, { body, parentId: replyTo?.id });
      list.setItems((items) => [...items, c]);
      onCountChange(count + 1);
      setText('');
      setReplyTo(null);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/comments/${deleting.id}`);
      list.setItems((items) => items.map((x) => (x.id === deleting.id ? { ...x, deleted: true, body: null } : x)));
      onCountChange(Math.max(0, count - 1));
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={count ? `${count} comment${count === 1 ? '' : 's'}` : 'Comments'}
        footer={
          <form className="w-full space-y-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            {replyTo && (
              <p className="flex items-center gap-2 text-[13px] text-text-3">
                <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" /> Replying to {replyTo.author?.displayName ?? 'this comment'}
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="ml-auto grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2"><X className="h-4 w-4" aria-hidden="true" /></button>
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                enterKeyHint="send"
                autoCapitalize="sentences"
                autoComplete="off"
                placeholder={replyTo ? 'Write a reply' : 'Add a comment'}
                aria-label={replyTo ? 'Write a reply' : 'Add a comment'}
                className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] focus:border-accent focus:outline-none"
              />
              <button type="submit" disabled={!text.trim() || sending} aria-label="Post comment" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-50">
                {sending ? <Spinner /> : <Send className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </form>
        }
      >
        {list.loading && <SkeletonList variant="row" count={4} />}
        {list.error && !list.items.length && <ErrorState error={list.error} onRetry={list.reload} compact />}
        {!list.loading && !list.error && !list.items.length && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageCircle className="h-8 w-8 text-text-3" aria-hidden="true" />
            <p className="font-semibold">No comments yet</p>
            <p className="text-[14px] text-text-3">Start the conversation.</p>
          </div>
        )}
        <ul className="space-y-1">
          {ordered.map(({ c, depth }) => (
            <li key={c.id} className={cn('flex gap-3 py-2', depth > 0 && 'ml-10')}>
              {c.byOriginalPoster || !c.author ? (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-text-2"><Ghost className="h-4 w-4" aria-hidden="true" /></span>
              ) : (
                <PersonAvatar person={c.author} size="sm" link />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <span className="font-semibold">{c.byOriginalPoster ? 'Original poster' : (c.author?.displayName ?? 'Deleted user')}</span>
                  <span className="ml-2 text-text-3">{ago(c.createdAt)}</span>
                </p>
                {c.deleted ? <p className="text-[14px] italic text-text-3">This comment was deleted.</p> : <p className="whitespace-pre-line break-words text-[15px]"><RichText text={c.body ?? ''} /></p>}
                {!c.deleted && (
                  <div className="font-sans mt-0.5 flex gap-3 text-[12px] font-semibold text-text-3">
                    <button type="button" onClick={() => setReplyTo(c)} className="hover:text-text">Reply</button>
                    {c.isMine ? (
                      <button type="button" onClick={() => setDeleting(c)} className="inline-flex items-center gap-1 hover:text-danger"><Trash2 className="h-3 w-3" aria-hidden="true" /> Delete</button>
                    ) : (
                      <button type="button" onClick={() => setReporting(c)} className="inline-flex items-center gap-1 hover:text-text"><Flag className="h-3 w-3" aria-hidden="true" /> Report</button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {list.hasMore ? (
          <button type="button" onClick={list.loadMore} disabled={list.loadingMore} className="mx-auto mt-2 flex items-center gap-2 text-[14px] font-semibold text-accent">{list.loadingMore && <Spinner />} More comments</button>
        ) : list.items.length > 3 ? (
          <EndOfList message="That’s every comment" className="py-4" />
        ) : null}
      </Sheet>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void remove()} title="Delete this comment?" description="This cannot be undone." confirmLabel="Delete" danger />
      {reporting && <ReportSheet open onClose={() => setReporting(null)} targetType="comment" targetId={reporting.id} label="this comment" />}
    </>
  );
}
