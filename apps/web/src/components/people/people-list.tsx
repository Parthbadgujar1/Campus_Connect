'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle, UserCheck, UserPlus, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { del, get, post, type Query } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, type Page } from '@/lib/api/hooks';
import type { PersonSummary } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { InfiniteList } from '@/components/ui/infinite';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { FormAlert, Spinner } from '@/components/ui/states';
import { ROLE_LABEL } from '@/lib/roles';

export type PersonRowData = PersonSummary & { headline: string | null; isFollowing: boolean };

function meta(p: PersonRowData): string {
  if (p.role !== 'student') return [ROLE_LABEL[p.role], p.headline].filter(Boolean).join(' · ');
  return [p.department, p.year ? `Year ${p.year}` : null, p.headline].filter(Boolean).join(' · ');
}

export function LivePersonRow({ person, onChange }: { person: PersonRowData; onChange: (p: PersonRowData) => void }) {
  const router = useRouter();
  const follow = useAction(async () => {
    const next = !person.isFollowing;
    onChange({ ...person, isFollowing: next });
    try {
      await (next ? post(`/users/${person.id}/follow`) : del(`/users/${person.id}/follow`));
      invalidate('feed:following');
    } catch (err) {
      onChange({ ...person, isFollowing: !next });
      throw err;
    }
  });
  const message = useAction(async () => {
    const r = await post<{ chatId: string }>('/chats/direct', { userId: person.id });
    router.push(`/chats/${r.chatId}`);
  });
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <PersonAvatar person={person} link />
        <div className="min-w-0 flex-1">
          <PersonName person={person} className="text-[15px]" />
          <p className="truncate text-[13px] text-text-3">{meta(person)}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void message.run()} disabled={message.pending} aria-label={`Message ${person.displayName}`}>
          {message.pending ? <Spinner /> : <MessageCircle className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <Button size="sm" variant={person.isFollowing ? 'secondary' : 'primary'} onClick={() => void follow.run()} aria-pressed={person.isFollowing}>
          {person.isFollowing ? <UserCheck className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          {person.isFollowing ? 'Following' : 'Follow'}
        </Button>
      </div>
      {(follow.error || message.error) && <FormAlert className="mt-2">{(follow.error ?? message.error)!.message}</FormAlert>}
    </div>
  );
}

/** The college directory with any filters (department, year, role, search). */
export function PeopleList({ query, cacheKey, empty }: { query: Query; cacheKey: string; empty?: { icon: LucideIcon; title: string; description?: string } }) {
  const list = useInfinite<PersonRowData>(`people:${cacheKey}`, (cursor, signal) => get<Page<PersonRowData>>('/users', { ...query, cursor: cursor ?? undefined, limit: 20 }, signal));
  return (
    <InfiniteList
      state={list}
      skeleton="row"
      className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface"
      empty={empty ?? { icon: UsersRound, title: 'Nobody here yet', description: 'As more people join, they show up here.' }}
      endMessage="That’s everyone"
      render={(p) => <LivePersonRow person={p} onChange={(next) => list.setItems((items) => items.map((x) => (x.id === next.id ? next : x)))} />}
    />
  );
}

