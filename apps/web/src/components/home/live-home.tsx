'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowBigUp, Bell, ClipboardCheck, Flag, Megaphone, Search, ShieldCheck, Upload, Users, X } from 'lucide-react';
import { Composer } from '@/components/feed/composer';
import { LivePostCard } from '@/components/feed/live-post-card';
import { AmbienceButton } from '@/components/shell/ambience';
import { UnderlineTabs } from '@/components/ui/chip';
import { SectionHeader } from '@/components/ui/layout';
import { SectionBoundary } from '@/components/common/section-boundary';
import { StatusStrip } from '@/components/status/status';
import { CampusFinds, greeting, LoopsStrip, PlayAndAsk, QuickChips, Reveal, SpacesStrip, UpNext } from './home-sections';
import { ErrorState, LoadMore, SkeletonList } from '@/components/ui/states';
import { get } from '@/lib/api/client';
import { useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { PersonSummary, PostView } from '@/lib/api/types';
import { ago } from '@/lib/live-time';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useState, Suspense } from 'react';

type Scope = 'all' | 'following';

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
      <SectionHeader tone="pink" title="For you" description="Posts from everyone, and the people you follow" />
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
          <SectionBoundary key={p.id} label="This post" compact>
            <LivePostCard post={p} onChange={change} onRemove={remove} />
          </SectionBoundary>
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
  const first = user?.profile.displayName.split(' ')[0] ?? 'there';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
        <div className="min-w-0">
          <p className="text-[14px] text-text-3">{greeting()}</p>
          <h1 className="mt-0.5 truncate text-[34px] font-bold leading-none tracking-tight md:text-[40px]">{first}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <Link href="/search" aria-label="Search" className="press grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-text-2 shadow-card hover:text-text">
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
          <span className="md:hidden" data-tour="appearance">
            <AmbienceButton />
          </span>
          <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="press relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-text-2 shadow-card hover:text-text">
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {unread > 0 && <span className="font-sans absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        </div>
      </header>

      <SectionBoundary label="Stories" compact>
        <StatusStrip />
      </SectionBoundary>

      <div className="mt-6 space-y-9">
        <Reveal index={0}><QuickChips /></Reveal>
        <SectionBoundary label="Your tools" compact>
          <StaffTools />
        </SectionBoundary>
        <Reveal index={1}><UpNext /></Reveal>
        <Reveal index={2}><LoopsStrip /></Reveal>
        <Reveal index={3}><SpacesStrip /></Reveal>
        <Reveal index={4}><PlayAndAsk /></Reveal>
        <Reveal index={5}><CampusFinds /></Reveal>
        <Suspense fallback={<SkeletonList count={2} />}>
          <SectionBoundary label="The feed">
            <Feed />
          </SectionBoundary>
        </Suspense>
        <div className="grid gap-9 md:grid-cols-2">
          <section aria-label="Notices">
            <SectionHeader tone="blue" title="Notices" action={{ label: 'All notices', href: '/news' }} />
            <SectionBoundary label="Notices">
              <Notices />
            </SectionBoundary>
          </section>
          <section aria-label="Boards">
            <SectionHeader tone="blue" title="Boards" description="Top discussions from your spaces" action={{ label: 'Open boards', href: '/spaces' }} />
            <SectionBoundary label="Boards">
              <Boards />
            </SectionBoundary>
          </section>
        </div>
      </div>
    </div>
  );
}
