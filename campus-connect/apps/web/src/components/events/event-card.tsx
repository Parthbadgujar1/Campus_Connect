'use client';

import Link from 'next/link';
import { Calendar, MapPin, Users, Video } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import type { CampusEvent } from '@/lib/types';
import { appActions, useAppState } from '@/lib/store';
import { formatDay, formatTime } from '@/lib/time';
import { gradientFor } from '@/lib/visuals';

export function useRsvp(eventId: string) {
  return useAppState((s) => s.rsvp[eventId] ?? null);
}

const month = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' });

/** Going / Interested toggle used on cards and detail pages. */
export function RsvpControl({ eventId, size = 'sm' }: { eventId: string; size?: 'sm' | 'md' }) {
  const rsvp = useRsvp(eventId);
  return (
    <div className="flex gap-2" role="group" aria-label="RSVP">
      <button
        type="button"
        aria-pressed={rsvp === 'going'}
        onClick={() => appActions.setRsvp(eventId, rsvp === 'going' ? null : 'going')}
        className={buttonClass({ variant: rsvp === 'going' ? 'primary' : 'secondary', size })}
      >
        Going
      </button>
      <button
        type="button"
        aria-pressed={rsvp === 'interested'}
        onClick={() => appActions.setRsvp(eventId, rsvp === 'interested' ? null : 'interested')}
        className={buttonClass({ variant: rsvp === 'interested' ? 'soft' : 'ghost', size, className: rsvp === 'interested' ? '' : 'border border-border' })}
      >
        Interested
      </button>
    </div>
  );
}

/**
 * Events read like tickets: a coloured stub with the date, a perforation, and
 * the details on the other side.
 */
export function EventCard({ event, variant = 'row' }: { event: CampusEvent; variant?: 'row' | 'card' }) {
  const rsvp = useRsvp(event.id);
  const going = event.going + (rsvp === 'going' ? 1 : 0);

  if (variant === 'card') {
    return (
      <article className="w-64 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-card md:w-72">
        <Link href={`/events/${event.id}`} className="block">
          <div className="relative flex h-28 items-start justify-between overflow-hidden p-3 text-white" style={{ background: gradientFor(event.seed) }}>
            <span className="relative rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-semibold">{event.category}</span>
            <span className="relative grid w-12 place-items-center rounded-xl bg-white/90 py-1 text-center text-zinc-900">
              <span className="text-[10px] font-bold uppercase">{month(event.startsAt)}</span>
              <span className="font-display text-lg font-semibold leading-none">{day(event.startsAt)}</span>
            </span>
          </div>
          <div className="space-y-1.5 p-4 pb-2">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{event.title}</h3>
            <p className="flex items-center gap-1.5 text-[13px] text-text-3">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDay(event.startsAt)} · {formatTime(event.startsAt)}
            </p>
            <p className="flex items-center gap-1.5 truncate text-[13px] text-text-3">
              {event.isOnline ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="truncate">{event.venue}</span>
            </p>
          </div>
        </Link>
        <div className="flex items-center justify-between gap-2 px-4 pb-4">
          <span className="flex items-center gap-1 text-xs text-text-3">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {going.toLocaleString('en-IN')} going
          </span>
          <Button size="sm" variant={rsvp === 'going' ? 'soft' : 'primary'} onClick={() => appActions.setRsvp(event.id, rsvp === 'going' ? null : 'going')} aria-pressed={rsvp === 'going'}>
            Going
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article className="relative flex overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <Link
        href={`/events/${event.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative grid w-[76px] shrink-0 place-items-center text-white"
        style={{ background: gradientFor(event.seed) }}
      >
        <span className="text-center leading-tight">
          <span className="block text-[10px] font-bold uppercase tracking-widest opacity-90">{month(event.startsAt)}</span>
          <span className="block font-display text-[28px] font-semibold leading-none">{day(event.startsAt)}</span>
          <span className="mt-1 block text-[10px] font-semibold opacity-85">{formatTime(event.startsAt)}</span>
        </span>
      </Link>
      {/* Perforation */}
      <span aria-hidden="true" className="absolute left-[76px] top-0 h-full -translate-x-1/2 border-l-2 border-dashed border-white/60" />
      <span aria-hidden="true" className="absolute -top-2.5 left-[76px] h-5 w-5 -translate-x-1/2 rounded-full border border-border bg-[var(--bg)]" />
      <span aria-hidden="true" className="absolute -bottom-2.5 left-[76px] h-5 w-5 -translate-x-1/2 rounded-full border border-border bg-[var(--bg)]" />

      <div className="min-w-0 flex-1 p-4 pl-5">
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
          {event.category}
          {(event.fee === 'Free' || !event.fee) && <span className="rounded-full bg-success-soft px-2 py-px normal-case tracking-normal text-success">Free</span>}
        </p>
        <Link href={`/events/${event.id}`} className="mt-1 line-clamp-2 block text-[16px] font-semibold leading-snug hover:underline">
          {event.title}
        </Link>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-text-3">
          {event.isOnline ? <Video className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span className="truncate">{event.venue}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-text-3">
            {going.toLocaleString('en-IN')} going · {event.organizer}
          </span>
          <RsvpControl eventId={event.id} />
        </div>
      </div>
    </article>
  );
}
