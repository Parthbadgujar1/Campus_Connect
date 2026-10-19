'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Hash, Headphones, Lock, Megaphone, MessageCircle, Mic, MicOff, PhoneOff, Pin, Plus, Shield, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { EventCard } from '@/components/events/event-card';
import { Vote } from '@/components/spaces/vote';
import { events } from '@/data/events';
import { allPeople, getPerson, me, students } from '@/data/people';
import { getSpace, threads as allThreads, type Space, type Thread, type VoiceRoom } from '@/data/spaces';
import { appActions, useAppState } from '@/lib/store';
import { NOW, relativeTime } from '@/lib/time';
import { gradientFor, initials } from '@/lib/visuals';
import { cn } from '@/lib/utils';

type Tab = 'board' | 'rooms' | 'events' | 'members' | 'about';
const TABS: { value: Tab; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'events', label: 'Events' },
  { value: 'members', label: 'Members' },
  { value: 'about', label: 'About' },
];
type Sort = 'Hot' | 'New' | 'Top';

export default function SpacePage() {
  return (
    <Suspense fallback={null}>
      <SpaceContent />
    </Suspense>
  );
}

function SpaceContent() {
  const { slug } = useParams<{ slug: string }>();
  const space = getSpace(slug);
  if (!space) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Space" back backHref="/spaces" />
        <EmptyState icon={Users} title="This space doesn’t exist" className="mt-6" />
      </div>
    );
  }
  return <SpaceView key={space.slug} space={space} />;
}

