'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AlertTriangle, Ban, Check, Eye, EyeOff, Flag, ShieldQuestion, Trash2, Undo2, X } from 'lucide-react';
import { get, post } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { PersonSummary } from '@/lib/api/types';
import type { ReportQueueRow } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Textarea } from '@/components/ui/fields';
import { Card, EmptyState } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { InfoBanner } from '@/components/common/info-banner';
import { useSession } from '@/lib/session';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

type Action = 'dismiss' | 'hide' | 'remove' | 'restore' | 'warn' | 'suspend_user';
const TYPE_LABEL: Record<string, string> = {
  post: 'Post', comment: 'Comment', discussion: 'Discussion', discussion_reply: 'Discussion reply', message: 'Chat message', user: 'Profile', listing: 'Listing',
  hush_question: 'Hush question', hush_answer: 'Hush answer', lost_found: 'Lost & found', resource: 'Shelf item', event: 'Event', space: 'Space', lecture: 'Lecture',
};
const REVEALABLE = new Set(['post', 'comment', 'hush_question', 'hush_answer']);
const LINK: Record<string, (id: string) => string> = {
  post: (id) => `/post/${id}`, hush_question: (id) => `/hush/${id}`, listing: (id) => `/marketplace/${id}`, event: (id) => `/events/${id}`,
  resource: (id) => `/resources?id=${id}`, lecture: (id) => `/lectures?id=${id}`, lost_found: (id) => `/lost-found?id=${id}`,
};

