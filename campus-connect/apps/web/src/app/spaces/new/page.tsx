'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Field, Input, Textarea } from '@/components/ui/fields';
import { Card, PageHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import type { Community } from '@/lib/types';
import { gradientFor, initials } from '@/lib/visuals';
import { cn } from '@/lib/utils';

const KINDS: Community['kind'][] = ['Club', 'Interest', 'Department', 'Exam', 'Hostel', 'City'];
const ROOM_PRESETS = ['general', 'announcements', 'resources', 'doubts', 'memes', 'projects'];

export default function NewSpacePage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [kind, setKind] = useState<Community['kind']>('Interest');
  const [privacy, setPrivacy] = useState<Community['privacy']>('Public');
  const [rooms, setRooms] = useState<string[]>(['general', 'announcements']);
  const [voice, setVoice] = useState(true);
  const ready = name.trim().length >= 3 && about.trim().length >= 10;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="New space" subtitle="A home for a club, class or shared interest" back backHref="/spaces" />

      <div className="mt-2 grid gap-6 md:grid-cols-[minmax(0,1fr)_300px] md:items-start">
        <div className="space-y-5">
          <Field label="Name" htmlFor="space-name">
            <Input id="space-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Night Owls Study Circle" maxLength={40} />
          </Field>
          <Field label="What is it about?" htmlFor="space-about" hint="At least 10 characters. Shown on the explore card.">
            <Textarea id="space-about" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Who should join and what you’ll do together" />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Kind</p>
            <ChipRow>
              {KINDS.map((item) => (
                <Chip key={item} active={kind === item} onClick={() => setKind(item)}>
                  {item}
                </Chip>
              ))}
            </ChipRow>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Who can join</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: 'Public', icon: Globe, text: 'Anyone on campus can join and read.' },
                  { value: 'Private', icon: Lock, text: 'People request to join. Moderators approve.' },
                ] as const
              ).map((option) => {
                const active = privacy === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPrivacy(option.value)}
                    className={cn(
                      'press flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                      active ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2',
                    )}
                  >
                    <option.icon className={cn('mt-0.5 h-5 w-5 shrink-0', active ? 'text-accent-soft-ink' : 'text-text-3')} aria-hidden="true" />
                    <span>
                      <span className="block font-semibold">{option.value}</span>
                      <span className="block text-sm text-text-3">{option.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Starting rooms</p>
            <div className="flex flex-wrap gap-2">
              {ROOM_PRESETS.map((room) => {
                const on = rooms.includes(room);
                return (
                  <Chip key={room} active={on} onClick={() => setRooms((list) => (on ? list.filter((r) => r !== room) : [...list, room]))}>
                    {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}#{room}
                  </Chip>
                );
              })}
              <Chip active={voice} onClick={() => setVoice((v) => !v)}>
                {voice && <Check className="h-3.5 w-3.5" aria-hidden="true" />}Voice lounge
              </Chip>
            </div>
          </div>
        </div>

        {/* Live preview of the explore card */}
        <aside className="md:sticky md:top-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-3">Preview</p>
          <Card className="overflow-hidden">
            <div className="relative h-20 overflow-hidden transition-[background] duration-700" style={{ background: gradientFor(name || 'new-space') }}>
            </div>
            <div className="-mt-7 px-4">
              <span
                className="grid h-14 w-14 place-items-center rounded-2xl border-4 border-[var(--surface-solid)] font-display text-lg font-semibold text-white"
                style={{ background: gradientFor(`${name || 'new-space'}-icon`) }}
              >
                {initials(name || 'New Space')}
              </span>
            </div>
            <div className="space-y-1.5 p-4 pt-2">
              <p className="truncate font-display text-lg font-semibold">{name || 'Your space'}</p>
              <p className="flex items-center gap-1.5 text-xs text-text-3">
                {privacy === 'Private' ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Globe className="h-3 w-3" aria-hidden="true" />}
                {kind} · 1 member
              </p>
              <p className="line-clamp-2 text-sm text-text-2">{about || 'A short line about what happens here.'}</p>
              <p className="pt-1 text-xs text-text-3">
                {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
                {voice ? ' · voice lounge' : ''}
              </p>
            </div>
          </Card>
          <Button
            full
            size="lg"
            className="mt-4"
            disabled={!ready}
            onClick={() => {
              toast('Space submitted for review. You’ll be its first moderator.');
              router.push('/spaces');
            }}
          >
            Create space
          </Button>
          <p className="mt-2 text-center text-xs text-text-3">New spaces are reviewed by the college within a day.</p>
        </aside>
      </div>
    </div>
  );
}
