'use client';

import Link from 'next/link';
import { Brain, Grid2x2, Shuffle, Zap, type LucideIcon } from 'lucide-react';
import { PageHeader, SectionHeader } from '@/components/ui/layout';
import { UnseenDot } from '@/components/ui/unseen';
import { Pressable, Stagger, StaggerItem } from '@/components/motion';
import { appActions } from '@/lib/store';

const QUICK: { href: string; title: string; description: string; time: string; icon: LucideIcon }[] = [
  { href: '/games/memory', title: 'Memory garden', description: 'Match the pairs, fewest moves wins', time: '2 min', icon: Grid2x2 },
  { href: '/games/reflex', title: 'Reflex ripple', description: 'Tap the moment the circle glows', time: '1 min', icon: Zap },
  { href: '/games/quiz', title: 'Tech trivia', description: 'Five questions, fifteen seconds each', time: '3 min', icon: Brain },
  { href: '/games/scramble', title: 'Word scramble', description: 'Unscramble the words from campus life', time: '2 min', icon: Shuffle },
];

/** Discover → Playroom: short solo games for a break between classes. They run on this device. */
export default function PlayroomPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Playroom" subtitle="Quick games for a short break" back backHref="/discover" />
      <section className="mt-4" aria-label="Quick games">
        <SectionHeader title="Quick games" description="Play on your own, a minute or two each" />
        <Stagger className="grid grid-cols-2 gap-3">
          {QUICK.map((game) => (
            <StaggerItem key={game.href}>
              <Pressable className="h-full">
                <Link
                  href={game.href}
                  onClick={() => appActions.markSeen(game.href)}
                  className="relative flex h-full min-h-[156px] flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/40"
                >
                  <UnseenDot href={game.href} />
                  <game.icon className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
                  <span>
                    <span className="block text-[17px] font-semibold">{game.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-text-3">{game.description}</span>
                    <span className="mt-2 block text-[12px] font-semibold text-text-2">{game.time}</span>
                  </span>
                </Link>
              </Pressable>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
      <p className="mt-8 text-center text-[13px] text-text-3">Want to play with people? Start a thread in a <Link href="/spaces" className="font-semibold text-accent">space</Link> or plan a game night in <Link href="/chats" className="font-semibold text-accent">Chats</Link>.</p>
    </div>
  );
}
