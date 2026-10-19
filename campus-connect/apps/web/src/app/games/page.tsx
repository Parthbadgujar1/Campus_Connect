'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Brain, ChevronRight, Grid2x2, Mic, MicOff, Plus, Users, Zap } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch } from '@/components/ui/fields';
import { PageHeader, SectionHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { leaderboard } from '@/data/fun';
import { getPerson, me } from '@/data/people';
import { playTables, type PlayTable } from '@/data/playroom';
import { cn } from '@/lib/utils';

const QUICK: { href: string; title: string; description: string; time: string; icon: typeof Grid2x2 }[] = [
  { href: '/games/memory', title: 'Memory garden', description: 'Match the pairs, fewest moves wins', time: '2 min', icon: Grid2x2 },
  { href: '/games/reflex', title: 'Reflex ripple', description: 'Tap the moment the circle glows', time: '1 min', icon: Zap },
  { href: '/games/quiz', title: 'Campus trivia', description: 'Five questions, fifteen seconds each', time: '3 min', icon: Brain },
];

const GAMES = ['Smash bracket', 'Trivia night', 'Word duel', 'Pictionary', 'Quiz battle'];

export default function PlayroomPage() {
  const toast = useToast();
  const [tables, setTables] = useState<PlayTable[]>(playTables);
  const [open, setOpen] = useState<PlayTable | null>(null);
  const [starting, setStarting] = useState(false);
  const [draft, setDraft] = useState({ game: GAMES[0]!, seats: '6', voice: true });
  const [micOn, setMicOn] = useState(false);

  const join = (table: PlayTable) => {
    if (table.playerIds.includes('me')) return;
    setTables((list) => list.map((t) => (t.id === table.id ? { ...t, taken: t.taken + 1, playerIds: [...t.playerIds, 'me'] } : t)));
    toast(`You joined ${table.game}`);
  };
  const leave = (table: PlayTable) => {
    setTables((list) => list.map((t) => (t.id === table.id ? { ...t, taken: t.taken - 1, playerIds: t.playerIds.filter((id) => id !== 'me') } : t)));
    setOpen(null);
    toast('You left the table');
  };

  const current = open ? tables.find((t) => t.id === open.id) ?? open : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Playroom"
        subtitle="Quick games on your own, or live tables with people"
        back
        backHref="/discover"
        actions={
          <Button size="sm" onClick={() => setStarting(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Table
          </Button>
        }
      />

      <section className="mt-6" aria-labelledby="quick">
        <SectionHeader title="Quick games" description="Play alone, between classes" />
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {QUICK.map((game) => (
            <li key={game.href}>
              <Link href={game.href} className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-surface-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                  <game.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{game.title}</span>
                  <span className="block text-[13px] text-text-3">
                    {game.description} · {game.time}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-9" aria-labelledby="tables">
        <SectionHeader title="Live tables" description="Join a table, talk with voice or chat, and play together" />
        <ul className="grid gap-3 md:grid-cols-2">
          {tables.map((table) => {
            const host = getPerson(table.hostId);
            const seated = table.playerIds.includes('me');
            const full = table.taken >= table.seats;
            return (
              <li key={table.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-text-3">Hosted by {host.name.split(' ')[0]}</p>
                    <p className="text-[17px] font-semibold">{table.game}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', table.status === 'Playing' ? 'bg-highlight text-highlight-ink' : 'bg-surface-2 text-text-2')}>
                    {table.status}
                  </span>
                </div>
                <p className="text-[14px] text-text-2">{table.note}</p>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {table.playerIds.slice(0, 4).map((id) => (
                      <Avatar key={id} name={id === 'me' ? me.name : getPerson(id).name} seed={id === 'me' ? me.id : id} size="xs" className="ring-2 ring-surface" />
                    ))}
                  </div>
                  <span className="flex items-center gap-1.5 text-[13px] text-text-3">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {table.taken} of {table.seats}
                    {table.voice && (
                      <>
                        <span aria-hidden="true">·</span>
                        <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                        Voice
                      </>
                    )}
                  </span>
                </div>
                <div className="mt-auto flex gap-2">
                  {seated ? (
                    <Button variant="secondary" full onClick={() => setOpen(table)}>
                      Open table
                    </Button>
                  ) : (
                    <Button full disabled={full} onClick={() => join(table)}>
                      {full ? 'Full' : 'Join table'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-9" aria-labelledby="board">
        <SectionHeader title="This month" action={{ label: 'Achievements', href: '/achievements' }} />
        <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {leaderboard.slice(0, 5).map((row, i) => {
            const isMe = row.personId === 'me';
            const person = isMe ? me : getPerson(row.personId);
            return (
              <li key={row.personId} className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-accent-soft/60')}>
                <span className="w-6 text-center text-[15px] font-semibold text-text-3">{i + 1}</span>
                <Avatar name={person.name} seed={person.id} size="xs" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{isMe ? 'You' : person.name}</span>
                <span className="text-[14px] font-semibold tabular-nums">{row.xp.toLocaleString('en-IN')} XP</span>
              </li>
            );
          })}
        </ol>
      </section>

      <Sheet open={current !== null} onClose={() => setOpen(null)} title={current?.game ?? 'Table'} description={current ? `Hosted by ${getPerson(current.hostId).name}` : undefined}>
        {current && (
          <div className="space-y-5">
            <p className="text-[15px] text-text-2">{current.note}</p>
            <div className="grid grid-cols-3 gap-3">
              {current.playerIds.map((id) => (
                <div key={id} className="flex flex-col items-center gap-1.5">
                  <Avatar name={id === 'me' ? me.name : getPerson(id).name} seed={id === 'me' ? me.id : id} size="md" />
                  <span className="text-[13px] font-medium">{id === 'me' ? 'You' : getPerson(id).name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
            {current.voice && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
                <div>
                  <p className="text-[15px] font-semibold">Voice</p>
                  <p className="text-[13px] text-text-3">{micOn ? 'Your mic is on' : 'Muted until you speak'}</p>
                </div>
                <Button variant={micOn ? 'primary' : 'secondary'} onClick={() => setMicOn((m) => !m)} aria-pressed={micOn}>
                  {micOn ? <Mic className="h-4 w-4" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
                  {micOn ? 'Mute' : 'Unmute'}
                </Button>
              </div>
            )}
            <Button variant="secondary" full onClick={() => leave(current)}>
              Leave table
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={starting}
        onClose={() => setStarting(false)}
        title="Start a table"
        description="Others can see it and join."
        footer={
          <Button
            full
            onClick={() => {
              setStarting(false);
              toast(`${draft.game} table is open`);
            }}
          >
            Open table
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Game" htmlFor="table-game">
            <Select id="table-game" value={draft.game} onChange={(e) => setDraft({ ...draft, game: e.target.value })}>
              {GAMES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Seats" htmlFor="table-seats">
            <Input id="table-seats" type="number" min={2} max={12} value={draft.seats} onChange={(e) => setDraft({ ...draft, seats: e.target.value })} />
          </Field>
          <div className="overflow-hidden rounded-2xl border border-border">
            <Switch checked={draft.voice} onChange={(value) => setDraft({ ...draft, voice: value })} label="Voice" description="Players can talk while they play" />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
