'use client';

import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownRight, Flag, Lock, Pin, Reply, Send, Trash2, Unlock } from 'lucide-react';
import { del, get, patch, post } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { DiscussionDetail, DiscussionReply } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { ReportSheet } from '@/components/common/report-sheet';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { VoteControl } from '@/components/hush/hush-ui';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

function ReplyBox({ discussionId, parentId, onDone, autoFocus = false }: { discussionId: string; parentId?: string; onDone: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState('');
  const send = useAction(async () => {
    await post(`/discussions/${discussionId}/replies`, { body: body.trim(), parentId });
    setBody('');
    onDone();
  });
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) void send.run(); }}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={parentId ? 2 : 3} maxLength={5000} placeholder={parentId ? 'Write a reply' : 'Add to the discussion'} aria-label="Reply" autoFocus={autoFocus} />
      {send.error && <FormAlert>{send.error.message}</FormAlert>}
      <Button type="submit" size="sm" disabled={!body.trim() || send.pending}>{send.pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />} Reply</Button>
    </form>
  );
}

export default function DiscussionPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params);
  const router = useRouter();
  const d = useQuery<DiscussionDetail>(`discussion:${id}`, (signal) => get(`/discussions/${id}`, undefined, signal));
  const replies = useQuery<{ items: DiscussionReply[] }>(`discussion:${id}:replies`, (signal) => get(`/discussions/${id}/replies`, undefined, signal));
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'discussion' | 'reply'; id: string } | null>(null);
  const [reporting, setReporting] = useState<{ type: 'discussion' | 'discussion_reply'; id: string } | null>(null);
  const manage = useAction(async (change: { pinned?: boolean; locked?: boolean }) => {
    await patch(`/discussions/${id}`, change);
    d.reload();
    invalidate('spaces:board');
  });
  const remove = useAction(async () => {
    if (!deleting) return;
    await del(deleting.kind === 'discussion' ? `/discussions/${id}` : `/discussion-replies/${deleting.id}`);
    setDeleting(null);
    if (deleting.kind === 'discussion') {
      invalidate('spaces:board');
      router.replace(`/spaces/${slug}`);
    } else replies.reload();
  });
  const refresh = () => {
    setReplyTo(null);
    replies.reload();
    d.reload();
  };
  // Replies arrive flat with parent ids; show each under its parent, depth-first.
  const ordered = useMemo(() => {
    const items = replies.data?.items ?? [];
    const children = new Map<string | null, DiscussionReply[]>();
    for (const r of items) children.set(r.parentId, [...(children.get(r.parentId) ?? []), r]);
    const out: DiscussionReply[] = [];
    const walk = (parent: string | null) => (children.get(parent) ?? []).forEach((r) => { out.push(r); walk(r.id); });
    walk(null);
    return out;
  }, [replies.data]);
  const t = d.data;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={t?.space.name ?? 'Discussion'} back backHref={`/spaces/${slug}`} />
      {d.loading && <SkeletonList count={2} />}
      {d.error && <ErrorState error={d.error} onRetry={d.reload} />}
      {t && (
        <Reveal className="space-y-6">
          <Card className="flex gap-3 p-4">
            <VoteControl path={`/discussions/${t.id}/vote`} field="score" value={t.myVote} count={t.score} onChange={(v, c) => d.setData((x) => (x ? { ...x, myVote: v, score: c } : x))} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{t.flair}</Badge>
                {t.pinned && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent"><Pin className="h-3.5 w-3.5" aria-hidden="true" />Pinned</span>}
                {t.locked && <span className="inline-flex items-center gap-1 text-[12px] text-text-3"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Locked</span>}
              </div>
              <h2 className="mt-2 text-[22px] font-bold leading-tight">{t.title}</h2>
              <div className="mt-2 flex items-center gap-2 text-[13px] text-text-3"><PersonAvatar person={t.author} size="xs" /><PersonName person={t.author} className="text-text-2" /> · {ago(t.createdAt)} · <Link href={`/spaces/${t.space.slug}`} className="hover:underline">{t.space.name}</Link></div>
              {t.body && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{t.body}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {t.canManage && <Button size="sm" variant="ghost" onClick={() => void manage.run({ pinned: !t.pinned })} disabled={manage.pending}><Pin className="h-4 w-4" aria-hidden="true" />{t.pinned ? 'Unpin' : 'Pin'}</Button>}
                {t.canManage && <Button size="sm" variant="ghost" onClick={() => void manage.run({ locked: !t.locked })} disabled={manage.pending}>{t.locked ? <Unlock className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}{t.locked ? 'Unlock' : 'Lock'}</Button>}
                {(t.isMine || t.canManage) && <Button size="sm" variant="ghost" onClick={() => setDeleting({ kind: 'discussion', id: t.id })}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</Button>}
                {!t.isMine && <Button size="sm" variant="ghost" onClick={() => setReporting({ type: 'discussion', id: t.id })}><Flag className="h-4 w-4" aria-hidden="true" /> Report</Button>}
              </div>
              {manage.error && <FormAlert className="mt-2">{manage.error.message}</FormAlert>}
            </div>
          </Card>

          <section aria-label="Replies">
            <SectionHeader title={`${t.commentsCount} repl${t.commentsCount === 1 ? 'y' : 'ies'}`} />
            {t.locked && !t.canManage ? <FormAlert tone="info">This discussion is locked; no new replies.</FormAlert> : <Card className="mb-4 p-4"><ReplyBox discussionId={t.id} onDone={refresh} /></Card>}
            {replies.loading && <SkeletonList count={2} />}
            {replies.error && <ErrorState error={replies.error} onRetry={replies.reload} compact />}
            <Stagger className="space-y-2">
              {ordered.map((r) => (
                <StaggerItem key={r.id}>
                  <div className="flex gap-2" style={{ paddingLeft: `${Math.min(r.depth, 6) * 16}px` }}>
                    {r.depth > 0 && <CornerDownRight className="mt-3 h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />}
                    <div className={cn('flex min-w-0 flex-1 gap-2 rounded-2xl border border-border bg-surface p-3', r.deleted && 'opacity-60')}>
                      {!r.deleted && <VoteControl path={`/discussion-replies/${r.id}/vote`} field="score" value={r.myVote} count={r.score} onChange={(v, c) => replies.setData((x) => (x ? { items: x.items.map((y) => (y.id === r.id ? { ...y, myVote: v, score: c } : y)) } : x))} />}
                      <div className="min-w-0 flex-1">
                        {r.deleted ? (
                          <p className="text-[14px] italic text-text-3">This reply was deleted.</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-[13px] text-text-3">{r.author && <><PersonAvatar person={r.author} size="xs" /><PersonName person={r.author} className="text-text-2" /></>} · {ago(r.createdAt)}</div>
                            <p className="mt-1 whitespace-pre-wrap text-[15px]">{r.body}</p>
                            <div className="mt-1 flex gap-1">
                              {(!t.locked || t.canManage) && <Button size="sm" variant="ghost" onClick={() => setReplyTo(replyTo === r.id ? null : r.id)}><Reply className="h-4 w-4" aria-hidden="true" /> Reply</Button>}
                              {(r.isMine || t.canManage) && <Button size="sm" variant="ghost" onClick={() => setDeleting({ kind: 'reply', id: r.id })} aria-label="Delete reply"><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}
                              {!r.isMine && <Button size="sm" variant="ghost" onClick={() => setReporting({ type: 'discussion_reply', id: r.id })} aria-label="Report reply"><Flag className="h-4 w-4" aria-hidden="true" /></Button>}
                            </div>
                            {replyTo === r.id && <div className="mt-2"><ReplyBox discussionId={t.id} parentId={r.id} onDone={refresh} autoFocus /></div>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        </Reveal>
      )}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void remove.run()} title={deleting?.kind === 'discussion' ? 'Delete this discussion?' : 'Delete this reply?'} description="This cannot be undone." confirmLabel="Delete" danger pending={remove.pending} error={remove.error?.message} />
      {reporting && <ReportSheet open onClose={() => setReporting(null)} targetType={reporting.type} targetId={reporting.id} label={reporting.type === 'discussion' ? 'this discussion' : 'this reply'} />}
    </div>
  );
}
