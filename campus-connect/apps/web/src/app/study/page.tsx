'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Circle, MessageSquare, Plus, Users, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { chats } from '@/data/chats';
import { studyCircles, studyingNow, type MeetProvider, type StudyCircle } from '@/data/circles';
import { studyPartners } from '@/data/learning';
import { getPerson } from '@/data/people';
import { lectureSubjects } from '@/data/lectures-library';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type Tab = 'now' | 'circles' | 'partners';
const TABS: { value: Tab; label: string }[] = [
  { value: 'now', label: 'Studying now' },
  { value: 'circles', label: 'Circles' },
  { value: 'partners', label: 'Partners' },
];
const PROVIDERS: MeetProvider[] = ['Google Meet', 'Jitsi', 'In app voice', 'In person'];

const directChat = (personId: string) => chats.find((chat) => chat.kind === 'direct' && chat.memberIds.includes(personId));

export default function StudyPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('now');
  const [subject, setSubject] = useState('All');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', subject: lectureSubjects[0] ?? '', schedule: '', provider: 'Google Meet' as MeetProvider, place: '' });

  const circles = subject === 'All' ? studyCircles : studyCircles.filter((c) => c.subject === subject);
  const partners = subject === 'All' ? studyPartners : studyPartners.filter((p) => p.subject === subject);

  const message = (personId: string) => {
    const chat = directChat(personId);
    if (chat) router.push(`/chats/${chat.id}`);
    else toast(`Request sent to ${getPerson(personId).name.split(' ')[0]}`);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Study together"
        subtitle="Find people studying now, join a circle or find a partner"
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Circle
          </Button>
        }
      />

      <div className="mt-4">
        <UnderlineTabs<Tab> label="Study together sections" value={tab} onChange={setTab} options={TABS} />
      </div>

      <ChipRow className="mt-5">
        {['All', ...lectureSubjects.slice(0, 6)].map((item) => (
          <Chip key={item} active={subject === item} onClick={() => setSubject(item)}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      {tab === 'now' && (
        <section className="mt-6" aria-label="Studying now">
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {studyingNow.map((entry) => {
              const person = getPerson(entry.personId);
              return (
                <li key={entry.id} className="flex items-center gap-3.5 px-4 py-3.5">
                  <Avatar name={person.name} seed={person.id} size="md" presence={entry.focus === 'Focused'} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[15px] font-semibold">
                      {person.name.split(' ')[0]}
                      <span className={cn('rounded-full px-2 py-0.5 text-[12px] font-semibold', entry.focus === 'Focused' ? 'bg-highlight text-highlight-ink' : 'bg-surface-2 text-text-2')}>
                        {entry.focus}
                      </span>
                    </p>
                    <p className="truncate text-[14px] text-text-2">{entry.topic}</p>
                    <p className="text-[13px] text-text-3">Since {relativeTime(entry.since)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => message(entry.personId)} aria-label={`Message ${person.name}`} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-text-2 hover:text-text">
                      <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                    <Button size="sm" variant={entry.open ? 'primary' : 'secondary'} disabled={!entry.open} onClick={() => toast(`Joined ${person.name.split(' ')[0]}'s session (preview)`)}>
                      Join
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[13px] text-text-3">Join opens when someone is focusing and welcomes company. Tap the message icon to talk first.</p>
        </section>
      )}

      {tab === 'circles' && (
        <section className="mt-6 grid gap-3 md:grid-cols-2" aria-label="Study circles">
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} onChat={() => toast(`${circle.name} chat opened (preview)`)} onJoin={() => toast(`Joined ${circle.name} (preview)`)} />
          ))}
          {circles.length === 0 && <p className="col-span-full py-10 text-center text-[15px] text-text-3">No circles for this subject yet. Start one with the Circle button.</p>}
        </section>
      )}

      {tab === 'partners' && (
        <section className="mt-6" aria-label="Study partners">
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {partners.map((partner) => {
              const person = getPerson(partner.personId);
              return (
                <li key={partner.personId} className="flex items-center gap-3.5 px-4 py-3.5">
                  <Avatar name={person.name} seed={person.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{person.name}</p>
                    <p className="truncate text-[14px] text-text-2">
                      {partner.subject} · {partner.level}
                    </p>
                    <p className="truncate text-[13px] text-text-3">{partner.availability}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => message(partner.personId)}>
                    Message
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-center text-[14px] text-text-3">
            Want to teach or be taught? <Link href="/help" className="font-semibold text-accent">Ask a peer</Link>
          </p>
        </section>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Start a circle"
        description="Pick where you'll study. Video links open in your browser."
        footer={
          <Button
            full
            disabled={draft.name.trim().length < 3}
            onClick={() => {
              setCreating(false);
              toast('Circle created. Invite your people from the circle page.');
              setDraft({ name: '', subject: lectureSubjects[0] ?? '', schedule: '', provider: 'Google Meet', place: '' });
            }}
          >
            Create circle
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="circle-name">
            <Input id="circle-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Compiler design revision" />
          </Field>
          <Field label="Subject" htmlFor="circle-subject">
            <Select id="circle-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
              {lectureSubjects.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="When" htmlFor="circle-when">
            <Input id="circle-when" value={draft.schedule} onChange={(e) => setDraft({ ...draft, schedule: e.target.value })} placeholder="Tomorrow · 8:00 pm" />
          </Field>
          <Field label="How you'll meet" htmlFor="circle-provider">
            <Select id="circle-provider" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value as MeetProvider })}>
              {PROVIDERS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </Field>
          {draft.provider === 'In person' && (
            <Field label="Where" htmlFor="circle-place">
              <Input id="circle-place" value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="Library, reading room B" />
            </Field>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function CircleCard({ circle, onChat, onJoin }: { circle: StudyCircle; onChat: () => void; onJoin: () => void }) {
  const host = getPerson(circle.hostId);
  const remote = circle.provider === 'Google Meet' || circle.provider === 'Jitsi';
  const spots = circle.capacity - circle.members;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-3">{circle.subject}</p>
          <h2 className="mt-0.5 text-[18px] font-semibold leading-snug">{circle.name}</h2>
        </div>
        {circle.live && <span className="shrink-0 rounded-full bg-highlight px-2.5 py-0.5 text-[12px] font-semibold text-highlight-ink">Live</span>}
      </div>
      <p className="text-[14px] text-text-2">{circle.description}</p>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-3">
        <div className="flex items-center gap-1.5">
          <Circle className="h-3.5 w-3.5" aria-hidden="true" />
          {circle.schedule}
        </div>
        <div className="flex items-center gap-1.5">
          {remote ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <Users className="h-3.5 w-3.5" aria-hidden="true" />}
          {circle.provider}
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {circle.members} of {circle.capacity} · {spots} {spots === 1 ? 'spot' : 'spots'} left
        </div>
      </dl>
      <p className="text-[13px] text-text-3">Hosted by {host.name}</p>
      <div className="mt-auto flex gap-2 pt-1">
        {remote ? (
          <a href={circle.where} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-accent-ink">
            <Video className="h-4 w-4" aria-hidden="true" />
            Join on {circle.provider}
          </a>
        ) : (
          <Button full onClick={onJoin} variant="primary">
            {circle.provider === 'In app voice' ? 'Join voice room' : 'Join'}
          </Button>
        )}
        <Button variant="secondary" onClick={onChat} aria-label={`Open chat for ${circle.name}`}>
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          Chat
        </Button>
      </div>
      {circle.provider === 'In person' && <p className="text-[13px] text-text-3">Where: {circle.where}</p>}
    </article>
  );
}
