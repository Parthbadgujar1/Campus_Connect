'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Plus, Search } from 'lucide-react';
import { EventCard } from '@/components/events/event-card';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Input } from '@/components/ui/fields';
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { events, eventCategories } from '@/data/events';
import { useAppState } from '@/lib/store';
import { NOW, dayHeading, dayKey } from '@/lib/time';

type View = 'Upcoming' | 'Going' | 'Past';

export default function EventsPage() {
  const [view, setView] = useState<View>('Upcoming');
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');
  const rsvp = useAppState((s) => s.rsvp);
  const toast = useToast();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nowMs = NOW.getTime();
    return events
      .filter((e) => {
        if (view === 'Past') return new Date(e.endsAt).getTime() < nowMs;
        if (new Date(e.endsAt).getTime() < nowMs) return false;
        return view === 'Upcoming' || rsvp[e.id] === 'going';
      })
      .filter((e) => category === 'All' || e.category === category)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q)))
      .sort((a, b) => (view === 'Past' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
  }, [view, category, query, rsvp]);

  // Group by calendar day so the list reads like an agenda.
  const groups = list.reduce<Record<string, typeof list>>((acc, event) => {
    const key = dayKey(event.startsAt);
    (acc[key] ??= []).push(event);
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Events"
        subtitle="Hackathons, workshops, fests and placement drives"
        back
        backHref="/"
        actions={
          <button
            type="button"
            aria-label="Suggest an event"
            onClick={() => toast('Clubs and admins submit events for approval')}
            className="press grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink shadow-card"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        }
      />

      <div className="mt-4 space-y-4">
        <Segmented<View>
          label="Event views"
          value={view}
          onChange={setView}
          options={[
            { value: 'Upcoming', label: 'Upcoming' },
            { value: 'Going', label: 'Going' },
            { value: 'Past', label: 'Past' },
          ]}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events or tags"
            aria-label="Search events"
            className="rounded-full pl-10"
          />
        </div>

        <ChipRow>
          {['All', ...eventCategories].map((item) => (
            <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
              {item}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={view === 'Going' ? 'You have no RSVPs yet' : 'No events match'}
          description={view === 'Going' ? 'Tap Going on an event to add it to your agenda and your ID check-in.' : 'Try another category or search term.'}
          className="mt-8"
          action={
            view === 'Going' ? (
              <Button variant="soft" onClick={() => setView('Upcoming')}>
                Browse upcoming events
              </Button>
            ) : undefined
          }
        />
      ) : (
        Object.entries(groups).map(([key, dayEvents]) => (
          <section key={key} className="mt-6">
            <SectionHeader title={dayHeading(dayEvents[0]!.startsAt)} description={`${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`} />
            <div className="stagger space-y-3">
              {dayEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
