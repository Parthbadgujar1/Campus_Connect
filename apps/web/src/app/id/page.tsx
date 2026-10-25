'use client';

import Link from 'next/link';
import { BadgeCheck, CalendarCheck, ChevronRight, Ticket } from 'lucide-react';
import { get } from '@/lib/api/client';
import { useQuery, type Page } from '@/lib/api/hooks';
import type { EventView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { SkeletonList } from '@/components/ui/states';
import { QrCode } from '@/components/common/qr-code';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { Reveal } from '@/components/motion';
import { useSession } from '@/lib/session';
import { ROLE_LABEL } from '@/lib/roles';
import { dateTime } from '@/lib/live-time';

// My campus card: who you are on CampusConnect, with a QR code that opens your profile (handy to
// share your contact at a fest), and quick access to your event tickets. It is not an official
// college ID card.

export default function CampusCardPage() {
  const { user } = useSession();
  const tickets = useQuery<Page<EventView>>('events:list:mine:card', (signal) => get('/events', { when: 'mine', limit: 20 }, signal));
  if (!user) return null;
  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile/${user.profile.username}` : `/profile/${user.profile.username}`;
  const going = (tickets.data?.items ?? []).filter((e) => e.myRsvp === 'going' && e.status === 'published' && new Date(e.endsAt) > new Date());
  const detail = user.role === 'student'
    ? [user.profile.department, user.profile.year ? `Year ${user.profile.year}` : null, user.profile.division ? `Div ${user.profile.division}` : null].filter(Boolean).join(' · ')
    : [user.roleInfo.designation, user.roleInfo.organization ?? user.profile.department].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="My campus card" back backHref="/you" subtitle="Your details and event tickets in one place" />
      <Reveal>
        <div className="relative mt-2 overflow-hidden rounded-3xl bg-[#22377f] p-5 text-white shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{user.role === 'expert' ? 'Industry expert' : user.college.shortName} · CampusConnect</p>
              <p className="mt-1 truncate text-[16px] font-bold leading-tight">{user.role === 'expert' ? 'CampusConnect mentor network' : user.college.name}</p>
            </div>
            {user.profile.isVerified && (
              <Badge className="bg-white/15 text-white" icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}>
                Verified
              </Badge>
            )}
          </div>
          <div className="mt-6 flex items-end justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3">
                <PersonAvatar person={{ id: user.id, displayName: user.profile.displayName, avatarUrl: user.profile.avatarUrl, username: user.profile.username }} size="lg" className="ring-2 ring-white/40" />
                <div className="min-w-0">
                  <p className="truncate text-[22px] font-bold tracking-tight">{user.profile.displayName}</p>
                  <p className="truncate text-sm text-white/80">@{user.profile.username}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <dt className="text-white/60">Role</dt>
                  <dd className="font-semibold">{ROLE_LABEL[user.role]}{user.pendingRole ? ` (${user.pendingRole} pending)` : ''}</dd>
                </div>
                {detail && (
                  <div>
                    <dt className="text-white/60">{user.role === 'student' ? 'Class' : 'Details'}</dt>
                    <dd className="font-semibold">{detail}</dd>
                  </div>
                )}
                {user.roleInfo.enrollmentNumber && (
                  <div>
                    <dt className="text-white/60">Enrolment no.</dt>
                    <dd className="font-semibold tabular-nums">{user.roleInfo.enrollmentNumber}</dd>
                  </div>
                )}
                {user.roleInfo.employeeId && (
                  <div>
                    <dt className="text-white/60">Employee ID</dt>
                    <dd className="font-semibold tabular-nums">{user.roleInfo.employeeId}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="shrink-0 text-center">
              <QrCode value={profileUrl} size={112} label="QR code that opens your profile" />
              <p className="mt-1 text-[10px] text-white/70">Scan to open profile</p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[12px] text-text-3">This card is for CampusConnect only; it is not an official college ID.</p>
      </Reveal>

      <section className="mt-8" aria-label="Event tickets">
        <SectionHeader title="Event tickets" description="Show the QR on the event page at the entrance" />
        {tickets.loading && <SkeletonList variant="row" count={2} />}
        {!tickets.loading && !going.length && <EmptyState icon={Ticket} title="No tickets yet" description="RSVP “Going” to an event and its ticket shows up here." action={<Link href="/events" className="font-semibold text-accent">Browse events</Link>} />}
        {going.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {going.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                  <CalendarCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.title}</span>
                    <span className="block truncate text-[13px] text-text-3">{dateTime(e.startsAt)} · {e.venue}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
