'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookMarked, CalendarCheck, DoorOpen, ShieldCheck, Sun, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/chip';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { QrCode } from '@/components/common/qr-code';
import { communities } from '@/data/communities';
import { events } from '@/data/events';
import { college, me } from '@/data/people';
import { attendance } from '@/data/learning';
import { useAppState } from '@/lib/store';
import { formatRange } from '@/lib/time';

type Section = 'Access' | 'Library' | 'Clubs' | 'Check-in';

const GATES = [
  { id: 'g1', name: 'Main gate', status: 'Active' },
  { id: 'g2', name: 'Hostel B entry', status: 'Active' },
  { id: 'g3', name: 'Central library', status: 'Active' },
  { id: 'g4', name: 'Innovation Lab (Block C)', status: 'Badge required' },
  { id: 'g5', name: 'Electrical lab 1', status: 'Scheduled' },
];

const BORROWED = [
  { id: 'b1', title: 'Operating System Concepts (Galvin)', due: '22 Oct 2026', overdue: false },
  { id: 'b2', title: 'Database System Concepts', due: '10 Oct 2026', overdue: true },
];

export default function StudentIdPage() {
  const [section, setSection] = useState<Section>('Access');
  const joined = useAppState((s) => s.joined);
  const rsvp = useAppState((s) => s.rsvp);
  const attending = events.filter((e) => rsvp[e.id] === 'going');
  const clubs = communities.filter((c) => joined.includes(c.id));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Digital student ID" back backHref="/campus" subtitle="Use it at gates, labs, the library and events" />

      <div
        className="relative mt-4 overflow-hidden rounded-3xl p-5 text-white shadow-xl"
        style={{ background: '#22377f' }}
      >
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{college.shortName} · Student ID</p>
            <p className="mt-1 text-lg font-bold leading-tight">{college.name}</p>
          </div>
          <Badge tone="success" className="bg-white/15 text-white">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Verified
          </Badge>
        </div>

        <div className="relative mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-2xl font-bold tracking-tight">{me.name}</p>
              <p className="text-sm text-white/80">
                {me.branch} · Year {me.year} · Div {me.division}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-white/60">Roll no.</dt>
                <dd className="font-semibold tabular-nums">CSMSS-23-0142</dd>
              </div>
              <div>
                <dt className="text-white/60">Valid till</dt>
                <dd className="font-semibold">Jun 2027</dd>
              </div>
            </dl>
          </div>
          <div className="shrink-0">
            <QrCode seed={`${me.id}-id`} size={116} label="Your student ID QR code" />
          </div>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-text-3">
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        Turn brightness up when scanning at a gate or event desk.
      </p>

      <div className="mt-6">
        <Segmented<Section>
          label="ID sections"
          value={section}
          onChange={setSection}
          options={[
            { value: 'Access', label: 'Access' },
            { value: 'Library', label: 'Library' },
            { value: 'Clubs', label: 'Clubs' },
            { value: 'Check-in', label: 'Check-in' },
          ]}
        />
      </div>

      <div className="mt-5">
        {section === 'Access' && (
          <Card className="divide-y divide-border">
            {GATES.map((gate) => (
              <div key={gate.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-text-2">
                  <DoorOpen className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex-1 text-[15px] font-medium">{gate.name}</span>
                <Badge tone={gate.status === 'Active' ? 'success' : 'neutral'}>{gate.status}</Badge>
              </div>
            ))}
          </Card>
        )}

        {section === 'Library' && (
          <div className="space-y-4">
            <Card className="divide-y divide-border">
              {BORROWED.map((book) => (
                <div key={book.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-text-2">
                    <BookMarked className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{book.title}</p>
                    <p className={book.overdue ? 'text-xs font-semibold text-danger' : 'text-xs text-text-3'}>
                      Due {book.due}
                      {book.overdue ? ' · overdue' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
            <p className="text-sm text-text-3">
              Library hours: 8 AM – 10 PM (exam week). Digital library access is included with your ID.
            </p>
            <Link href="/resources" className="text-sm font-semibold text-accent hover:underline">
              Open resource hub →
            </Link>
          </div>
        )}

        {section === 'Clubs' && (
          <div>
            <SectionHeader title="Club memberships" description="Shown to club leads for event entry" />
            {clubs.length === 0 ? (
              <EmptyState icon={Users} title="No memberships yet" action={<Link href="/spaces" className="text-sm font-semibold text-accent">Browse spaces</Link>} />
            ) : (
              <Card className="divide-y divide-border">
                {clubs.map((club) => (
                  <Link key={club.id} href={`/spaces/${club.slug}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-2">
                    <span className="text-[15px] font-medium">{club.name}</span>
                    <Badge tone="accent">Member</Badge>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        )}

        {section === 'Check-in' && (
          <div>
            <SectionHeader title="Events you’re going to" description="Show the event code at the desk, or scan the QR" />
            {attending.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No RSVPs yet" description="Mark an event as Going and its check-in code appears here." action={<Link href="/events" className="text-sm font-semibold text-accent">Browse events</Link>} />
            ) : (
              <div className="space-y-3">
                {attending.map((event) => (
                  <Card key={event.id} className="flex items-center gap-4 p-4">
                    <QrCode seed={event.checkInCode} size={84} label={`Check-in code for ${event.title}`} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-semibold leading-snug">{event.title}</p>
                      <p className="mt-1 text-xs text-text-3">{formatRange(event.startsAt, event.endsAt)}</p>
                      <p className="mt-2 font-mono text-sm font-semibold tracking-wider">{event.checkInCode}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-text-3">
        Attendance across {attendance.length} courses is tracked in{' '}
        <Link href="/academics" className="font-semibold text-accent">Academics</Link>.
      </p>
    </div>
  );
}
