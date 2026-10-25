'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { Award, CalendarDays, CalendarPlus, Camera, CheckCircle2, Clock, ExternalLink, MapPin, Star, Ticket, Users, XCircle } from 'lucide-react';
import { del, get, isApiError, post, put } from '@/lib/api/client';
import { invalidate, useAction, useQuery, type Page } from '@/lib/api/hooks';
import type { PersonSummary } from '@/lib/api/types';
import type { EventDetail } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Input, Textarea } from '@/components/ui/fields';
import { Card, MetaLine, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { QrCode } from '@/components/common/qr-code';
import { Reveal } from '@/components/motion';
import { CATEGORY_LABEL, EventCover } from '@/components/events/live-event';
import { dateTime, longDate, time } from '@/lib/live-time';

/** The ticket: a QR that changes every 30 seconds, so a screenshot stops working. */
function CheckInTicket({ id, title }: { id: string; title: string }) {
  const code = useQuery<{ qr: string; code: string; expiresAt: string; checkedIn: boolean }>(`events:code:${id}`, (signal) => get(`/events/${id}/check-in-code`, undefined, signal), { refreshMs: 25_000 });
  if (code.loading) return <SkeletonList variant="tile" count={1} />;
  if (code.error) return <ErrorState error={code.error} onRetry={code.reload} compact />;
  if (!code.data) return null;
  if (code.data.checkedIn) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
        <p className="font-semibold">You are checked in. Enjoy the event!</p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col items-center gap-3 p-5 text-center">
      <QrCode value={code.data.qr} size={200} label={`Check-in code for ${title}`} />
      <p className="font-mono text-[15px] font-semibold tracking-wider">{code.data.code}</p>
      <p className="text-[13px] text-text-3">Show this at the entrance. It refreshes on its own every 30 seconds.</p>
    </Card>
  );
}

