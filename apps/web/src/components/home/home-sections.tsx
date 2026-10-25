'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, CalendarDays, Flame, Gamepad2, Play, Search, Tag, Users, Heart } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { SectionHeader } from '@/components/ui/layout';
import { Skeleton } from '@/components/ui/states';
import { get } from '@/lib/api/client';
import { useQuery, type Page } from '@/lib/api/hooks';
import type { EventView, OpportunityView, PostView, SpaceView } from '@/lib/api/types';
import type { ListingView, LostFoundView } from '@/lib/api/modules';
import { daysLeft, monthDay, rupees, time } from '@/lib/live-time';
import { QUIZ_BANK } from '@/lib/quiz-bank';
import { gradientFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** Re-renders on an interval so countdowns stay true while the page is open. */
function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Each home section rises in a beat after the one above it (Calm motion switches this off globally). */
export function Reveal({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}>
      {children}
    </div>
  );
}

const CHIPS = [
  { href: '/loops', label: 'Loops', icon: Play, tone: 'bg-[#302675] text-white' },
  { href: '/spaces', label: 'Spaces', icon: Users, tone: 'bg-[#b8f28b] text-[#0a0a0a]' },
  { href: '/hush', label: 'Hush', icon: Flame, tone: 'bg-[#ffd9a8] text-[#3a2208]' },
  { href: '/games/quiz', label: 'Quiz', icon: Gamepad2, tone: 'bg-[#d9d2f7] text-[#241a5c]' },
  { href: '/events', label: 'Events', icon: CalendarDays, tone: 'bg-[#bfdbfe] text-[#12306b]' },
  { href: '/lost-found', label: 'Lost & found', icon: Search, tone: 'bg-[#fbcfe8] text-[#5b1a3a]' },
  { href: '/marketplace', label: 'Market', icon: Tag, tone: 'bg-[#bbf7d0] text-[#0d3b1f]' },
] as const;

