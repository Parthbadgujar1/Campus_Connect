'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { Card, EmptyState, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { contentQueue } from '@/data/admin';
import { communities } from '@/data/communities';
import { events } from '@/data/events';
import { resources } from '@/data/learning';
import { relativeTime } from '@/lib/time';

type Tab = 'Queue' | 'Communities' | 'Events' | 'Clubs' | 'Resources';

export default function AdminContentPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Queue');
  const [done, setDone] = useState<string[]>([]);

  const pendingResources = resources.filter((r) => !r.approved);
  const queue = contentQueue.filter((c) => !done.includes(c.id));

  const act = (id: string, verb: 'Approved' | 'Rejected') => {
    setDone((d) => [...d, id]);
    toast(`${verb}. The submitter is notified.`);
  };

  return (
    <div className="space-y-5 px-4 pb-28 md:px-8 md:pb-12">
      <UnderlineTabs<Tab>
        label="Content sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'Queue', label: 'Queue', count: queue.length },
          { value: 'Communities', label: 'Communities' },
          { value: 'Events', label: 'Events' },
          { value: 'Clubs', label: 'Clubs' },
          { value: 'Resources', label: 'Resources', count: pendingResources.length },
        ]}
      />

      {tab === 'Queue' && (
        <section className="space-y-3">
          <SectionHeader title="Waiting for approval" description="New communities, clubs, events and shared resources" />
          {queue.length === 0 && <EmptyState icon={Check} title="Nothing waiting" />}
          {queue.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">{item.kind}</Badge>
                  <span className="text-xs text-text-3">{relativeTime(item.at)} ago</span>
                </div>
                <p className="mt-1 font-semibold">{item.title}</p>
                <p className="text-xs text-text-3">Submitted by {item.submittedBy}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(item.id, 'Approved')}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => act(item.id, 'Rejected')}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {tab === 'Communities' && (
        <section className="space-y-3">
          {communities
            .filter((c) => c.kind !== 'Club')
            .map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-text-3">
                    {c.kind} · {c.privacy} · {c.members.toLocaleString('en-IN')} members · {c.moderators.join(', ')}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toast('Community settings open (demo)')}>
                  Manage
                </Button>
              </Card>
            ))}
        </section>
      )}

      {tab === 'Events' && (
        <section className="space-y-3">
          {events.map((e) => (
            <Card key={e.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.title}</p>
                <p className="text-xs text-text-3">
                  {e.category} · {e.organizer} · {e.going} going
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => toast('Event editor opens (demo)')}>
                Edit
              </Button>
            </Card>
          ))}
        </section>
      )}

      {tab === 'Clubs' && (
        <section className="space-y-3">
          {communities
            .filter((c) => c.kind === 'Club')
            .map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-text-3">Lead: {c.lead ?? c.moderators[0]} · {c.projects.length} projects</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toast('Club profile editor opens (demo)')}>
                  Manage
                </Button>
              </Card>
            ))}
        </section>
      )}

      {tab === 'Resources' && (
        <section className="space-y-3">
          {pendingResources.length === 0 && <EmptyState icon={Check} title="No resources pending" />}
          {pendingResources.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.title}</p>
                <p className="text-xs text-text-3">
                  {r.kind} · {r.subject} · Sem {r.semester}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(r.id, 'Approved')}>
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => act(r.id, 'Rejected')}>
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
