'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Ban, Bell, BellOff, Check, ExternalLink, FileText, Flag, Link2, LogOut, Palette, Search, Shield, ShieldOff, Timer, UserMinus, UserPlus } from 'lucide-react';
import { del, errorMessage, get, patch, post } from '@/lib/api/client';
import { invalidate, useQuery, type Page } from '@/lib/api/hooks';
import type { ChatListItem, MessageView, PersonSummary } from '@/lib/api/types';
import type { ChatDetail, Presence } from '@/lib/api/modules';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/fields';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ConfirmDialog, ErrorState, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ReportSheet } from '@/components/common/report-sheet';
import { formatBytes } from '@/components/loops/media';
import { ago, day, time } from '@/lib/live-time';
import { cn } from '@/lib/utils';
import { ChatAvatar } from './chat-list';
import type { ViewerItem } from './media-viewer';

export const WALLPAPERS: Record<string, { label: string; className: string; swatch: string }> = {
  none: { label: 'Default', className: '', swatch: 'var(--surface-2)' },
  meadow: { label: 'Meadow', className: 'bg-[linear-gradient(160deg,rgb(16_185_129/0.10),rgb(132_204_22/0.06))]', swatch: '#34d399' },
  ocean: { label: 'Ocean', className: 'bg-[linear-gradient(160deg,rgb(59_130_246/0.12),rgb(14_165_233/0.06))]', swatch: '#60a5fa' },
  blossom: { label: 'Blossom', className: 'bg-[linear-gradient(160deg,rgb(236_72_153/0.10),rgb(168_85_247/0.07))]', swatch: '#f472b6' },
  ember: { label: 'Ember', className: 'bg-[linear-gradient(160deg,rgb(249_115_22/0.11),rgb(234_179_8/0.06))]', swatch: '#fb923c' },
};

/** "online", "last seen today at 4:10 pm", or nothing when they hide their activity. */
export function presenceLabel(p: Presence | undefined | null): string | null {
  if (!p || !p.visible) return null;
  if (p.online) return 'online';
  if (!p.lastSeenAt) return null;
  const d = new Date(p.lastSeenAt);
  const today = new Date().toDateString() === d.toDateString();
  return `last seen ${today ? 'today' : day(p.lastSeenAt)} at ${time(p.lastSeenAt)}`;
}

