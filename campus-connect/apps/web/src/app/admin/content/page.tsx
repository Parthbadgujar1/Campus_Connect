'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Check, ExternalLink, LayoutGrid, X } from 'lucide-react';
import { get, post } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { QueueItem } from '@/lib/api/modules';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Input } from '@/components/ui/fields';
import { Card, EmptyState } from '@/components/ui/layout';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ErrorState, FormAlert, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Stagger, StaggerItem } from '@/components/motion';
import { useSession } from '@/lib/session';
import { ago } from '@/lib/live-time';

type QueueType = 'resource' | 'lecture' | 'event' | 'opportunity' | 'space';
const LABEL: Record<QueueType, string> = { resource: 'Shelf uploads', lecture: 'Lectures', event: 'Events', opportunity: 'Opportunities', space: 'Spaces' };

function Item({ type, item, onDone }: { type: QueueType; item: QueueItem; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const decide = useAction(async (decision: 'approve' | 'reject') => {
    await post(`/admin/queue/${type}/${item.id}`, { decision, note: note.trim() || undefined });
    toast(decision === 'approve' ? 'Approved and live' : 'Rejected');
    invalidate('admin:overview');
    onDone();
  });
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <PersonAvatar person={item.submittedBy} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.title}</p>
          <p className="text-[13px] text-text-3">{item.submittedBy?.displayName ?? 'Deleted user'} · {ago(item.submittedAt)}</p>
        </div>
        <Link href={item.link} target="_blank" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">Preview <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note to the person (optional; helpful when rejecting)" aria-label="Review note" />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void decide.run('approve')} disabled={decide.pending}><Check className="h-4 w-4" aria-hidden="true" /> Approve</Button>
        <Button size="sm" variant="secondary" onClick={() => void decide.run('reject')} disabled={decide.pending}><X className="h-4 w-4" aria-hidden="true" /> Reject</Button>
      </div>
      {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
    </Card>
  );
}

function ContentInner() {
  const { user } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const allowed: QueueType[] = user?.role === 'faculty' ? ['resource', 'lecture'] : ['resource', 'lecture', 'event', 'opportunity', 'space'];
  const asked = params.get('tab') as QueueType | null;
  const tab: QueueType = asked && allowed.includes(asked) ? asked : allowed[0]!;
  const queue = useQuery<Record<QueueType, QueueItem[]>>('admin:queue', (signal) => get('/admin/queue', undefined, signal));
  const items = queue.data?.[tab] ?? [];
  return (
    <div>
      <ChipRow>
        {allowed.map((t) => (
          <Chip key={t} active={tab === t} onClick={() => router.replace(`/admin/content?tab=${t}`, { scroll: false })}>
            {LABEL[t]}{queue.data ? ` · ${queue.data[t]?.length ?? 0}` : ''}
          </Chip>
        ))}
      </ChipRow>
      <div className="mt-4">
        {queue.loading && <SkeletonList variant="card" count={3} />}
        {queue.error && <ErrorState error={queue.error} onRetry={queue.reload} />}
        {queue.data && !items.length && <EmptyState icon={LayoutGrid} title={`No ${LABEL[tab].toLowerCase()} waiting`} description="New submissions appear here, oldest first." />}
        {items.length > 0 && (
          <Stagger className="grid gap-3 md:grid-cols-2">
            {items.map((it) => (
              <StaggerItem key={it.id}>
                <Item type={tab} item={it} onDone={() => queue.setData((d) => (d ? { ...d, [tab]: d[tab].filter((x) => x.id !== it.id) } : d))} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
        {items.length >= 50 && <p className="mt-3 text-center text-[13px] text-text-3">Showing the 50 oldest. More appear as you review these.</p>}
      </div>
    </div>
  );
}

export default function AdminContentPage() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={3} />}>
      <ContentInner />
    </Suspense>
  );
}
