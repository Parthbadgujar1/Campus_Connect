'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Mic, MicOff, MonitorPlay, MonitorUp, Pause, Play, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { watchParties } from '@/data/fun';
import { getPerson, students } from '@/data/people';
import { gradientFor, hueFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

interface Line {
  id: number;
  from: string;
  text: string;
}

const SEED_LINES: Line[] = [
  { id: 1, from: 'p-tanvi', text: 'Pause at 4:20, that’s the part I was asking about' },
  { id: 2, from: 'p-harsh', text: 'Subtitles are on if you need them 👍' },
  { id: 3, from: 'p-neha', text: 'Can someone recap the last two minutes?' },
];

const REACTIONS = ['👏', '😂', '🔥', '💜', '🤯'];

interface Floater {
  id: number;
  emoji: string;
  left: number;
}

export default function WatchPartyPage() {
  const { id } = useParams<{ id: string }>();
  const party = watchParties.find((w) => w.id === id);
  const toast = useToast();
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(35);
  const [micOn, setMicOn] = useState(false);
  const [lines, setLines] = useState<Line[]>(SEED_LINES);
  const [draft, setDraft] = useState('');
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const counter = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // Simulated synced playback. In the live app every viewer follows the host's clock.
  useEffect(() => {
    if (!playing) return;
    const handle = window.setInterval(() => setProgress((p) => (p >= 100 ? 0 : p + 0.4)), 400);
    return () => window.clearInterval(handle);
  }, [playing]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [lines.length]);

  if (!party) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState icon={MonitorPlay} title="This party has ended" action={<Link href="/watch?tab=together" className="text-sm font-semibold text-accent">See other parties</Link>} />
      </div>
    );
  }

  const host = getPerson(party.hostId);
  const viewers = students.slice(0, 6);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    counter.current += 1;
    setLines((l) => [...l, { id: 1000 + counter.current, from: 'me', text }]);
    setDraft('');
  };

  const react = (emoji: string) => {
    counter.current += 1;
    const floater = { id: counter.current, emoji, left: 10 + ((counter.current * 37) % 70) };
    setFloaters((f) => [...f.slice(-6), floater]);
    window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== floater.id)), 2400);
  };

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:flex-row md:gap-4 md:p-4">
      <section className="flex flex-col md:min-h-0 md:flex-1">
        <div className="relative aspect-video w-full overflow-hidden text-white md:rounded-3xl" style={{ background: gradientFor(party.seed) }}>
          <Link href="/watch?tab=together" aria-label="Leave party" className="press absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/30">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/30 py-1 pl-1 pr-3 text-xs font-semibold">
            <span className="flex -space-x-2">
              {viewers.slice(0, 3).map((p) => (
                <Avatar key={p.id} name={p.name} seed={p.id} size="xs" className="ring-2 ring-black/20" />
              ))}
            </span>
            {party.viewers + 1} here
          </div>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause for everyone' : 'Play for everyone'}
            className="press absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/25"
          >
            {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 translate-x-0.5 fill-current" />}
          </button>
          {floaters.map((f) => (
            <span key={f.id} aria-hidden="true" className="party-float pointer-events-none absolute bottom-10 text-3xl" style={{ left: `${f.left}%` }}>
              {f.emoji}
            </span>
          ))}
          <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label="Playback position" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-white shadow-[0_0_10px_white] transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-white/85">
              <span>In sync with {host.name.split(' ')[0]}</span>
              <span>{playing ? 'Playing for everyone' : 'Paused'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 pt-4 md:px-1">
          <div>
            <h1 className="font-display text-[22px] font-semibold leading-tight">{party.title}</h1>
            <p className="text-sm text-text-3">
              {party.live ? 'Live' : 'Scheduled'} · hosted by {host.name} · {party.source}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label={micOn ? 'Mute microphone' : 'Unmute microphone'} onClick={() => setMicOn((m) => !m)} className={cn('border border-border bg-surface shadow-card', micOn && 'bg-accent-soft text-accent-soft-ink')}>
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </IconButton>
            <IconButton label="Share screen" onClick={() => toast('Screen share starts in the desktop app (preview)')} className="border border-border bg-surface shadow-card">
              <MonitorUp className="h-5 w-5" />
            </IconButton>
            <div className="ml-auto flex gap-1.5 rounded-full border border-border bg-surface p-1 shadow-card">
              {REACTIONS.map((emoji) => (
                <button key={emoji} type="button" aria-label={`React with ${emoji}`} onClick={() => react(emoji)} className="press grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-surface-2">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="mt-4 flex min-h-[360px] flex-1 flex-col border-t border-border md:mt-0 md:w-[360px] md:flex-none md:overflow-hidden md:rounded-3xl md:border md:bg-surface md:shadow-card">
        <p className="px-4 pb-2 pt-4 font-display text-lg font-semibold">Room talk</p>
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
          {lines.map((line) => {
            const mine = line.from === 'me';
            const name = mine ? 'You' : getPerson(line.from).name.split(' ')[0];
            return (
              <div key={line.id} className="animate-rise border-l-[3px] pl-3" style={{ borderColor: mine ? 'var(--accent)' : `hsl(${hueFor(line.from)} 42% 58%)` }}>
                <p className="text-xs font-semibold text-text-3">{name}</p>
                <p className="text-sm">{line.text}</p>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="pb-safe flex gap-2 p-3">
          <label className="sr-only" htmlFor="party-chat">
            Message the room
          </label>
          <input
            id="party-chat"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something to the room"
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-sm focus:border-accent focus:outline-none"
          />
          <IconButton type="submit" label="Send message" disabled={!draft.trim()} className="h-11 w-11 bg-accent text-accent-ink hover:bg-accent hover:text-accent-ink">
            <Send className="h-4 w-4" />
          </IconButton>
        </form>
      </aside>
    </div>
  );
}
