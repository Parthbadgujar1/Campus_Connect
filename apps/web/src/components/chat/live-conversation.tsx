'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, Archive, BellOff, Bell, CalendarClock, Check, CheckCheck, Copy, CornerUpLeft, Eye, FileText, Flag, Forward, Info, LogOut, MapPin, Mic, MoreVertical, Pencil, Pin, Play, Plus, Search, Send, SmilePlus, Trash2, Users, X } from 'lucide-react';
import { clientId, del, errorMessage, get, patch, post, put, uploadWithProgress } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { ChatListItem, FileView, MessageView } from '@/lib/api/types';
import type { ChatDetail, Presence } from '@/lib/api/modules';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/fields';
import { Menu } from '@/components/ui/menu';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ReportSheet } from '@/components/common/report-sheet';
import { AnimatePresence, motion } from '@/components/motion';
import { useLive, sendTyping } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { refreshBadges } from '@/components/shell/app-shell';
import { day, time, toLocalInput } from '@/lib/live-time';
import { cn } from '@/lib/utils';
import { ChatAvatar } from './chat-list';
import { RichText } from '@/components/common/rich-text';
import { usePublicConfig } from '@/components/shell/public-shell';
import { AttachSheet, ContactSheet, MediaComposer, PollSheet, shareLocation, type OutgoingMessage } from './attach';
import { ChatInfoSheet, ChatSearchSheet, ForwardSheet, WALLPAPERS, presenceLabel } from './chat-sheets';
import { MediaViewer, type ViewerItem } from './media-viewer';
import { VoicePlayer, VoiceRecorder } from './voice';

const QUICK = ['👍', '❤️', '😂', '🎉', '😮', '🙏'];
const EDIT_WINDOW_MS = 15 * 60_000;

interface MessagesPage {
  items: MessageView[];
  olderCursor: string | null;
  newerCursor: string | null;
  hasMoreNewer: boolean;
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function Bubble({ m, chat, onReply, onChange, onReport, onOpenMedia, onForward, readByOther, highlight }: { m: MessageView; chat: ChatDetail; onReply: (m: MessageView) => void; onChange: (m: MessageView | null) => void; onReport: (m: MessageView) => void; onOpenMedia: (m: MessageView) => void; onForward: (m: MessageView) => void; readByOther: boolean; highlight: boolean }) {
  const toast = useToast();
  const [snapUrl, setSnapUrl] = useState<FileView | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body ?? '');
  const [picking, setPicking] = useState(false);
  const react = useAction(async (emoji: string) => {
    const mine = m.reactions.find((r) => r.emoji === emoji)?.mine;
    const res = mine ? await del<{ reactions: Array<{ emoji: string; n: number }> }>(`/messages/${m.id}/reactions`, { emoji }) : await put<{ reactions: Array<{ emoji: string; n: number }> }>(`/messages/${m.id}/reactions`, { emoji });
    onChange({ ...m, reactions: res.reactions.map((r) => ({ emoji: r.emoji, count: r.n, mine: r.emoji === emoji ? !mine : (m.reactions.find((x) => x.emoji === r.emoji)?.mine ?? false) })) });
    setPicking(false);
  });
  const edit = useAction(async () => {
    const next = await patch<MessageView>(`/messages/${m.id}`, { body: text.trim() });
    onChange(next);
    setEditing(false);
  });
  const remove = useAction(async () => {
    await del(`/messages/${m.id}`);
    onChange({ ...m, deleted: true, body: null, file: null, payload: {} });
  });
  const respond = useAction(async (response: string) => {
    const r = await put<{ counts: Record<string, number>; mine: string | null }>(`/messages/${m.id}/response`, { response: m.responses?.mine === response ? null : response });
    onChange({ ...m, responses: r });
  });

  const openSnap = useAction(async () => {
    const r = await post<{ file: FileView }>(`/messages/${m.id}/open-snap`);
    setSnapUrl(r.file);
    onChange({ ...m, snap: { viewed: true } });
  });

