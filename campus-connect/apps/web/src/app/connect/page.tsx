'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Switch } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { chats } from '@/data/chats';
import { me, students } from '@/data/people';

// Crossed paths: people you already share something with. You choose whether you appear here.
type Reason = 'Same branch' | 'Same year' | 'Shared interest' | 'Same class';
const REASONS: Reason[] = ['Same branch', 'Same year', 'Shared interest'];

function reasonsFor(person: (typeof students)[number]): Reason[] {
  const reasons: Reason[] = [];
  if (person.branch && person.branch === me.branch) reasons.push('Same branch');
  if (person.year && person.year === me.year) reasons.push('Same year');
  if (person.interests.some((i) => me.interests.includes(i))) reasons.push('Shared interest');
  return reasons;
}

export default function CrossedPathsPage() {
  const toast = useToast();
  const [visible, setVisible] = useState(true);
  const [filter, setFilter] = useState<'All' | Reason>('All');
  const [said, setSaid] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);

  const people = useMemo(
    () =>
      students
        .filter((p) => p.id !== me.id && !passed.includes(p.id))
        .map((p) => ({ person: p, reasons: reasonsFor(p) }))
        .filter((row) => row.reasons.length > 0)
        .filter((row) => filter === 'All' || row.reasons.includes(filter))
        .slice(0, 12),
    [filter, passed],
  );

  const sayHi = (personId: string, name: string) => {
    const chat = chats.find((c) => c.kind === 'direct' && c.memberIds.includes(personId));
    setSaid((list) => [...list, personId]);
    toast(chat ? `Hi sent to ${name.split(' ')[0]}. Open chats to reply.` : `Hi sent to ${name.split(' ')[0]} (preview)`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Crossed paths" subtitle="People you already share a class, branch or interest with" back backHref="/discover" />

      <section className="mt-5 rounded-2xl border border-border bg-surface">
        <Switch
          checked={visible}
          onChange={setVisible}
          label="Show me in Crossed paths"
          description={visible ? 'Classmates can find you here' : 'You are hidden. You can still see others.'}
        />
      </section>

      {visible && (
        <>
          <ChipRow className="mt-5">
            {(['All', ...REASONS] as const).map((item) => (
              <Chip key={item} active={filter === item} onClick={() => setFilter(item)}>
                {item}
              </Chip>
            ))}
          </ChipRow>

          <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {people.map(({ person, reasons }) => {
              const greeted = said.includes(person.id);
              return (
                <li key={person.id} className="flex items-start gap-3.5 px-4 py-4">
                  <Link href={`/profile/${person.username}`} aria-label={`View ${person.name}`}>
                    <Avatar name={person.name} seed={person.id} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{person.name}</p>
                    <p className="truncate text-[14px] text-text-2">
                      {person.branch} · Year {person.year}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {reasons.map((reason) => (
                        <span key={reason} className="rounded-full bg-highlight px-2.5 py-0.5 text-[12px] font-semibold text-highlight-ink">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Button size="sm" variant={greeted ? 'secondary' : 'primary'} disabled={greeted} onClick={() => sayHi(person.id, person.name)}>
                      {greeted ? 'Said hi' : 'Say hi'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setPassed((list) => [...list, person.id])}
                      className="text-[13px] font-semibold text-text-3 hover:text-text-2"
                    >
                      Not now
                    </button>
                  </div>
                </li>
              );
            })}
            {people.length === 0 && <li className="px-6 py-12 text-center text-[15px] text-text-3">No one matches this yet. Check back after your next class.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
