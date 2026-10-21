'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowBigUp, Bell, CalendarClock, ChevronRight, ClipboardCheck, Flag, Megaphone, MessageCircleQuestion, ShieldCheck, Upload, Users, X } from 'lucide-react';
import { Composer } from '@/components/feed/composer';
import { LivePostCard } from '@/components/feed/live-post-card';
import { AmbienceButton } from '@/components/shell/ambience';
import { UnderlineTabs } from '@/components/ui/chip';
import { SectionHeader } from '@/components/ui/layout';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ErrorState, LoadMore, Skeleton, SkeletonList } from '@/components/ui/states';
import { get } from '@/lib/api/client';
import { useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { EventView, OpportunityView, PersonSummary, PostView } from '@/lib/api/types';
import { ago, daysLeft, monthDay, time } from '@/lib/live-time';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useState, Suspense } from 'react';

type Scope = 'all' | 'following' | 'campus' | 'class';

function Upcoming() {
  const q = useQuery<Page<EventView>>('home:events', (s) => get('/events', { limit: 3 }, s));
  if (q.error) return <ErrorState compact error={q.error} onRetry={q.reload} />;
  if (q.loading) return <SkeletonList variant="tile" count={3} className="md:grid-cols-3" />;
  if (!q.data!.items.length) return <p className="rounded-2xl border border-dashed border-border p-5 text-center text-[14px] text-text-3">No events coming up. <Link href="/events?create=1" className="font-semibold text-accent">Create one</Link></p>;
  return (
    <div className="stagger grid gap-3 md:grid-cols-3">
      {q.data!.items.map((e) => {
        const md = monthDay(e.startsAt);
        return (
          <Link key={e.id} href={`/events/${e.id}`} className="press flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:border-accent/40">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-accent-soft text-center text-accent-soft-ink">
              <span className="leading-tight">
                <span className="block text-[11px] font-semibold uppercase">{md.month}</span>
                <span className="block text-[20px] font-bold">{md.day}</span>
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{e.title}</span>
              <span className="mt-0.5 block truncate text-[13px] text-text-3">{time(e.startsAt)} · {e.venue}</span>
              {e.myRsvp === 'going' && <span className="font-sans mt-1 inline-block rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">You’re going</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Closing() {
  const q = useQuery<Page<OpportunityView>>('home:opps', (s) => get('/opportunities', { limit: 3 }, s));
  if (q.error) return <ErrorState compact error={q.error} onRetry={q.reload} />;
  if (q.loading) return <SkeletonList variant="row" count={3} />;
  if (!q.data!.items.length) return <p className="rounded-2xl border border-dashed border-border p-5 text-center text-[14px] text-text-3">Nothing closing soon.</p>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {q.data!.items.map((o) => {
        const days = daysLeft(o.deadline);
        return (
          <li key={o.id}>
            <Link href={`/opportunities/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
              <CalendarClock className={cn('h-5 w-5 shrink-0', days <= 3 ? 'text-warning' : 'text-text-3')} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{o.title}</span>
                <span className="block truncate text-[13px] text-text-3">{o.orgName}</span>
              </span>
              <span className={cn('font-sans shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', days <= 3 ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-text-2')}>
                {days <= 0 ? 'Today' : `${days} days`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Notices() {
  const q = useQuery<Page<{ id: string; title: string; authorLabel: string; publishedAt: string; pinned: boolean; category: string }>>('home:notices', (s) => get('/announcements', { limit: 3 }, s));
  if (q.error) return <ErrorState compact error={q.error} onRetry={q.reload} />;
  if (q.loading) return <SkeletonList variant="row" count={3} />;
  if (!q.data!.items.length) return <p className="rounded-2xl border border-dashed border-border p-5 text-center text-[14px] text-text-3">No notices right now.</p>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {q.data!.items.map((n) => (
        <li key={n.id}>
          <Link href={`/news?id=${n.id}`} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
            <Megaphone className={cn('mt-0.5 h-5 w-5 shrink-0', n.category === 'important' ? 'text-danger' : 'text-accent')} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-snug">{n.title}</span>
              <span className="mt-0.5 block text-[13px] text-text-3">{n.authorLabel} · {ago(n.publishedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Boards() {
  const q = useQuery<{ items: Array<{ id: string; title: string; score: number; commentsCount: number; space: { slug: string; name: string }; author: PersonSummary }> }>('home:discussions', (s) => get('/discussions', { sort: 'top', limit: 3 }, s));
  if (q.error) return <ErrorState compact error={q.error} onRetry={q.reload} />;
  if (q.loading) return <SkeletonList variant="row" count={3} />;
  if (!q.data!.items.length) return <p className="rounded-2xl border border-dashed border-border p-5 text-center text-[14px] text-text-3">Join a space to see its discussions here. <Link href="/spaces" className="font-semibold text-accent">Browse spaces</Link></p>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {q.data!.items.map((t) => (
        <li key={t.id}>
          <Link href={`/spaces/${t.space.slug}/t/${t.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2">
            <span className="flex w-10 shrink-0 flex-col items-center text-text-2">
              <ArrowBigUp className="h-5 w-5" aria-hidden="true" />
              <span className="text-[13px] font-semibold">{t.score}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-text-3">{t.space.name} · {t.author.displayName.split(' ')[0]} · {t.commentsCount} replies</span>
              <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{t.title}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HushPreview() {
  const q = useQuery<Page<{ id: string; topic: string; body: string; answersCount: number }>>('home:hush', (s) => get('/hush', { sort: 'top', limit: 3 }, s));
  if (q.error) return <ErrorState compact error={q.error} onRetry={q.reload} />;
  if (q.loading) return <SkeletonList variant="row" count={3} />;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {q.data!.items.map((h) => (
        <li key={h.id}>
          <Link href={`/hush/${h.id}`} className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2">
            <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold capitalize text-text-3">{h.topic.replace('_', ' ')}</span>
              <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{h.body}</span>
              <span className="mt-1 block text-[13px] text-text-3">{h.answersCount} {h.answersCount === 1 ? 'answer' : 'answers'}</span>
            </span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PeopleRow() {
  const q = useQuery<Page<PersonSummary & { isFollowing: boolean }>>('home:people', (s) => get('/users', { limit: 12 }, s));
  if (q.loading) return <div className="flex gap-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-16 shrink-0 rounded-full" />)}</div>;
  if (q.error || !q.data?.items.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="list" aria-label="People at your college">
      {q.data.items.map((p) => (
        <Link key={p.id} href={`/profile/${p.username}`} role="listitem" className="press flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
          <PersonAvatar person={p} size="lg" />
          <span className="w-full truncate text-[12px] text-text-2">{p.displayName.split(' ')[0]}</span>
        </Link>
      ))}
    </div>
  );
}

/** Quick tools for staff, from live counts. */
function StaffTools() {
  const { user } = useSession();
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
  const isFaculty = user?.role === 'faculty' || user?.role === 'admin';
  const overview = useQuery<{ queues: Record<string, number> }>(isAdmin ? 'home:admin-overview' : null, (s) => get('/admin/overview', undefined, s));
  const review = useQuery<Page<unknown>>(isFaculty && !isAdmin ? 'home:review' : null, (s) => get('/resources/review-queue', { limit: 50 }, s));
  if (!isAdmin && !isFaculty) return null;
  const q = overview.data?.queues;
  const tools = [
    isFaculty && { href: '/news', icon: Megaphone, label: 'Post a notice' },
    isFaculty && { href: '/lectures', icon: Upload, label: 'Add a lecture' },
    { href: '/admin/content', icon: ClipboardCheck, label: 'Review queue', count: q ? q.resources + q.lectures + q.spaces + q.events + q.opportunities : (review.data?.items.length ?? undefined) },
    isAdmin && { href: '/admin/moderation', icon: Flag, label: 'Reports', count: q?.open_reports },
    isAdmin && { href: '/admin/people?tab=requests', icon: Users, label: 'Verifications', count: q?.verifications },
    isAdmin && { href: '/admin', icon: ShieldCheck, label: 'Admin console' },
  ].filter(Boolean) as Array<{ href: string; icon: typeof Megaphone; label: string; count?: number }>;
  return (
    <section aria-label="Your tools">
      <SectionHeader tone="violet" title="Your tools" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href} className="press flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 hover:border-accent/40">
              <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{t.label}</span>
              {t.count ? <span className="font-sans rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">{t.count}</span> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Feed() {
  const params = useSearchParams();
  const tag = params.get('tag');
  const [scope, setScope] = useState<Scope>('all');
  const key = tag ? `feed:tag:${tag}` : `feed:${scope}`;
  const feed = useInfinite<PostView>(key, async (cursor, signal) => {
    const r = await get<{ pinned: PostView[]; items: PostView[]; nextCursor: string | null }>('/feed', { scope: tag ? 'tag' : scope, tag: tag ?? undefined, cursor: cursor ?? undefined, limit: 10 }, signal);
    return { items: [...r.pinned, ...r.items], nextCursor: r.nextCursor };
  });
  const change = (p: PostView) => feed.setItems((items) => items.map((x) => (x.id === p.id ? p : x)));
  const remove = (id: string) => feed.setItems((items) => items.filter((x) => x.id !== id));

  return (
    <section aria-label="Posts for you">
      <SectionHeader tone="pink" title="For you" description="Posts from your college, your class and people you follow" />
      <Composer onPosted={(p) => feed.setItems((items) => [p, ...items])} />
      {tag ? (
        <p className="font-sans mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-soft-ink">
          Showing #{tag}
          <Link href="/" aria-label="Clear tag filter" className="grid h-5 w-5 place-items-center rounded-full hover:bg-surface"><X className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </p>
      ) : (
        <UnderlineTabs<Scope>
          className="mt-4"
          label="Feed filter"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All' },
            { value: 'following', label: 'Following' },
            { value: 'class', label: 'My class' },
            { value: 'campus', label: 'Campus' },
          ]}
        />
      )}
      <div className="mt-4 space-y-4" aria-busy={feed.loading}>
        {feed.loading && <SkeletonList count={3} label="Loading posts" />}
        {feed.error && !feed.items.length && <ErrorState error={feed.error} onRetry={feed.reload} />}
        {!feed.loading && !feed.error && !feed.items.length && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-[15px] text-text-3">
            {scope === 'following' ? 'Follow people to see their posts here.' : 'Nothing here yet. Be the first to post!'}
          </p>
        )}
        {feed.items.map((p) => (
          <LivePostCard key={p.id} post={p} onChange={change} onRemove={remove} />
        ))}
        {feed.error && feed.items.length > 0 && <ErrorState compact error={feed.error} onRetry={feed.loadMore} />}
        <LoadMore hasMore={feed.hasMore} loading={feed.loadingMore} onClick={feed.loadMore} label="Show more posts" />
      </div>
    </section>
  );
}

export function LiveHome() {
  const { user } = useSession();
  const bell = useQuery<{ count: number }>('badge:notifications', (s) => get('/notifications/unread-count', undefined, s), { refreshMs: 60_000 });
  const unread = bell.data?.count ?? 0;
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
        <div className="min-w-0">
          <p className="text-[14px] text-text-3">{dateLabel}</p>
          <h1 className="marker-heading hl-yellow mt-1 text-[30px] font-bold leading-tight tracking-tight md:text-[32px]">Hi, {user?.profile.displayName.split(' ')[0] ?? 'there'}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <span className="md:hidden" data-tour="appearance">
            <AmbienceButton />
          </span>
          <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="press relative grid h-10 w-10 place-items-center rounded-full bg-surface text-text-2 shadow-card hover:text-text">
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />}
          </Link>
        </div>
      </header>

      <div className="mt-5">
        <PeopleRow />
      </div>

      <div className="mt-8 space-y-10">
        <StaffTools />
        <section aria-label="Happening soon">
          <SectionHeader tone="yellow" title="Happening soon" action={{ label: 'All events', href: '/events' }} />
          <Upcoming />
        </section>
        <div className="grid gap-10 md:grid-cols-2">
          <section aria-label="Closing soon">
            <SectionHeader tone="green" title="Closing soon" action={{ label: 'Opportunities', href: '/opportunities' }} />
            <Closing />
          </section>
          <section aria-label="Notices">
            <SectionHeader tone="blue" title="Notices" action={{ label: 'All notices', href: '/news' }} />
            <Notices />
          </section>
        </div>
        <Suspense fallback={<SkeletonList count={2} />}>
          <Feed />
        </Suspense>
        <section aria-label="Boards">
          <SectionHeader tone="blue" title="Boards" description="Top discussions from your spaces" action={{ label: 'Open boards', href: '/spaces' }} />
          <Boards />
        </section>
        <section aria-label="Hush">
          <SectionHeader tone="violet" title="Hush" description="Anonymous questions, answered by people who know" action={{ label: 'Open Hush', href: '/hush' }} />
          <HushPreview />
        </section>
      </div>
    </div>
  );
}