  if (m.kind === 'system') {
    return <p className="mx-auto my-2 max-w-[85%] rounded-full bg-surface-2 px-3 py-1 text-center text-[12px] text-text-3">{m.body}</p>;
  }
  const mine = m.isMine;
  const canEdit = mine && m.kind === 'text' && !m.deleted && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;
  const canDelete = !m.deleted && (mine || chat.myRole !== 'member');
  const plan = m.kind === 'plan' ? (m.payload as { title?: string; when?: string; place?: string }) : null;
  const poll = m.kind === 'poll' ? (m.payload as { question?: string; options?: string[] }) : null;
  const pollTotal = poll ? Object.values(m.responses?.counts ?? {}).reduce((a, b) => a + b, 0) : 0;
  return (
    <motion.div layout id={`msg-${m.id}`} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cn('group flex gap-2 rounded-2xl transition-colors duration-700', mine ? 'justify-end' : 'justify-start', highlight && 'bg-accent-soft/70')}>
      {!mine && chat.kind !== 'direct' && <span className="mt-auto shrink-0">{m.sender && <PersonAvatar person={{ ...m.sender, id: m.sender.alias ?? m.sender.id }} size="xs" />}</span>}
      <div className={cn('flex max-w-[80%] flex-col', mine ? 'items-end' : 'items-start')}>
        {!mine && chat.kind !== 'direct' && <span className="mb-0.5 px-1 text-[12px] font-semibold text-text-3">{m.sender?.displayName}</span>}
        <div className={cn('relative rounded-2xl px-3.5 py-2 text-[15px] shadow-card', mine ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-surface-2 text-text', m.deleted && 'italic opacity-70')}>
          {m.forwarded && !m.deleted && <p className="mb-1 flex items-center gap-1 text-[12px] italic opacity-75"><Forward className="h-3.5 w-3.5" aria-hidden="true" /> Forwarded</p>}
          {m.replyTo && !m.deleted && (
            <div className={cn('mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[13px]', mine ? 'border-accent-ink/50 bg-black/10' : 'border-accent bg-surface')}>
              <span className="block font-semibold">{m.replyTo.senderName ?? 'Message'}</span>
              <span className="line-clamp-2 opacity-80">{m.replyTo.body ?? 'Deleted message'}</span>
            </div>
          )}
          {m.deleted ? (
            'This message was deleted'
          ) : editing ? (
            <form className="flex min-w-[220px] flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void edit.run(); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} autoFocus aria-label="Edit message" className="h-10 bg-surface text-text" />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={edit.pending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <>
              {m.kind !== 'snap' && m.file && m.file.kind === 'image' && m.file.url && (
                <button type="button" onClick={() => onOpenMedia(m)} className="mb-1 block" aria-label="Open photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.file.thumbnailUrl ?? m.file.url} alt={m.file.name} className="max-h-72 rounded-xl object-cover" loading="lazy" />
                </button>
              )}
              {m.kind === 'snap' && (
                snapUrl?.url ? (
                  snapUrl.kind === 'video' ? <video src={snapUrl.url} autoPlay controls className="max-h-72 rounded-xl" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={snapUrl.url} alt="View-once photo" className="max-h-72 rounded-xl object-cover" />
                ) : (
                  <button type="button" disabled={mine || m.snap?.viewed || openSnap.pending} onClick={() => void openSnap.run()} className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold', mine ? 'bg-black/10' : 'bg-surface')}>
                    {openSnap.pending ? <Spinner /> : <Eye className="h-4 w-4" aria-hidden="true" />} {mine ? 'View-once photo sent' : m.snap?.viewed ? 'Opened' : 'Tap to view once'}
                  </button>
                )
              )}
              {m.kind !== 'snap' && m.file && m.file.kind === 'video' && m.file.url && (
                <button type="button" onClick={() => onOpenMedia(m)} className="relative mb-1 block" aria-label="Play video">
                  <video src={`${m.file.url}#t=0.5`} preload="metadata" muted playsInline className="max-h-72 rounded-xl bg-black" />
                  <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white"><Play className="ml-0.5 h-6 w-6 fill-white" aria-hidden="true" /></span></span>
                </button>
              )}
              {m.kind !== 'snap' && m.file && m.file.kind === 'audio' && m.file.url && <VoicePlayer src={m.file.url} mine={mine} />}
              {poll && (
                <div className="min-w-[220px]">
                  <p className="font-semibold">{poll.question}</p>
                  <div className="mt-2 space-y-1.5">
                    {(poll.options ?? []).map((o, i) => {
                      const n = m.responses?.counts[String(i)] ?? 0;
                      const on = m.responses?.mine === String(i);
                      return (
                        <button key={i} type="button" onClick={() => void respond.run(String(i))} aria-pressed={on} className={cn('relative block w-full overflow-hidden rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold', mine ? 'bg-black/15' : 'bg-surface')}>
                          <span className="absolute inset-y-0 left-0 bg-current opacity-15" style={{ width: pollTotal ? `${(n / pollTotal) * 100}%` : 0 }} aria-hidden="true" />
                          <span className="relative flex justify-between gap-2"><span>{on ? '✓ ' : ''}{o}</span><span>{n}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {m.kind !== 'snap' && m.file && !['image', 'video', 'audio'].includes(m.file.kind) && m.file.url && (
                <a href={m.file.url} target="_blank" rel="noopener noreferrer" className={cn('mb-1 flex items-center gap-2 rounded-xl px-2.5 py-2 text-[14px] font-semibold', mine ? 'bg-black/10' : 'bg-surface')}>
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> <span className="truncate">{m.file.name}</span>
                </a>
              )}
              {plan && (
                <div className="min-w-[200px]">
                  <p className="font-semibold">{plan.title}</p>
                  {plan.when && <p className="mt-0.5 flex items-center gap-1 text-[13px] opacity-90"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{day(plan.when)}, {time(plan.when)}</p>}
                  {plan.place && <p className="flex items-center gap-1 text-[13px] opacity-90"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{plan.place}</p>}
                  <div className="mt-2 flex gap-1.5">
                    {(['in', 'maybe', 'out'] as const).map((r) => (
                      <button key={r} type="button" onClick={() => void respond.run(r)} aria-pressed={m.responses?.mine === r} className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', m.responses?.mine === r ? (mine ? 'bg-white text-black ring-2 ring-white' : 'bg-accent text-accent-ink') : mine ? 'bg-black/15' : 'bg-surface')}>
                        {m.responses?.mine === r ? '✓ ' : ''}{r === 'in' ? 'I’m in' : r === 'maybe' ? 'Maybe' : 'Can’t'}{m.responses?.counts[r] ? ` · ${m.responses.counts[r]}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {m.body && m.kind !== 'plan' && m.kind !== 'poll' && <p className="whitespace-pre-wrap break-words"><RichText text={m.body} linkClassName="underline underline-offset-2" /></p>}
            </>
          )}
        </div>
        {m.reactions.length > 0 && (
          <div className="-mt-1.5 flex flex-wrap gap-1 px-1">
            {m.reactions.map((r) => (
              <button key={r.emoji} type="button" onClick={() => void react.run(r.emoji)} aria-pressed={r.mine} className={cn('rounded-full border px-1.5 text-[12px] leading-5 shadow-card', r.mine ? 'border-accent bg-accent-soft' : 'border-border bg-surface-solid')}>
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] text-text-3">
          <span>{time(m.createdAt)}</span>
          {m.edited && !m.deleted && <span>· edited</span>}
          {mine && !m.deleted && (chat.kind === 'direct' && readByOther ? <CheckCheck className="h-3.5 w-3.5 text-accent" aria-label="Seen" /> : <Check className="h-3.5 w-3.5" aria-label="Sent" />)}
          {!m.deleted && (
            <span className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
              <button type="button" onClick={() => onReply(m)} aria-label="Reply" className="rounded-full p-1 hover:bg-surface-2"><CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" /></button>
              <button type="button" onClick={() => setPicking((v) => !v)} aria-label="React" className="rounded-full p-1 hover:bg-surface-2"><SmilePlus className="h-3.5 w-3.5" aria-hidden="true" /></button>
              {m.body && m.kind !== 'poll' && m.kind !== 'plan' && <button type="button" onClick={() => void navigator.clipboard.writeText(m.body ?? '').then(() => toast('Copied')).catch(() => undefined)} aria-label="Copy" className="rounded-full p-1 hover:bg-surface-2"><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button>}
              {['text', 'image', 'file', 'voice', 'video'].includes(m.kind) && <button type="button" onClick={() => onForward(m)} aria-label="Forward" className="rounded-full p-1 hover:bg-surface-2"><Forward className="h-3.5 w-3.5" aria-hidden="true" /></button>}
              {canEdit && <button type="button" onClick={() => { setText(m.body ?? ''); setEditing(true); }} aria-label="Edit" className="rounded-full p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>}
              {canDelete && <button type="button" onClick={() => void remove.run()} aria-label="Delete for everyone" className="rounded-full p-1 hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>}
              {!mine && <button type="button" onClick={() => onReport(m)} aria-label="Report" className="rounded-full p-1 hover:bg-surface-2"><Flag className="h-3.5 w-3.5" aria-hidden="true" /></button>}
            </span>
          )}
        </div>
        <AnimatePresence>
          {picking && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mt-1 flex gap-1 rounded-full border border-border bg-surface-solid p-1 shadow-card">
              {QUICK.map((e) => <button key={e} type="button" onClick={() => void react.run(e)} className="rounded-full px-1.5 text-[18px] hover:bg-surface-2" aria-label={`React ${e}`}>{e}</button>)}
            </motion.div>
          )}
        </AnimatePresence>
        {(react.error || edit.error || remove.error || respond.error || openSnap.error) && <p className="px-1 text-[12px] text-danger">{(react.error ?? edit.error ?? remove.error ?? respond.error ?? openSnap.error)!.message}</p>}
      </div>
    </motion.div>
  );
}

function PlanSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (payload: { title: string; when?: string; place?: string }) => void }) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(toLocalInput(new Date(Date.now() + 86_400_000)));
  const [place, setPlace] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Make a plan" description="Everyone can answer I’m in, Maybe or Can’t." footer={<Button full disabled={!title.trim()} onClick={() => { onSend({ title: title.trim(), when: new Date(when).toISOString(), place: place.trim() || undefined }); onClose(); setTitle(''); setPlace(''); }}>Send plan</Button>}>
      <div className="space-y-4">
        <Field label="What" htmlFor="plan-title"><Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Study session" /></Field>
        <Field label="When" htmlFor="plan-when"><Input id="plan-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Where (optional)" htmlFor="plan-place"><Input id="plan-place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder="Library, 2nd floor" /></Field>
      </div>
    </Sheet>
  );
}

export function LiveConversation({ chatId }: { chatId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const config = usePublicConfig();
  const maxMb = config.data?.uploads.purposes.message?.maxMb ?? config.data?.uploads.maxMb ?? 25;
  const chat = useQuery<ChatDetail>(`chats:one:${chatId}`, (signal) => get(`/chats/${chatId}`, undefined, signal));
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [older, setOlder] = useState<string | null>(null);
  const [newer, setNewer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [typing, setTyping] = useState<{ name: string; at: number } | null>(null);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'attach' | 'plan' | 'poll' | 'contact' | 'info' | 'search' | null>(null);
  const [outgoing, setOutgoing] = useState<{ files: File[]; mode: 'media' | 'document' | 'snap' } | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(null);
  const [forwarding, setForwarding] = useState<string | null>(null);
  const [reporting, setReporting] = useState<MessageView | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [atBottomState, setAtBottomState] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [presence, setPresence] = useState<Presence | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const atBottom = useRef(true);
  // False until the chat has opened at its latest message; until then scrolling is ours, not the person's.
  const settled = useRef(false);
  const lastTypingSent = useRef(0);

  const c = chat.data;
  const other = c?.kind === 'direct' ? c.members.find((m) => m.id && m.id !== user?.id) : undefined;

  // Online / last seen for direct chats; live updates arrive as presence events.
  useEffect(() => {
    if (!other?.id) return;
    let cancelled = false;
    get<Presence>(`/users/${other.id}/presence`).then((p) => !cancelled && setPresence(p)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [other?.id]);
  useLive(null, (e) => {
    if (e.type === 'presence' && other?.id && e.userId === other.id) setPresence((p) => ({ visible: true, online: e.online, lastSeenAt: e.online ? (p?.lastSeenAt ?? null) : e.at }));
  });

  const scrollToEnd = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnseen(0);
  }, []);

  const markRead = useCallback(() => {
    void post(`/chats/${chatId}/read`).then(() => {
      invalidate('chats:list');
      refreshBadges();
    }).catch(() => undefined);
  }, [chatId]);

  const merge = useCallback((incoming: MessageView[]) => {
    setMessages((list) => {
      const byId = new Map(list.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m });
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    });
  }, []);

  // First page (newest), then keep up through live events.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    atBottom.current = true;
    settled.current = false;
    get<MessagesPage>(`/chats/${chatId}/messages`, { limit: 40 })
      .then((page) => {
        if (cancelled) return;
        setMessages(page.items);
        setOlder(page.olderCursor);
        setNewer(page.newerCursor);
        setError(null);
        markRead();
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [chatId, markRead]);

  useLayoutEffect(() => {
    if (atBottom.current) scrollToEnd();
    // Once the first page is on screen at the bottom, hand scrolling back to the person.
    if (!settled.current && messages.length) {
      const t = setTimeout(() => {
        scrollToEnd();
        settled.current = true;
      }, 350);
      return () => clearTimeout(t);
    }
  }, [messages.length, scrollToEnd]);

  // Photos, videos and fonts finish loading after the first render and make the list taller.
  // While at the bottom, stay there, so a chat always opens at its latest message.
  useEffect(() => {
    const box = content.current;
    const el = scroller.current;
    if (!box || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [loading]);

  const catchUp = useCallback(async () => {
    if (!newer) return;
    try {
      const page = await get<MessagesPage>(`/chats/${chatId}/messages`, { after: newer, limit: 100 });
      if (page.items.length) {
        merge(page.items);
        markRead();
      }
      if (page.newerCursor) setNewer(page.newerCursor);
    } catch {
      // Next event or reconnect tries again.
    }
  }, [chatId, newer, merge, markRead]);

  useLive(chatId, (e) => {
    if (e.type === 'ready') void catchUp();
    if (e.type === 'message.created') {
      merge([e.message as MessageView]);
      setTyping(null);
      if (!atBottom.current) setUnseen((n) => n + 1);
      if (document.visibilityState === 'visible') markRead();
    }
    if (e.type === 'message.deleted') setMessages((list) => list.map((m) => (m.id === e.messageId ? { ...m, deleted: true, body: null, file: null, payload: {} } : m)));
    if (e.type === 'message.reactions') setMessages((list) => list.map((m) => (m.id === e.messageId ? { ...m, reactions: e.reactions.map((r) => ({ ...r, mine: m.reactions.find((x) => x.emoji === r.emoji)?.mine ?? false })) } : m)));
    if (e.type === 'message.response') setMessages((list) => list.map((m) => (m.id === e.messageId ? { ...m, responses: { counts: e.responses, mine: m.responses?.mine ?? null } } : m)));
    if (e.type === 'typing' && e.userId !== user?.id) setTyping({ name: e.name, at: Date.now() });
    if (e.type === 'chat.read' && e.userId !== user?.id) setOtherReadAt(e.at);
    if (e.type === 'chat.updated') chat.reload();
  });
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setTyping(null), 4000);
    return () => clearTimeout(t);
  }, [typing]);

  const loadOlder = async (): Promise<boolean> => {
    if (!older || loadingOlder) return false;
    const el = scroller.current;
    const before = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const page = await get<MessagesPage>(`/chats/${chatId}/messages`, { before: older, limit: 40 });
      atBottom.current = false;
      merge(page.items);
      setOlder(page.olderCursor);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
      return Boolean(page.olderCursor);
    } catch (err) {
      toast((err as Error).message);
      return false;
    } finally {
      setLoadingOlder(false);
    }
  };

  /** Sends one message (text, file, poll...) as a reply when one is selected. */
  const sendRaw = useCallback(
    async (m: OutgoingMessage) => {
      const sent = await post<MessageView>(`/chats/${chatId}/messages`, { clientId: clientId(), kind: m.kind, body: m.body, fileId: m.fileId, payload: m.payload, replyToId: replyTo?.id });
      atBottom.current = true;
      merge([sent]);
      setReplyTo(null);
      invalidate('chats:list');
    },
    [chatId, replyTo, merge],
  );
  const send = useAction(sendRaw);

  const sendVoice = async (file: File) => {
    setRecording(false);
    setVoiceUploading(true);
    try {
      const up = await uploadWithProgress<FileView>('message', file, file.name, () => undefined);
      await sendRaw({ kind: 'voice', fileId: up.id });
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setVoiceUploading(false);
    }
  };

  const settings = useAction(async (change: Record<string, unknown>, message: string) => {
    await patch(`/chats/${chatId}/settings`, change);
    chat.reload();
    invalidate('chats:list');
    toast(message);
  });

  const submit = () => {
    const body = text.trim();
    if (!body || send.pending) return;
    setText('');
    void send.run({ kind: 'text', body });
  };

  const choose = (choice: 'poll' | 'plan' | 'location' | 'contact') => {
    if (choice === 'location') {
      shareLocation()
        .then((m) => sendRaw(m))
        .catch((err) => toast((err as Error).message));
    } else setSheet(choice);
  };

  const mediaItems = useCallback(
    (list: MessageView[]): ViewerItem[] => list.filter((m) => !m.deleted && m.kind !== 'snap' && m.file?.url && (m.file.kind === 'image' || m.file.kind === 'video')).map((m) => ({ messageId: m.id, file: m.file!, sender: m.isMine ? 'You' : (m.sender?.displayName ?? 'Someone'), caption: m.body, createdAt: m.createdAt })),
    [],
  );
  const openMedia = (m: MessageView) => {
    const items = mediaItems(messages);
    setViewer({ items, index: Math.max(0, items.findIndex((x) => x.messageId === m.id)) });
  };

  // Jump to a message from search: load older pages until it is here, then scroll to it.
  const jumpTo = async (m: MessageView) => {
    setSheet(null);
    let found = messages.some((x) => x.id === m.id);
    for (let i = 0; !found && i < 15; i++) {
      const more = await loadOlder();
      await new Promise((r) => setTimeout(r, 60));
      found = Boolean(document.getElementById(`msg-${m.id}`));
      if (!more) break;
    }
    requestAnimationFrame(() => {
      document.getElementById(`msg-${m.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlight(m.id);
      setTimeout(() => setHighlight(null), 2200);
    });
  };

  const header: Pick<ChatListItem, 'id' | 'kind' | 'title' | 'other'> | null = c ? { id: c.id, kind: c.kind, title: c.title, other: (other as never) ?? null } : null;
  const lastMine = [...messages].reverse().find((m) => m.isMine);
  const readByOther = Boolean(otherReadAt && lastMine && otherReadAt >= lastMine.createdAt);
  const subtitle = typing ? `${typing.name.split(' ')[0]} is typing…` : c ? (c.kind === 'direct' ? (presenceLabel(presence) ?? 'Tap for contact info') : `${c.members.length} members${c.disappearingSeconds ? ' · disappearing messages' : ''}`) : '';
  const wallpaper = WALLPAPERS[c?.settings.colorWash ?? 'none']?.className ?? '';
  let lastDay = '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="pt-safe flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
        <Link href="/chats" aria-label="Back to chats" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 md:hidden"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
        <button type="button" onClick={() => c && setSheet('info')} className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-1 py-0.5 text-left hover:bg-surface-2" aria-label="Chat info">
          {header && <ChatAvatar chat={header} size="sm" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{c?.title ?? 'Chat'}</span>
            <span className={cn('block truncate text-[12px]', typing || presence?.online ? 'text-accent' : 'text-text-3')}>{subtitle}</span>
          </span>
        </button>
        <button type="button" onClick={() => setSheet('search')} aria-label="Search in chat" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"><Search className="h-5 w-5" aria-hidden="true" /></button>
        {c && (
          <Menu
            label="Chat options"
            trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
            items={[
              { label: c.kind === 'direct' ? 'Contact info' : 'Group info', icon: Info, onSelect: () => setSheet('info') },
              { label: c.settings.pinned ? 'Unpin' : 'Pin to top', icon: Pin, onSelect: () => void settings.run({ pinned: !c.settings.pinned }, c.settings.pinned ? 'Unpinned' : 'Pinned') },
              { label: c.settings.muted ? 'Unmute' : 'Mute for 8 hours', icon: c.settings.muted ? Bell : BellOff, onSelect: () => void settings.run({ muteHours: c.settings.muted ? 0 : 8 }, c.settings.muted ? 'Unmuted' : 'Muted for 8 hours') },
              { label: c.settings.archived ? 'Move to inbox' : 'Archive', icon: Archive, onSelect: () => void settings.run({ archived: !c.settings.archived }, c.settings.archived ? 'Moved to inbox' : 'Archived') },
              ...(c.kind !== 'direct' ? [{ label: 'Members', icon: Users, onSelect: () => setSheet('info') }, { label: 'Exit group', icon: LogOut, danger: true, onSelect: () => setSheet('info') }] : []),
            ]}
          />
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (!settled.current) return;
            const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            atBottom.current = bottom;
            if (bottom !== atBottomState) setAtBottomState(bottom);
            if (bottom && unseen) setUnseen(0);
            if (el.scrollTop < 60 && older) void loadOlder();
          }}
          className={cn('h-full overflow-y-auto px-3 py-4', wallpaper)}
          aria-live="polite"
          aria-label="Messages"
        >
          <div ref={content}>
          {older && (
            <div className="mb-3 flex justify-center">
              <Button size="sm" variant="secondary" onClick={() => void loadOlder()} disabled={loadingOlder}>{loadingOlder ? <Spinner /> : null} Earlier messages</Button>
            </div>
          )}
          {!older && !loading && messages.length > 0 && <p className="mb-4 text-center text-[12px] text-text-3">This is the beginning of your conversation.{c?.disappearingSeconds ? ' New messages disappear after ' + (c.disappearingSeconds === 86400 ? '24 hours.' : '7 days.') : ''}</p>}
          {loading && <div className="flex justify-center py-10"><Spinner label="Loading messages" /></div>}
          {Boolean(error) && <ErrorState error={error} onRetry={() => router.refresh()} />}
          {!loading && !error && !messages.length && <p className="py-16 text-center text-[14px] text-text-3">No messages yet. Say hello!</p>}
          {c && (
            <div className="space-y-2.5">
              {messages.map((m) => {
                const k = dayKey(m.createdAt);
                const sep = k !== lastDay;
                lastDay = k;
                return (
                  <div key={m.id}>
                    {sep && <p className="my-3 text-center"><span className="rounded-full bg-surface-solid/90 px-3 py-1 text-[12px] font-semibold text-text-3 shadow-card">{day(m.createdAt)}</span></p>}
                    <Bubble
                      m={m}
                      chat={c}
                      readByOther={readByOther && m.id === lastMine?.id}
                      highlight={highlight === m.id}
                      onReply={setReplyTo}
                      onReport={setReporting}
                      onOpenMedia={openMedia}
                      onForward={(x) => setForwarding(x.id)}
                      onChange={(next) => setMessages((list) => (next ? list.map((x) => (x.id === next.id ? next : x)) : list.filter((x) => x.id !== m.id)))}
                    />
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
        <AnimatePresence>
          {!atBottomState && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => {
                atBottom.current = true;
                setAtBottomState(true);
                scrollToEnd(true);
              }}
              aria-label={unseen ? `${unseen} new messages, jump to latest` : 'Jump to latest'}
              className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full border border-border bg-[var(--surface-solid)] shadow-float"
            >
              <ArrowDown className="h-5 w-5" aria-hidden="true" />
              {unseen > 0 && <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-5 text-accent-ink">{unseen}</span>}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-border bg-[var(--surface-solid)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {c && !c.canPost ? (
          <p className="py-2 text-center text-[13px] text-text-3">{c.onlyAdminsPost ? 'Only admins can post here.' : 'You cannot send messages in this chat.'}</p>
        ) : recording ? (
          <VoiceRecorder onSend={(f) => void sendVoice(f)} onCancel={() => setRecording(false)} onError={(msg) => toast(msg)} />
        ) : (
          <>
            <AnimatePresence>
              {replyTo && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-2 flex items-center gap-2 overflow-hidden rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                  <CornerUpLeft className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">Replying to <strong>{replyTo.isMine ? 'yourself' : (replyTo.sender?.displayName ?? 'message')}</strong>: {replyTo.body ?? (replyTo.file ? replyTo.file.name : '')}</span>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-4 w-4" aria-hidden="true" /></button>
                </motion.div>
              )}
            </AnimatePresence>
            {send.error && <FormAlert className="mb-2">{send.error.message}</FormAlert>}
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <button type="button" onClick={() => setSheet('attach')} aria-label="Attach" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-text-2 hover:bg-surface-2">
                {voiceUploading ? <Spinner /> : <Plus className="h-6 w-6" aria-hidden="true" />}
              </button>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (Date.now() - lastTypingSent.current > 3000) {
                    lastTypingSent.current = Date.now();
                    sendTyping(chatId);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Message"
                aria-label="Message"
                className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-[15px] focus:border-accent focus:outline-none"
              />
              {text.trim() ? (
                <motion.button type="submit" whileTap={{ scale: 0.9 }} disabled={send.pending} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-50">
                  {send.pending ? <Spinner /> : <Send className="h-5 w-5" aria-hidden="true" />}
                </motion.button>
              ) : (
                <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => setRecording(true)} disabled={voiceUploading} aria-label="Record a voice message" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-50">
                  <Mic className="h-5 w-5" aria-hidden="true" />
                </motion.button>
              )}
            </form>
          </>
        )}
      </div>

      <AttachSheet open={sheet === 'attach'} onClose={() => setSheet(null)} onFiles={(files, mode) => setOutgoing({ files, mode })} onChoose={choose} />
      {outgoing && <MediaComposer files={outgoing.files} mode={outgoing.mode} maxMb={maxMb} onClose={() => setOutgoing(null)} onSend={sendRaw} />}
      {sheet === 'poll' && <PollSheet onClose={() => setSheet(null)} onSend={sendRaw} />}
      {sheet === 'contact' && <ContactSheet onClose={() => setSheet(null)} onSend={sendRaw} />}
      <PlanSheet open={sheet === 'plan'} onClose={() => setSheet(null)} onSend={(payload) => void send.run({ kind: 'plan', body: payload.title, payload })} />
      {sheet === 'search' && <ChatSearchSheet chatId={chatId} onClose={() => setSheet(null)} onPick={(m) => void jumpTo(m)} />}
      {sheet === 'info' && c && user && (
        <ChatInfoSheet
          chat={c}
          me={user.id}
          presence={presence}
          messages={messages}
          onClose={() => setSheet(null)}
          onSearch={() => setSheet('search')}
          onChanged={() => chat.reload()}
          onOpenMedia={(items, index) => setViewer({ items, index })}
        />
      )}
      {viewer && <MediaViewer items={viewer.items} start={viewer.index} onClose={() => setViewer(null)} onForward={(id) => { setViewer(null); setForwarding(id); }} />}
      {forwarding && <ForwardSheet messageId={forwarding} onClose={() => setForwarding(null)} />}
      {reporting && <ReportSheet open onClose={() => setReporting(null)} targetType="message" targetId={reporting.id} label="this message" />}
      {chat.error && <ErrorState error={chat.error} onRetry={chat.reload} className="m-4" />}
      {settings.error && <FormAlert className="m-3">{settings.error.message}</FormAlert>}
    </div>
  );
}
