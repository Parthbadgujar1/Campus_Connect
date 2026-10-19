'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { trendingTopics } from '@/data/feed';
import { appActions, useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

// Pulse: what is rising on campus right now. Momentum is the change over the chosen window.
const WINDOWS = ['This hour', 'Today', 'This week'] as const;
type Window = (typeof WINDOWS)[number];

const MULTIPLIER: Record<Window, number> = { 'This hour': 0.12, Today: 0.6, 'This week': 1 };

export default function PulsePage() {
  const [windowed, setWindowed] = useState<Window>('Today');
  const followed = useAppState((s) => s.following);

  const ranked = useMemo(() => {
    return trendingTopics
      .map((topic, i) => {
        const volume = Math.round(topic.posts * MULTIPLIER[windowed]);
        // A stable, made-up momentum per topic so the list reorders with the window.
        const momentum = Math.round(((i * 37 + topic.posts) % 80) + 20 - (windowed === 'This hour' ? 10 : 0));
        return { ...topic, volume, momentum };
      })
      .sort((a, b) => b.momentum - a.momentum);
  }, [windowed]);

  const max = Math.max(...ranked.map((r) => r.volume), 1);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Pulse" subtitle="What is rising on campus" back backHref="/discover" />

      <ChipRow className="mt-4">
        {WINDOWS.map((item) => (
          <Chip key={item} active={windowed === item} onClick={() => setWindowed(item)}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      <ol className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {ranked.map((topic, i) => {
          const isFollowing = followed.includes(`#${topic.tag}`);
          return (
            <li key={topic.tag} className="flex items-center gap-4 px-4 py-4">
              <span className="w-6 shrink-0 text-center text-[16px] font-bold tabular-nums text-text-3">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[16px] font-semibold">
                  #{topic.tag}
                  {topic.momentum >= 70 && <span className="rounded-full bg-highlight px-2 py-px text-[12px] font-semibold text-highlight-ink">Rising</span>}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${topic.volume} posts ${windowed.toLowerCase()}`}>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(6, (topic.volume / max) * 100)}%` }} />
                  </span>
                  <span className="shrink-0 text-[13px] text-text-3">{topic.volume.toLocaleString('en-IN')} posts</span>
                </div>
              </div>
              <Button size="sm" variant={isFollowing ? 'secondary' : 'primary'} aria-pressed={isFollowing} onClick={() => appActions.toggleFollowing(`#${topic.tag}`)}>
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-4">
        <p className="text-[14px] text-text-2">Start a topic by using a hashtag in a post.</p>
        <Link href="/create" className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 text-[14px] font-semibold')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Post
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
