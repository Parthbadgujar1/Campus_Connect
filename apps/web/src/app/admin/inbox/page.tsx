'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Database, Inbox, Mail, Play } from 'lucide-react';
import { get, patch, post } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Select } from '@/components/ui/fields';
import { Card, EmptyState } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { ErrorState, FormAlert, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ago, dateTime } from '@/lib/live-time';

type Status = 'new' | 'in_progress' | 'resolved' | 'spam';
interface ContactRow {
  id: string;
  name: string;
  email: string;
  topic: string;
  subject: string;
  message: string;
  status: Status;
  createdAt: string;
}
interface DataRequest {
  id: string;
  email: string;
  kind: 'export' | 'deletion' | string;
  status: string;
  scheduledFor: string | null;
  requestedAt: string;
  completedAt: string | null;
  lastError: string | null;
}
const STATUS_LABEL: Record<Status, string> = { new: 'New', in_progress: 'In progress', resolved: 'Resolved', spam: 'Spam' };

function Message({ m, onChange }: { m: ContactRow; onChange: (m: ContactRow | null) => void }) {
  const set = useAction(async (status: Status) => {
    await patch(`/admin/contact/${m.id}`, { status });
    invalidate('admin:overview');
    onChange(null);
  });
  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={m.topic === 'safety' ? 'danger' : m.topic === 'privacy' ? 'info' : 'neutral'}>{m.topic}</Badge>
        <span className="text-[12px] text-text-3">{ago(m.createdAt)}</span>
      </div>
      <p className="font-semibold">{m.subject}</p>
      <p className="whitespace-pre-wrap text-[14px] text-text-2">{m.message}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent"><Mail className="h-4 w-4" aria-hidden="true" /> Reply to {m.name}</a>
        <Select value={m.status} onChange={(e) => void set.run(e.target.value as Status)} disabled={set.pending} aria-label="Message status" className="h-10 w-auto min-w-[150px] text-[14px]">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
      </div>
      {set.error && <FormAlert>{set.error.message}</FormAlert>}
    </Card>
  );
}

function Contact() {
  const [status, setStatus] = useState<Status>('new');
  const list = useInfinite<ContactRow>(`admin:contact:${status}`, (cursor, signal) => get<Page<ContactRow>>('/admin/contact', { status, cursor: cursor ?? undefined, limit: 20 }, signal));
  return (
    <>
      <ChipRow>{(Object.keys(STATUS_LABEL) as Status[]).map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</Chip>)}</ChipRow>
      <InfiniteList
        state={list}
        skeleton="card"
        className="mt-4 space-y-3"
        empty={{ icon: Inbox, title: status === 'new' ? 'Inbox zero' : 'Nothing here', description: status === 'new' ? 'Messages from the contact form and safety reports land here.' : undefined }}
        endMessage="No more messages"
        render={(m) => <Message m={m} onChange={() => list.setItems((items) => items.filter((x) => x.id !== m.id))} />}
      />
    </>
  );
}

function DataRequests() {
  const toast = useToast();
  const list = useQuery<{ items: DataRequest[] }>('admin:data-requests', (signal) => get('/admin/data-requests', undefined, signal));
  const run = useAction(async (id: string) => {
    await post(`/admin/data-requests/${id}/run`);
    toast('Export prepared. The person was emailed a download link.');
    list.reload();
  });
  if (list.loading) return <SkeletonList variant="row" count={4} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const items = list.data?.items ?? [];
  if (!items.length) return <EmptyState icon={Database} title="No data requests" description="Data exports and account deletions people ask for appear here. Both run automatically." />;
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{r.email}</p>
            <p className="text-[13px] text-text-3">{r.kind === 'export' ? 'Copy of their data' : 'Account deletion'} · asked {ago(r.requestedAt)}{r.scheduledFor ? ` · runs ${dateTime(r.scheduledFor)}` : ''}{r.completedAt ? ` · done ${ago(r.completedAt)}` : ''}</p>
            {r.lastError && <p className="text-[12px] text-danger">{r.lastError}</p>}
          </div>
          <Badge tone={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>{r.status}</Badge>
          {r.kind === 'export' && ['pending', 'failed'].includes(r.status) && <Button size="sm" variant="secondary" onClick={() => void run.run(r.id)} disabled={run.pending}><Play className="h-4 w-4" aria-hidden="true" /> Prepare now</Button>}
        </Card>
      ))}
      {run.error && <FormAlert>{run.error.message}</FormAlert>}
    </div>
  );
}

function InboxInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'data' ? 'data' : 'contact';
  return (
    <div>
      <Segmented<'contact' | 'data'>
        label="Inbox views"
        value={tab}
        onChange={(v) => router.replace(v === 'data' ? '/admin/inbox?tab=data' : '/admin/inbox', { scroll: false })}
        className="mb-4 max-w-md"
        options={[
          { value: 'contact', label: 'Messages' },
          { value: 'data', label: 'Data requests' },
        ]}
      />
      {tab === 'contact' ? <Contact /> : <DataRequests />}
    </div>
  );
}

export default function AdminInboxPage() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={3} />}>
      <InboxInner />
    </Suspense>
  );
}
