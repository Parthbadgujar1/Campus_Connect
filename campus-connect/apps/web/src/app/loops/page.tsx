'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, CheckCircle2, Clapperboard, Heart, MessageCircle, Plus, RotateCcw, Send, Volume2, VolumeX } from 'lucide-react';
import { del, errorMessage, get, put } from '@/lib/api/client';
import { useInfinite, type Page } from '@/lib/api/hooks';
import type { PostView } from '@/lib/api/types';
import { buttonClass } from '@/components/ui/button';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { AnimatePresence, motion } from '@/components/motion';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

// Discover → Loops: every post with a video, one per screen. Swipe (or scroll) up for the next,
// double-tap to like. The video in view plays; the rest pause. When there are no more loops,
// a clear end card says so instead of repeating old ones.

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
}

function Loop({ post, muted, onMute, onChange }: { post: PostView; muted: boolean; onMute: () => void; onChange: (p: PostView) => void }) {
  const toast = useToast();
  const root = useRef<HTMLElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [paused, setPaused] = useState(false);
  const lastTap = useRef(0);
  const clip = post.attachments.find((a) => a.kind === 'video' && a.url);

  // Play only while most of the loop is on screen.
  useEffect(() => {
    const el = root.current;
    const v = video.current;
    if (!el || !v) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio > 0.6) {
          v.play().then(() => setPaused(false)).catch(() => setPaused(true));
        } else {
          v.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const like = async (force?: boolean) => {
    const next = force ?? !post.liked;
    if (next === post.liked) return;
    onChange({ ...post, liked: next, likesCount: post.likesCount + (next ? 1 : -1) });
    try {
      const r = await (next ? put<{ likesCount: number }>(`/posts/${post.id}/like`) : del<{ likesCount: number }>(`/posts/${post.id}/like`));
      onChange({ ...post, liked: next, likesCount: r.likesCount });
    } catch (err) {
      onChange(post);
      toast(errorMessage(err));
    }
  };
  const save = async () => {
    const next = !post.saved;
    onChange({ ...post, saved: next });
    try {
      await (next ? put(`/saved/post/${post.id}`) : del(`/saved/post/${post.id}`));
      toast(next ? 'Saved' : 'Removed from saved');
    } catch (err) {
      onChange(post);
      toast(errorMessage(err));
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'A loop on CampusConnect', url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      // Share sheet closed.
    }
  };
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      const id = now;
      setBursts((b) => [...b, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 800);
      void like(true);
    } else {
      const v = video.current;
      if (v) {
        if (v.paused) void v.play().then(() => setPaused(false)).catch(() => undefined);
        else {
          v.pause();
          setPaused(true);
        }
      }
    }
    lastTap.current = now;
  };

  return (
    <section ref={root} className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black text-white" aria-label={`Loop by ${post.author?.displayName ?? 'Anonymous'}`}>
      {clip?.url && (
        <video ref={video} src={clip.url} poster={clip.thumbnailUrl ?? undefined} muted={muted} loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-contain" />
      )}
      <div className="absolute inset-0" onClick={onTap} aria-hidden="true" />
      <AnimatePresence>
        {paused && (
          <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-[13px] font-semibold">
            Paused
          </motion.span>
        )}
      </AnimatePresence>
      {bursts.map((b) => (
        <motion.span key={b.id} initial={{ opacity: 1, scale: 0.4 }} animate={{ opacity: 0, scale: 1.6, y: -40 }} transition={{ duration: 0.7 }} className="pointer-events-none absolute" style={{ left: b.x - 36, top: b.y - 36 }}>
          <Heart className="h-[72px] w-[72px] fill-rose-500 text-rose-500 drop-shadow" aria-hidden="true" />
        </motion.span>
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute bottom-0 left-0 right-20 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          {post.author ? (
            <Link href={`/profile/${post.author.username}`} className="flex items-center gap-2 font-semibold">
              <PersonAvatar person={post.author} size="sm" /> {post.author.displayName}
            </Link>
          ) : (
            <span className="font-semibold">Anonymous</span>
          )}
          <span className="text-[13px] text-white/70">· {ago(post.createdAt)}</span>
        </div>
        {post.body && <p className="mt-2 line-clamp-3 text-[15px] text-white/95">{post.body}</p>}
        {post.tags.length > 0 && <p className="mt-1 text-[13px] text-white/80">{post.tags.map((t) => `#${t}`).join(' ')}</p>}
      </div>
      <div className="absolute bottom-0 right-0 flex flex-col items-center gap-4 p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => void like()} aria-pressed={post.liked} aria-label={post.liked ? 'Unlike' : 'Like'} className="flex flex-col items-center gap-1 text-[12px] font-semibold">
          <motion.span whileTap={{ scale: 0.8 }} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur"><Heart className={cn('h-6 w-6', post.liked && 'fill-rose-500 text-rose-500')} aria-hidden="true" /></motion.span>
          {compact(post.likesCount)}
        </button>
        <Link href={`/post/${post.id}`} aria-label="Comments" className="flex flex-col items-center gap-1 text-[12px] font-semibold">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur"><MessageCircle className="h-6 w-6" aria-hidden="true" /></span>
          {compact(post.commentsCount)}
        </Link>
        <button type="button" onClick={() => void save()} aria-pressed={post.saved} aria-label={post.saved ? 'Remove from saved' : 'Save'} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur">
          <Bookmark className={cn('h-6 w-6', post.saved && 'fill-white')} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => void share()} aria-label="Share" className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur">
          <Send className="h-6 w-6" aria-hidden="true" />
        </button>
        <button type="button" onClick={onMute} aria-label={muted ? 'Turn sound on' : 'Mute'} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur">
          {muted ? <VolumeX className="h-6 w-6" aria-hidden="true" /> : <Volume2 className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}

function EndCard({ empty, onTop }: { empty: boolean; onTop: () => void }) {
  return (
    <section className="grid h-dvh w-full snap-start place-items-center bg-black px-8 text-center text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10">{empty ? <Clapperboard className="h-8 w-8" aria-hidden="true" /> : <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden="true" />}</span>
        <p className="text-[22px] font-semibold">{empty ? 'No loops yet' : 'You’ve reached the end'}</p>
        <p className="max-w-xs text-[14px] text-white/70">{empty ? 'Loops are short videos people post. Share one from your phone to get it started.' : 'You have watched every loop from your campus. New ones show up here as people post them.'}</p>
        <div className="mt-2 flex gap-2">
          <Link href="/create?video=1" className={buttonClass({ size: 'sm' })}><Plus className="h-4 w-4" aria-hidden="true" /> Post a loop</Link>
          {!empty && <button type="button" onClick={onTop} className={buttonClass({ size: 'sm', variant: 'secondary' })}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Back to top</button>}
        </div>
      </div>
    </section>
  );
}

export default function LoopsPage() {
  const [muted, setMuted] = useState(true);
  const scroller = useRef<HTMLDivElement | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const feed = useInfinite<PostView>('feed:loops', (cursor, signal) => get<Page<PostView>>('/feed', { scope: 'loops', cursor: cursor ?? undefined, limit: 6 }, signal));
  const items = feed.items.filter((p) => p.attachments.some((a) => a.kind === 'video' && a.url));

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !feed.hasMore) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && feed.loadMore(), { root: scroller.current, rootMargin: '200% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [feed.hasMore, feed.loadMore, items.length]);

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <Link href="/discover" aria-label="Back" className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
      <p className="pointer-events-none absolute left-1/2 top-[max(1.1rem,env(safe-area-inset-top))] z-10 -translate-x-1/2 text-[17px] font-semibold text-white">Loops</p>
      <div ref={scroller} className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {feed.loading && <div className="grid h-dvh place-items-center text-white"><Spinner label="Loading loops" /></div>}
        {feed.error && !items.length && (
          <div className="grid h-dvh place-items-center px-8 text-center text-white">
            <div>
              <p className="font-semibold">Loops could not load</p>
              <p className="mt-1 text-[14px] text-white/70">{errorMessage(feed.error)}</p>
              <button type="button" onClick={feed.reload} className={buttonClass({ size: 'sm', className: 'mt-4' })}>Try again</button>
            </div>
          </div>
        )}
        {items.map((p) => (
          <Loop key={p.id} post={p} muted={muted} onMute={() => setMuted((m) => !m)} onChange={(next) => feed.setItems((list) => list.map((x) => (x.id === next.id ? next : x)))} />
        ))}
        {feed.hasMore && <div ref={sentinel} className="grid h-24 place-items-center text-white">{feed.loadingMore && <Spinner />}</div>}
        {!feed.loading && !feed.hasMore && !(feed.error && !items.length) && <EndCard empty={!items.length} onTop={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })} />}
      </div>
    </div>
  );
}
