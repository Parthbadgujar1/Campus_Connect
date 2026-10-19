'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Send, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { momentSets, type MomentSet } from '@/data/moments';
import { getPerson, me } from '@/data/people';
import { appActions, useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { gradientFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

const FRAME_MS = 5000;

/** Ring split into one arc per frame; unseen arcs glow, seen ones fade. */
function ringFor(set: MomentSet, seen: string[]): string {
  const n = set.frames.length;
  const gap = n > 1 ? 4 : 0;
  const slice = 360 / n;
  const stops = set.frames.flatMap((frame, i) => {
    const color = seen.includes(frame.id) ? 'var(--surface-3)' : 'var(--accent)';
    const start = i * slice;
    return [`${color} ${start}deg ${start + slice - gap}deg`, `transparent ${start + slice - gap}deg ${start + slice}deg`];
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export function MomentsRail({ className }: { className?: string }) {
  const toast = useToast();
  const seen = useAppState((s) => s.seenMoments);
  const [openAt, setOpenAt] = useState<number | null>(null);

  return (
    <>
      <div className={cn('no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 py-2 md:mx-0 md:px-0', className)}>
        <button
          type="button"
          onClick={() => toast('Moment camera opens on your phone (preview)')}
          className="press flex w-[68px] shrink-0 flex-col items-center gap-1.5"
        >
          <span className="relative grid h-[66px] w-[66px] place-items-center rounded-full border-2 border-dashed border-border">
            <Avatar name={me.name} seed={me.id} size="lg" className="h-[56px] w-[56px]" />
            <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--bg)] bg-accent text-accent-ink">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
            </span>
          </span>
          <span className="w-full truncate text-center text-xs font-medium text-text-2">Your moment</span>
        </button>

        {momentSets.map((set, i) => {
          const person = getPerson(set.personId);
          const allSeen = set.frames.every((f) => seen.includes(f.id));
          return (
            <button
              key={set.personId}
              type="button"
              onClick={() => setOpenAt(i)}
              className="press flex w-[68px] shrink-0 flex-col items-center gap-1.5"
              aria-label={`Moments from ${person.name}${allSeen ? ', seen' : ''}`}
            >
              <span className="grid h-[66px] w-[66px] place-items-center rounded-full p-[3px]" style={{ background: ringFor(set, seen) }}>
                <span className="grid h-full w-full place-items-center rounded-full bg-[var(--bg)] p-[2px]">
                  <Avatar name={person.name} seed={person.id} size="lg" className="h-full w-full" />
                </span>
              </span>
              <span className={cn('w-full truncate text-center text-xs font-medium', allSeen ? 'text-text-3' : 'text-text')}>
                {person.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
      {openAt !== null && <MomentViewer startSet={openAt} onClose={() => setOpenAt(null)} />}
    </>
  );
}

function MomentViewer({ startSet, onClose }: { startSet: number; onClose: () => void }) {
  const toast = useToast();
  const reduceMotionPref = useAppState((s) => s.reduceMotion);
  const [position, setPosition] = useState({ set: startSet, frame: 0 });
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  // With calm motion on, frames wait for a tap instead of advancing on a timer.
  const [autoAdvance] = useState(
    () => !reduceMotionPref && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const set = momentSets[position.set]!;
  const frame = set.frames[position.frame]!;
  const person = getPerson(set.personId);

  const next = () => {
    if (position.frame < set.frames.length - 1) setPosition({ set: position.set, frame: position.frame + 1 });
    else if (position.set < momentSets.length - 1) setPosition({ set: position.set + 1, frame: 0 });
    else onClose();
  };
  const previous = () => {
    if (position.frame > 0) setPosition({ set: position.set, frame: position.frame - 1 });
    else if (position.set > 0) setPosition({ set: position.set - 1, frame: momentSets[position.set - 1]!.frames.length - 1 });
  };

  useEffect(() => {
    appActions.seeMoment(frame.id);
  }, [frame.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') previous();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Moments from ${person.name}`} className="animate-fade fixed inset-0 z-[85] grid place-items-center bg-black/80 md:p-6">
      <div
        className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden text-white md:h-[min(820px,92dvh)] md:rounded-3xl"
        style={{ background: gradientFor(frame.seed) }}
      >

        <div className="pt-safe relative z-10 px-4 pt-3">
          <div className="flex gap-1">
            {set.frames.map((f, i) => (
              <span key={f.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                {i < position.frame && <span className="block h-full w-full bg-white" />}
                {i === position.frame && (
                  <span
                    key={`${position.set}-${position.frame}`}
                    className="block h-full w-full origin-left bg-white"
                    style={
                      autoAdvance
                        ? { animation: `grow-x ${FRAME_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }
                        : undefined
                    }
                    onAnimationEnd={autoAdvance ? next : undefined}
                  />
                )}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={person.name} seed={person.id} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{person.name}</p>
              <p className="text-xs text-white/75">{relativeTime(frame.at)} ago</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close moments" className="press grid h-10 w-10 place-items-center rounded-full bg-black/20">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tap zones: left goes back, right goes forward; press and hold pauses. */}
        <div
          className="relative z-0 flex flex-1 items-center px-8"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        >
          <button type="button" aria-label="Previous moment" onClick={previous} className="absolute inset-y-0 left-0 w-1/3" />
          <button type="button" aria-label="Next moment" onClick={next} className="absolute inset-y-0 right-0 w-2/3" />
          <p key={frame.id} className="animate-rise pointer-events-none relative mx-auto max-w-xs text-center font-display text-[30px] font-semibold leading-tight text-balance drop-shadow">
            {frame.caption}
          </p>
        </div>

        <div className="pb-safe relative z-10 space-y-3 px-4 pb-4">
          <div className="flex justify-center gap-2">
            {['💜', '😂', '🔥', '👏', '🥹'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                onClick={() => toast(`Sent ${emoji} to ${person.name.split(' ')[0]}`)}
                className="press grid h-11 w-11 place-items-center rounded-full bg-black/20 text-xl"
              >
                {emoji}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2 rounded-full border border-white/30 bg-black/20 p-1.5 pl-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              setReply('');
              toast(`Reply sent to ${person.name.split(' ')[0]}`);
            }}
          >
            <label htmlFor="moment-reply" className="sr-only">
              Reply to {person.name}
            </label>
            <input
              id="moment-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              placeholder={`Reply to ${person.name.split(' ')[0]}…`}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/70 focus:outline-none"
            />
            <button type="submit" aria-label="Send reply" className="press grid h-9 w-9 place-items-center rounded-full bg-white text-black">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
