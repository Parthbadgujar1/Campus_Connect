'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Archive, BellOff, Check, CheckSquare, Hash, MessageSquarePlus, MessagesSquare, Pin, Search, Trash2, Users, UsersRound, VenetianMask, X } from 'lucide-react';
import { del, get, patch, post } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, type Page } from '@/lib/api/hooks';
import type { ChatListItem, PersonSummary } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Field, Input } from '@/components/ui/fields';
import { EndOfList } from '@/components/ui/infinite';
import { EmptyState } from '@/components/ui/layout';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ConfirmDialog, ErrorState, FormAlert, LoadMore, SkeletonList, Spinner } from '@/components/ui/states';
import { Avatar } from '@/components/ui/avatar';
import { Stagger, StaggerItem } from '@/components/motion';
import { useLive } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { useToast } from '@/components/ui/toast';
import { refreshBadges } from '@/components/shell/app-shell';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';
import { StatusStrip } from '@/components/status/status';

type Filter = 'all' | 'unread' | 'direct' | 'groups' | 'archived';

export function ChatAvatar({ chat, size = 'md' }: { chat: Pick<ChatListItem, 'id' | 'kind' | 'title' | 'other'>; size?: 'sm' | 'md' | 'lg' }) {
  if (chat.kind === 'direct' && chat.other) return <PersonAvatar person={chat.other} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />;
  if (chat.kind === 'anonymous') return <span className={cn('grid shrink-0 place-items-center rounded-full bg-surface-2 text-text-2', size === 'sm' ? 'h-9 w-9' : 'h-11 w-11')}><VenetianMask className="h-5 w-5" aria-hidden="true" /></span>;
  if (chat.kind === 'channel') return <span className={cn('grid shrink-0 place-items-center rounded-full bg-surface-2 text-text-2', size === 'sm' ? 'h-9 w-9' : 'h-11 w-11')}><Hash className="h-5 w-5" aria-hidden="true" /></span>;
  return <Avatar name={chat.title || 'Group'} seed={chat.id} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />;
}

type PersonRow = PersonSummary & { headline: string | null };

function NewChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(false);
  const [picked, setPicked] = useState<PersonRow[]>([]);
  const [title, setTitle] = useState('');
  // Everyone at the college, a page at a time, so any person in the portal can be messaged.
  const people = useInfinite<PersonRow>(open ? `chats:people:${q}` : null, (cursor, signal) => get<Page<PersonRow>>('/users', { q: q || undefined, cursor: cursor ?? undefined, limit: 30 }, signal));
  const direct = useAction(async (userId: string) => {
    const r = await post<{ chatId: string }>('/chats/direct', { userId });
    onClose();
    invalidate('chats:list');
    router.push(`/chats/${r.chatId}`);
  });
  const makeGroup = useAction(async () => {
    const r = await post<{ chatId: string }>('/chats/group', { title: title.trim(), memberIds: picked.map((p) => p.id) });
    onClose();
    setPicked([]);
    setTitle('');
    invalidate('chats:list');
    router.push(`/chats/${r.chatId}`);
  });
  const toggle = (p: PersonRow) => setPicked((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={group ? 'New group' : 'New chat'}
      footer={group ? <Button full onClick={() => void makeGroup.run()} disabled={!title.trim() || !picked.length || makeGroup.pending}>{makeGroup.pending ? <Spinner /> : <Users className="h-4 w-4" aria-hidden="true" />} Create group ({picked.length})</Button> : undefined}
    >
      <div className="space-y-3">
        <ChipRow>
          <Chip active={!group} onClick={() => setGroup(false)}>Message one person</Chip>
          <Chip active={group} onClick={() => setGroup(true)}>Start a group</Chip>
        </ChipRow>
        {group && <Field label="Group name" htmlFor="g-title"><Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Hackathon squad" /></Field>}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name or skill" className="pl-10" aria-label="Search people" />
        </div>
        {people.loading && <SkeletonList variant="row" count={4} />}
        {people.error && <ErrorState error={people.error} onRetry={people.reload} compact />}
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {people.items.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => (group ? toggle(p) : void direct.run(p.id))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2" aria-pressed={group ? on : undefined}>
                  <PersonAvatar person={p} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.displayName}</span>
                    <span className="block truncate text-[12px] text-text-3">{p.headline ?? [p.department, p.year ? `Year ${p.year}` : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  {group && <span className={cn('grid h-6 w-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-accent-ink' : 'border-text-3')}>{on && <Check className="h-4 w-4" aria-hidden="true" />}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {!people.loading && !people.error && !people.items.length && <p className="rounded-2xl border border-dashed border-border p-5 text-center text-[14px] text-text-3">{q ? 'No one matches that search.' : 'No one else has joined yet.'}</p>}
        <LoadMore hasMore={people.hasMore} loading={people.loadingMore} onClick={people.loadMore} label="Show more people" />
        {(direct.error || makeGroup.error) && <FormAlert>{(direct.error ?? makeGroup.error)!.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

export function ChatList() {
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const toast = useToast();
  const { user } = useSession();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const list = useInfinite<ChatListItem>(`chats:list:${filter}:${search}`, (cursor, signal) => get<Page<ChatListItem>>('/chats', { filter, q: search || undefined, cursor: cursor ?? undefined, limit: 40 }, signal));
  // New messages anywhere: refresh the list (cheap) and the badges.
  // Busy chats can send many events a second: refresh the list once for the whole burst.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  useLive(null, (e) => {
    if (e.type === 'message.created' || e.type === 'chat.updated' || e.type === 'ready') {
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        invalidate('chats:list');
        refreshBadges();
      }, 1200);
    }
  });
  // Lists also refresh on a timer, in case the live connection is down.
  useEffect(() => {
    const t = setInterval(() => invalidate('chats:list'), 30_000);
    return () => clearInterval(t);
  }, []);
  const activeId = pathname.startsWith('/chats/') ? pathname.split('/')[2] : null;

  // ---- selecting chats: long-press (or right-click) a chat, or tap Select
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const startSelecting = (id: string) => {
    setSelecting(true);
    setPicked((p) => (p.includes(id) ? p : [...p, id]));
  };
  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
  };
  const chosen = list.items.filter((c) => picked.includes(c.id));
  const bulk = useAction(async (change: Record<string, unknown>, message: string) => {
    await Promise.all(chosen.map((c) => patch(`/chats/${c.id}/settings`, change)));
    invalidate('chats:list');
    refreshBadges();
    toast(message);
    stopSelecting();
  });
  const removeChosen = useAction(async () => {
    // Direct chats are deleted for me; groups and communities are left.
    await Promise.all(chosen.map((c) => (c.kind === 'direct' ? del(`/chats/${c.id}`) : user ? del(`/chats/${c.id}/members/${user.id}`) : Promise.resolve())));
    invalidate('chats:list');
    refreshBadges();
    toast(chosen.length === 1 ? 'Done' : `${chosen.length} chats removed`);
    setConfirmDelete(false);
    stopSelecting();
  });
  const allPinned = chosen.length > 0 && chosen.every((c) => c.pinned);
  const allMuted = chosen.length > 0 && chosen.every((c) => c.muted);
  const leavesGroups = chosen.some((c) => c.kind !== 'direct');
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="pt-safe shrink-0 px-4 pb-3 pt-4">
        {selecting ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={stopSelecting} aria-label="Cancel selecting" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"><X className="h-5 w-5" aria-hidden="true" /></button>
            <span className="min-w-0 flex-1 text-[18px] font-bold">{picked.length ? `${picked.length} selected` : 'Select chats'}</span>
            <Button size="sm" variant="secondary" disabled={!picked.length || bulk.pending} onClick={() => void bulk.run({ pinned: !allPinned }, allPinned ? 'Unpinned' : 'Pinned')}><Pin className="h-4 w-4" aria-hidden="true" /> {allPinned ? 'Unpin' : 'Pin'}</Button>
            <Button size="sm" variant="secondary" disabled={!picked.length || bulk.pending} onClick={() => void bulk.run({ muteHours: allMuted ? 0 : 8 }, allMuted ? 'Unmuted' : 'Muted for 8 hours')}><BellOff className="h-4 w-4" aria-hidden="true" /> {allMuted ? 'Unmute' : 'Mute'}</Button>
            <Button size="sm" variant="secondary" disabled={!picked.length || bulk.pending} onClick={() => void bulk.run({ archived: filter !== 'archived' }, filter === 'archived' ? 'Moved to inbox' : 'Archived')}><Archive className="h-4 w-4" aria-hidden="true" /> {filter === 'archived' ? 'Unarchive' : 'Archive'}</Button>
            <Button size="sm" variant="danger" disabled={!picked.length} onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /> {chosen.length > 0 && chosen.every((c) => c.kind !== 'direct') ? 'Leave' : 'Delete'}</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <h1 className="marker-heading hl-green text-[28px] font-bold leading-tight">Chats</h1>
            <div className="flex items-center gap-2">
              {list.items.length > 0 && <Button size="sm" variant="secondary" onClick={() => setSelecting(true)}><CheckSquare className="h-4 w-4" aria-hidden="true" /> Select</Button>}
              <Button size="sm" onClick={() => setComposing(true)}><MessageSquarePlus className="h-4 w-4" aria-hidden="true" /> New</Button>
            </div>
          </div>
        )}
        <StatusStrip />
        <form className="relative mt-3" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setSearch(''); }} placeholder="Search chats" className="h-11 pl-10" aria-label="Search chats" enterKeyHint="search" />
        </form>
        <ChipRow className="mt-3">
          {(['all', 'unread', 'direct', 'groups', 'archived'] as Filter[]).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{{ all: 'All', unread: 'Unread', direct: 'People', groups: 'Groups', archived: 'Archived' }[f]}</Chip>
          ))}
        </ChipRow>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-4">
        {list.loading && <SkeletonList variant="row" count={7} className="mx-4" />}
        {list.error && !list.items.length && <ErrorState error={list.error} onRetry={list.reload} className="mx-4" />}
        {!list.loading && !list.error && !list.items.length && (
          <EmptyState className="mx-4" icon={filter === 'archived' ? MessagesSquare : UsersRound} title={search ? 'No chats match' : filter === 'unread' ? 'You’re all caught up' : filter === 'archived' ? 'Nothing archived' : 'No chats yet'} description={!search && filter === 'all' ? 'Message a classmate or start a group.' : undefined} action={!search && filter === 'all' ? <Button onClick={() => setComposing(true)}>Start a chat</Button> : undefined} />
        )}
        {list.items.length > 0 && (
          <Stagger as="ul">
            {list.items.map((c) => (
              <StaggerItem key={c.id} as="li">
                <Link
                  href={`/chats/${c.id}`}
                  onClick={(e) => {
                    if (!selecting) return;
                    e.preventDefault();
                    setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]));
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    startSelecting(c.id);
                  }}
                  onPointerDown={(e) => {
                    if (selecting || e.pointerType === 'mouse') return;
                    pressEnd();
                    pressTimer.current = setTimeout(() => startSelecting(c.id), 500);
                  }}
                  onPointerUp={pressEnd}
                  onPointerLeave={pressEnd}
                  onPointerCancel={pressEnd}
                  draggable={false}
                  className={cn('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 [-webkit-touch-callout:none]', activeId === c.id && !selecting && 'bg-surface-2', picked.includes(c.id) && 'bg-accent-soft/60')}
                  aria-current={activeId === c.id ? 'page' : undefined}
                >
                  {selecting && (
                    <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2', picked.includes(c.id) ? 'border-accent bg-accent text-accent-ink' : 'border-text-3')} aria-hidden="true">
                      {picked.includes(c.id) && <Check className="h-4 w-4" />}
                    </span>
                  )}
                  <ChatAvatar chat={c} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('truncate text-[15px]', c.unread ? 'font-bold' : 'font-semibold')}>{c.title}</span>
                      {c.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-text-3" aria-label="Pinned" />}
                      {c.muted && <BellOff className="h-3.5 w-3.5 shrink-0 text-text-3" aria-label="Muted" />}
                    </span>
                    <span className={cn('block truncate text-[13px]', c.unread ? 'font-medium text-text' : 'text-text-3')}>
                      {c.lastMessage ? `${c.lastMessage.senderName && c.kind !== 'direct' ? `${c.lastMessage.senderName}: ` : c.lastMessage.senderName === 'You' ? 'You: ' : ''}${c.lastMessage.preview}` : c.kind === 'direct' ? 'Say hello 👋' : `${c.membersCount} members`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-text-3">{ago(c.lastMessage?.createdAt ?? c.activityAt)}</span>
                    {c.unread > 0 && <span className="min-w-[20px] rounded-full bg-accent px-1.5 text-center text-[11px] font-bold leading-5 text-accent-ink">{c.unread > 99 ? '99+' : c.unread}</span>}
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
        {list.items.length > 0 && (list.hasMore ? <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} /> : <EndOfList message="No more chats" className="py-6" />)}
      </div>
      <NewChat open={composing} onClose={() => setComposing(false)} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void removeChosen.run()}
        title={chosen.length === 1 ? (chosen[0]?.kind === 'direct' ? 'Delete this chat?' : 'Leave this group?') : `Remove ${chosen.length} chats?`}
        description={chosen.every((c) => c.kind !== 'direct') ? 'You will stop getting messages from these groups. An admin can add you back.' : leavesGroups ? 'Direct chats are deleted for you only and come back if they message you again. You will leave any groups, and an admin can add you back.' : 'The chat and its messages are removed for you only. It comes back if they message you again.'}
        confirmLabel={chosen.length > 0 && chosen.every((c) => c.kind !== 'direct') ? 'Leave' : 'Delete'}
        danger
        pending={removeChosen.pending}
        error={removeChosen.error?.message}
      />
    </div>
  );
}
