'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Captions,
  Check,
  FileText,
  Heart,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Send,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { VideoCard, duration } from '@/components/watch/video-card';
import { getPerson } from '@/data/people';
import { getChannel, getVideo, videos, watchProgress, type Video } from '@/data/videos';
import { appActions, useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { compactNumber, gradientFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
type Panel = 'next' | 'moments' | 'chapters' | 'notes';

interface Moment {
  id: string;
  at: number;
  from: string;
  text: string;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// Comments pinned to a moment in the video. They surface on screen as playback passes them.
function seedMoments(video: Video): Moment[] {
  const total = video.durationMin * 60;
  const lines: [string, string][] = [
    ['p-tanvi', 'This explanation finally made it click 💡'],
    ['p-rohan', 'Pause here and try it yourself first'],
    ['p-aditi', 'Love how calm this pacing is'],
    ['p-harsh', 'Bookmarking this bit for the exam'],
  ];
  return lines.map(([from, text], i) => ({ id: `${video.id}-m${i}`, at: Math.round(total * (0.04 + i * 0.22)), from, text }));
}

export default function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const video = getVideo(id);
  if (!video) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState icon={Play} title="This video isn’t available" description="It may be in review or was removed." action={<Link href="/watch" className="text-sm font-semibold text-accent">Back to Watch</Link>} />
      </div>
    );
  }
  return <Player key={video.id} video={video} />;
}

