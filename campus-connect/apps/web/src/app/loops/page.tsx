'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Bookmark, Heart, MessageCircle, Music2, Send, Volume2, VolumeX } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { getPerson } from '@/data/people';
import { loops } from '@/data/videos';
import { appActions, useAppState } from '@/lib/store';
import { compactNumber, gradientFor, hueFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

const REPLIES = [
  { from: 'p-rohan', text: 'This is the clearest version I’ve seen' },
  { from: 'p-tanvi', text: 'Saving for exam week 📌' },
  { from: 'p-harsh', text: 'Part 2 please!!' },
];

export default function LoopsPage() {
  return (
    <Suspense fallback={null}>
      <Loops />
    </Suspense>
  );
}

function Loops() {
  const params = useSearchParams();
  const toast = useToast();
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [repliesFor, setRepliesFor] = useState<string | null>(null);
  const liked = useAppState((s) => s.liked);
  const saved = useAppState((s) => s.saved);
  const following = useAppState((s) => s.following);
  const burstId = useRef(0);

  // Open at the loop that was tapped elsewhere (Watch, Kept): the feed starts there and wraps around.
  const startIndex = Math.max(0, loops.findIndex((l) => l.id === params.get('start')));
  // Endless: the feed grows as you near its end, cycling through the loops from the one you opened.
  const [count, setCount] = useState(loops.length * 2);
  const feed = Array.from({ length: count }, (_, i) => loops[(startIndex + i) % loops.length]!);

  const resonate = (id: string, x: number, y: number) => {
    burstId.current += 1;
    const burst = { id: burstId.current, x, y };
    setBursts((b) => [...b, burst]);
    window.setTimeout(() => setBursts((b) => b.filter((item) => item.id !== burst.id)), 900);
    if (!liked.includes(id)) appActions.toggleLiked(id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black md:static md:z-auto md:flex md:h-dvh md:items-center md:justify-center md:bg-transparent md:py-6">
      <div className="relative h-full w-full md:aspect-[9/16] md:h-full md:w-auto md:overflow-hidden md:rounded-3xl md:shadow-float">
        <div
          onScroll={(e) => {
            const el = e.currentTarget;
            const current = Math.round(el.scrollTop / el.clientHeight);
            setActive(current);
            if (current > count - 4) setCount((n) => n + loops.length);
          }}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto"
        >
          {feed.map((loop, index) => {
            const author = getPerson(loop.authorId);
            const isLiked = liked.includes(loop.id);
            const isSaved = saved.includes(loop.id);
            const isFollowing = following.includes(author.id);
            const isActive = index === active;
            return (
              <article
                key={`${index}-${loop.id}`}
                aria-label={`${loop.caption} by ${author.name}`}
                className="relative flex h-full snap-start snap-always flex-col justify-end overflow-hidden text-white"
                style={{ background: gradientFor(loop.seed) }}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  resonate(loop.id, e.clientX - rect.left, e.clientY - rect.top);
                }}
              >
                {/* Soft moving shapes stand in for video until the media service is live */}

                {/* Loop progress, top edge */}
                <span aria-hidden="true" className="absolute inset-x-4 top-[max(14px,env(safe-area-inset-top))] h-[3px] overflow-hidden rounded-full bg-white/25">
                  {isActive && <span key={`p-${active}`} className="block h-full origin-left rounded-full bg-white" style={{ animation: 'grow-x 9s linear infinite' }} />}
                </span>

                {bursts.length > 0 &&
                  isActive &&
                  bursts.map((b) => (
                    <span key={b.id} aria-hidden="true" className="burst pointer-events-none absolute z-20" style={{ left: b.x, top: b.y }}>
                      <Heart className="h-24 w-24 fill-white text-white" />
                    </span>
                  ))}

                <div className="relative space-y-3 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
                  <div className="flex items-center gap-2.5">
                    <Link href={`/profile/${author.username}`} className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={author.name} seed={author.id} size="md" className="ring-2 ring-white/60" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{author.name}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-white/75">
                          <Music2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{loop.audio}</span>
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-pressed={isFollowing}
                      onClick={() => appActions.toggleFollowing(author.id)}
                      className={cn('press ml-auto shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold', isFollowing ? 'bg-white/15' : 'bg-white text-black')}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                  <p className="font-display text-[22px] font-semibold leading-snug text-balance">{loop.caption}</p>

                  {/* Tide bar: actions sit in one calm row instead of a stacked rail */}
                  <div className="flex items-center gap-1 rounded-full bg-white/15 p-1">
                    <TideButton label={compactNumber(loop.likes + (isLiked ? 1 : 0))} pressed={isLiked} aria="Like" onClick={() => appActions.toggleLiked(loop.id)}>
                      <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} aria-hidden="true" />
                    </TideButton>
                    <TideButton label={compactNumber(loop.replies)} aria="Replies" onClick={() => setRepliesFor(loop.id)}>
                      <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    </TideButton>
                    <TideButton label="Share" aria="Share" onClick={() => toast('Link copied (preview)')}>
                      <Send className="h-5 w-5" aria-hidden="true" />
                    </TideButton>
                    <TideButton label={isSaved ? 'Saved' : 'Save'} pressed={isSaved} aria="Save" onClick={() => appActions.toggleSaved(loop.id)}>
                      <Bookmark className={cn('h-5 w-5', isSaved && 'fill-current')} aria-hidden="true" />
                    </TideButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[max(24px,calc(env(safe-area-inset-top)+12px))]">
          <Link href="/discover" aria-label="Back" className="press pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p className="font-display text-lg font-semibold text-white drop-shadow">Loops</p>
          <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)} className="press pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white">
            {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <Sheet open={repliesFor !== null} onClose={() => setRepliesFor(null)} title="Replies" description="Keep it kind and useful">
        <div className="space-y-4">
          {REPLIES.map((r) => {
            const person = getPerson(r.from);
            return (
              <div key={r.from} className="border-l-[3px] pl-3" style={{ borderColor: `hsl(${hueFor(r.from)} 42% 58%)` }}>
                <p className="text-xs font-semibold text-text-3">{person.name}</p>
                <p className="text-[15px]">{r.text}</p>
              </div>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

function TideButton({ children, label, onClick, pressed, aria }: { children: ReactNode; label: string; onClick: () => void; pressed?: boolean; aria: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      aria-pressed={pressed}
      className={cn('press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors', pressed ? 'bg-white text-black' : 'hover:bg-white/10')}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
