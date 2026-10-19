'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Bus, Calendar, Plane, Plus, Train, Users, Car } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, ProgressBar } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { trips } from '@/data/living';
import { getPerson } from '@/data/people';
import { formatDay, formatTime, daysUntil } from '@/lib/time';
import { formatINR } from '@/lib/visuals';
import type { Trip } from '@/lib/types';

type View = 'Find' | 'Matches' | 'Mine';
const TRANSPORT = ['All', 'Train', 'Bus', 'Flight', 'Cab'] as const;

const TRANSPORT_ICON = { Train, Bus, Flight: Plane, Cab: Car } as const;

export default function TravelPage() {
  const toast = useToast();
  const [view, setView] = useState<View>('Find');
  const [transport, setTransport] = useState<(typeof TRANSPORT)[number]>('All');
  const [requested, setRequested] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const me = 'me';

  const visible = trips.filter((t) => (transport === 'All' || t.transport === transport) && daysUntil(t.departs) >= 0);
  const mine = trips.filter((t) => t.memberIds.includes(me));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Travel"
        subtitle="Trip partners for trains, buses, flights and cabs"
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create trip
          </Button>
        }
      />

      <div className="mt-4 space-y-4">
        <Segmented<View>
          label="Travel sections"
          value={view}
          onChange={setView}
          options={[
            { value: 'Find', label: 'Find trips' },
            { value: 'Matches', label: 'Matches' },
            { value: 'Mine', label: 'My trips', count: mine.length },
          ]}
        />
        {view === 'Find' && (
          <ChipRow>
            {TRANSPORT.map((item) => (
              <Chip key={item} active={transport === item} onClick={() => setTransport(item)}>
                {item}
              </Chip>
            ))}
          </ChipRow>
        )}
      </div>

      {view === 'Find' && (
        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {visible.length === 0 && <EmptyState icon={Plane} title="No trips for this transport" className="md:col-span-2" />}
          {visible.map((trip) => (
            <TripCard key={trip.id} trip={trip} requested={requested.includes(trip.id)} onRequest={() => { setRequested((r) => [...r, trip.id]); toast(`Requested a seat on the ${trip.destination} trip`); }} />
          ))}
        </section>
      )}

      {view === 'Matches' && (
        <section className="mt-5 space-y-3">
          <p className="rounded-2xl bg-accent-soft p-4 text-sm text-accent-soft-ink">
            Matched on destination, dates, transport and budget. Your own budget is ₹1,500–₹2,500.
          </p>
          {[...visible].sort((a, b) => b.seats - b.seatsTaken - (a.seats - a.seatsTaken)).slice(0, 3).map((trip) => (
            <Link key={trip.id} href={`/travel/${trip.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/40">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{trip.destination}</p>
                <p className="text-xs text-text-3">
                  {formatDay(trip.departs)} · {trip.purpose} · {trip.seats - trip.seatsTaken} seats left
                </p>
              </div>
              <Badge tone="success">{trip.budget <= 2500 ? 'Budget match' : 'Stretch budget'}</Badge>
              <ArrowRight className="h-4 w-4 text-text-3" aria-hidden="true" />
            </Link>
          ))}
        </section>
      )}

      {view === 'Mine' && (
        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {mine.length === 0 ? (
            <EmptyState icon={Users} title="No trips yet" description="Join a trip or create one to start a group chat and split expenses." className="md:col-span-2" />
          ) : (
            mine.map((trip) => <TripCard key={trip.id} trip={trip} requested={true} onRequest={() => {}} />)
          )}
        </section>
      )}

      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a trip"
        description="Others can join, and you get a group chat and expense tracker"
        footer={<Button full onClick={() => { setCreateOpen(false); toast('Trip posted (demo)'); }}>Post trip</Button>}
      >
        <div className="space-y-4">
          <Field label="Destination" htmlFor="tr-dest">
            <Input id="tr-dest" placeholder="e.g. Shirdi" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Leaving" htmlFor="tr-date">
              <Input id="tr-date" type="date" />
            </Field>
            <Field label="Transport" htmlFor="tr-transport">
              <Select id="tr-transport">
                <option>Train</option>
                <option>Bus</option>
                <option>Flight</option>
                <option>Cab</option>
              </Select>
            </Field>
            <Field label="Seats available" htmlFor="tr-seats">
              <Input id="tr-seats" type="number" min={1} max={12} defaultValue={4} />
            </Field>
            <Field label="Budget per person (₹)" htmlFor="tr-budget">
              <Input id="tr-budget" inputMode="numeric" placeholder="2000" />
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function TripCard({ trip, requested, onRequest }: { trip: Trip; requested: boolean; onRequest: () => void }) {
  const Icon = TRANSPORT_ICON[trip.transport];
  const seatsLeft = trip.seats - trip.seatsTaken;
  const members = trip.memberIds.slice(0, 4);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/travel/${trip.id}`} className="block truncate text-[17px] font-semibold hover:underline">
            {trip.destination}
          </Link>
          <p className="truncate text-xs text-text-3">From {trip.from}</p>
        </div>
        <Badge tone="accent" icon={<Icon className="h-3 w-3" aria-hidden="true" />}>
          {trip.transport}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-2">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-text-3" aria-hidden="true" />
          {formatDay(trip.departs)} · {formatTime(trip.departs)}
        </span>
        <span>{trip.purpose}</span>
        <span className="font-semibold text-text">{formatINR(trip.budget)} est.</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-text-3">
          <span>{seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left` : 'Full'}</span>
          <span>
            {trip.seatsTaken}/{trip.seats}
          </span>
        </div>
        <ProgressBar value={trip.seatsTaken} max={trip.seats} label="Seats taken" />
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex -space-x-2">
          {members.map((id) => {
            const p = getPerson(id);
            return <Avatar key={id} name={p.name} seed={p.id} size="sm" ring />;
          })}
        </div>
        {trip.memberIds.includes('me') ? (
          <Link href={`/travel/${trip.id}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            Open trip
          </Link>
        ) : (
          <Button size="sm" disabled={seatsLeft <= 0 || requested} onClick={onRequest}>
            {requested ? 'Requested' : seatsLeft <= 0 ? 'Full' : 'Request seat'}
          </Button>
        )}
      </div>
    </Card>
  );
}