function ReportCard({ r, onDone }: { r: ReportQueueRow; onDone: () => void }) {
  const toast = useToast();
  const { user } = useSession();
  const [note, setNote] = useState('');
  const [revealing, setRevealing] = useState(false);
  const act = useAction(async (action: Action) => {
    await post('/admin/reports/action', { targetType: r.targetType, targetId: r.targetId, action, note: note.trim() || undefined });
    toast({ dismiss: 'Reports dismissed', hide: 'Hidden', remove: 'Removed', restore: 'Restored', warn: 'Warning sent', suspend_user: 'Account suspended' }[action]);
    invalidate('admin:overview');
    onDone();
  });
  const t = r.targetType ?? '';
  const urgent = r.priority <= 2;
  const link = LINK[t]?.(r.targetId);
  return (
    <Card className={cn('space-y-3 p-4', urgent && 'border-danger/40')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={urgent ? 'danger' : 'neutral'} icon={urgent ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : undefined}>{urgent ? 'Urgent' : `Priority ${r.priority}`}</Badge>
        <Badge>{TYPE_LABEL[t] ?? 'Item'}</Badge>
        <span className="text-[12px] text-text-3">{r.reports} report{r.reports === 1 ? '' : 's'} · first {ago(r.firstReportedAt)}</span>
      </div>
      <p className="whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2 text-[14px]">{r.preview}</p>
      <div className="flex flex-wrap gap-1.5">
        {r.reasons.map((x) => <span key={x} className="rounded-full bg-warning-soft px-2 py-0.5 text-[12px] font-semibold text-warning">{x.replace(/_/g, ' ')}</span>)}
      </div>
      {r.details.length > 0 && (
        <ul className="space-y-1 text-[13px] text-text-2">
          {r.details.map((d, i) => <li key={i}>“{d}”</li>)}
        </ul>
      )}
      {link && <Link href={link} target="_blank" className="inline-block text-[13px] font-semibold text-accent">Open in the app</Link>}
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Note (sent to the person for warnings and removals)" aria-label="Moderator note" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={act.pending} onClick={() => void act.run('dismiss')}><Check className="h-4 w-4" aria-hidden="true" /> Nothing wrong</Button>
        {t !== 'user' && <Button size="sm" variant="secondary" disabled={act.pending} onClick={() => void act.run('hide')}><EyeOff className="h-4 w-4" aria-hidden="true" /> Hide</Button>}
        {t !== 'user' && <Button size="sm" variant="danger" disabled={act.pending} onClick={() => void act.run('remove')}><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</Button>}
        <Button size="sm" variant="secondary" disabled={act.pending} onClick={() => void act.run('warn')}><Flag className="h-4 w-4" aria-hidden="true" /> Warn</Button>
        <Button size="sm" variant="danger" disabled={act.pending} onClick={() => void act.run('suspend_user')}><Ban className="h-4 w-4" aria-hidden="true" /> Suspend author</Button>
        {user?.role === 'admin' && r.anonymous && REVEALABLE.has(t) && <Button size="sm" variant="ghost" onClick={() => setRevealing(true)}><ShieldQuestion className="h-4 w-4" aria-hidden="true" /> Ask to reveal author</Button>}
        {act.pending && <Spinner />}
      </div>
      {act.error && <FormAlert>{act.error.message}</FormAlert>}
      {revealing && <RevealRequest contentType={t} contentId={r.targetId} onClose={() => setRevealing(false)} />}
    </Card>
  );
}

function RevealRequest({ contentType, contentId, onClose }: { contentType: string; contentId: string; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const send = useAction(async () => {
    await post('/admin/identity-reveals', { contentType, contentId, reason: reason.trim() });
    toast('Request sent. Another admin must approve it.');
    invalidate('admin:reveals');
    onClose();
  });
  return (
    <Sheet open onClose={onClose} title="Ask to reveal the author" description="Only for serious harm (threats, harassment, legal requests). A second admin has to approve, and every step is logged." footer={<Button full disabled={reason.trim().length < 10 || send.pending} onClick={() => void send.run()}>Send request</Button>}>
      <Field label="Why is this needed?" htmlFor="reveal-reason" hint="At least 10 characters. The other admins see this.">
        <Textarea id="reveal-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
      </Field>
      {send.error && <FormAlert className="mt-3">{send.error.message}</FormAlert>}
    </Sheet>
  );
}

interface RevealRow {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedBy: { id: string; name: string };
  decidedBy: { id: string; name: string } | null;
  canDecide: boolean;
  createdAt: string;
  decidedAt: string | null;
}

function Reveals() {
  const toast = useToast();
  const list = useQuery<{ items: RevealRow[] }>('admin:reveals', (signal) => get('/admin/identity-reveals', undefined, signal));
  const [revealed, setRevealed] = useState<Record<string, (PersonSummary & { email: string | null }) | null>>({});
  const decide = useAction(async (id: string, decision: 'approve' | 'reject') => {
    const r = await post<{ status: string; author: (PersonSummary & { email: string | null }) | null }>(`/admin/identity-reveals/${id}/decision`, { decision });
    if (decision === 'approve') setRevealed((m) => ({ ...m, [id]: r.author }));
    toast(decision === 'approve' ? 'Approved' : 'Rejected');
    list.reload();
  });
  if (list.loading) return <SkeletonList variant="row" count={3} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const items = list.data?.items ?? [];
  return (
    <div className="space-y-3">
      <InfoBanner icon={ShieldQuestion} title="Two admins, every time">Anonymous authors are revealed only when one admin asks and a different admin approves within 7 days. The author is shown once, to the approving admin, and the decision is in the audit log.</InfoBanner>
      {!items.length && <EmptyState icon={Eye} title="No reveal requests" description="Requests come from the report queue, on anonymous posts, comments and Hush." />}
      {items.map((r) => (
        <Card key={r.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.status === 'pending' ? 'warning' : r.status === 'approved' ? 'success' : 'neutral'}>{r.status}</Badge>
            <Badge>{TYPE_LABEL[r.contentType] ?? r.contentType}</Badge>
            <span className="text-[12px] text-text-3">asked by {r.requestedBy.name} · {ago(r.createdAt)}</span>
          </div>
          <p className="text-[14px]">{r.reason}</p>
          {LINK[r.contentType] && <Link href={LINK[r.contentType]!(r.contentId)} target="_blank" className="text-[13px] font-semibold text-accent">Open the content</Link>}
          {r.decidedBy && <p className="text-[12px] text-text-3">Decided by {r.decidedBy.name}{r.decidedAt ? ` · ${ago(r.decidedAt)}` : ''}</p>}
          {r.id in revealed && (
            <FormAlert tone="info">{revealed[r.id] ? `Author: ${revealed[r.id]!.displayName} (@${revealed[r.id]!.username})${revealed[r.id]!.email ? ` · ${revealed[r.id]!.email}` : ''}` : 'The author’s account no longer exists.'}</FormAlert>
          )}
          {r.canDecide && (
            <div className="flex gap-2">
              <Button size="sm" disabled={decide.pending} onClick={() => void decide.run(r.id, 'approve')}><Check className="h-4 w-4" aria-hidden="true" /> Approve and reveal</Button>
              <Button size="sm" variant="secondary" disabled={decide.pending} onClick={() => void decide.run(r.id, 'reject')}><X className="h-4 w-4" aria-hidden="true" /> Reject</Button>
            </div>
          )}
          {r.status === 'pending' && !r.canDecide && <p className="text-[12px] text-text-3">Waiting for another admin.</p>}
        </Card>
      ))}
      {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
    </div>
  );
}

function Queue() {
  const [status, setStatus] = useState<'open' | 'actioned' | 'dismissed'>('open');
  const list = useInfinite<ReportQueueRow & { id: string }>(`admin:reports:${status}`, async (cursor, signal) => {
    const page = await get<Page<ReportQueueRow>>('/admin/reports', { status, cursor: cursor ?? undefined, limit: 15 }, signal);
    return { ...page, items: page.items.map((r) => ({ ...r, id: `${r.targetType}:${r.targetId}` })) };
  });
  return (
    <>
      <ChipRow>
        {(['open', 'actioned', 'dismissed'] as const).map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s === 'open' ? 'Open' : s === 'actioned' ? 'Acted on' : 'Dismissed'}</Chip>)}
      </ChipRow>
      <InfiniteList
        state={list}
        skeleton="card"
        className="mt-4 space-y-3"
        empty={{ icon: Flag, title: status === 'open' ? 'No open reports' : 'Nothing here', description: status === 'open' ? 'Reports from people appear here, most urgent first.' : undefined }}
        endMessage="That’s the whole queue"
        render={(r) => (status === 'open' ? <ReportCard r={r} onDone={() => list.setItems((items) => items.filter((x) => x.id !== r.id))} /> : (
          <Card className="space-y-1.5 p-4">
            <div className="flex flex-wrap gap-2"><Badge>{TYPE_LABEL[r.targetType ?? ''] ?? 'Item'}</Badge><span className="text-[12px] text-text-3">{r.reports} reports · {ago(r.lastReportedAt)}</span></div>
            <p className="line-clamp-3 text-[14px]">{r.preview}</p>
            {r.targetType && r.targetType !== 'user' && status === 'actioned' && <RestoreButton r={r} onDone={() => list.setItems((items) => items.filter((x) => x.id !== r.id))} />}
          </Card>
        ))}
      />
    </>
  );
}

function RestoreButton({ r, onDone }: { r: ReportQueueRow; onDone: () => void }) {
  const restore = useAction(async () => {
    await post('/admin/reports/action', { targetType: r.targetType, targetId: r.targetId, action: 'restore' });
    onDone();
  });
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => void restore.run()} disabled={restore.pending}><Undo2 className="h-4 w-4" aria-hidden="true" /> Restore</Button>
      {restore.error && <FormAlert>{restore.error.message}</FormAlert>}
    </>
  );
}

function ModerationInner() {
  const { user } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'reveals' && user?.role === 'admin' ? 'reveals' : 'reports';
  return (
    <div>
      {user?.role === 'admin' && (
        <Segmented<'reports' | 'reveals'>
          label="Moderation views"
          value={tab}
          onChange={(v) => router.replace(v === 'reveals' ? '/admin/moderation?tab=reveals' : '/admin/moderation', { scroll: false })}
          className="mb-4 max-w-md"
          options={[
            { value: 'reports', label: 'Reports' },
            { value: 'reveals', label: 'Identity reveals' },
          ]}
        />
      )}
      {tab === 'reports' ? <Queue /> : <Reveals />}
    </div>
  );
}

export default function AdminModerationPage() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={3} />}>
      <ModerationInner />
    </Suspense>
  );
}