function Player({ video }: { video: Video }) {
  const toast = useToast();
  const total = video.durationMin * 60;
  const channel = getChannel(video.channelId);
  const subscribed = useAppState((s) => (channel ? s.subscriptions.includes(channel.id) : false));
  const resonated = useAppState((s) => s.liked.includes(video.id));
  const kept = useAppState((s) => s.saved.includes(video.id));

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(((watchProgress[video.id] ?? 0) / 100) * total);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [captions, setCaptions] = useState(false);
  const [panel, setPanel] = useState<Panel>('next');
  const [moments, setMoments] = useState<Moment[]>(() => seedMoments(video));
  const [draft, setDraft] = useState('');

  const isPlaying = playing && position < total;

  // Preview playback advances the timeline; real streaming arrives with the video service.
  useEffect(() => {
    if (!isPlaying) return;
    const handle = window.setInterval(() => setPosition((p) => Math.min(total, p + speed * 4)), 1000);
    return () => window.clearInterval(handle);
  }, [isPlaying, speed, total]);

  const seek = (seconds: number) => setPosition(Math.max(0, Math.min(total, seconds)));
  const chapter = [...video.chapters].reverse().find((c) => c.at <= position);
  const surfacing = moments.filter((m) => position >= m.at && position - m.at < 14);
  const upNext = videos.filter((v) => v.id !== video.id && (v.kind === video.kind || v.channelId === video.channelId)).slice(0, 6);
  const pct = (position / total) * 100;

  const panels: { value: Panel; label: string }[] = [
    { value: 'next', label: 'Up next' },
    { value: 'moments', label: `Moments · ${moments.length}` },
    ...(video.chapters.length ? [{ value: 'chapters' as const, label: 'Chapters' }] : []),
    ...(video.notes.length ? [{ value: 'notes' as const, label: 'Notes' }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl pb-16 md:px-8 md:pt-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {/* Theatre: the video sits on a glow of its own colours */}
          <div className="relative md:px-0">
            <div className="relative aspect-video w-full overflow-hidden text-white md:rounded-3xl" style={{ background: gradientFor(video.seed) }}>

              <Link href="/watch" aria-label="Back to Watch" className="press absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/30">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (isPlaying) return setPlaying(false);
                  if (position >= total) setPosition(0);
                  setPlaying(true);
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="press absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/25"
              >
                {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 translate-x-0.5 fill-current" />}
              </button>

              {/* Moments float up as playback passes them */}
              <div className="pointer-events-none absolute right-3 top-14 flex max-w-[60%] flex-col items-end gap-1.5" aria-live="polite">
                {surfacing.map((m) => (
                  <span key={m.id} className="animate-rise flex items-center gap-2 rounded-full bg-black/35 py-1 pl-1 pr-3 text-xs">
                    <Avatar name={m.from === 'me' ? 'You' : getPerson(m.from).name} seed={m.from} size="xs" className="h-5 w-5 text-[8px]" />
                    <span className="truncate">{m.text}</span>
                  </span>
                ))}
              </div>

              {captions && (
                <p className="absolute inset-x-6 bottom-20 mx-auto max-w-md rounded-xl bg-black/60 px-3 py-1.5 text-center text-sm">
                  {chapter ? chapter.label : 'Captions appear when the transcript is ready.'}
                </p>
              )}

              <div className="absolute inset-x-0 bottom-0 space-y-2 p-3 md:p-4">
                <div
                  role="slider"
                  aria-label="Seek"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={Math.round(position)}
                  aria-valuetext={clock(position)}
                  tabIndex={0}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    seek(((e.clientX - rect.left) / rect.width) * total);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') seek(position + 10);
                    if (e.key === 'ArrowLeft') seek(position - 10);
                  }}
                  className="relative h-2 w-full cursor-pointer rounded-full bg-white/25"
                >
                  <div className="h-full rounded-full bg-white shadow-[0_0_12px_white]" style={{ width: `${pct}%` }} />
                  {moments.map((m) => (
                    <span key={m.id} aria-hidden="true" className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--orb-b)]" style={{ left: `${(m.at / total) * 100}%` }} />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button type="button" aria-label="Back 10 seconds" onClick={() => seek(position - 10)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Forward 10 seconds" onClick={() => seek(position + 10)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15">
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <span className="ml-1 tabular-nums">
                    {clock(position)} / {clock(total)}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Playback speed ${speed}x`}
                      onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
                      className="rounded-full bg-white/15 px-2.5 py-1 font-semibold tabular-nums"
                    >
                      {speed}x
                    </button>
                    <button type="button" aria-pressed={captions} aria-label="Captions" onClick={() => setCaptions((c) => !c)} className={cn('grid h-8 w-8 place-items-center rounded-full', captions ? 'bg-white text-black' : 'hover:bg-white/15')}>
                      <Captions className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-4 pt-5 md:px-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{video.kind === 'Lecture' ? video.subject : 'Creator'}</Badge>
              {video.semester && <Badge>Semester {video.semester}</Badge>}
              <span className="text-xs text-text-3">
                {compactNumber(video.views)} views · {relativeTime(video.uploadedAt)} · {duration(video.durationMin)}
              </span>
            </div>
            <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-balance md:text-[30px]">{video.title}</h1>

            {channel && (
              <div className="flex items-center gap-3">
                <Avatar name={channel.name} seed={channel.personId} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{channel.name}</p>
                  <p className="truncate text-xs text-text-3">
                    {channel.handle} · {compactNumber(channel.subscribers + (subscribed ? 1 : 0))} following
                  </p>
                </div>
                <Button size="sm" variant={subscribed ? 'secondary' : 'primary'} aria-pressed={subscribed} onClick={() => appActions.toggleSubscribed(channel.id)}>
                  {subscribed && <Check className="h-4 w-4" aria-hidden="true" />}
                  {subscribed ? 'Following' : 'Follow'}
                </Button>
              </div>
            )}

            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              <Button size="sm" variant={resonated ? 'soft' : 'secondary'} aria-pressed={resonated} onClick={() => appActions.toggleLiked(video.id)}>
                <Heart className={cn('h-4 w-4', resonated && 'fill-current')} aria-hidden="true" />
                {compactNumber(Math.round(video.views / 12) + (resonated ? 1 : 0))}
              </Button>
              <Button size="sm" variant={kept ? 'soft' : 'secondary'} aria-pressed={kept} onClick={() => appActions.toggleSaved(video.id)}>
                <Bookmark className={cn('h-4 w-4', kept && 'fill-current')} aria-hidden="true" />
                {kept ? 'Saved' : 'Save'}
              </Button>
              <Link href="/watch?tab=together" className={buttonClass({ size: 'sm', variant: 'secondary' })}>
                <Users className="h-4 w-4" aria-hidden="true" />
                Watch together
              </Link>
              <Button size="sm" variant="secondary" onClick={() => toast('Link copied (preview)')}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Share
              </Button>
            </div>

            <p className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-text-2">{video.description}</p>
          </div>
        </div>

        <aside className="min-w-0 px-4 md:px-0">
          <UnderlineTabs<Panel> label="Video panels" value={panel} onChange={setPanel} options={panels} />
          <div key={panel} className="animate-rise mt-4">
            {panel === 'next' && (
              <div className="space-y-1">
                {upNext.map((v) => (
                  <VideoCard key={v.id} video={v} layout="row" />
                ))}
              </div>
            )}

            {panel === 'moments' && (
              <div className="space-y-3">
                <form
                  className="flex items-center gap-2 rounded-full border border-border bg-surface p-1.5 pl-4 shadow-card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = draft.trim();
                    if (!text) return;
                    setMoments((list) => [...list, { id: `${video.id}-mine-${list.length}`, at: Math.round(position), from: 'me', text }].sort((a, b) => a.at - b.at));
                    setDraft('');
                  }}
                >
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold tabular-nums text-accent-soft-ink">{clock(position)}</span>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pin a thought to this moment" aria-label="Add a moment" className="h-9 min-w-0 flex-1 bg-transparent text-sm placeholder:text-text-3 focus:outline-none" />
                  <Button type="submit" size="sm" disabled={!draft.trim()} aria-label="Pin moment" className="h-9 w-9 px-0">
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>
                {moments.map((m) => {
                  const name = m.from === 'me' ? 'You' : getPerson(m.from).name;
                  return (
                    <button key={m.id} type="button" onClick={() => seek(m.at)} className="press flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
                      <Avatar name={name} seed={m.from} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-xs text-text-3">
                          <span className="font-semibold text-text-2">{name}</span>
                          <span className="rounded-full bg-surface-2 px-1.5 font-semibold tabular-nums">{clock(m.at)}</span>
                        </span>
                        <span className="mt-0.5 block text-sm">{m.text}</span>
                      </span>
                    </button>
                  );
                })}
                <p className="flex items-center gap-1.5 px-2 text-xs text-text-3">
                  <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                  Moments appear on the video as you reach them.
                </p>
              </div>
            )}

            {panel === 'chapters' && (
              <div className="space-y-1">
                {video.chapters.map((c) => (
                  <button
                    key={c.at}
                    type="button"
                    onClick={() => {
                      seek(c.at);
                      setPlaying(true);
                    }}
                    className={cn('press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-surface-2', chapter?.at === c.at && 'bg-accent-soft text-accent-soft-ink')}
                  >
                    <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-text-3">{clock(c.at)}</span>
                    <span className="text-sm font-semibold">{c.label}</span>
                  </button>
                ))}
              </div>
            )}

            {panel === 'notes' && (
              <div className="space-y-1">
                {video.notes.map((note) => (
                  <button key={note} type="button" onClick={() => toast(`Opening ${note} (preview)`)} className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-text-2">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold">{note}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
