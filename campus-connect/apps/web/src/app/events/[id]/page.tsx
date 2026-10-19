'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Calendar, CalendarDays, CalendarPlus, Clock, Gift, MapPin, MessageCircle, Share2, Ticket, UsersRound, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { RsvpControl, useRsvp } from '@/components/events/event-card';
import { QrCode } from '@/components/common/qr-code';
import { Card, DetailHero, EmptyState, MetaLine, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { getEvent } from '@/data/events';
import { getPerson } from '@/data/people';
import { communities } from '@/data/communities';
import { formatLongDate, formatRange, deadlineLabel, daysUntil } from '@/lib/time';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const event = getEvent(id);
  const rsvp = useRsvp(id);
  const toast = useToast();

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Event" back backHref="/events" />
        <EmptyState icon={CalendarDays} title="Event not found" className="mt-6" />
      </div>
    );
  }

  const going = event.going + (rsvp === 'going' ? 1 : 0);
  const closed = daysUntil(event.registrationDeadline) < 0;
  const organizer = communities.find((c) => c.slug === event.organizerSlug);
  const attendees = event.attendeeIds.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Event" back backHref="/events" actions={
        <button type="button" aria-label="Share event" onClick={() => toast('Event link copied (demo)')} className="grid h-10 w-10 place-items-center rounded-full text-text-2 hover:bg-surface-2">
          <Share2 className="h-5 w-5" aria-hidden="true" />
        </button>
      } />

      <div className="mt-2 md:mt-4 md:grid md:grid-cols-[minmax(0,1fr)_280px] md:items-start md:gap-6">
        <div className="space-y-5">
          <DetailHero seed={event.seed} icon={Calendar} eyebrow={event.category} title={event.title}>
            <MetaLine icon={Clock}>{formatRange(event.startsAt, event.endsAt)}</MetaLine>
            <MetaLine icon={event.isOnline ? Video : MapPin}>{event.venue}</MetaLine>
            <MetaLine icon={UsersRound}>
              Organised by{' '}
              {organizer ? (
                <Link href={`/spaces/${organizer.slug}`} className="font-semibold text-accent hover:underline">
                  {event.organizer}
                </Link>
              ) : (
                event.organizer
              )}
            </MetaLine>
          </DetailHero>

          <Card className="space-y-4 p-5">
            <SectionHeader title="About this event" />
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-text-2">{event.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <Badge key={tag}>#{tag}</Badge>
              ))}
            </div>
          </Card>

          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-3">Registration</p>
              <p className="font-semibold">{closed ? 'Registration closed' : deadlineLabel(event.registrationDeadline)}</p>
              <p className="text-xs text-text-3">Closes {formatLongDate(event.registrationDeadline)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-3">Fee & perks</p>
              <p className="flex items-center gap-2 font-semibold">
                <Ticket className="h-4 w-4 text-text-3" aria-hidden="true" />
                {event.fee ?? 'Free'}
              </p>
              {event.certificate && (
                <p className="flex items-center gap-2 text-sm text-text-2">
                  <Gift className="h-4 w-4 text-text-3" aria-hidden="true" />
                  Certificate of participation
                </p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{going.toLocaleString('en-IN')} going</span>
                <span className="text-text-3">
                  {event.capacity.toLocaleString('en-IN')} seats · {event.interested.toLocaleString('en-IN')} interested
                </span>
              </div>
              <ProgressBar value={going} max={event.capacity} label="Seats filled" />
            </div>
          </Card>

          <section>
            <SectionHeader title="Who’s going" description={`${attendees.length} of ${going} shown`} />
            {attendees.length === 0 ? (
              <EmptyState icon={UsersRound} title="Be the first to say you're going" />
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                {attendees.map((id) => {
                  const person = getPerson(id);
                  return (
                    <Link key={id} href={`/profile/${person.username}`} className="flex items-center gap-2 text-sm">
                      <Avatar name={person.name} seed={person.id} size="sm" />
                      <span className="font-medium">{person.name.split(' ')[0]}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="mt-5 space-y-4 md:sticky md:top-6 md:mt-0">
          <Card className="space-y-4 p-5">
            <p className="font-semibold">Your RSVP</p>
            <RsvpControl eventId={event.id} size="md" />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => toast('Added to your calendar (demo)')}>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Add to calendar
              </Button>
              {event.chatId ? (
                <Link href={`/chats/${event.chatId}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Event chat
                </Link>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => toast('Event chat opens after you RSVP (demo)')}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Event chat
                </Button>
              )}
            </div>
          </Card>

          {rsvp === 'going' ? (
            <Card className="flex flex-col items-center gap-3 p-5 text-center">
              <QrCode seed={event.checkInCode} size={150} label={`Check-in code for ${event.title}`} />
              <p className="text-sm font-semibold">Check-in code {event.checkInCode}</p>
              <p className="text-xs text-text-3">Show this at the entry desk, or find it in your student ID.</p>
              <Link href="/id" className="text-sm font-semibold text-accent hover:underline">
                Open digital ID
              </Link>
            </Card>
          ) : (
            <Card className="p-5 text-sm text-text-3">
              <p className="font-semibold text-text">Check-in opens after you RSVP as Going.</p>
              <p className="mt-1">Your QR code is generated for you then.</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
