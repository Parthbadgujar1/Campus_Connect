'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Clapperboard, Flame, Gamepad2, Handshake, Heart, LayoutGrid, Laugh, MessageCircle, MessageCircleQuestion, Search, UsersRound } from 'lucide-react';
import { SectionHeader } from '@/components/ui/layout';
import { AmbienceButton } from '@/components/shell/ambience';
import { UnseenDot } from '@/components/ui/unseen';
import { Skeleton } from '@/components/ui/states';
import { Pressable, Reveal, Stagger, StaggerItem } from '@/components/motion';
import { get } from '@/lib/api/client';
import { useQuery, type Page } from '@/lib/api/hooks';
import type { PostView } from '@/lib/api/types';
import type { HomeDiscussion } from '@/lib/api/modules';
import { appActions } from '@/lib/store';
import { useSession } from '@/lib/session';
import { can, type Capability } from '@/lib/roles';
import { ago } from '@/lib/live-time';

// Discover: the social side of campus. Four main places, then the smaller ones, then what is
// trending this week (real posts and discussions, most liked first).

const MAIN: { href: string; title: string; description: string; icon: LucideIcon; needs?: Capability }[] = [
  { href: '/spaces', title: 'Boards', description: 'Spaces, discussions and votes', icon: LayoutGrid, needs: 'spaces' },
  { href: '/loops', title: 'Loops', description: 'Short videos from campus', icon: Clapperboard, needs: 'loops' },
  { href: '/hush', title: 'Hush', description: 'Anonymous questions, honest answers', icon: MessageCircleQuestion, needs: 'hush' },
  { href: '/games', title: 'Playroom', description: 'Quick games for a break', icon: Gamepad2, needs: 'games' },
];

const MORE: { href: string; label: string; description: string; icon: LucideIcon; needs?: Capability }[] = [
  { href: '/trending', label: 'Trending', description: 'The most liked posts this week', icon: Flame },
  { href: '/teams', label: 'Team up', description: 'People looking for teammates', icon: Handshake, needs: 'spaces' },
  { href: '/connect', label: 'Crossed paths', description: 'People in your department and year', icon: UsersRound },
  { href: '/memes', label: 'Meme wall', description: 'Posts tagged #memes', icon: Laugh },
];

export default function DiscoverPage() {
  const { user } = useSession();
  const trending = useQuery<Page<PostView> & { pinned: PostView[] }>('discover:trending', (signal) => get('/feed', { scope: 'trending', limit: 3 }, signal));
  const boards = useQuery<{ items: HomeDiscussion[] }>('discover:boards', (signal) => get('/discussions', { sort: 'top', limit: 3 }, signal));
  const main = MAIN.filter((m) => !m.needs || can(user, m.needs));
  const more = MORE.filter((m) => !m.needs || can(user, m.needs));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-16">
      <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
        <Reveal>
          <h1 className="marker-heading hl-violet text-[30px] font-bold leading-tight tracking-tight md:text-[32px]">Discover</h1>
          <p className="mt-1 text-[14px] text-text-3">{new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' })}{user && user.role !== 'expert' ? ` at ${user.college.shortName}` : ''}</p>
        </Reveal>
        <span className="md:hidden">
          <AmbienceButton />
        </span>
      </header>

      <Link href="/search" className="mt-6 flex h-11 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 text-[15px] text-text-3 transition-colors hover:border-text-3">
        <Search className="h-[18px] w-[18px]" aria-hidden="true" />
        Search people, spaces, notes and events
      </Link>

      <Stagger className="mt-6 grid grid-cols-2 gap-3">
        {main.map((place) => (
          <StaggerItem key={place.href}>
            <Pressable className="h-full">
              <Link href={place.href} onClick={() => appActions.markSeen(place.href)} className="relative flex h-full min-h-[148px] flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
                <UnseenDot href={place.href} />
                <place.icon className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <span className="block text-[17px] font-semibold">{place.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] text-text-3">{place.description}</span>
                </span>
              </Link>
            </Pressable>
          </StaggerItem>
        ))}
      </Stagger>

      <section className="mt-9" aria-label="Trending this week">
        <SectionHeader title="Trending this week" action={{ label: 'See all', href: '/trending' }} />
        {trending.loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : trending.data && trending.data.items.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {trending.data.items.map((p) => (
              <li key={p.id}>
                <Link href={`/post/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[15px]">{p.body}</span>
                    <span className="mt-0.5 flex items-center gap-3 text-[12px] text-text-3">
                      <span>{p.anonymous ? 'Anonymous' : p.author?.displayName}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{p.likesCount}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{p.commentsCount}</span>
                      <span>{ago(p.createdAt)}</span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-text-3">Nothing is trending yet this week.</p>
        )}
      </section>

      {can(user, 'spaces') && boards.data && boards.data.items.length > 0 && (
        <section className="mt-9" aria-label="Top discussions">
          <SectionHeader title="On the boards" action={{ label: 'All boards', href: '/spaces' }} />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {boards.data.items.map((d) => (
              <li key={d.id}>
                <Link href={`/spaces/${d.space.slug}/t/${d.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{d.title}</span>
                    <span className="block truncate text-[12px] text-text-3">{d.space.name} · {d.score} votes · {d.commentsCount} replies</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-9" aria-label="More places">
        <SectionHeader title="More" />
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {more.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => appActions.markSeen(item.href)} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2">
                <item.icon className="h-5 w-5 shrink-0 text-text-2" strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-medium">{item.label}<UnseenDot href={item.href} placement="inline" /></span>
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