function SpaceView({ space }: { space: Space }) {
  const params = useSearchParams();
  const toast = useToast();
  const requested = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === requested) ? (requested as Tab) : 'board');
  const [sort, setSort] = useState<Sort>('Hot');
  const [posted, setPosted] = useState<Thread[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [voice, setVoice] = useState<VoiceRoom | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [flair, setFlair] = useState('Discussion');
  const joined = useAppState((s) => s.joined.includes(space.id));
  const votes = useAppState((s) => s.votes);

  const board = [...posted, ...allThreads.filter((t) => t.spaceSlug === space.slug)].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'New') return b.createdAt.localeCompare(a.createdAt);
    const sa = a.score + (votes[a.id] ?? 0);
    const sb = b.score + (votes[b.id] ?? 0);
    if (sort === 'Top') return sb - sa;
    // Hot: score decays with age.
    const age = (t: Thread) => Math.max(1, (NOW.getTime() - new Date(t.createdAt).getTime()) / 3_600_000);
    return sb / Math.pow(age(b) + 2, 1.2) - sa / Math.pow(age(a) + 2, 1.2);
  });

  const spaceEvents = events.filter((e) => e.organizerSlug === space.slug);
  const mods = space.moderators.map((name) => allPeople.find((p) => p.name === name)).filter(Boolean);
  const members = students.slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-4xl pb-36 md:px-8 md:pb-16">
      <div className="px-4 md:px-0">
        <PageHeader title={space.name} back backHref="/spaces" />
      </div>

      {/* Banner */}
      <section className="relative overflow-hidden md:mt-3 md:rounded-3xl" aria-label={`${space.name} banner`}>
        <div className="relative h-36 md:h-44" style={{ background: gradientFor(space.seed) }} aria-hidden="true">
        </div>
        <div className="relative -mt-10 flex items-end justify-between gap-3 px-4 md:px-6">
          <span
            className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-[var(--bg)] font-display text-2xl font-semibold text-white shadow-card"
            style={{ background: gradientFor(`${space.seed}-icon`) }}
          >
            {initials(space.name)}
          </span>
          <Button variant={joined ? 'secondary' : 'primary'} aria-pressed={joined} onClick={() => appActions.toggleJoined(space.id)}>
            {joined ? 'Joined' : space.privacy === 'Private' ? 'Request to join' : 'Join space'}
          </Button>
        </div>
        <div className="px-4 pt-3 md:px-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-3">
            <span className="flex items-center gap-1.5">
              {space.privacy === 'Private' ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <Users className="h-3.5 w-3.5" aria-hidden="true" />}
              {space.kind} · {space.members.toLocaleString('en-IN')} members
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-success">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              {space.online} online
            </span>
          </p>
          <p className="mt-2 max-w-2xl text-[15px] text-text-2 text-pretty">{space.description}</p>
        </div>
      </section>

      <div className="mt-6 px-4 md:px-0">
        <UnderlineTabs<Tab> label="Space sections" value={tab} onChange={setTab} options={TABS} />
      </div>

      <div className="mt-5 px-4 md:px-0">
        {tab === 'board' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <ChipRow className="md:flex-nowrap">
                {(['Hot', 'New', 'Top'] as Sort[]).map((item) => (
                  <Chip key={item} active={sort === item} onClick={() => setSort(item)}>
                    {item}
                  </Chip>
                ))}
              </ChipRow>
              <Button size="sm" onClick={() => setComposeOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Thread
              </Button>
            </div>
            {board.length === 0 && <EmptyState icon={MessageCircle} title="No threads yet" description="Start the first conversation in this space." />}
            <div key={sort} className="stagger space-y-3">
              {board.map((thread) => {
                const author = getPerson(thread.authorId);
                return (
                  <article key={thread.id} className="flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
                    <Vote id={thread.id} base={thread.score} />
                    <Link href={`/spaces/${space.slug}/t/${thread.id}`} className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {thread.pinned && <Pin className="h-3.5 w-3.5 text-accent" aria-label="Pinned" />}
                        <Badge tone={thread.flair === 'Official' ? 'accent' : 'neutral'}>{thread.flair}</Badge>
                        <span className="text-xs text-text-3">
                          {thread.authorId === 'me' ? 'You' : author.name.split(' ')[0]} · {relativeTime(thread.createdAt)}
                        </span>
                      </span>
                      <span className="mt-1.5 block text-[16px] font-semibold leading-snug">{thread.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-text-2">{thread.body}</span>
                      <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-text-3">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {thread.comments} replies
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'rooms' && (
          <section className="space-y-7">
            <div>
              <SectionHeader title="Text rooms" description="Ongoing conversations by topic" />
              <Card className="divide-y divide-border overflow-hidden">
                {space.channels.map((channel) => {
                  const Icon = channel.kind === 'announcements' ? Megaphone : Hash;
                  return (
                    <Link key={channel.id} href={`/spaces/${space.slug}/c/${channel.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-surface-2 text-text-2">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[15px]', channel.unread ? 'font-bold' : 'font-semibold')}>{channel.name}</span>
                        <span className="block truncate text-xs text-text-3">{channel.topic}</span>
                      </span>
                      {channel.unread > 0 && (
                        <span className="rounded-full bg-accent px-2 text-[11px] font-bold leading-5 text-accent-ink">{channel.unread}</span>
                      )}
                    </Link>
                  );
                })}
              </Card>
            </div>
            <div>
              <SectionHeader title="Voice lounges" description="Drop in, talk, leave whenever you like" />
              <div className="grid gap-3 md:grid-cols-2">
                {space.voice.map((room) => (
                  <Card key={room.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 font-semibold">
                        <Headphones className="h-4 w-4 text-text-3" aria-hidden="true" />
                        {room.name}
                      </p>
                      <span className="text-xs text-text-3">{room.memberIds.length ? `${room.memberIds.length} inside` : 'Empty'}</span>
                    </div>
                    <div className="mt-3 flex -space-x-2">
                      {room.memberIds.map((id) => (
                        <Avatar key={id} name={getPerson(id).name} seed={id} size="sm" ring />
                      ))}
                      {room.memberIds.length === 0 && <p className="text-sm text-text-3">Be the first one here.</p>}
                    </div>
                    <Button size="sm" variant="soft" className="mt-4 w-full" onClick={() => setVoice(room)}>
                      <Mic className="h-4 w-4" aria-hidden="true" />
                      Join lounge
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === 'events' &&
          (spaceEvents.length ? (
            <div className="stagger space-y-3">
              {spaceEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No events planned" description="Events from this space show up here once approved." />
          ))}

        {tab === 'members' && (
          <section className="space-y-6">
            <div>
              <SectionHeader title="Moderators" />
              <Card className="divide-y divide-border overflow-hidden">
                {space.moderators.map((name) => {
                  const person = mods.find((p) => p?.name === name);
                  return (
                    <div key={name} className="flex items-center gap-3 px-4 py-3">
                      {person ? <Avatar name={person.name} seed={person.id} size="sm" /> : <Shield className="h-9 w-9 rounded-full bg-surface-2 p-2 text-text-2" aria-hidden="true" />}
                      <span className="flex-1 text-sm font-semibold">{name}</span>
                      <Badge tone="accent">Moderator</Badge>
                    </div>
                  );
                })}
              </Card>
            </div>
            <div>
              <SectionHeader title="Members" description={`${space.members.toLocaleString('en-IN')} in total`} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {members.map((person, i) => (
                  <Link key={person.id} href={`/profile/${person.username}`} className="press flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2.5 shadow-card">
                    <Avatar name={person.name} seed={person.id} size="sm" presence={i % 3 === 0} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{person.name.split(' ')[0]}</span>
                      <span className="block truncate text-[11px] text-text-3">{i % 3 === 0 ? 'Online' : `Year ${person.year}`}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === 'about' && (
          <Card className="space-y-4 p-5">
            <p className="text-[15px] leading-relaxed text-text-2">{space.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {space.tags.map((tag) => (
                <Badge key={tag}>#{tag}</Badge>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold">Space guidelines</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-2">
                <li>Be kind. Critique ideas, not people.</li>
                <li>Keep threads on topic; use rooms for quick chat.</li>
                <li>No spam, no selling outside the Market.</li>
                <li>Report anything that feels unsafe. Moderators reply within a day.</li>
              </ol>
            </div>
          </Card>
        )}
      </div>

      <Sheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="New thread"
        description={`Posting to ${space.name}`}
        footer={
          <Button
            full
            disabled={title.trim().length < 5}
            onClick={() => {
              setPosted((list) => [
                { id: `t-new-${list.length}`, spaceSlug: space.slug, title: title.trim(), body: body.trim(), authorId: 'me', flair, score: 1, comments: 0, createdAt: NOW.toISOString() },
                ...list,
              ]);
              setTitle('');
              setBody('');
              setComposeOpen(false);
              setSort('New');
              toast('Thread posted');
            }}
          >
            Post thread
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="th-title">
            <Input id="th-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ask, share or start a discussion" />
          </Field>
          <Field label="Flair" htmlFor="th-flair">
            <Select id="th-flair" value={flair} onChange={(e) => setFlair(e.target.value)}>
              <option>Discussion</option>
              <option>Question</option>
              <option>Resource</option>
              <option>Event</option>
              <option>Win</option>
            </Select>
          </Field>
          <Field label="Details" htmlFor="th-body">
            <Textarea id="th-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add context so people can help" />
          </Field>
        </div>
      </Sheet>

      {voice && <VoiceRoomSheet room={voice} spaceName={space.name} onClose={() => setVoice(null)} />}
    </div>
  );
}

/** A calm voice lounge: everyone as an orb, the speaker gently glowing. */
function VoiceRoomSheet({ room, spaceName, onClose }: { room: VoiceRoom; spaceName: string; onClose: () => void }) {
  const [muted, setMuted] = useState(true);
  const people = [...room.memberIds, 'me'];
  const speaking = room.memberIds[0];
  return (
    <Sheet open onClose={onClose} title={room.name} description={`Voice lounge · ${spaceName}`}>
      <div className="grid grid-cols-3 gap-4 py-4">
        {people.map((id) => {
          const isMe = id === 'me';
          const person = isMe ? me : getPerson(id);
          const talking = id === speaking || (isMe && !muted);
          return (
            <div key={id} className="flex flex-col items-center gap-2">
              <span className="relative grid place-items-center">
                {talking && <span className="animate-breathe absolute -inset-2 rounded-full bg-success/30" aria-hidden="true" />}
                <Avatar name={person.name} seed={person.id} size="lg" />
                {isMe && muted && (
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-danger text-white">
                    <MicOff className="h-3 w-3" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold">{isMe ? 'You' : person.name.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-3 pt-2">
        <Button variant={muted ? 'secondary' : 'soft'} onClick={() => setMuted((m) => !m)} aria-pressed={!muted}>
          {muted ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
          {muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button variant="danger" onClick={onClose}>
          <PhoneOff className="h-4 w-4" aria-hidden="true" />
          Leave
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-text-3">Audio connects when the realtime service is live. This is a preview of the room.</p>
    </Sheet>
  );
}