/** One-tap jumps to the busiest corners of campus. */
export function QuickChips() {
  return (
    <nav aria-label="Jump to" className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {CHIPS.map(({ href, label, icon: Icon, tone }) => (
        <Link key={href} href={href} className={cn('press font-sans flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-transform hover:-translate-y-0.5', tone)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function greeting(): string {
  const hour = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  if (hour < 21) return 'Good evening,';
  return 'Good night,';
}

/** "In 18 min", "Today · 4:30 pm", "In 2 days": how soon something starts. */
function startsIn(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return 'Happening now';
  if (mins < 60) return `In ${mins} min`;
  if (mins < 24 * 60) return `In ${Math.round(mins / 60)} hr`;
  const days = Math.round(mins / (24 * 60));
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

/** The big card: the next event on campus, with the next one and the closest deadline beside it. */
export function UpNext() {
  useTick(30_000);
  const events = useQuery<Page<EventView>>('home:events', (s) => get('/events', { limit: 3 }, s));
  const opps = useQuery<Page<OpportunityView>>('home:opps', (s) => get('/opportunities', { limit: 3 }, s));
  const [first, second] = events.data?.items ?? [];
  const closing = opps.data?.items[0];

  if (events.loading) return <Skeleton className="h-44 w-full rounded-[28px]" />;
  if (!first) {
    return (
      <Link href="/events?create=1" className="press flex items-center justify-between rounded-[28px] bg-[#302675] p-6 text-white">
        <span>
          <span className="block text-[12px] font-bold uppercase tracking-widest text-[#b8f28b]">Nothing planned yet</span>
          <span className="mt-1 block text-[22px] font-bold leading-tight">Start something. Host the first event.</span>
        </span>
        <ArrowUpRight className="h-6 w-6 shrink-0 text-[#b8f28b]" aria-hidden="true" />
      </Link>
    );
  }
  const md = second ? monthDay(second.startsAt) : null;
  const days = closing ? daysLeft(closing.deadline) : null;
  return (
    <div className="space-y-3">
      <Link href={`/events/${first.id}`} className="press relative block overflow-hidden rounded-[28px] bg-[#302675] p-5 text-white shadow-float">
        <span aria-hidden="true" className="animate-spin-slow pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full border-[26px] border-white/[0.07] border-t-[#b8f28b]/30" />
        <span aria-hidden="true" className="animate-float pointer-events-none absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-[#b8f28b]/15" />
        <span className="relative flex items-center justify-between gap-3">
          <span className="font-sans flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-[#b8f28b]">
            <span aria-hidden="true" className="animate-breathe h-2 w-2 rounded-full bg-[#b8f28b]" />
            Up next · {startsIn(first.startsAt)}
          </span>
          {first.myRsvp === 'going' && <span className="font-sans rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">You’re going</span>}
        </span>
        <span className="relative mt-3 block max-w-[85%] text-[26px] font-bold leading-[1.1] tracking-tight">{first.title}</span>
        <span className="relative mt-2 block text-[13px] text-white/75">{first.organizerName} · {first.venue} · {time(first.startsAt)}</span>
        <span className="relative mt-4 flex items-center gap-2">
          <span className="font-sans rounded-full bg-[#b8f28b] px-3.5 py-1.5 text-[13px] font-bold text-[#0a0a0a]">{first.myRsvp === 'going' ? 'View event' : 'See details'}</span>
          <span className="font-sans text-[12px] text-white/70">{first.goingCount} going</span>
        </span>
      </Link>

      {(second || closing) && (
        <div className="grid grid-cols-2 gap-3">
          {second && md ? (
            <Link href={`/events/${second.id}`} className="press flex min-h-[168px] flex-col justify-between rounded-[24px] bg-[#b8f28b] p-4 text-[#0a0a0a]">
              <span className="flex items-start justify-between">
                <span className="leading-none">
                  <span className="font-sans block text-[12px] font-bold uppercase tracking-widest">{md.month}</span>
                  <span className="block text-[44px] font-bold leading-none tracking-tight">{md.day}</span>
                </span>
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="line-clamp-2 block text-[17px] font-bold leading-tight">{second.title}</span>
                <span className="font-sans mt-1.5 block text-[12px] font-semibold">{second.goingCount} going</span>
              </span>
            </Link>
          ) : <span />}
          {closing && days !== null ? (
            <Link href={`/opportunities/${closing.id}`} className="press flex min-h-[168px] flex-col justify-between rounded-[24px] border border-border bg-surface p-4 shadow-card">
              <span className={cn('font-sans text-[12px] font-bold uppercase tracking-widest', days <= 3 ? 'text-danger' : 'text-text-3')}>
                {days <= 0 ? 'Closes today' : `Closes in ${days} ${days === 1 ? 'day' : 'days'}`}
              </span>
              <span>
                <span className="line-clamp-3 block text-[19px] font-bold leading-tight">{closing.title}</span>
                <span className="mt-1 block truncate text-[13px] text-text-3">{closing.orgName}</span>
              </span>
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}

function loopCover(p: PostView): string | null {
  const video = p.attachments.find((a) => a.kind === 'video');
  return p.cover?.thumbnailUrl ?? p.cover?.url ?? video?.thumbnailUrl ?? null;
}

/** A shelf of short videos to tap into: the part of the app that keeps people scrolling. */
export function LoopsStrip() {
  const q = useQuery<Page<PostView>>('home:loops', (s) => get('/feed', { scope: 'loops', limit: 8 }, s));
  if (q.error || (!q.loading && !q.data?.items.length)) return null;
  return (
    <section aria-label="Loops">
      <SectionHeader tone="violet" title="Loops" description="Short videos from your campus" action={{ label: 'Watch all', href: '/loops' }} />
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {q.loading
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-60 w-36 shrink-0 rounded-3xl" />)
          : q.data!.items.map((p) => {
              const cover = loopCover(p);
              return (
                <Link key={p.id} href={`/loops?id=${p.id}`} className="press relative flex h-60 w-36 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-3xl bg-[#302675] p-3 text-white transition-transform hover:-translate-y-1" style={cover ? undefined : { background: `linear-gradient(160deg, ${gradientFor(p.id)}, #302675)` }}>
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
                  <span aria-hidden="true" className="animate-breathe absolute left-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/40 backdrop-blur"><Play className="h-3.5 w-3.5 fill-white" /></span>
                  <span className="relative line-clamp-2 text-[14px] font-bold leading-tight">{p.body || 'Watch this loop'}</span>
                  <span className="font-sans relative mt-1 flex items-center justify-between text-[11px] text-white/80">
                    <span className="truncate">@{p.author?.username ?? 'anonymous'}</span>
                    <span className="flex shrink-0 items-center gap-1"><Heart className="h-3 w-3" aria-hidden="true" />{compact(p.likesCount)}</span>
                  </span>
                </Link>
              );
            })}
      </div>
    </section>
  );
}

/** Spaces worth joining, as colourful tiles. */
export function SpacesStrip() {
  const suggested = useQuery<{ items: SpaceView[] }>('spaces:suggested', (s) => get('/spaces/suggested', { limit: 8 }, s));
  // New accounts have nothing to suggest yet; show the spaces people are joining instead.
  const empty = !suggested.loading && !suggested.data?.items.length;
  const popular = useQuery<Page<SpaceView>>(empty ? 'home:spaces' : null, (s) => get('/spaces', { limit: 8 }, s));
  const q = empty ? popular : suggested;
  if (q.error || (!q.loading && !q.data?.items.length)) return null;
  return (
    <section aria-label="Spaces for you">
      <SectionHeader tone="blue" title="Spaces for you" description="Clubs, classes and communities" action={{ label: 'See all', href: '/spaces' }} />
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {q.loading
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 w-36 shrink-0 rounded-3xl" />)
          : q.data!.items.map((s) => (
              <Link key={s.id} href={`/spaces/${s.slug}`} className="press flex h-32 w-36 shrink-0 flex-col justify-between rounded-3xl p-3.5 text-white" style={{ background: gradientFor(s.slug) }}>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-[16px] font-bold">{s.name.slice(0, 1)}</span>
                <span>
                  <span className="line-clamp-1 block text-[15px] font-bold leading-tight">{s.name}</span>
                  <span className="font-sans mt-0.5 flex items-center gap-1 text-[11px] text-white/85"><Users className="h-3 w-3" aria-hidden="true" />{compact(s.membersCount)} members</span>
                </span>
              </Link>
            ))}
      </div>
    </section>
  );
}

/** The daily quiz and the hottest anonymous question, side by side. */
export function PlayAndAsk() {
  const hush = useQuery<Page<{ id: string; topic: string; body: string; answersCount: number }>>('home:hush', (s) => get('/hush', { sort: 'top', limit: 3 }, s));
  const reduceMotion = useAppState((s) => s.reduceMotion);
  const [turn, setTurn] = useState(0);
  const count = hush.data?.items.length ?? 0;
  // Rotates through the hottest questions so the card keeps changing; stays put in Calm mode.
  useEffect(() => {
    if (reduceMotion || count < 2) return;
    const id = setInterval(() => setTurn((n) => n + 1), 6000);
    return () => clearInterval(id);
  }, [reduceMotion, count]);
  const top = hush.data?.items[count ? turn % count : 0];
  return (
    <section aria-label="Play and ask" className="grid grid-cols-2 gap-3">
      <Link href="/games/quiz" className="press flex min-h-[176px] flex-col justify-between rounded-[24px] bg-[#b8f28b] p-4 text-[#0a0a0a]">
        <span className="flex items-center justify-between">
          <span className="font-sans text-[12px] font-bold uppercase tracking-widest">Daily quiz</span>
          <Gamepad2 className="animate-float h-6 w-6" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-[26px] font-bold leading-[1.05] tracking-tight">Beat your class</span>
          <span className="font-sans mt-1.5 block text-[12px] font-semibold">{QUIZ_BANK.length} questions to play</span>
        </span>
      </Link>
      <Link href={top ? `/hush/${top.id}` : '/hush'} className="press flex min-h-[176px] flex-col justify-between rounded-[24px] border border-border bg-surface p-4 shadow-card">
        <span className="flex items-center justify-between">
          <span className="font-sans text-[12px] font-bold uppercase tracking-widest text-text-3">Hush</span>
          <Flame className="h-5 w-5 text-warning" aria-hidden="true" />
        </span>
        {hush.loading ? <Skeleton className="h-16 w-full" /> : top ? (
          <span key={top.id} className="animate-fade">
            <span className="line-clamp-4 block text-[15px] font-bold leading-snug">{top.body}</span>
            <span className="font-sans mt-1.5 block text-[12px] text-text-3">{top.answersCount} {top.answersCount === 1 ? 'answer' : 'answers'} · anonymous</span>
          </span>
        ) : (
          <span className="text-[16px] font-bold leading-snug">Ask anything, anonymously.</span>
        )}
      </Link>
    </section>
  );
}

/** What is lost and what is for sale: the two boards students check every day. */
export function CampusFinds() {
  const lost = useQuery<Page<LostFoundView>>('home:lost', (s) => get('/lost-found', { include: 'open', limit: 1 }, s));
  const market = useQuery<Page<ListingView>>('home:market', (s) => get('/listings', { sort: 'new', limit: 1 }, s));
  const l = lost.data?.items[0];
  const m = market.data?.items[0];
  if (!l && !m) return null;
  return (
    <section aria-label="Lost and found, and marketplace" className="grid grid-cols-2 gap-3">
      {l ? (
        <Link href={`/lost-found?id=${l.id}`} className="press flex min-h-[150px] flex-col justify-between rounded-[24px] bg-[#1c1c1c] p-4 text-white">
          <span className="font-sans flex items-center justify-between text-[12px] font-bold uppercase tracking-widest text-[#ffb4a2]">
            {l.kind === 'lost' ? 'Lost' : 'Found'}
            <Search className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="line-clamp-2 block text-[16px] font-bold leading-tight">{l.title}</span>
            <span className="mt-1 block truncate text-[12px] text-white/70">{l.location}</span>
          </span>
        </Link>
      ) : <span />}
      {m ? (
        <Link href={`/marketplace/${m.id}`} className="press flex min-h-[150px] flex-col justify-between rounded-[24px] border border-border bg-surface p-4 shadow-card">
          <span className="font-sans flex items-center justify-between text-[12px] font-bold uppercase tracking-widest text-accent">
            Marketplace
            <Tag className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[28px] font-bold leading-none tracking-tight">{m.mode === 'free' ? 'Free' : rupees(m.pricePaise)}</span>
            <span className="line-clamp-2 mt-1.5 block text-[14px] font-semibold leading-snug">{m.title}</span>
          </span>
        </Link>
      ) : <span />}
    </section>
  );
}