/** Pick up to 5 chats and forward a message to them. */
export function ForwardSheet({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const chats = useQuery<Page<ChatListItem>>(`forward:chats:${q}`, (signal) => get('/chats', { q: q || undefined, limit: 30 }, signal));
  const send = async () => {
    setSending(true);
    try {
      const r = await post<{ sent: number }>(`/messages/${messageId}/forward`, { chatIds: picked });
      invalidate('chats:list');
      toast(r.sent === picked.length ? 'Forwarded' : `Forwarded to ${r.sent} of ${picked.length} chats`);
      onClose();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Forward to…" description="Up to 5 chats." footer={picked.length ? <Button full disabled={sending} onClick={() => void send()}>{sending && <Spinner />} Forward{picked.length > 1 ? ` to ${picked.length}` : ''}</Button> : undefined}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="pl-10" />
      </div>
      {chats.loading && <SkeletonList variant="row" count={4} />}
      {chats.error && <ErrorState error={chats.error} onRetry={chats.reload} compact />}
      <ul className="divide-y divide-border">
        {chats.data?.items.map((c) => {
          const on = picked.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" aria-pressed={on} disabled={!on && picked.length >= 5} onClick={() => setPicked((l) => (on ? l.filter((x) => x !== c.id) : [...l, c.id]))} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2 disabled:opacity-50">
                <ChatAvatar chat={c} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-accent-ink' : 'border-text-3')}>{on && <Check className="h-4 w-4" aria-hidden="true" />}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** Search this chat's messages; tap a result to jump to it. */
export function ChatSearchSheet({ chatId, onClose, onPick }: { chatId: string; onClose: () => void; onPick: (m: MessageView) => void }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const results = useQuery<{ items: MessageView[] }>(q.length >= 2 ? `chats:search:${chatId}:${q}` : null, (signal) => get(`/chats/${chatId}/messages`, { q, limit: 50 }, signal));
  return (
    <Sheet open onClose={onClose} title="Search in chat">
      <form className="relative mb-3" onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); }}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={text} onChange={(e) => { setText(e.target.value); if (e.target.value.trim().length >= 2) setQ(e.target.value.trim()); }} placeholder="Search messages" aria-label="Search messages" className="pl-10" autoFocus enterKeyHint="search" />
      </form>
      {results.loading && <SkeletonList variant="row" count={3} />}
      {results.data && !results.data.items.length && <p className="py-6 text-center text-[14px] text-text-3">No messages match “{q}”.</p>}
      <ul className="divide-y divide-border">
        {results.data?.items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => onPick(m)} className="w-full py-2.5 text-left hover:bg-surface-2">
              <span className="flex justify-between gap-2 text-[12px] text-text-3"><span className="truncate font-semibold">{m.isMine ? 'You' : (m.sender?.displayName ?? 'Someone')}</span><span className="shrink-0">{day(m.createdAt)}, {time(m.createdAt)}</span></span>
              <span className="line-clamp-2 text-[14px]">{m.body}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

type InfoTab = 'media' | 'docs' | 'links';

/** Chat info, like WhatsApp: shared media, docs and links; mute, wallpaper, disappearing
 *  messages; members and admin tools for groups; profile, block and report for direct chats. */
export function ChatInfoSheet({ chat, me, presence, messages, onClose, onOpenMedia, onSearch, onChanged }: { chat: ChatDetail; me: string; presence: Presence | null; messages: MessageView[]; onClose: () => void; onOpenMedia: (items: ViewerItem[], index: number) => void; onSearch: () => void; onChanged: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<InfoTab>('media');
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'block' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [about, setAbout] = useState(chat.description ?? '');
  const [busy, setBusy] = useState(false);
  const media = useQuery<{ items: MessageView[] }>(`chats:media:${chat.id}`, (signal) => get(`/chats/${chat.id}/media`, undefined, signal));
  const isGroup = chat.kind !== 'direct';
  const admin = chat.myRole !== 'member';
  const other = chat.kind === 'direct' ? chat.members.find((m) => m.id && m.id !== me) : undefined;

  const visual = (media.data?.items ?? []).filter((m) => m.file && (m.file.kind === 'image' || m.file.kind === 'video'));
  const docs = (media.data?.items ?? []).filter((m) => m.file && !['image', 'video'].includes(m.file.kind));
  const links = useMemo(() => {
    const out: Array<{ url: string; m: MessageView }> = [];
    for (const m of [...messages].reverse()) for (const url of m.body?.match(/https?:\/\/[^\s<]+/g) ?? []) out.push({ url, m });
    return out.slice(0, 100);
  }, [messages]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      onChanged();
      invalidate('chats:list');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const setDisappearing = (seconds: number | null) => run(() => patch(`/chats/${chat.id}`, { disappearingSeconds: seconds }), seconds ? 'Disappearing messages on' : 'Disappearing messages off');

  return (
    <>
      <Sheet open onClose={onClose} title={isGroup ? 'Group info' : 'Contact info'}>
        <div className="flex flex-col items-center gap-2 text-center">
          <ChatAvatar chat={{ id: chat.id, kind: chat.kind, title: chat.title, other: (other as PersonSummary | undefined) ?? null }} size="lg" />
          <p className="text-[20px] font-bold leading-tight">{chat.title}</p>
          <p className="text-[13px] text-text-3">{isGroup ? `Group · ${chat.members.length} members` : [other && 'username' in other && other.username ? `@${other.username}` : null, presenceLabel(presence)].filter(Boolean).join(' · ')}</p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {other?.username && <Link href={`/profile/${other.username}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Profile</Link>}
            <button type="button" onClick={onSearch} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold"><Search className="h-4 w-4" aria-hidden="true" /> Search</button>
            <button type="button" disabled={busy} onClick={() => void run(() => patch(`/chats/${chat.id}/settings`, { muteHours: chat.settings.muted ? 0 : 8 }), chat.settings.muted ? 'Unmuted' : 'Muted for 8 hours')} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold">
              {chat.settings.muted ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />} {chat.settings.muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>

        {isGroup && (
          <section className="mt-5 rounded-2xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-text-3">About</p>
              {admin && !editingAbout && <button type="button" onClick={() => setEditingAbout(true)} className="text-[13px] font-semibold text-accent">Edit</button>}
            </div>
            {editingAbout ? (
              <div className="mt-2 space-y-2">
                <Textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={500} aria-label="Group description" />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => void run(() => patch(`/chats/${chat.id}`, { description: about.trim() || null }), 'Description saved').then(() => setEditingAbout(false))}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingAbout(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-[14px]">{chat.description || (admin ? 'Add a group description' : 'No description')}</p>
            )}
          </section>
        )}

        <section className="mt-5">
          <Segmented<InfoTab> label="Shared in this chat" value={tab} onChange={setTab} options={[{ value: 'media', label: `Media · ${visual.length}` }, { value: 'docs', label: `Docs · ${docs.length}` }, { value: 'links', label: `Links · ${links.length}` }]} />
          <div className="mt-3">
            {media.loading && <SkeletonList variant="row" count={2} />}
            {tab === 'media' && (visual.length ? (
              <div className="grid grid-cols-3 gap-1">
                {visual.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => onOpenMedia(visual.map((x) => ({ messageId: x.id, file: x.file!, sender: x.isMine ? 'You' : (x.sender?.displayName ?? 'Someone'), caption: x.body, createdAt: x.createdAt })), i)} className="aspect-square overflow-hidden rounded-lg bg-black">
                    {m.file!.kind === 'video' ? <video src={m.file!.url ?? undefined} preload="metadata" muted className="h-full w-full object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.file!.thumbnailUrl ?? m.file!.url ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            ) : !media.loading && <p className="py-4 text-center text-[14px] text-text-3">No photos or videos yet.</p>)}
            {tab === 'docs' && (docs.length ? (
              <ul className="divide-y divide-border">
                {docs.map((m) => (
                  <li key={m.id}><a href={m.file!.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 hover:bg-surface-2"><FileText className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{m.file!.name}</span><span className="block text-[12px] text-text-3">{formatBytes(m.file!.size)} · {ago(m.createdAt)}</span></span></a></li>
                ))}
              </ul>
            ) : !media.loading && <p className="py-4 text-center text-[14px] text-text-3">No documents yet.</p>)}
            {tab === 'links' && (links.length ? (
              <ul className="divide-y divide-border">
                {links.map(({ url, m }, i) => (
                  <li key={`${m.id}-${i}`}><a href={url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 py-2.5 hover:bg-surface-2"><Link2 className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{url.replace(/^https?:\/\//, '')}</span><span className="block text-[12px] text-text-3">{m.isMine ? 'You' : m.sender?.displayName} · {ago(m.createdAt)}</span></span></a></li>
                ))}
              </ul>
            ) : <p className="py-4 text-center text-[14px] text-text-3">No links in the loaded messages.</p>)}
          </div>
        </section>

        <section className="mt-5 space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><Timer className="h-4 w-4" aria-hidden="true" /> Disappearing messages</p>
            <ChipRow>
              {([['Off', null], ['24 hours', 86400], ['7 days', 604800]] as const).map(([label, v]) => (
                <Chip key={label} active={(chat.disappearingSeconds ?? null) === v} onClick={() => (isGroup && !admin ? toast('Only group admins can change this') : void setDisappearing(v))}>{label}</Chip>
              ))}
            </ChipRow>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><Palette className="h-4 w-4" aria-hidden="true" /> Wallpaper</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(WALLPAPERS).map(([key, w]) => (
                <button key={key} type="button" onClick={() => void run(() => patch(`/chats/${chat.id}/settings`, { colorWash: key }), `Wallpaper: ${w.label}`)} aria-pressed={chat.settings.colorWash === key} className={cn('flex flex-col items-center gap-1 text-[12px]', chat.settings.colorWash === key ? 'font-semibold' : 'text-text-3')}>
                  <span className={cn('h-10 w-10 rounded-full border-2', chat.settings.colorWash === key ? 'border-accent' : 'border-border')} style={{ background: w.swatch }} />
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isGroup && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] font-semibold">{chat.members.length} members</p>
              {admin && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" aria-hidden="true" /> Add</Button>}
            </div>
            <ul className="divide-y divide-border">
              {chat.members.map((m, i) => (
                <li key={m.id ?? i} className="flex items-center gap-3 py-2.5">
                  <PersonAvatar person={m.id && m.username ? { id: m.id, displayName: m.displayName, avatarUrl: m.avatarUrl ?? null, username: m.username } : null} size="sm" link={Boolean(m.username)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.id === me ? 'You' : m.displayName}</span>
                    {m.chatRole !== 'member' && <span className="text-[12px] text-accent">{m.chatRole === 'owner' ? 'Group owner' : 'Group admin'}</span>}
                  </span>
                  {admin && m.id && m.id !== me && m.chatRole !== 'owner' && (
                    <span className="flex gap-1">
                      <button type="button" disabled={busy} onClick={() => void run(() => patch(`/chats/${chat.id}/members/${m.id}`, { role: m.chatRole === 'admin' ? 'member' : 'admin' }), m.chatRole === 'admin' ? 'Admin removed' : 'Made admin')} aria-label={m.chatRole === 'admin' ? `Dismiss ${m.displayName} as admin` : `Make ${m.displayName} admin`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2">
                        {m.chatRole === 'admin' ? <ShieldOff className="h-4 w-4" aria-hidden="true" /> : <Shield className="h-4 w-4" aria-hidden="true" />}
                      </button>
                      <button type="button" disabled={busy} onClick={() => void run(() => del(`/chats/${chat.id}/members/${m.id}`), `${m.displayName} removed`)} aria-label={`Remove ${m.displayName}`} className="grid h-9 w-9 place-items-center rounded-full text-danger hover:bg-danger-soft">
                        <UserMinus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 -mx-2 flex flex-col">
          {isGroup ? (
            <button type="button" onClick={() => setConfirm('leave')} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold text-danger hover:bg-danger-soft"><LogOut className="h-5 w-5" aria-hidden="true" /> Exit group</button>
          ) : (
            other?.id && <button type="button" onClick={() => setConfirm('block')} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold text-danger hover:bg-danger-soft"><Ban className="h-5 w-5" aria-hidden="true" /> Block {other.displayName.split(' ')[0]}</button>
          )}
          {!isGroup && other?.id && <button type="button" onClick={() => setReporting(true)} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold text-danger hover:bg-danger-soft"><Flag className="h-5 w-5" aria-hidden="true" /> Report {other.displayName.split(' ')[0]}</button>}
        </section>
      </Sheet>

      {adding && <AddMembersSheet chat={chat} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); onChanged(); }} />}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          void (confirm === 'leave'
            ? run(() => del(`/chats/${chat.id}/members/${me}`), 'You left the group').then(() => router.replace('/chats'))
            : run(() => post(`/users/${other!.id}/block`), 'Blocked').then(() => router.replace('/chats')))
        }
        title={confirm === 'leave' ? 'Exit this group?' : `Block ${other?.displayName ?? 'this person'}?`}
        description={confirm === 'leave' ? 'You will stop getting its messages.' : 'They will not be able to message you or see your profile. They are not told.'}
        confirmLabel={confirm === 'leave' ? 'Exit group' : 'Block'}
        danger
      />
      {reporting && other?.id && <ReportSheet open onClose={() => setReporting(false)} targetType="user" targetId={other.id} label="this person" />}
    </>
  );
}

function AddMembersSheet({ chat, onClose, onAdded }: { chat: ChatDetail; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inChat = new Set(chat.members.map((m) => m.id));
  const people = useQuery<Page<PersonSummary>>(`chats:add:${q}`, (signal) => get('/users', { q: q || undefined, limit: 30 }, signal));
  const add = async () => {
    setBusy(true);
    try {
      await post(`/chats/${chat.id}/members`, { userIds: picked });
      toast(`Added ${picked.length}`);
      onAdded();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Add members" footer={picked.length ? <Button full disabled={busy} onClick={() => void add()}>{busy && <Spinner />} Add {picked.length}</Button> : undefined}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="pl-10" />
      </div>
      <ul className="divide-y divide-border">
        {people.data?.items.filter((p) => !inChat.has(p.id)).map((p) => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id}>
              <button type="button" aria-pressed={on} onClick={() => setPicked((l) => (on ? l.filter((x) => x !== p.id) : [...l, p.id]))} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2">
                <PersonAvatar person={p} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.displayName}</span>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-accent-ink' : 'border-text-3')}>{on && <Check className="h-4 w-4" aria-hidden="true" />}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
