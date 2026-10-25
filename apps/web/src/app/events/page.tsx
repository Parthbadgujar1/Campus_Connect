'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CalendarDays, Plus, Search } from 'lucide-react';
import { get, withQuery } from '@/lib/api/client';
import { useInfinite, type Page } from '@/lib/api/hooks';
import type { EventView } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Input } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { SkeletonList } from '@/components/ui/states';
import { Reveal } from '@/components/motion';
import { CATEGORY_LABEL, CreateEventSheet, EventCard } from '@/components/events/live-event';
import { useSession } from '@/lib/session';
import { can } from '@/lib/roles';

type When = 'upcoming' | 'mine' | 'organizing' | 'past';

function EventsInner() {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const when = (params.get('when') as When) || 'upcoming';
  const category = params.get('category');
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(params.get('create') === '1');
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { when: when === 'upcoming' ? null : when, category, q: q || null, ...next }), { scroll: false });
  const list = useInfinite<EventView>(`events:list:${when}:${category}:${q}`, (cursor, signal) => get<Page<EventView>>('/events', { when, category: category ?? undefined, q: q || undefined, cursor: cursor ?? undefined, limit: 12 }, signal));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Events"
        subtitle="Fests, workshops, talks and meetups"
        back
        backHref="/campus"
        actions={
          can(user, 'events.create') && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Create
            </Button>
          )
        }
      />
      <Reveal className="space-y-3">
        <Segmented<When>
          label="Which events"
          value={when}
          onChange={(v) => go({ when: v === 'upcoming' ? null : v })}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'mine', label: 'My RSVPs' },
            { value: 'organizing', label: 'Organising' },
            { value: 'past', label: 'Past' },
          ]}
        />
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events, venues or tags" className="pl-10" aria-label="Search events" enterKeyHint="search" />
        </form>
        <ChipRow>
          <Chip active={!category} onClick={() => go({ category: null })}>All</Chip>
          {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
            <Chip key={v} active={category === v} onClick={() => go({ category: v })}>{l}</Chip>
          ))}
        </ChipRow>
      </Reveal>
      <div className="mt-4">
        <InfiniteList
          state={list}
          skeleton="card"
          className="grid gap-4 sm:grid-cols-2"
          empty={{ icon: CalendarDays, title: when === 'mine' ? 'No RSVPs yet' : when === 'organizing' ? 'You have not organised an event' : 'No events here', description: when === 'upcoming' ? 'Nothing is scheduled for this filter yet.' : undefined, action: when === 'organizing' && can(user, 'events.create') ? <Button onClick={() => setCreating(true)}>Create an event</Button> : undefined }}
          endMessage={when === 'past' ? 'That’s every past event' : 'That’s everything on the calendar'}
          render={(e) => <EventCard e={e} />}
        />
      </div>
      <CreateEventSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={4} className="mx-auto mt-24 max-w-4xl px-4" />}>
      <EventsInner />
    </Suspense>
  );
}
