'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Clapperboard, Gamepad2, Globe, Handshake, Laugh, MessageCircleQuestion, Palette, Search, TrendingUp, UsersRound, LayoutGrid } from 'lucide-react';
import { SectionHeader } from '@/components/ui/layout';
import { AmbienceButton } from '@/components/shell/ambience';
import { watchParties } from '@/data/fun';
import { hushQuestions } from '@/data/hush';
import { spaces } from '@/data/spaces';
import { loops } from '@/data/videos';
import { studyingNow } from '@/data/circles';
import { NOW } from '@/lib/time';

// Discover: the social side of campus. Four main places, then the smaller ones.

const MAIN: { href: string; title: string; description: string; icon: LucideIcon; count: string }[] = [
  { href: '/spaces', title: 'Boards', description: 'Threads, votes and replies from your spaces', icon: LayoutGrid, count: `${spaces.length} spaces` },
  { href: '/loops', title: 'Loops', description: 'Short videos you can scroll all day', icon: Clapperboard, count: `${loops.length}+ loops` },
  { href: '/hush', title: 'Hush', description: 'Anonymous questions, answered by people who know', icon: MessageCircleQuestion, count: `${hushQuestions.length} questions` },
  { href: '/games', title: 'Playroom', description: 'Quick games, and live tables you can join', icon: Gamepad2, count: 'Live tables' },
];

const MORE: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: '/trending', label: 'Pulse', description: 'Topics rising on campus this hour', icon: TrendingUp },
  { href: '/creators', label: 'Makers', description: 'Student projects that want collaborators', icon: Palette },
  { href: '/network', label: 'Beyond campus', description: 'Other colleges and meetups in your city', icon: Globe },
  { href: '/memes', label: 'Meme wall', description: 'Campus humour and this week’s contest', icon: Laugh },
  { href: '/connect', label: 'Crossed paths', description: 'People you share a class or hostel with', icon: Handshake },
];

export default function DiscoverPage() {
  const live = [
    ...watchParties.filter((w) => w.live).map((w) => ({ id: w.id, title: w.title, meta: `Watch party · ${w.viewers} watching`, href: `/watch/party/${w.id}` })),
    ...spaces.flatMap((s) =>
      s.voice.filter((v) => v.memberIds.length > 0).map((v) => ({ id: `${s.slug}-${v.id}`, title: `${v.name} · ${s.name}`, meta: `Voice room · ${v.memberIds.length} talking`, href: `/spaces/${s.slug}?tab=rooms` })),
    ),
  ].slice(0, 2);
  const studying = studyingNow.filter((s) => s.open).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-16">
      <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[32px]">Discover</h1>
          <p className="mt-1 text-[14px] text-text-3">{NOW.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' })}</p>
        </div>
        <span className="md:hidden">
          <AmbienceButton />
        </span>
      </header>

      <Link href="/search" className="mt-6 flex h-11 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 text-[15px] text-text-3 transition-colors hover:border-text-3">
        <Search className="h-[18px] w-[18px]" aria-hidden="true" />
        Search people, spaces and videos
      </Link>

      <section aria-label="Main places" className="mt-6 grid grid-cols-2 gap-3">
        {MAIN.map((place) => (
          <Link key={place.href} href={place.href} className="press flex min-h-[156px] flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
            <place.icon className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
            <span>
              <span className="block text-[17px] font-semibold">{place.title}</span>
              <span className="mt-0.5 line-clamp-2 block text-[13px] text-text-3">{place.description}</span>
              <span className="mt-2 block text-[12px] font-semibold text-text-2">{place.count}</span>
            </span>
          </Link>
        ))}
      </section>

      {live.length > 0 && (
        <section className="mt-9" aria-label="Live now">
          <SectionHeader title="Live now" />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {live.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-label="Live" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{item.title}</span>
                    <span className="block truncate text-[13px] text-text-3">{item.meta}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-text-3">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            {studying} people are focusing right now. <Link href="/study" className="font-semibold text-accent">Study together</Link>
          </p>
        </section>
      )}

      <section className="mt-9" aria-labelledby="more-places">
        <SectionHeader title="More" />
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {MORE.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2">
                <item.icon className="h-5 w-5 shrink-0 text-text-2" strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{item.label}</span>
                  <span className="block truncate text-[13px] text-text-3">{item.description}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
