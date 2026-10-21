'use client';

import { useEffect, useState } from 'react';
import { CloudRain, Coffee, Flame, Library, Pause, Play, RotateCcw, Trees, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Card, PageHeader } from '@/components/ui/layout';
import { cn } from '@/lib/utils';

const PRESETS = [
  { id: 'quick', label: '15 · 3', focus: 15, rest: 3 },
  { id: 'classic', label: '25 · 5', focus: 25, rest: 5 },
  { id: 'deep', label: '50 · 10', focus: 50, rest: 10 },
] as const;

const SOUNDS = [
  { id: 'silence', label: 'Silence', icon: VolumeX },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'library', label: 'Library hum', icon: Library },
  { id: 'forest', label: 'Forest', icon: Trees },
] as const;

interface Timer {
  phase: 'focus' | 'rest';
  left: number;
  completed: number;
}

export default function FocusPage() {
  const [presetId, setPresetId] = useState<(typeof PRESETS)[number]['id']>('classic');
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[1];
  const [timer, setTimer] = useState<Timer>({ phase: 'focus', left: preset.focus * 60, completed: 0 });
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState<(typeof SOUNDS)[number]['id']>('silence');
  const [intention, setIntention] = useState('');

  // One tick a second. Phase changes happen inside the same pure update.
  useEffect(() => {
    if (!running) return;
    const handle = window.setInterval(() => {
      setTimer((t) => {
        if (t.left > 1) return { ...t, left: t.left - 1 };
        return t.phase === 'focus'
          ? { phase: 'rest', left: preset.rest * 60, completed: t.completed + 1 }
          : { phase: 'focus', left: preset.focus * 60, completed: t.completed };
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, [running, preset.focus, preset.rest]);

  const total = (timer.phase === 'focus' ? preset.focus : preset.rest) * 60;
  const progress = 1 - timer.left / total;
  const minutes = Math.floor(timer.left / 60);
  const seconds = String(timer.left % 60).padStart(2, '0');
  const circumference = 2 * Math.PI * 140;

  const choose = (id: (typeof PRESETS)[number]['id']) => {
    const next = PRESETS.find((p) => p.id === id) ?? PRESETS[1];
    setPresetId(id);
    setRunning(false);
    setTimer((t) => ({ ...t, phase: 'focus', left: next.focus * 60 }));
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Focus" subtitle="Breathe in with the ring, breathe out, begin" back backHref="/study" />

      <div className="mt-2 flex flex-col items-center">
        <ChipRow className="justify-center md:justify-center">
          {PRESETS.map((p) => (
            <Chip key={p.id} active={presetId === p.id} onClick={() => choose(p.id)}>
              {p.label}
            </Chip>
          ))}
        </ChipRow>

        {/* The ring */}
        <div className="relative mt-6 grid aspect-square w-full max-w-[340px] place-items-center">
          <svg viewBox="0 0 300 300" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="150" cy="150" r="140" fill="none" strokeWidth="6" className="stroke-surface-3" />
            <circle
              cx="150"
              cy="150"
              r="140"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              stroke={timer.phase === 'focus' ? 'var(--accent)' : 'var(--success)'}
              strokeDasharray={`${progress * circumference} ${circumference}`}
              className="transition-[stroke-dasharray] duration-1000 ease-linear"
            />
          </svg>
          <div className="glass relative grid h-[68%] w-[68%] place-items-center rounded-full shadow-float">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-3">{timer.phase === 'focus' ? 'Focus' : 'Rest'}</p>
              <p className="font-display text-[56px] font-semibold leading-none tabular-nums" role="timer" aria-live="off">
                {minutes}:{seconds}
              </p>
              <p className="mt-2 text-xs text-text-3">{running ? (timer.phase === 'focus' ? 'In the flow' : 'Stretch, sip water') : 'Paused'}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="secondary"
            aria-label="Reset"
            onClick={() => {
              setRunning(false);
              setTimer((t) => ({ ...t, phase: 'focus', left: preset.focus * 60 }));
            }}
            className="h-12 w-12 px-0"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button size="lg" onClick={() => setRunning((r) => !r)} className="min-w-40">
            {running ? <Pause className="h-5 w-5 fill-current" aria-hidden="true" /> : <Play className="h-5 w-5 fill-current" aria-hidden="true" />}
            {running ? 'Pause' : timer.left === total ? 'Begin' : 'Resume'}
          </Button>
          <Button
            variant="secondary"
            aria-label="Skip to break"
            onClick={() => setTimer((t) => (t.phase === 'focus' ? { phase: 'rest', left: preset.rest * 60, completed: t.completed + 1 } : { ...t, phase: 'focus', left: preset.focus * 60 }))}
            className="h-12 w-12 px-0"
          >
            <Coffee className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        <input
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="What are you focusing on?"
          aria-label="Focus intention"
          className="mt-6 w-full max-w-sm border-b border-border bg-transparent pb-2 text-center font-display text-lg placeholder:text-text-3 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm font-semibold">Soundscape</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SOUNDS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={sound === s.id}
                onClick={() => setSound(s.id)}
                className={cn('press flex flex-col items-start gap-3 rounded-2xl border p-3 text-left text-sm font-semibold transition-colors', sound === s.id ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border bg-surface-2 text-text-2 hover:border-accent/40')}
              >
                <s.icon className="h-5 w-5" aria-hidden="true" />
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-3">Audio plays once the media service is connected.</p>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <span className="orb grid h-14 w-14 shrink-0 place-items-center rounded-full text-accent-ink">
            <Flame className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-2xl font-semibold">12-day streak</p>
            <p className="text-sm text-text-3">
              {timer.completed} {timer.completed === 1 ? 'session' : 'sessions'} today. One more keeps the flame going.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
