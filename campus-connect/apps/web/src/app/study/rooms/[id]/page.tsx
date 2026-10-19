'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Coffee, Pause, Play, RotateCcw, Timer, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { Input } from '@/components/ui/fields';
import { useToast } from '@/components/ui/toast';
import { studyRooms } from '@/data/learning';
import { getPerson, students } from '@/data/people';
import { cn } from '@/lib/utils';

type Phase = 'focus' | 'break';
interface Timer {
  phase: Phase;
  secondsLeft: number;
  cycles: number;
}

/** Pure timer step: switch phase when a segment ends. Kept out of effects on purpose. */
function tick(timer: Timer, focusSeconds: number, breakSeconds: number): Timer {
  if (timer.secondsLeft > 1) return { ...timer, secondsLeft: timer.secondsLeft - 1 };
  if (timer.phase === 'focus') return { phase: 'break', secondsLeft: breakSeconds, cycles: timer.cycles + 1 };
  return { phase: 'focus', secondsLeft: focusSeconds, cycles: timer.cycles };
}

export default function StudyRoomPage() {
  const { id } = useParams<{ id: string }>();
  const room = studyRooms.find((r) => r.id === id);
  const toast = useToast();
  const focusSeconds = (room?.focusMinutes ?? 25) * 60;
  const breakSeconds = (room?.breakMinutes ?? 5) * 60;
  const [timer, setTimer] = useState<Timer>({ phase: 'focus', secondsLeft: focusSeconds, cycles: 0 });
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<string[]>(room?.sharedNotes ?? []);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!running) return;
    const handle = window.setInterval(() => setTimer((t) => tick(t, focusSeconds, breakSeconds)), 1000);
    return () => window.clearInterval(handle);
  }, [running, focusSeconds, breakSeconds]);

  if (!room) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Study room" back backHref="/study?tab=rooms" />
        <EmptyState icon={Timer} title="This room is no longer available" className="mt-6" />
      </div>
    );
  }

  const phaseTotal = timer.phase === 'focus' ? focusSeconds : breakSeconds;
  const mm = String(Math.floor(timer.secondsLeft / 60)).padStart(2, '0');
  const ss = String(timer.secondsLeft % 60).padStart(2, '0');
  const host = getPerson(room.hostId);
  const members = students.slice(0, Math.min(room.members, 6));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={room.title} subtitle={`${room.subject} · ${room.type}`} back backHref="/study?tab=rooms" />

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Card className={cn('flex flex-col items-center gap-5 p-6 text-center transition-colors', timer.phase === 'break' && 'bg-success-soft border-success/30')}>
            <div className="flex items-center gap-2">
              <Badge tone={timer.phase === 'focus' ? 'accent' : 'success'}>
                {timer.phase === 'focus' ? 'Focus' : 'Break'}
              </Badge>
              <Badge>{room.focusMinutes}/{room.breakMinutes} min</Badge>
              <span className="text-xs text-text-3">Cycle {timer.cycles + 1}</span>
            </div>
            <p className="text-6xl font-bold tabular-nums tracking-tight md:text-7xl" aria-live="off" aria-label={`${mm} minutes ${ss} seconds`}>
              {mm}:{ss}
            </p>
            <ProgressBar value={phaseTotal - timer.secondsLeft} max={phaseTotal} tone={timer.phase === 'focus' ? 'accent' : 'success'} className="max-w-sm" label="Timer progress" />
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={() => setRunning((r) => !r)}>
                {running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                {running ? 'Pause' : 'Start'}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  setRunning(false);
                  setTimer({ phase: 'focus', secondsLeft: focusSeconds, cycles: 0 });
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-text-3">
              <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
              Everyone in the room follows the same timer.
            </p>
          </Card>

          <section>
            <SectionHeader title="Shared notes" description="Anyone in the room can add a note" />
            <Card className="space-y-3 p-4">
              {notes.length === 0 && <p className="text-sm text-text-3">No notes yet.</p>}
              <ul className="space-y-2">
                {notes.map((item, i) => (
                  <li key={`${item}-${i}`} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  setNotes((n) => [...n, note.trim()]);
                  setNote('');
                }}
              >
                <Input aria-label="Add a shared note" placeholder="Add a note for the room" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button type="submit" variant="secondary" disabled={!note.trim()}>
                  Add
                </Button>
              </form>
            </Card>
          </section>
        </div>

        <aside className="space-y-5">
          <Card className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" aria-hidden="true" />
              {room.members} in the room
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((person) => (
                <Avatar key={person.id} name={person.name} seed={person.id} size="sm" />
              ))}
            </div>
            <p className="text-xs text-text-3">
              Host: <Link href={`/profile/${host.username}`} className="font-semibold text-accent">{host.name}</Link>
            </p>
          </Card>
          <Card className="space-y-2 p-4 text-sm text-text-2">
            <p className="font-semibold text-text">Room rules</p>
            <p>• Camera optional. Mics muted during focus.</p>
            <p>• Keep chat to the subject.</p>
            <p>• Leave a note before you go.</p>
          </Card>
          <Button variant="ghost" full onClick={() => toast('You left the room')}>
            Leave room
          </Button>
        </aside>
      </div>
    </div>
  );
}
