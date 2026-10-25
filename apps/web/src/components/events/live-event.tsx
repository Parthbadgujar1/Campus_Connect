'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Award, CalendarDays, Check, ImagePlus, MapPin, Plus, Users } from 'lucide-react';
import { post, upload } from '@/lib/api/client';
import { invalidate, useAction } from '@/lib/api/hooks';
import type { EventView, FileView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/fields';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable } from '@/components/motion';
import { gradientFor } from '@/lib/visuals';
import { monthDay, time, toLocalInput } from '@/lib/live-time';
import { cn } from '@/lib/utils';

export const CATEGORY_LABEL: Record<string, string> = {
  hackathon: 'Hackathon',
  workshop: 'Workshop',
  seminar: 'Seminar',
  webinar: 'Webinar',
  competition: 'Competition',
  cultural: 'Cultural',
  sports: 'Sports',
  club: 'Club',
  meetup: 'Meetup',
  fest: 'Fest',
  placement: 'Placement',
  academic: 'Academic',
};

/** The event's cover photo, or a calm colour field when there is none. */
export function EventCover({ event, className }: { event: Pick<EventView, 'id' | 'title' | 'cover'>; className?: string }) {
  const src = event.cover?.thumbnailUrl ?? event.cover?.url;
  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)} style={src ? undefined : { background: gradientFor(event.id) }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

export function EventCard({ e }: { e: EventView }) {
  const md = monthDay(e.startsAt);
  const full = e.spotsLeft === 0;
  return (
    <Pressable>
      <Link href={`/events/${e.id}`} className="block overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-colors hover:border-accent/40">
        <div className="relative">
          <EventCover event={e} className="h-36" />
          <span className="absolute left-3 top-3 grid h-14 w-14 place-items-center rounded-xl bg-surface-solid/95 text-center shadow-card">
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase text-accent">{md.month}</span>
              <span className="block text-[20px] font-bold">{md.day}</span>
            </span>
          </span>
          {e.status === 'cancelled' && <span className="absolute right-3 top-3 rounded-full bg-danger px-2.5 py-1 text-[12px] font-semibold text-white">Cancelled</span>}
        </div>
        <div className="p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-3">{CATEGORY_LABEL[e.category] ?? e.category} · {e.organizerName}</p>
          <h3 className="mt-1 line-clamp-2 text-[17px] font-semibold leading-snug">{e.title}</h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-text-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />{time(e.startsAt)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-text-2"><MapPin className="h-4 w-4" aria-hidden="true" /><span className="truncate">{e.isOnline ? 'Online' : e.venue}</span></p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {e.myRsvp === 'going' && <Badge tone="success">You’re going</Badge>}
            {e.myRsvp === 'interested' && <Badge tone="info">Interested</Badge>}
            {e.status === 'pending' && <Badge tone="warning">Waiting for approval</Badge>}
            <span className={cn('inline-flex items-center gap-1 text-[13px]', full ? 'font-semibold text-danger' : 'text-text-3')}>
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {full ? 'Full' : `${e.spotsLeft} spot${e.spotsLeft === 1 ? '' : 's'} left`}
            </span>
            {e.hasCertificate && <span className="inline-flex items-center gap-1 text-[13px] text-text-3"><Award className="h-3.5 w-3.5" aria-hidden="true" />Certificate</span>}
            {e.feeText && <span className="text-[13px] text-text-3">{e.feeText}</span>}
          </div>
        </div>
      </Link>
    </Pressable>
  );
}

export function CreateEventSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const start = new Date(Date.now() + 2 * 86_400_000);
  start.setMinutes(0, 0, 0);
  const [form, setForm] = useState({ title: '', category: 'workshop', startsAt: toLocalInput(start), endsAt: toLocalInput(new Date(start.getTime() + 2 * 3_600_000)), venue: '', capacity: '50', description: '', feeText: '', onlineUrl: '' });
  const [isOnline, setOnline] = useState(false);
  const [certificate, setCertificate] = useState(false);
  const [cover, setCover] = useState<FileView | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const pick = useAction(async (f: File) => setCover(await upload<FileView>('event', f)));
  const send = useAction(async () => {
    const res = await post<{ id: string; status: string; message: string }>('/events', {
      title: form.title.trim(),
      category: form.category,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      venue: form.venue.trim() || (isOnline ? 'Online' : ''),
      capacity: Number(form.capacity),
      description: form.description.trim() || undefined,
      feeText: form.feeText.trim() || undefined,
      isOnline,
      onlineUrl: isOnline ? form.onlineUrl.trim() : undefined,
      hasCertificate: certificate,
      coverFileId: cover?.id,
    });
    toast(res.message);
    invalidate('events:');
    onClose();
  });
  const fields = send.error && 'fields' in send.error ? (send.error as { fields: Record<string, string> }).fields : {};
  const ready = form.title.trim().length >= 3 && Number(form.capacity) >= 1 && (isOnline ? /^https:\/\//.test(form.onlineUrl.trim()) : form.venue.trim().length >= 2);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Create an event"
      description="Student events are checked by the college before they are listed."
      footer={
        <Button full onClick={() => void send.run()} disabled={!ready || send.pending} aria-busy={send.pending}>
          {send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Create event
        </Button>
      }
    >
      <div className="space-y-4">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick.run(f); e.target.value = ''; }} />
        <button type="button" onClick={() => input.current?.click()} className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2 text-[14px] font-semibold text-text-2">
          {cover?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.thumbnailUrl ?? cover.url} alt="Event cover" className="absolute inset-0 h-full w-full object-cover" />
          ) : pick.pending ? (
            <Spinner label="Uploading" />
          ) : (
            <span className="flex items-center gap-2"><ImagePlus className="h-5 w-5" aria-hidden="true" /> Add a cover photo (optional)</span>
          )}
          {cover && <span className="absolute bottom-2 right-2 rounded-full bg-surface-solid px-2 py-0.5 text-[12px]"><Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Change</span>}
        </button>
        {pick.error && <FormAlert>{pick.error.message}</FormAlert>}
        <Field label="Title" htmlFor="ev-title" hint={fields.title}>
          <Input id="ev-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="ev-cat">
            <Select id="ev-cat" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Seats" htmlFor="ev-cap" hint={fields.capacity}>
            <Input id="ev-cap" type="number" min={1} max={100000} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="ev-start" hint={fields.startsAt}>
            <Input id="ev-start" type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor="ev-end" hint={fields.endsAt}>
            <Input id="ev-end" type="datetime-local" value={form.endsAt} min={form.startsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </Field>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <Switch checked={isOnline} onChange={setOnline} label="Online event" description="People get the meeting link after they RSVP" />
          <Switch checked={certificate} onChange={setCertificate} label="Certificate for attendees" />
        </div>
        {isOnline ? (
          <Field label="Meeting link" htmlFor="ev-url" hint={fields.onlineUrl}>
            <Input id="ev-url" value={form.onlineUrl} onChange={(e) => set('onlineUrl', e.target.value)} placeholder="https://meet.google.com/…" inputMode="url" />
          </Field>
        ) : (
          <Field label="Venue" htmlFor="ev-venue" hint={fields.venue}>
            <Input id="ev-venue" value={form.venue} onChange={(e) => set('venue', e.target.value)} maxLength={160} placeholder="Seminar Hall, Lab 2…" />
          </Field>
        )}
        <Field label="Entry fee (optional)" htmlFor="ev-fee">
          <Input id="ev-fee" value={form.feeText} onChange={(e) => set('feeText', e.target.value)} maxLength={60} placeholder="Free, or ₹100 for the kit" />
        </Field>
        <Field label="Details" htmlFor="ev-desc">
          <Textarea id="ev-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} rows={4} />
        </Field>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}
