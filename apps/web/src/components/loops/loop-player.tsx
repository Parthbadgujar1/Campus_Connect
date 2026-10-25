'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, EyeOff, Flag, Gauge, Heart, Link2, MessageCircle, MoreHorizontal, Pencil, Play, Send, Trash2, Volume2, VolumeX, ExternalLink } from 'lucide-react';
import { del, errorMessage, patch, post as apiPost, put } from '@/lib/api/client';
import { invalidate } from '@/lib/api/hooks';
import type { PostView } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ReportSheet } from '@/components/common/report-sheet';
import { RichText } from '@/components/common/rich-text';
import { AnimatePresence, motion } from '@/components/motion';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';
import { CommentsSheet } from './comments-sheet';
import { ShareSheet } from './share-sheet';
import { ensureDuration } from './media';

export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

const HOLD_MS = 220;
const DOUBLE_MS = 280;

interface Props {
  post: PostView;
  /** On screen now: plays. */
  active: boolean;
  /** How far from the active loop (0 = active); only nearby loops load their video. */
  distance: number;
  muted: boolean;
  onMuteChange: (muted: boolean) => void;
  onChange: (p: PostView) => void;
  onFollowAuthor: (authorId: string) => void;
  onRemove: (id: string, reason: 'deleted' | 'hidden') => void;
  /** Playback speed shared by every loop (1 = normal). */
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const SPEEDS = [1, 1.5, 2, 0.5];

export function LoopPlayer({ post, active, distance, muted, onMuteChange, onChange, onFollowAuthor, onRemove, speed, onSpeedChange }: Props) {
  const toast = useToast();
  const router = useRouter();
  const video = useRef<HTMLVideoElement | null>(null);
  const clip = post.attachments.find((a) => a.kind === 'video' && a.url);
  const poster = post.cover?.url ?? post.cover?.thumbnailUrl ?? undefined;
  const [paused, setPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [flash, setFlash] = useState<'muted' | 'sound' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState<'comments' | 'share' | 'more' | 'report' | 'delete' | 'edit' | null>(null);
  const [draft, setDraft] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);
  const counted = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef(0);
  const held = useRef(false);

  const play = useCallback(() => {
    const v = video.current;
    if (!v) return;
    v.play()
      .then(() => {
        setPaused(false);
        setBlocked(false);
      })
      .catch(() => {
        // Autoplay with sound can be refused until the person taps once.
        if (!v.muted) {
          v.muted = true;
          onMuteChange(true);
          void v.play().then(() => setPaused(false)).catch(() => setBlocked(true));
        } else setBlocked(true);
      });
  }, [onMuteChange]);

  // Play while on screen; rewind and stop when scrolled away. Pause when the tab is hidden.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active) play();
    else {
      v.pause();
      if (v.currentTime > 0) v.currentTime = 0;
      setProgress(0);
      setExpanded(false);
    }
  }, [active, play, clip?.url]);
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      const v = video.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else if (!paused) play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, paused, play]);
  useEffect(() => {
    if (video.current) video.current.playbackRate = speed;
  }, [speed, clip?.url, active]);
  // Keep the element's muted flag in step with the shared choice.
  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);

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
      toast(next ? 'Saved to your list' : 'Removed from saved');
    } catch (err) {
      onChange(post);
      toast(errorMessage(err));
    }
  };
  const follow = async () => {
    if (!post.author) return;
    onFollowAuthor(post.author.id);
    try {
      await apiPost(`/users/${post.author.id}/follow`);
      toast(`Following ${post.author.displayName.split(' ')[0]}`);
    } catch (err) {
      toast(errorMessage(err));
    }
  };
  const saveCaption = async () => {
    const body = draft.trim();
    if (!body || savingCaption) return;
    setSavingCaption(true);
    try {
      const next = await patch<PostView>(`/posts/${post.id}`, { body });
      onChange(next);
      toast('Caption updated');
      setSheet(null);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSavingCaption(false);
    }
  };
  const remove = async () => {
    try {
      await del(`/posts/${post.id}`);
      invalidate('feed:');
      toast('Loop deleted');
      onRemove(post.id, 'deleted');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSheet(null);
    }
  };

  // Gestures: tap = sound on/off, double tap = like, press and hold = pause.
  const onPointerDown = () => {
    held.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setHolding(true);
      video.current?.pause();
    }, HOLD_MS);
  };
  const endHold = () => {
    clearTimeout(holdTimer.current);
    if (held.current) {
      setHolding(false);
      play();
      return true;
    }
    return false;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (endHold()) return;
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_MS) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      const rect = e.currentTarget.getBoundingClientRect();
      const id = now;
      setBursts((b) => [...b, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
      void like(true);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => {
      if (blocked || paused) {
        play();
        return;
      }
      const next = !muted;
      onMuteChange(next);
      if (video.current) video.current.muted = next;
      setFlash(next ? 'muted' : 'sound');
      setTimeout(() => setFlash(null), 700);
    }, DOUBLE_MS);
  };
  useEffect(() => () => {
    clearTimeout(holdTimer.current);
    clearTimeout(tapTimer.current);
  }, []);

  // Keyboard on desktop for the loop on screen: space pause, m sound, l like.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (sheet || (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))) return;
      if (e.key === ' ') {
        e.preventDefault();
        const v = video.current;
        if (!v) return;
        if (v.paused) play();
        else {
          v.pause();
          setPaused(true);
        }
      } else if (e.key === 'm') onMuteChange(!muted);
      else if (e.key === 'l') void like();
      else if (e.key === 'c') setSheet('comments');
      else if (e.key === 's') void save();
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && video.current && Number.isFinite(video.current.duration)) {
        e.preventDefault();
        video.current.currentTime = Math.max(0, Math.min(video.current.duration, video.current.currentTime + (e.key === 'ArrowRight' ? 5 : -5)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onTime = () => {
    const v = video.current;
    if (!v || !Number.isFinite(v.duration) || !v.duration) return;
    setProgress(v.currentTime / v.duration);
    // Count a view once it has played for a moment.
    if (!counted.current && !post.isMine && v.currentTime >= Math.min(2, v.duration * 0.5)) {
      counted.current = true;
      void apiPost<{ viewsCount: number }>(`/posts/${post.id}/view`).then((r) => onChange({ ...post, viewsCount: r.viewsCount })).catch(() => undefined);
    }
  };

  const link = `/loops?id=${post.id}`;
  const caption = post.body.trim();
  const chrome = !holding;

  return (
    <section data-loop-id={post.id} className="relative flex h-dvh w-full snap-start snap-always items-center justify-center bg-black" aria-label={`Loop by ${post.author?.displayName ?? 'Anonymous'}`}>
      <div className="relative h-full w-full md:aspect-[9/16] md:h-[calc(100dvh-2rem)] md:w-auto md:overflow-hidden md:rounded-2xl">
        {clip?.url && distance <= 2 ? (
          <video
            ref={video}
            src={clip.url}
            poster={poster}
            muted={muted}
            loop
            playsInline
            preload={distance === 0 ? 'auto' : 'metadata'}
            onTimeUpdate={onTime}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (Number.isFinite(v.duration)) setDuration(v.duration);
              else if (active) void ensureDuration(v).then((d) => { setDuration(d); play(); });
            }}
            onPause={() => !holding && setPaused(Boolean(video.current?.paused) && active && !document.hidden)}
            onPlay={() => setPaused(false)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          poster ? <img src={poster} alt="" className="absolute inset-0 h-full w-full object-contain" /> : null
        )}

        {/* Gesture surface */}
        <div
          className="absolute inset-0 touch-manipulation select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={endHold}
          onPointerLeave={() => held.current && endHold()}
          onContextMenu={(e) => e.preventDefault()}
          aria-hidden="true"
        />

        <AnimatePresence>
          {(paused || blocked) && !holding && active && (
            <motion.span key="paused" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white">
              <Play className="ml-1 h-8 w-8 fill-white" aria-hidden="true" />
            </motion.span>
          )}
          {flash && (
            <motion.span key="flash" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white">
              {flash === 'muted' ? <VolumeX className="h-6 w-6" aria-hidden="true" /> : <Volume2 className="h-6 w-6" aria-hidden="true" />}
            </motion.span>
          )}
        </AnimatePresence>
        {bursts.map((b) => (
          <motion.span key={b.id} initial={{ opacity: 1, scale: 0.3, rotate: -12 }} animate={{ opacity: 0, scale: 1.5, y: -60, rotate: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="pointer-events-none absolute" style={{ left: b.x - 44, top: b.y - 44 }}>
            <Heart className="h-[88px] w-[88px] fill-rose-500 text-rose-500 drop-shadow-lg" aria-hidden="true" />
          </motion.span>
        ))}

        <div className={cn('transition-opacity duration-200', chrome ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          {/* Sound */}
          <button type="button" onClick={() => onMuteChange(!muted)} aria-label={muted ? 'Turn sound on' : 'Mute'} className="absolute right-3 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
            {muted ? <VolumeX className="h-[18px] w-[18px]" aria-hidden="true" /> : <Volume2 className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>

          {/* Author, caption, views */}
          <div className="absolute bottom-0 left-0 right-16 z-10 p-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] text-white">
            <div className="flex items-center gap-2">
              {post.author ? (
                <Link href={`/profile/${post.author.username}`} className="flex min-w-0 items-center gap-2 font-semibold">
                  <PersonAvatar person={post.author} size="sm" className="ring-2 ring-white/70" />
                  <span className="truncate">{post.author.displayName}</span>
                </Link>
              ) : (
                <span className="font-semibold">Anonymous</span>
              )}
              {post.author && !post.isMine && !post.followsAuthor && (
                <button type="button" onClick={() => void follow()} className="shrink-0 rounded-lg border border-white/80 px-2.5 py-0.5 text-[13px] font-semibold hover:bg-white/15">Follow</button>
              )}
            </div>
            {caption && (
              <button type="button" onClick={() => setExpanded((x) => !x)} className={cn('mt-2 block w-full text-left text-[15px] leading-snug', expanded ? 'max-h-48 overflow-y-auto' : 'line-clamp-2')} aria-expanded={expanded}>
                <RichText text={caption} tagHref={(t) => `/loops?tag=${encodeURIComponent(t)}`} linkClassName="font-semibold" />
              </button>
            )}
            <p className="mt-1.5 text-[12px] text-white/75">
              {compact(post.viewsCount)} view{post.viewsCount === 1 ? '' : 's'} · {ago(post.createdAt)}
              {post.audience.type !== 'college' && ` · ${post.audience.type === 'space' ? (post.audience.space?.name ?? 'Space') : post.audience.type === 'department' ? (post.audience.department ?? 'Department') : 'Your class'}`}
            </p>
          </div>

          {/* Actions */}
          <div className="absolute bottom-0 right-0 z-10 flex flex-col items-center gap-4 p-2.5 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] text-white">
            <button type="button" onClick={() => void like()} aria-pressed={post.liked} aria-label={post.liked ? 'Unlike' : 'Like'} className="flex flex-col items-center gap-0.5 text-[12px] font-semibold">
              <motion.span key={String(post.liked)} initial={{ scale: post.liked ? 0.6 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
                <Heart className={cn('h-7 w-7 drop-shadow', post.liked && 'fill-rose-500 text-rose-500')} aria-hidden="true" />
              </motion.span>
              {compact(post.likesCount)}
            </button>
            <button type="button" onClick={() => setSheet('comments')} aria-label="Comments" className="flex flex-col items-center gap-0.5 text-[12px] font-semibold">
              <MessageCircle className="h-7 w-7 drop-shadow" aria-hidden="true" />
              {compact(post.commentsCount)}
            </button>
            <button type="button" onClick={() => setSheet('share')} aria-label="Share" className="flex flex-col items-center gap-0.5 text-[12px] font-semibold">
              <Send className="h-7 w-7 drop-shadow" aria-hidden="true" />
              Share
            </button>
            <button type="button" onClick={() => void save()} aria-pressed={post.saved} aria-label={post.saved ? 'Remove from saved' : 'Save'}>
              <Bookmark className={cn('h-7 w-7 drop-shadow', post.saved && 'fill-white')} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setSheet('more')} aria-label="More options">
              <MoreHorizontal className="h-7 w-7 drop-shadow" aria-hidden="true" />
            </button>
          </div>

          {/* Progress; drag to jump */}
          {active && duration > 0 && (
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => {
                const v = video.current;
                if (!v || !Number.isFinite(v.duration) || !v.duration) return;
                v.currentTime = (Number(e.target.value) / 1000) * v.duration;
                setProgress(Number(e.target.value) / 1000);
              }}
              aria-label="Seek"
              className="loop-seek absolute inset-x-0 bottom-0 z-20 h-3 w-full cursor-pointer appearance-none bg-transparent"
              style={{ ['--seek' as string]: `${progress * 100}%` }}
            />
          )}
        </div>
      </div>

      {sheet === 'comments' && <CommentsSheet postId={post.id} count={post.commentsCount} onClose={() => setSheet(null)} onCountChange={(n) => onChange({ ...post, commentsCount: n })} />}
      {sheet === 'share' && <ShareSheet path={link} title={caption ? caption.slice(0, 80) : 'A loop on CampusConnect'} onClose={() => setSheet(null)} />}
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="Loop options">
        <div className="-mx-2 flex flex-col">
          <ActionRow icon={muted ? Volume2 : VolumeX} label={muted ? 'Turn sound on' : 'Mute'} onClick={() => { onMuteChange(!muted); setSheet(null); }} />
          <ActionRow icon={Gauge} label={`Playback speed: ${speed}×`} hint="Tap to change" onClick={() => onSpeedChange(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)} />
          {post.isMine && <ActionRow icon={Pencil} label="Edit caption" onClick={() => { setDraft(post.body); setSheet('edit'); }} />}
          <ActionRow icon={Link2} label="Copy link" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${link}`).then(() => toast('Link copied')).catch(() => toast('Could not copy the link')); setSheet(null); }} />
          <ActionRow icon={ExternalLink} label="Open as a post" onClick={() => router.push(`/post/${post.id}`)} />
          {!post.isMine && <ActionRow icon={EyeOff} label="Not interested" hint="Hide this loop for now" onClick={() => { setSheet(null); onRemove(post.id, 'hidden'); toast('Hidden. You will see fewer like this.'); }} />}
          {!post.isMine && <ActionRow icon={Flag} label="Report" danger onClick={() => setSheet('report')} />}
          {post.isMine && <ActionRow icon={Trash2} label="Delete" danger onClick={() => setSheet('delete')} />}
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'edit'}
        onClose={() => setSheet(null)}
        title="Edit caption"
        footer={<Button full disabled={!draft.trim() || savingCaption} onClick={() => void saveCaption()}>Save</Button>}
      >
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} rows={5} autoCapitalize="sentences" aria-label="Caption" placeholder="Write a caption… use #hashtags" />
      </Sheet>
      {sheet === 'report' && <ReportSheet open onClose={() => setSheet(null)} targetType="post" targetId={post.id} label="this loop" />}
      <ConfirmDialog open={sheet === 'delete'} onClose={() => setSheet(null)} onConfirm={() => void remove()} title="Delete this loop?" description="It is removed for everyone, with its likes and comments." confirmLabel="Delete" danger />
    </section>
  );
}

function ActionRow({ icon: Icon, label, hint, danger, onClick }: { icon: typeof Link2; label: string; hint?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2', danger && 'text-danger')}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-text-3">{hint}</span>}
      </span>
    </button>
  );
}
