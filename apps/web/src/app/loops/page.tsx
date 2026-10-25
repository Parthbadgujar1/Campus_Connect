'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Camera, CheckCircle2, ChevronDown, ChevronUp, Clapperboard, RotateCcw, UsersRound } from 'lucide-react';
import { errorMessage, get, withQuery } from '@/lib/api/client';
import { useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { PostView } from '@/lib/api/types';
import { buttonClass } from '@/components/ui/button';
import { Spinner } from '@/components/ui/states';
import { SectionBoundary } from '@/components/common/section-boundary';
import { LoopPlayer } from '@/components/loops/loop-player';
import { useLive } from '@/lib/realtime';
import { NewLoop } from '@/components/loops/new-loop';
import { cn } from '@/lib/utils';

// Discover → Loops: short videos from people at your college, one per screen, like Reels.
// Swipe or use ↑/↓ to move, tap for sound, hold to pause, double-tap to like. "For you" shows
// every loop you can see, newest first; "Following" only people you follow; /loops?tag=x one
// hashtag; /loops?id=x opens a shared loop first. When there are no more, an end card says so.

type Tab = 'for-you' | 'following';
const isLoop = (p: PostView) => p.attachments.some((a) => a.kind === 'video' && a.url);

function EndCard({ kind, onTop, onNew }: { kind: 'empty' | 'following-empty' | 'end'; onTop: () => void; onNew: () => void }) {
  const copy = {
    empty: { icon: Clapperboard, title: 'No loops yet', text: 'Loops are short videos from people on CampusConnect. Post the first one.' },
    'following-empty': { icon: UsersRound, title: 'Nothing from people you follow', text: 'Follow people from their loops or profiles, and their new loops show up here.' },
    end: { icon: CheckCircle2, title: 'You’re all caught up', text: 'You have seen every loop here. New ones appear as people post them.' },
  }[kind];
  return (
    <section className="grid h-dvh w-full snap-start place-items-center bg-black px-8 text-center text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10"><copy.icon className={cn('h-8 w-8', kind === 'end' && 'text-emerald-400')} aria-hidden="true" /></span>
        <p className="text-[22px] font-semibold">{copy.title}</p>
        <p className="max-w-xs text-[14px] text-white/70">{copy.text}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onNew} className={buttonClass({ size: 'sm' })}><Camera className="h-4 w-4" aria-hidden="true" /> New loop</button>
          {kind === 'end' && <button type="button" onClick={onTop} className={buttonClass({ size: 'sm', variant: 'secondary' })}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Back to top</button>}
        </div>
      </div>
    </section>
  );
}

function LoopsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tag = params.get('tag');
  const startId = params.get('id');
  const tab: Tab = params.get('tab') === 'following' ? 'following' : 'for-you';
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hasNew, setHasNew] = useState(false);
  const [mine, setMine] = useState<PostView[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const feed = useInfinite<PostView>(`feed:loops:${tab}:${tag ?? ''}`, (cursor, signal) =>
    get<Page<PostView>>('/feed', { scope: 'loops', following: tab === 'following' ? 'true' : undefined, tag: tag ?? undefined, cursor: cursor ?? undefined, limit: 6 }, signal),
  );
  const first = useQuery<PostView>(startId ? `loops:one:${startId}` : null, (signal) => get(`/posts/${startId}`, undefined, signal));
  const [edits, setEdits] = useState<Record<string, PostView>>({});

  const items = useMemo(() => {
    const seen = new Set<string>(hidden);
    const out: PostView[] = [];
    for (const p of [...mine, ...(first.data && isLoop(first.data) ? [first.data] : []), ...feed.items]) {
      if (seen.has(p.id) || !isLoop(p)) continue;
      seen.add(p.id);
      out.push(edits[p.id] ?? p);
    }
    return out;
  }, [mine, first.data, feed.items, hidden, edits]);

  const activeIndex = Math.max(0, items.findIndex((p) => p.id === activeId));

  // ---- live: counts on the loops around the one you are watching stay current, and a "New loops"
  // button appears when someone posts. The server announces a change to the feed; we fetch only what we show.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const liveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(liveTimer.current), []);
  useLive(null, (e) => {
    if (e.type !== 'changed' || !e.topics.includes('feed') || liveTimer.current) return;
    liveTimer.current = setTimeout(async () => {
      liveTimer.current = undefined;
      if (document.hidden) return;
      const list = itemsRef.current;
      const at = Math.max(0, list.findIndex((p) => p.id === activeRef.current));
      const near = list.slice(Math.max(0, at - 1), at + 2);
      const fresh = await Promise.all(near.map((p) => get<PostView>(`/posts/${p.id}`).catch(() => null)));
      setEdits((m) => {
        const next = { ...m };
        fresh.forEach((f, i) => {
          if (f) next[near[i]!.id] = f;
        });
        return next;
      });
    }, 1500);
  });
  // A loop that lands above the one you are watching (the list keeps you where you are) gets a button.
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!items.length) return;
    if (!knownIds.current) {
      knownIds.current = new Set(items.map((p) => p.id));
      return;
    }
    const known = knownIds.current;
    const fresh = items.filter((p) => !known.has(p.id));
    items.forEach((p) => known.add(p.id));
    if (fresh.some((p) => !p.isMine && items.findIndex((x) => x.id === p.id) < activeIndex)) setHasNew(true);
  }, [items, activeIndex]);
  useEffect(() => {
    if (activeIndex === 0) setHasNew(false);
  }, [activeIndex]);
  const showNew = () => {
    setHasNew(false);
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The loop that fills most of the screen is the one that plays.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActiveId((e.target as HTMLElement).dataset.loopId ?? null);
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll('[data-loop-id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);
  useEffect(() => {
    if (!activeId && items[0]) setActiveId(items[0].id);
  }, [activeId, items]);

  // Load more before reaching the end.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !feed.hasMore) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && feed.loadMore(), { root: scroller.current, rootMargin: '200% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [feed.hasMore, feed.loadMore, items.length]);

  const go = useCallback((by: number) => {
    const root = scroller.current;
    if (!root) return;
    root.scrollBy({ top: by * root.clientHeight, behavior: 'smooth' });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [role="dialog"]')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const setTab = (t: Tab) => router.replace(withQuery('/loops', { tab: t === 'following' ? 'following' : null }), { scroll: false });
  const change = (p: PostView) => setEdits((m) => ({ ...m, [p.id]: p }));
  const followAuthor = (authorId: string) =>
    setEdits((m) => {
      const next = { ...m };
      for (const p of items) if (p.author?.id === authorId) next[p.id] = { ...(m[p.id] ?? p), followsAuthor: true };
      return next;
    });
  const remove = (id: string) => {
    const i = items.findIndex((p) => p.id === id);
    setHidden((h) => [...h, id]);
    setActiveId(items[i + 1]?.id ?? items[i - 1]?.id ?? null);
  };

  const loading = feed.loading && !items.length;
  const endKind = !items.length ? (tab === 'following' && !tag ? 'following-empty' : 'empty') : 'end';

  return (
    <div className="fixed inset-0 z-40 bg-black text-white">
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/60 to-transparent pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 px-3">
          <Link href={tag ? '/loops' : '/discover'} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
          {tag ? (
            <p className="flex-1 truncate text-center text-[18px] font-semibold">#{tag}</p>
          ) : (
            <div className="flex flex-1 justify-center gap-5 text-[17px] font-semibold" role="tablist" aria-label="Loops">
              {(['for-you', 'following'] as Tab[]).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('relative pb-1 transition-opacity', tab === t ? 'opacity-100' : 'opacity-60 hover:opacity-90')}>
                  {t === 'for-you' ? 'For you' : 'Following'}
                  {tab === t && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-white" />}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setCreating(true)} aria-label="New loop" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><Camera className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      </div>

      {hasNew && (
        <button type="button" onClick={showNew} className="absolute left-1/2 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-black shadow-lg">
          <ArrowUp className="h-4 w-4" aria-hidden="true" /> New loops
        </button>
      )}

      {/* Up / down on desktop */}
      {items.length > 1 && (
        <div className="absolute right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <button type="button" onClick={() => go(-1)} disabled={activeIndex === 0} aria-label="Previous loop" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronUp className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next loop" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronDown className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      )}

      <div ref={scroller} className="no-scrollbar h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {loading && <div className="grid h-dvh place-items-center"><Spinner label="Loading loops" /></div>}
        {feed.error && !items.length && (
          <div className="grid h-dvh place-items-center px-8 text-center">
            <div>
              <p className="font-semibold">Loops could not load</p>
              <p className="mt-1 text-[14px] text-white/70">{errorMessage(feed.error)}</p>
              <button type="button" onClick={feed.reload} className={buttonClass({ size: 'sm', className: 'mt-4' })}>Try again</button>
            </div>
          </div>
        )}
        {items.map((p, i) => (
          <SectionBoundary key={p.id} label="This loop" className="h-dvh snap-start rounded-none border-0 bg-black text-white">
          <LoopPlayer
            post={p}
            active={p.id === (activeId ?? items[0]?.id)}
            distance={Math.abs(i - activeIndex)}
            muted={muted}
            onMuteChange={setMuted}
            onChange={change}
            onFollowAuthor={followAuthor}
            onRemove={remove}
            speed={speed}
            onSpeedChange={setSpeed}
          />
          </SectionBoundary>
        ))}
        {feed.hasMore && <div ref={sentinel} className="grid h-24 place-items-center">{feed.loadingMore && <Spinner />}</div>}
        {!loading && !feed.hasMore && !(feed.error && !items.length) && <EndCard kind={endKind} onTop={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })} onNew={() => setCreating(true)} />}
      </div>

      {creating && (
        <NewLoop
          onClose={() => setCreating(false)}
          onPosted={(p) => {
            setCreating(false);
            setMine((m) => [p, ...m]);
            setActiveId(p.id);
            if (tag || tab === 'following') router.replace('/loops', { scroll: false });
            requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0 }));
          }}
        />
      )}
    </div>
  );
}

export default function LoopsPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-40 grid place-items-center bg-black text-white"><Spinner label="Loading loops" /></div>}>
      <LoopsInner />
    </Suspense>
  );
}