/** Organisers scan tickets with the camera (where the browser can), or type the code shown. */
function Scanner({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const video = useRef<HTMLVideoElement | null>(null);
  const [manual, setManual] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [cameraState, setCameraState] = useState<'off' | 'on' | 'unsupported'>('off');
  const checkIn = useAction(async (qr: string) => {
    try {
      const r = await post<{ person: PersonSummary | null; checkedInAt: string }>(`/events/${id}/check-in`, { qr });
      setResult({ ok: true, text: `${r.person?.displayName ?? 'Guest'} checked in at ${time(r.checkedInAt)}` });
      toast('Checked in');
      invalidate(`events:attendees:${id}`);
    } catch (err) {
      setResult({ ok: false, text: isApiError(err) ? err.message : 'Could not check in.' });
    }
  });

  useEffect(() => {
    if (!open) return;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = '';
    const detector = new Detector({ formats: ['qr_code'] });
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        setCameraState('on');
        timer = setInterval(async () => {
          if (!video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          const value = codes[0]?.rawValue;
          if (value && value !== last && value.startsWith('cc-checkin:')) {
            last = value;
            void checkIn.run(value);
          }
        }, 600);
      })
      .catch(() => setCameraState('unsupported'));
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, checkIn]);

  return (
    <Sheet open={open} onClose={onClose} title="Check people in" description="Point the camera at a ticket, or type the code under it.">
      <div className="space-y-4">
        {cameraState !== 'unsupported' ? (
          <video ref={video} muted playsInline className="aspect-square w-full rounded-2xl bg-black object-cover" aria-label="Camera preview" />
        ) : (
          <FormAlert tone="info">This browser cannot scan with the camera. Ask for the 10-character code under the QR and paste the full ticket text below.</FormAlert>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void checkIn.run(manual.trim());
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="cc-checkin:…" aria-label="Ticket text" autoCapitalize="none" spellCheck={false} />
          <Button type="submit" disabled={checkIn.pending}>{checkIn.pending ? <Spinner /> : 'Check in'}</Button>
        </form>
        {result && <FormAlert tone={result.ok ? 'success' : 'error'}>{result.text}</FormAlert>}
      </div>
    </Sheet>
  );
}

function Attendees({ id }: { id: string }) {
  const [status, setStatus] = useState<'going' | 'interested'>('going');
  const list = useQuery<Page<PersonSummary & { checkedInAt: string | null }>>(`events:attendees:${id}:${status}`, (signal) => get(`/events/${id}/attendees`, { status, limit: 50 }, signal));
  return (
    <div className="space-y-3">
      <Segmented label="Attendee list" value={status} onChange={setStatus} options={[{ value: 'going', label: 'Going' }, { value: 'interested', label: 'Interested' }]} />
      {list.loading && <SkeletonList variant="row" count={3} />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} compact />}
      {list.data && (list.data.items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {list.data.items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <PersonAvatar person={p} size="sm" link />
              <span className="min-w-0 flex-1"><PersonName person={p} /></span>
              {p.checkedInAt ? <Badge tone="success">Checked in {time(p.checkedInAt)}</Badge> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-text-3">Nobody yet.</p>
      ))}
    </div>
  );
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const q = useQuery<EventDetail>(`events:one:${id}`, (signal) => get(`/events/${id}`, undefined, signal));
  const [scanning, setScanning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const rsvp = useAction(async (status: 'going' | 'interested' | null) => {
    type Rsvp = { myRsvp: EventDetail['myRsvp']; goingCount: number; interestedCount?: number; spotsLeft: number };
    const res = status ? await put<Rsvp>(`/events/${id}/rsvp`, { status }) : await del<Rsvp>(`/events/${id}/rsvp`);
    q.setData((e) => (e ? { ...e, myRsvp: res.myRsvp ?? null, goingCount: res.goingCount, spotsLeft: res.spotsLeft, interestedCount: res.interestedCount ?? e.interestedCount } : e));
    invalidate('events:list', 'home:events');
    toast(status === 'going' ? 'You’re going! Your ticket is below.' : status === 'interested' ? 'Marked as interested' : 'RSVP removed');
    if (status === 'going') q.reload();
  });
  const cancel = useAction(async () => {
    await post(`/events/${id}/cancel`, { reason: reason.trim() || undefined });
    setCancelling(false);
    q.reload();
    invalidate('events:');
    toast('Event cancelled. Everyone who signed up was told.');
  });

  const e = q.data;
  const ended = e ? new Date(e.endsAt) < new Date() : false;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Event" back backHref="/events" />
      {q.loading && <SkeletonList variant="card" count={2} />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {e && (
        <Reveal className="space-y-6">
          <Card className="overflow-hidden">
            <EventCover event={e} className="h-48 md:h-64" />
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{CATEGORY_LABEL[e.category] ?? e.category}</Badge>
                {e.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
                {e.status === 'pending' && <Badge tone="warning">Waiting for approval</Badge>}
                {e.myRsvp === 'going' && <Badge tone="success">You’re going</Badge>}
              </div>
              <h2 className="mt-2 text-[26px] font-bold leading-tight">{e.title}</h2>
              <p className="mt-1 text-[14px] text-text-2">by {e.space ? <Link href={`/spaces/${e.space.slug}`} className="font-semibold hover:underline">{e.organizerName}</Link> : e.organizerName}</p>
              <div className="mt-4 space-y-2">
                <MetaLine icon={CalendarDays}>{longDate(e.startsAt)}</MetaLine>
                <MetaLine icon={Clock}>{time(e.startsAt)} – {dateTime(e.endsAt)}</MetaLine>
                <MetaLine icon={MapPin}>{e.isOnline ? (e.onlineUrl ? <a href={e.onlineUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">Join online <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /></a> : 'Online (link after you RSVP)') : e.venue}</MetaLine>
                <MetaLine icon={Users}>{e.goingCount} going · {e.interestedCount} interested · {e.spotsLeft === 0 ? 'full' : `${e.spotsLeft} of ${e.capacity} spots left`}</MetaLine>
                {e.registrationDeadline && <MetaLine icon={Ticket}>Register by {dateTime(e.registrationDeadline)}</MetaLine>}
                {e.hasCertificate && <MetaLine icon={Award}>Certificate for attendees</MetaLine>}
                {e.feeText && <MetaLine icon={Star}>{e.feeText}</MetaLine>}
              </div>
              {e.description && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{e.description}</p>}
              {e.friendsGoing.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex -space-x-2">{e.friendsGoing.map((p) => <PersonAvatar key={p.id} person={p} size="xs" className="ring-2 ring-surface" />)}</div>
                  <p className="text-[13px] text-text-2">{e.friendsGoing.map((p) => p.displayName.split(' ')[0]).join(', ')} {e.friendsGoing.length === 1 ? 'is' : 'are'} going</p>
                </div>
              )}
            </div>
          </Card>

          {!ended && e.status === 'published' && (
            <section aria-label="Your RSVP" className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void rsvp.run('going')} disabled={rsvp.pending || e.myRsvp === 'going' || e.spotsLeft === 0 || !e.registrationOpen} variant={e.myRsvp === 'going' ? 'soft' : 'primary'}>
                  {rsvp.pending ? <Spinner /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {e.spotsLeft === 0 && e.myRsvp !== 'going' ? 'Full' : 'Going'}
                </Button>
                <Button variant={e.myRsvp === 'interested' ? 'soft' : 'secondary'} onClick={() => void rsvp.run('interested')} disabled={rsvp.pending || e.myRsvp === 'interested'}>
                  <Star className="h-4 w-4" aria-hidden="true" /> Interested
                </Button>
                {e.myRsvp && !e.checkedIn && (
                  <Button variant="ghost" onClick={() => void rsvp.run(null)} disabled={rsvp.pending}>
                    <XCircle className="h-4 w-4" aria-hidden="true" /> Remove RSVP
                  </Button>
                )}
                <a href={`/api/v1/events/${e.id}/calendar.ics`} className={buttonClass({ variant: 'secondary' })}>
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
                </a>
              </div>
              {rsvp.error && <FormAlert>{rsvp.error.message}</FormAlert>}
              {e.spotsLeft === 0 && e.myRsvp !== 'going' && <p className="text-[13px] text-text-3">This event is full. Mark yourself as interested to hear if a seat opens.</p>}
            </section>
          )}

          {e.myRsvp === 'going' && e.status === 'published' && !ended && (
            <section aria-label="Your ticket">
              <SectionHeader title="Your ticket" />
              <CheckInTicket id={e.id} title={e.title} />
            </section>
          )}

          {e.canManage && (
            <section aria-label="Organiser tools" className="space-y-4">
              <SectionHeader title="Organiser tools" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setScanning(true)} disabled={e.status !== 'published'}>
                  <Camera className="h-4 w-4" aria-hidden="true" /> Check people in
                </Button>
                {e.status !== 'cancelled' && !ended && (
                  <Button variant="danger" onClick={() => setCancelling(true)}>
                    Cancel event
                  </Button>
                )}
              </div>
              <Attendees id={e.id} />
            </section>
          )}
        </Reveal>
      )}
      <Scanner id={id} open={scanning} onClose={() => setScanning(false)} />
      <ConfirmDialog open={cancelling} onClose={() => setCancelling(false)} onConfirm={() => void cancel.run()} title="Cancel this event?" description="Everyone who signed up is notified. This cannot be undone." confirmLabel="Cancel event" danger pending={cancel.pending} error={cancel.error?.message}>
        <label htmlFor="cancel-reason" className="text-sm font-semibold">Reason (shown to attendees)</label>
        <Textarea id="cancel-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={300} rows={2} />
      </ConfirmDialog>
    </div>
  );
}
