'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Archive, Camera, CheckCheck, Ghost, MoreHorizontal, PenSquare, Pin, Search, Trash2, Users, VolumeX } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button, IconButton } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { describeMessage } from '@/components/chat/conversation';
import { AmbienceButton } from '@/components/shell/ambience';
import { chats, closeCircle, getMessages } from '@/data/chats';
import { communities } from '@/data/communities';
import { getPerson, me, students } from '@/data/people';
import type { Chat, Message } from '@/lib/types';
import { appActions, useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

// Chats, borrowing the best of each: a notes row on top (Instagram), a camera for quick snaps (Snapchat),
// communities with their groups (WhatsApp), reactions and read receipts, and archive, mute and pin.

type Tab = 'all' | 'unread' | 'groups' | 'communities';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'groups', label: 'Groups' },
  { value: 'communities', label: 'Communities' },
];

/** Short notes shown above people's names. Anyone can write one; it disappears after a day. */
const NOTES: Record<string, string> = {
  'p-pooja': 'Hackathon sign-up Thursday',
  'p-tanvi': 'Library till nine',
  'p-rohan': 'Mock interview at 7',
  'p-aditi': 'Designing all day',
};

const GROUP_KINDS = ['group', 'class', 'department', 'event', 'temporary', 'community'];

export function ChatAvatar({ chat, size = 'md' }: { chat: Chat; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-10 w-10', md: 'h-12 w-12', lg: 'h-16 w-16' }[size];
  if (chat.kind === 'anonymous') {
    return (
      <span className={cn('grid shrink-0 place-items-center rounded-full bg-surface-2 text-text-2', dims)} aria-hidden="true">
        <Ghost className="h-5 w-5" />
      </span>
    );
  }
  if (chat.kind === 'direct') {
    const other = chat.memberIds.find((id) => id !== 'me') ?? chat.seed;
    const person = getPerson(other);
    return <Avatar name={person.name} seed={person.id} size={size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'} className={dims} presence={chat.online} />;
  }
  // Groups: one circle with the group's initials, like a contact.
  return <Avatar name={chat.title} seed={chat.seed} size={size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'} className={dims} />;
}

function preview(chat: Chat, message?: Message, openedSnaps: string[] = []): string {
  if (!message) return chat.subtitle ?? '';
  if (message.type === 'snap') return openedSnaps.includes(message.id) ? 'Snap opened' : 'New snap';
  const who =
    message.from === 'me'
      ? 'You: '
      : chat.kind === 'direct' || message.from === 'system'
        ? ''
        : message.from.startsWith('anon-')
          ? `Anonymous ${message.from.slice(-1)}: `
          : `${getPerson(message.from).name.split(' ')[0]}: `;
  return `${who}${describeMessage(message)}`;
}

export function ChatList() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const activeId = pathname.startsWith('/chats/') ? pathname.split('/')[2] : undefined;
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [composing, setComposing] = useState(false);
  const [noting, setNoting] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [myNote, setMyNote] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [actionFor, setActionFor] = useState<Chat | null>(null);
  const openedSnaps = useAppState((s) => s.openedSnaps);
  const mutedIds = useAppState((s) => s.muted);
  const joined = useAppState((s) => s.joined);

  const isMuted = (chat: Chat) => Boolean(chat.muted) || mutedIds.includes(chat.id);
  const isPinned = (chat: Chat) => Boolean(chat.pinned) || pinned.includes(chat.id);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pin = (chat: Chat) => Boolean(chat.pinned) || pinned.includes(chat.id);
    const base = chats.filter((chat) => (showArchived ? archived.includes(chat.id) : !archived.includes(chat.id)));
    return base
      .filter((chat) => !q || chat.title.toLowerCase().includes(q))
      .filter((chat) => {
        if (tab === 'unread') return chat.unread > 0;
        if (tab === 'groups') return GROUP_KINDS.includes(chat.kind) && chat.kind !== 'community';
        if (tab === 'communities') return chat.kind === 'community';
        return true;
      })
      .sort((a, b) => Number(pin(b)) - Number(pin(a)) || b.lastAt.localeCompare(a.lastAt));
  }, [tab, query, showArchived, archived, pinned]);

  const joinedCommunities = communities.filter((c) => joined.includes(c.id));
  const archivedCount = archived.length;
  const recentNotes = closeCircle.filter((f) => NOTES[f.personId]).slice(0, 6);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="pt-safe px-4 md:px-5 md:pt-8">
        <div className="flex items-center justify-between gap-2 py-3 md:py-0">
          <h1 className="text-[30px] font-bold tracking-tight">Chats</h1>
          <div className="flex items-center gap-1.5">
            <span className="md:hidden">
              <AmbienceButton />
            </span>
            <IconButton label="Quick snap" onClick={() => toast('Camera opens for a snap (preview)')} className="bg-surface shadow-card">
              <Camera className="h-[19px] w-[19px]" />
            </IconButton>
            <IconButton label="Start a conversation" onClick={() => setComposing(true)} className="bg-surface shadow-card">
              <PenSquare className="h-[19px] w-[19px]" />
            </IconButton>
          </div>
        </div>

        {/* Notes row */}
        <div className="no-scrollbar -mx-4 mt-2 flex gap-3.5 overflow-x-auto px-4 md:-mx-5 md:px-5" aria-label="Notes">
          <button type="button" onClick={() => setNoting(true)} className="flex w-[78px] shrink-0 flex-col items-center text-center">
            <span className="relative mb-1 flex min-h-8 w-full items-end justify-center">
              <span className="max-w-full truncate rounded-2xl bg-surface px-2.5 py-1 text-[12px] text-text-2 shadow-card">{myNote || 'Add a note'}</span>
            </span>
            <span className="relative">
              <Avatar name={me.name} seed={me.id} size="md" />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[14px] font-bold leading-none text-accent-ink">+</span>
            </span>
            <span className="mt-1 text-[12px] font-semibold">You</span>
          </button>
          {recentNotes.map((friend) => {
            const person = getPerson(friend.personId);
            return (
              <Link key={friend.personId} href={friend.chatId ? `/chats/${friend.chatId}` : '/chats'} className="flex w-[78px] shrink-0 flex-col items-center text-center">
                <span className="relative mb-1 flex min-h-8 w-full items-end justify-center">
                  <span className="max-w-full truncate rounded-2xl bg-surface px-2.5 py-1 text-[12px] text-text-2 shadow-card">{NOTES[friend.personId]}</span>
                </span>
                <Avatar name={person.name} seed={person.id} size="md" presence={friend.streak > 0} />
                <span className="mt-1 text-[12px] font-semibold">{person.name.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-[15px] placeholder:text-text-3 focus:border-accent focus:outline-none"
          />
        </div>

        {!showArchived && (
          <div className="mt-3">
            <UnderlineTabs<Tab> label="Chat filters" value={tab} onChange={setTab} options={TABS} />
          </div>
        )}
      </div>

      <nav aria-label="Conversations" className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-36 pt-3 md:px-3 md:pb-6">
        {showArchived && (
          <button type="button" onClick={() => setShowArchived(false)} className="mb-2 px-3 text-[14px] font-semibold text-accent">
            ← Back to chats
          </button>
        )}

        {/* Communities: groups of groups, with their announcements */}
        {!showArchived && (tab === 'all' || tab === 'communities') && joinedCommunities.length > 0 && (
          <section aria-labelledby="communities" className="mb-4 px-2">
            <h2 id="communities" className="mb-2 text-[14px] font-semibold text-text-3">
              Communities
            </h2>
            <div className="no-scrollbar -mx-2 flex gap-3 overflow-x-auto px-2 pb-1">
              {joinedCommunities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  onClick={() => toast(`${community.name}: announcements and groups (preview)`)}
                  className="flex w-56 shrink-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-accent/40"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{community.name}</span>
                    <span className="block truncate text-[12px] text-text-3">
                      Announcements · {community.members.toLocaleString('en-IN')} members
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {list.length === 0 && (
          <p className="px-6 py-10 text-center text-[15px] text-text-3">
            {showArchived ? 'Nothing archived.' : query ? `No conversations match “${query}”.` : 'No conversations here yet.'}
          </p>
        )}

        <ul>
          {list.map((chat) => {
            const active = chat.id === activeId;
            const muted = isMuted(chat);
            const last = getMessages(chat.id).at(-1);
            const mine = last?.from === 'me';
            const unread = chat.unread > 0;
            return (
              <li key={chat.id} className="group relative">
                <Link
                  href={`/chats/${chat.id}`}
                  aria-current={active ? 'true' : undefined}
                  className={cn('flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors', active ? 'bg-accent-soft' : 'hover:bg-surface')}
                >
                  <ChatAvatar chat={chat} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('truncate text-[16px]', unread ? 'font-semibold' : 'font-medium')}>{chat.title}</span>
                      {isPinned(chat) && <Pin className="h-3.5 w-3.5 shrink-0 text-text-3" aria-label="Pinned" />}
                      {muted && <VolumeX className="h-3.5 w-3.5 shrink-0 text-text-3" aria-label="Muted" />}
                    </span>
                    <span className={cn('mt-0.5 flex items-center gap-1 truncate text-[14px]', unread ? 'text-text' : 'text-text-3')}>
                      {mine && <CheckCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Read" />}
                      <span className="truncate">{preview(chat, last, openedSnaps)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-0.5">
                    <span className={cn('text-[12px]', unread && !muted ? 'font-semibold text-accent' : 'text-text-3')}>{relativeTime(chat.lastAt)}</span>
                    {unread ? (
                      <span className={cn('min-w-5 rounded-full px-1.5 text-center text-[12px] font-semibold leading-5', muted ? 'bg-surface-3 text-text-2' : 'bg-accent text-accent-ink')}>{chat.unread}</span>
                    ) : (
                      <span className="h-5" />
                    )}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setActionFor(chat)}
                  aria-label={`More options for ${chat.title}`}
                  className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface text-text-3 shadow-card group-hover:grid"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>

        {!showArchived && archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived(true)} className="mx-auto mt-6 flex items-center gap-2 px-4 py-2 text-[14px] font-semibold text-text-2 hover:text-text">
            <Archive className="h-4 w-4" aria-hidden="true" />
            Archived · {archivedCount}
          </button>
        )}
      </nav>

      <Sheet open={actionFor !== null} onClose={() => setActionFor(null)} title={actionFor?.title ?? 'Chat'} description="Only you see these changes.">
        {actionFor && (
          <ul className="space-y-1">
            {[
              {
                label: archived.includes(actionFor.id) ? 'Unarchive' : 'Archive',
                icon: Archive,
                run: () => setArchived((a) => (a.includes(actionFor.id) ? a.filter((x) => x !== actionFor.id) : [...a, actionFor.id])),
              },
              {
                label: isMuted(actionFor) ? 'Unmute' : 'Mute',
                icon: VolumeX,
                run: () => appActions.toggleMuted(actionFor.id),
              },
              {
                label: isPinned(actionFor) ? 'Unpin' : 'Pin to top',
                icon: Pin,
                run: () => setPinned((p) => (p.includes(actionFor.id) ? p.filter((x) => x !== actionFor.id) : [...p, actionFor.id])),
              },
              {
                label: 'Delete chat',
                icon: Trash2,
                danger: true,
                run: () => {
                  setArchived((a) => a.filter((x) => x !== actionFor.id));
                  toast('Chat removed from this device (preview)');
                },
              },
            ].map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => {
                    item.run();
                    setActionFor(null);
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[16px] hover:bg-surface-2', item.danger ? 'text-danger' : 'text-text')}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet
        open={noting}
        onClose={() => setNoting(false)}
        title="Your note"
        description="Short, and gone after a day. Friends see it above your name."
        footer={
          <Button
            full
            onClick={() => {
              setMyNote(noteDraft.trim());
              setNoteDraft('');
              setNoting(false);
            }}
          >
            Share note
          </Button>
        }
      >
        <input
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value.slice(0, 40))}
          placeholder="Library till nine"
          aria-label="Note text"
          className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-[15px] focus:border-accent focus:outline-none"
        />
        <p className="mt-2 text-right text-[12px] text-text-3">{noteDraft.length}/40</p>
      </Sheet>

      <Sheet open={composing} onClose={() => setComposing(false)} title="New chat" description="Pick someone to talk to">
        <ul className="space-y-1">
          {students.slice(0, 8).map((person) => {
            const existing = chats.find((chat) => chat.kind === 'direct' && chat.memberIds.includes(person.id));
            return (
              <li key={person.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                <Avatar name={person.name} seed={person.id} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{person.name}</span>
                  <span className="block truncate text-[13px] text-text-3">{person.branch}</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setComposing(false);
                    if (existing) router.push(`/chats/${existing.id}`);
                    else toast(`Request sent to ${person.name.split(' ')[0]}`);
                  }}
                >
                  Message
                </Button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}
