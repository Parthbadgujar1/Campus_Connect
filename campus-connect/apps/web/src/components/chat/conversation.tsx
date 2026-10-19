'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  CalendarCheck,
  Camera,
  Copy,
  CornerUpLeft,
  Download,
  Eye,
  FileText,
  Ghost,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  Mic,
  Moon,
  Pause,
  Phone,
  Play,
  Plus,
  Send,
  Smile,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button, IconButton } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/fields';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { chatAmbiences, stickers } from '@/data/chats';
import { getPerson, me } from '@/data/people';
import type { Message } from '@/lib/types';
import { appActions, useAppState } from '@/lib/store';
import { NOW, dayHeading, dayKey, formatTime } from '@/lib/time';
import { gradientFor, hueFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

/*
 * Daylight chat: familiar soft bubbles, with one quiet idea. The background follows the
 * time of day each message was sent (morning peach, afternoon sky, evening lavender,
 * night blue), so scrolling back through a conversation feels like scrolling through days.
 * Extras (snaps, polls, plans, questions) live behind the + button to keep the screen calm.
 */

export type ConversationMode = 'direct' | 'group' | 'anonymous' | 'channel';
type Daypart = 'morning' | 'afternoon' | 'evening' | 'night';

const QUICK_REACTIONS = ['💜', '😂', '🔥', '👍', '🙏'];
const AUTO_REPLIES = ['Haha yes 😄', 'Perfect, see you there!', 'On it 👍', 'Sending it in a minute', 'That works for me ✨'];
const ANSWERS = ['Yes, let’s do that 👍', 'Good question. I think so, will confirm tonight.', 'Not sure yet, checking with the team.'];
const PLAN_WHEN = ['Today evening', 'Tomorrow', 'This weekend'];

const DAYPART: Record<Daypart, { label: string; icon: typeof Sun }> = {
  morning: { label: 'Morning', icon: Sunrise },
  afternoon: { label: 'Afternoon', icon: Sun },
  evening: { label: 'Evening', icon: Sunset },
  night: { label: 'Night', icon: Moon },
};

const HOUR = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' });

function daypartOf(iso: string): Daypart {
  const hour = Number.parseInt(HOUR.format(new Date(iso)), 10);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** Display name for a sender id; anonymous senders are numbered, never named. */
export function senderLabel(from: string): string {
  if (from === 'me') return 'You';
  if (from.startsWith('anon-')) return `Anonymous ${from.slice(-1)}`;
  return getPerson(from).name;
}

const firstName = (from: string) => (from === 'me' ? 'You' : from.startsWith('anon-') ? senderLabel(from) : getPerson(from).name.split(' ')[0]);
const nameColor = (from: string) => (from.startsWith('anon-') ? 'var(--text-3)' : `hsl(${hueFor(from)} 45% 48%)`);

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One short line describing a message, for previews, quotes and the shelf. */
export function describeMessage(m: Message): string {
  switch (m.type) {
    case 'voice':
      return `Voice note · ${clock(m.voiceSeconds ?? 0)}`;
    case 'snap':
      return 'Snap';
    case 'file':
      return m.file?.name ?? 'File';
    case 'poll':
      return `Poll: ${m.poll?.question ?? ''}`;
    case 'ask':
      return `Question: ${m.text ?? ''}`;
    case 'plan':
      return `Plan: ${m.plan?.title ?? ''}`;
    case 'sticker':
      return `${m.sticker ?? ''} sticker`;
    default:
      return m.text ?? '';
  }
}

const EXTRAS = [
  { label: 'Snap', icon: Camera },
  { label: 'Photo', icon: ImageIcon },
  { label: 'Sticker', icon: Smile },
  { label: 'Voice', icon: Mic },
  { label: 'Poll', icon: BarChart3 },
  { label: 'File', icon: FileText },
  { label: 'Plan', icon: CalendarCheck },
  { label: 'Question', icon: HelpCircle },
] as const;
type Extra = (typeof EXTRAS)[number]['label'];

interface Turn {
  key: string;
  from: string;
  messages: Message[];
}

interface Band {
  key: string;
  part: Daypart;
  start: string;
  turns: Turn[];
}

/** Groups messages into daylight bands (same day and time of day), then into speaker turns. */
function buildBands(messages: Message[], breakAt: string | null): Band[] {
  const bands: Band[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const part = daypartOf(m.createdAt);
    if (!prev || dayKey(prev.createdAt) !== dayKey(m.createdAt) || daypartOf(prev.createdAt) !== part) {
      bands.push({ key: m.id, part, start: m.createdAt, turns: [] });
    }
    const band = bands[bands.length - 1]!;
    const last = band.turns[band.turns.length - 1];
    const sameSpeaker = last && last.from === m.from && m.type !== 'system' && last.messages[0]?.type !== 'system' && m.id !== breakAt;
    if (sameSpeaker) last.messages.push(m);
    else band.turns.push({ key: m.id, from: m.from, messages: [m] });
  });
  return bands;
}

export function ConversationView({
  id,
  title,
  subtitle,
  avatar,
  initialMessages,
  mode,
  memberIds,
  backHref,
  replyFrom,
  placeholder,
  unread = 0,
}: {
  id: string;
  title: string;
  subtitle?: string;
  avatar: ReactNode;
  initialMessages: Message[];
  mode: ConversationMode;
  memberIds: string[];
  backHref: string;
  replyFrom?: string;
  placeholder?: string;
  /** How many of the latest messages arrived while the viewer was away. */
  unread?: number;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [tray, setTray] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planWhen, setPlanWhen] = useState(PLAN_WHEN[0]!);
  const [planWhere, setPlanWhere] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [timer, setTimer] = useState<'off' | '24h' | '7d'>('off');
  const [shelfOpen, setShelfOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [viewingSnap, setViewingSnap] = useState<Message | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [rsvp, setRsvp] = useState<Record<string, 'in' | 'out'>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [firstUnread] = useState<string | null>(() => {
    if (unread <= 0) return null;
    return initialMessages.slice(-unread).find((m) => m.from !== 'me')?.id ?? null;
  });
  const muted = useAppState((s) => s.muted.includes(id));
  const ambienceId = useAppState((s) => s.chatThemes[id] ?? 'none');
  const opened = useAppState((s) => s.openedSnaps);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const counter = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, typing]);

  const wash = chatAmbiences.find((a) => a.id === ambienceId)?.wash;
  const bands = buildBands(messages.filter((m) => !hiddenIds.includes(m.id)), firstUnread);
  const showNames = mode !== 'direct';
  const lastMessage = messages[messages.length - 1];
  const answersTo = (askId: string) => messages.filter((m) => m.replyTo === askId).length;

  const shelf = {
    plans: messages.filter((m) => m.type === 'plan'),
    asks: messages.filter((m) => m.type === 'ask'),
    files: messages.filter((m) => m.type === 'file' || m.type === 'poll'),
    kept: messages.filter((m) => kept.includes(m.id)),
  };
  const shelfCount = shelf.plans.length + shelf.asks.length + shelf.files.length + shelf.kept.length;

  const push = (partial: Omit<Message, 'id' | 'chatId' | 'createdAt' | 'from'>, from: string = 'me') => {
    counter.current += 1;
    const message: Message = { id: `local-${counter.current}-${from}`, chatId: id, from, createdAt: NOW.toISOString(), ...partial };
    setMessages((prev) => [...prev, message]);
    if (from === 'me' && mode === 'direct' && replyFrom) {
      // A little life in the prototype: the other person types, then answers.
      window.setTimeout(() => setTyping(true), 600);
      window.setTimeout(() => {
        setTyping(false);
        counter.current += 1;
        const reply: Message = {
          id: `local-${counter.current}-reply`,
          chatId: id,
          from: replyFrom,
          type: 'text',
          text: message.type === 'ask' ? ANSWERS[counter.current % ANSWERS.length] : AUTO_REPLIES[counter.current % AUTO_REPLIES.length],
          replyTo: message.type === 'ask' ? message.id : undefined,
          createdAt: NOW.toISOString(),
        };
        setMessages((prev) => [...prev, reply]);
      }, 2200);
    }
    return message;
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    push({ type: asking ? 'ask' : 'text', text, replyTo: replyTo ?? undefined });
    setDraft('');
    setAsking(false);
    setReplyTo(null);
  };

  const sharePlan = () => {
    const title = planTitle.trim();
    if (!title) return;
    const message = push({ type: 'plan', plan: { title, when: planWhen, where: planWhere.trim() || undefined, going: [] } });
    setRsvp((r) => ({ ...r, [message.id]: 'in' }));
    setPlanTitle('');
    setPlanWhere('');
    setPlanOpen(false);
  };

  const runExtra = (label: Extra) => {
    setExtrasOpen(false);
    if (label === 'Snap') push({ type: 'snap', snap: { seed: `snap-${counter.current}`, caption: 'Library view right now' } });
    if (label === 'Photo') push({ type: 'file', file: { name: 'campus-photo.jpg', size: '2.1 MB' } });
    if (label === 'Sticker') setTray(true);
    if (label === 'Voice') push({ type: 'voice', voiceSeconds: 9 });
    if (label === 'Poll') push({ type: 'poll', poll: { question: 'Which time works?', options: [{ label: 'Morning', votes: 0 }, { label: 'Evening', votes: 0 }] } });
    if (label === 'File') push({ type: 'file', file: { name: 'notes-unit3.pdf', size: '640 KB' } });
    if (label === 'Plan') setPlanOpen(true);
    if (label === 'Question') {
      setAsking(true);
      inputRef.current?.focus();
    }
  };

  const react = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions: { ...m.reactions, [emoji]: (m.reactions?.[emoji] ?? 0) + 1 } } : m)),
    );
    setSelected(null);
  };

  const jumpTo = (messageId: string) => {
    setShelfOpen(false);
    setFlash(messageId);
    window.setTimeout(() => document.getElementById(`msg-${messageId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
    window.setTimeout(() => setFlash((f) => (f === messageId ? null : f)), 1600);
  };

  const replyingTo = replyTo ? messages.find((m) => m.id === replyTo) : undefined;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="pt-safe relative z-10 flex items-center gap-2 border-b border-border bg-[var(--surface-solid)] px-3 py-2.5 md:px-5">
        <Link
          href={backHref}
          aria-label="Back"
          className={cn('press grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-2 hover:bg-surface-2', mode !== 'channel' && 'md:hidden')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <button type="button" onClick={() => setInfoOpen(true)} className="press flex min-w-0 flex-1 items-center gap-3 rounded-full py-1 pr-2 text-left" aria-label="Conversation details">
          {avatar}
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold leading-tight">{title}</span>
            <span className="block truncate text-xs text-text-3">{typing && replyFrom ? 'typing…' : subtitle}</span>
          </span>
        </button>
        {mode !== 'anonymous' && (
          <IconButton label="Call" onClick={() => setCallOpen(true)}>
            <Phone className="h-[19px] w-[19px]" />
          </IconButton>
        )}
        <IconButton label={`Shelf: ${shelfCount} shared things`} onClick={() => setShelfOpen(true)} className="relative">
          <Layers className="h-[19px] w-[19px]" />
          {shelfCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}
        </IconButton>
        <IconButton label="Details" onClick={() => setInfoOpen(true)}>
          <Info className="h-[19px] w-[19px]" />
        </IconButton>
      </header>

      {timer !== 'off' && (
        <p className="relative z-10 border-b border-border bg-surface px-4 py-2 text-center text-[13px] text-text-2">
          Messages disappear after {timer === '24h' ? '24 hours' : '7 days'}.
        </p>
      )}

      {/* Daylight bands */}
      <div
        className="no-scrollbar relative z-0 min-h-0 flex-1 overflow-y-auto"
        style={{ background: bands.length ? `var(--day-${bands[bands.length - 1]!.part})` : undefined }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        {wash && wash !== 'transparent' && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: wash }} />}
        {mode === 'anonymous' && (
          <p className="relative mx-auto mt-4 max-w-sm rounded-2xl bg-[var(--surface-solid)] px-4 py-3 text-center text-xs text-text-2 shadow-card">
            Names are hidden in this room. Be kind, don’t share personal details, and report anything abusive.
          </p>
        )}
        {bands.length === 0 && <p className="py-16 text-center text-sm text-text-3">No messages yet.</p>}

        {bands.map((band, index) => {
          const previous = bands[index - 1];
          const Icon = DAYPART[band.part].icon;
          return (
            <section
              key={band.key}
              aria-label={`${DAYPART[band.part].label}, ${dayHeading(band.start)}`}
              className="relative px-3 pb-5 pt-4 md:px-8"
              style={{ background: `linear-gradient(to bottom, var(--day-${previous?.part ?? band.part}), var(--day-${band.part}) 140px)` }}
            >
              <div className="mx-auto max-w-2xl">
                <p className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full bg-[var(--surface-solid)] px-3 py-1 text-[11px] font-semibold text-text-2 shadow-card">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {DAYPART[band.part].label} · {dayHeading(band.start)}
                </p>
                <div className="space-y-3">
                  {band.turns.map((turn) => {
                    if (turn.messages[0]?.type === 'system') {
                      return turn.messages.map((m) => (
                        <p key={m.id} className="mx-auto w-fit rounded-full bg-[var(--surface-solid)] px-3 py-1 text-center text-xs text-text-2">
                          {m.text}
                        </p>
                      ));
                    }
                    const mine = turn.from === 'me';
                    return (
                      <div key={turn.key}>
                        {turn.messages[0]?.id === firstUnread && (
                          <p className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                            <span className="h-px flex-1 bg-accent/40" />
                            New messages
                            <span className="h-px flex-1 bg-accent/40" />
                          </p>
                        )}
                        <div className={cn('flex items-end gap-2', mine && 'justify-end')}>
                          {showNames && !mine && (
                            <span className="mb-5 shrink-0">
                              {turn.from.startsWith('anon-') ? (
                                <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-text-2" aria-hidden="true">
                                  <Ghost className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <Avatar name={senderLabel(turn.from)} seed={turn.from} size="xs" className="h-7 w-7 text-[10px]" />
                              )}
                            </span>
                          )}
                          <div className={cn('flex min-w-0 max-w-[80%] flex-col gap-1 md:max-w-[68%]', mine ? 'items-end' : 'items-start')}>
                            {showNames && !mine && (
                              <span className="px-3 text-xs font-semibold" style={{ color: nameColor(turn.from) }}>
                                {senderLabel(turn.from)}
                              </span>
                            )}
                            {turn.messages.map((m, i) => (
                              <Bubble
                                key={m.id}
                                message={m}
                                mine={mine}
                                first={i === 0}
                                quoted={m.replyTo ? messages.find((x) => x.id === m.replyTo) : undefined}
                                selected={selected === m.id}
                                flash={flash === m.id}
                                kept={kept.includes(m.id)}
                                opened={opened.includes(m.id)}
                                rsvp={rsvp[m.id]}
                                answers={m.type === 'ask' ? answersTo(m.id) : 0}
                                onSelect={() => setSelected((s) => (s === m.id ? null : m.id))}
                                onReact={(emoji) => react(m.id, emoji)}
                                onReply={() => {
                                  setReplyTo(m.id);
                                  setSelected(null);
                                  inputRef.current?.focus();
                                }}
                                onKeep={() => {
                                  setKept((k) => (k.includes(m.id) ? k.filter((x) => x !== m.id) : [...k, m.id]));
                                  setSelected(null);
                                }}
                                onOpenSnap={() => setViewingSnap(m)}
                                onCopy={() => {
                                  navigator.clipboard?.writeText(m.text ?? '');
                                  setSelected(null);
                                  toast('Copied');
                                }}
                                onDelete={() => {
                                  setHiddenIds((h) => [...h, m.id]);
                                  setSelected(null);
                                  toast('Deleted for you');
                                }}
                                onForward={() => {
                                  setForwarding(m);
                                  setSelected(null);
                                }}
                                onRsvp={(value) =>
                                  setRsvp((r) => {
                                    const next = { ...r };
                                    if (next[m.id] === value) delete next[m.id];
                                    else next[m.id] = value;
                                    return next;
                                  })
                                }
                              />
                            ))}
                            <span className="px-2 text-[11px] text-text-3">{formatTime(turn.messages[turn.messages.length - 1]!.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {index === bands.length - 1 && (
                  <>
                    {typing && replyFrom && (
                      <div className="mt-3 flex" aria-live="polite" aria-label={`${firstName(replyFrom)} is typing`}>
                        <span className="flex gap-1 rounded-2xl rounded-bl-md bg-[var(--surface-solid)] px-4 py-3 shadow-card">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-3" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-3" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-3" />
                        </span>
                      </div>
                    )}
                    {mode === 'direct' && lastMessage?.from === 'me' && !typing && replyFrom && <p className="mt-1 text-right text-[11px] text-text-3">Seen</p>}
                  </>
                )}
              </div>
            </section>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        className="pb-safe relative z-10 border-t border-border bg-[var(--surface-solid)] px-3 py-2.5 md:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="mx-auto max-w-2xl">
          {extrasOpen && (
            <div className="animate-rise mb-2.5 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-[var(--surface-solid)] p-3 shadow-float" role="menu" aria-label="Share">
              {EXTRAS.map((extra) => (
                <button key={extra.label} type="button" role="menuitem" onClick={() => runExtra(extra.label)} className="press flex flex-col items-center gap-1.5 rounded-2xl py-2 text-[11px] font-semibold text-text-2 hover:bg-surface-2">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-soft-ink">
                    <extra.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {extra.label}
                </button>
              ))}
            </div>
          )}

          {tray && (
            <div className="animate-rise mb-2.5 rounded-2xl border border-border bg-[var(--surface-solid)] p-3 shadow-float">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold">Stickers</p>
                <IconButton label="Close stickers" onClick={() => setTray(false)} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {stickers.map((sticker) => (
                  <button
                    key={sticker}
                    type="button"
                    aria-label={`Send sticker ${sticker}`}
                    onClick={() => {
                      push({ type: 'sticker', sticker });
                      setTray(false);
                    }}
                    className="press grid aspect-square place-items-center rounded-2xl text-[26px] hover:bg-surface-2"
                  >
                    {sticker}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(replyingTo || asking) && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-xs">
              {asking ? <HelpCircle className="h-4 w-4 shrink-0 text-info" aria-hidden="true" /> : <CornerUpLeft className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate text-text-2">
                {asking ? (
                  'Asking a question. Replies will show it as answered.'
                ) : (
                  <>
                    Replying to <span className="font-semibold text-text">{firstName(replyingTo!.from)}</span>: {describeMessage(replyingTo!)}
                  </>
                )}
              </span>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => {
                  setReplyTo(null);
                  setAsking(false);
                }}
                className="grid h-6 w-6 place-items-center rounded-full text-text-3 hover:bg-surface-3"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              type="button"
              aria-label={extrasOpen ? 'Close share menu' : 'Share a snap, photo, sticker, voice note, poll, file, plan or question'}
              aria-expanded={extrasOpen}
              onClick={() => {
                setExtrasOpen((o) => !o);
                setTray(false);
              }}
              className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2"
            >
              <Plus className={cn('h-5 w-5 transition-transform duration-300', extrasOpen && 'rotate-45')} />
            </button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message</span>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setExtrasOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={asking ? 'Type your question…' : (placeholder ?? (mode === 'anonymous' ? 'Say it anonymously…' : 'Message'))}
                className="max-h-32 min-h-11 w-full resize-none rounded-2xl border border-border bg-bg px-4 py-2.5 text-[15px] placeholder:text-text-3 focus:border-accent focus:outline-none"
              />
            </label>
            {draft.trim() ? (
              <button type="submit" aria-label="Send" className="animate-pop press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                <Send className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" aria-label="Send a voice note" onClick={() => push({ type: 'voice', voiceSeconds: 6 })} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2">
                <Mic className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </form>

      <Sheet open={callOpen} onClose={() => setCallOpen(false)} title="Call" description={mode === 'direct' ? title : 'Start a call with this group'}>
        <div className="grid gap-3">
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setCallOpen(false)}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-accent-ink"
          >
            <Video className="h-4 w-4" aria-hidden="true" />
            Video call on Google Meet
          </a>
          <a
            href={`https://meet.jit.si/campusconnect-${id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setCallOpen(false)}
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-border text-[15px] font-semibold"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call on Jitsi (no account needed)
          </a>
          <p className="text-center text-[13px] text-text-3">Calls open in a new tab. Nothing is recorded.</p>
        </div>
      </Sheet>

      <Sheet open={forwarding !== null} onClose={() => setForwarding(null)} title="Forward to" description="Choose a conversation">
        <ul className="space-y-1">
          {['Pooja Kulkarni', 'DSA Interview Prep', 'Hostel B3 · Flatmates', 'Anonymous lounge'].map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => {
                  toast(`Forwarded to ${name} (preview)`);
                  setForwarding(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[16px] hover:bg-surface-2"
              >
                <Avatar name={name} seed={name} size="sm" />
                {name}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Share a plan"
        description="People can tap I’m in"
        footer={
          <Button full disabled={!planTitle.trim()} onClick={sharePlan}>
            Share plan
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="What" htmlFor="plan-title">
            <Input id="plan-title" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} placeholder="Lunch at the canteen" />
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">When</p>
            <div className="flex flex-wrap gap-2">
              {PLAN_WHEN.map((when) => (
                <button
                  key={when}
                  type="button"
                  aria-pressed={planWhen === when}
                  onClick={() => setPlanWhen(when)}
                  className={cn('press h-9 rounded-full border px-3.5 text-[13px] font-semibold', planWhen === when ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border text-text-2')}
                >
                  {when}
                </button>
              ))}
            </div>
          </div>
          <Field label="Where (optional)" htmlFor="plan-where">
            <Input id="plan-where" value={planWhere} onChange={(e) => setPlanWhere(e.target.value)} placeholder="Main canteen" />
          </Field>
        </div>
      </Sheet>

      <Sheet open={shelfOpen} onClose={() => setShelfOpen(false)} title="Shelf" description="Everything shared here, in one place">
        {shelfCount === 0 ? (
          <p className="py-8 text-center text-sm text-text-3">Plans, questions, files and saved messages collect here.</p>
        ) : (
          <div className="space-y-5">
            {(
              [
                { title: 'Plans', items: shelf.plans, icon: CalendarCheck },
                { title: 'Questions', items: shelf.asks, icon: HelpCircle },
                { title: 'Files and polls', items: shelf.files, icon: FileText },
                { title: 'Saved', items: shelf.kept, icon: Bookmark },
              ] as const
            ).map(
              (group) =>
                group.items.length > 0 && (
                  <div key={group.title}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-3">{group.title}</p>
                    <ul className="space-y-1">
                      {group.items.map((m) => (
                        <li key={m.id}>
                          <button type="button" onClick={() => jumpTo(m.id)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
                              <group.icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{m.type === 'plan' ? m.plan?.title : describeMessage(m)}</span>
                              <span className="block truncate text-xs text-text-3">
                                {firstName(m.from)} · {formatTime(m.createdAt)}
                                {m.type === 'plan' && ` · ${m.plan?.when}`}
                                {m.type === 'ask' && (answersTo(m.id) ? ' · answered' : ' · waiting for an answer')}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title={title} description={subtitle}>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold">Extra colour wash</p>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Conversation colour wash">
              {chatAmbiences.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={ambienceId === a.id}
                  onClick={() => appActions.setChatTheme(id, a.id)}
                  className={cn('press flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-[11px] font-semibold', ambienceId === a.id ? 'border-accent' : 'border-border')}
                >
                  <span className="h-10 w-full rounded-xl border border-border bg-surface" style={{ background: a.wash === 'transparent' ? undefined : a.wash }} />
                  {a.name}
                </button>
              ))}
            </div>
          </div>
          {mode !== 'direct' && mode !== 'anonymous' && (
            <div>
              <p className="mb-2 text-sm font-semibold">Disappearing messages</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Disappearing messages">
                {(
                  [
                    { value: 'off', label: 'Off' },
                    { value: '24h', label: '24 hours' },
                    { value: '7d', label: '7 days' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={timer === option.value}
                    onClick={() => setTimer(option.value)}
                    className={cn('press h-10 rounded-xl border text-[14px] font-semibold', timer === option.value ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border text-text-2')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mode !== 'direct' && mode !== 'anonymous' && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">Invite link</p>
                <p className="truncate text-[13px] text-text-3">campusconnect.app/join/{id}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => toast('Invite link copied')}>
                Copy
              </Button>
            </div>
          )}
          {memberIds.length > 1 && mode !== 'anonymous' && (
            <div>
              <p className="mb-2 text-sm font-semibold">People here</p>
              <ul className="space-y-2">
                {memberIds.map((memberId, index) => (
                  <li key={memberId} className="flex items-center gap-3 text-sm">
                    <Avatar name={memberId === 'me' ? me.name : getPerson(memberId).name} seed={memberId === 'me' ? me.id : memberId} size="sm" />
                    <span className="font-medium">{memberId === 'me' ? 'You' : getPerson(memberId).name}</span>
                    {index === 0 && mode !== 'direct' && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-soft-ink">Admin</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                appActions.toggleMuted(id);
                toast(muted ? 'Notifications on' : 'Muted');
              }}
            >
              {muted ? 'Unmute' : 'Mute'}
            </Button>
            <Button variant="danger" onClick={() => toast('Report sent to moderators (preview)')}>
              Report
            </Button>
          </div>
        </div>
      </Sheet>

      {viewingSnap && (
        <SnapViewer
          message={viewingSnap}
          onDone={() => {
            appActions.openSnap(viewingSnap.id);
            setViewingSnap(null);
          }}
        />
      )}
    </div>
  );
}

/** A single message. Text sits in a soft bubble; cards (voice, files, plans…) stand on their own. */
function Bubble({
  message,
  mine,
  first,
  quoted,
  selected,
  flash,
  kept,
  opened,
  rsvp,
  answers,
  onSelect,
  onReact,
  onReply,
  onKeep,
  onOpenSnap,
  onRsvp,
  onCopy,
  onDelete,
  onForward,
}: {
  message: Message;
  mine: boolean;
  first: boolean;
  quoted?: Message;
  selected: boolean;
  flash: boolean;
  kept: boolean;
  opened: boolean;
  rsvp?: 'in' | 'out';
  answers: number;
  onSelect: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onKeep: () => void;
  onOpenSnap: () => void;
  onRsvp: (value: 'in' | 'out') => void;
  onCopy: () => void;
  onDelete: () => void;
  onForward: () => void;
}) {
  const reactions = message.reactions ? Object.entries(message.reactions) : [];
  const isText = message.type === 'text';
  // Bubbles in one turn hug each other: the corners on the speaker's side are tighter.
  const corner = mine ? cn('rounded-br-md', !first && 'rounded-tr-md') : cn('rounded-bl-md', !first && 'rounded-tl-md');

  return (
    <div id={`msg-${message.id}`} className={cn('animate-rise relative flex max-w-full flex-col scroll-mt-24', mine ? 'items-end' : 'items-start')}>
      {selected && (
        <div
          className={cn('animate-pop absolute bottom-full z-20 mb-1.5 flex items-center gap-0.5 rounded-full border border-border bg-[var(--surface-solid)] p-1 shadow-float', mine ? 'right-0' : 'left-0')}
          role="toolbar"
          aria-label="Message actions"
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" aria-label={`React ${emoji}`} onClick={() => onReact(emoji)} className="press grid h-8 w-8 place-items-center rounded-full text-base hover:bg-surface-2">
              {emoji}
            </button>
          ))}
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
          <button type="button" onClick={onReply} aria-label="Reply" className="press grid h-8 w-8 place-items-center rounded-full text-text-2 hover:bg-surface-2">
            <CornerUpLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onKeep} aria-label={kept ? 'Remove from saved' : 'Save'} aria-pressed={kept} className="press grid h-8 w-8 place-items-center rounded-full text-text-2 hover:bg-surface-2">
            <Bookmark className={cn('h-4 w-4', kept && 'fill-current text-accent')} />
          </button>
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
          <button type="button" onClick={onForward} aria-label="Forward" className="press grid h-8 w-8 place-items-center rounded-full text-text-2 hover:bg-surface-2">
            <Send className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCopy} aria-label="Copy" className="press grid h-8 w-8 place-items-center rounded-full text-text-2 hover:bg-surface-2">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete for me" className="press grid h-8 w-8 place-items-center rounded-full text-danger hover:bg-danger-soft">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {isText ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`${message.text ?? ''}. Tap for reactions, reply and keep`}
          className={cn(
            'max-w-full whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-left text-[15px] leading-relaxed shadow-card',
            corner,
            mine ? 'bg-accent text-accent-ink' : 'bg-[var(--surface-solid)] text-text',
            flash && 'ring-4 ring-accent/40',
          )}
        >
          {quoted && (
            <span className={cn('mb-1.5 block border-l-2 pl-2 text-[12.5px] leading-snug', mine ? 'border-white/60 opacity-85' : 'border-accent text-text-2')}>
              <span className="block font-semibold">{firstName(quoted.from)}</span>
              <span className="line-clamp-2">{describeMessage(quoted)}</span>
            </span>
          )}
          {renderMentions(message.text ?? '', mine)}
          {kept && <Bookmark className="ml-1.5 inline h-3 w-3 fill-current align-[-1px] opacity-70" aria-label="Saved" />}
        </button>
      ) : (
        <div className={cn('flex max-w-full items-center gap-1.5', mine && 'flex-row-reverse', flash && 'rounded-2xl ring-4 ring-accent/40')}>
          <Card message={message} opened={opened} rsvp={rsvp} answers={answers} onSelect={onSelect} onOpenSnap={onOpenSnap} onRsvp={onRsvp} />
          <button type="button" onClick={onSelect} aria-label="React, reply or keep" aria-expanded={selected} className="press grid h-7 w-7 shrink-0 place-items-center rounded-full text-text-3 hover:bg-[var(--surface-solid)]">
            <Smile className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {reactions.length > 0 && (
        <span className={cn('-mt-1.5 flex gap-1 px-2', mine ? 'justify-end' : 'justify-start')}>
          {reactions.map(([emoji, count]) => (
            <button key={emoji} type="button" onClick={() => onReact(emoji)} aria-label={`${emoji} ${count}. Add yours`} className="animate-pop rounded-full border border-border bg-[var(--surface-solid)] px-1.5 py-px text-xs shadow-card">
              {emoji} {count > 1 && <span className="text-text-3">{count}</span>}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

function Card({
  message,
  opened,
  rsvp,
  answers,
  onSelect,
  onOpenSnap,
  onRsvp,
}: {
  message: Message;
  opened: boolean;
  rsvp?: 'in' | 'out';
  answers: number;
  onSelect: () => void;
  onOpenSnap: () => void;
  onRsvp: (value: 'in' | 'out') => void;
}) {
  switch (message.type) {
    case 'ask':
      return (
        <button type="button" onClick={onSelect} className="block w-72 max-w-full rounded-2xl bg-[var(--surface-solid)] p-3.5 text-left shadow-card">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-info">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Question
          </span>
          <span className="mt-1 block text-[15px] font-semibold leading-snug">{renderMentions(message.text ?? '', false)}</span>
          <span className={cn('mt-2 inline-flex items-center gap-1.5 text-xs font-semibold', answers ? 'text-success' : 'text-text-3')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', answers ? 'bg-success' : 'bg-text-3')} aria-hidden="true" />
            {answers ? `Answered · ${answers} ${answers === 1 ? 'reply' : 'replies'}` : 'Waiting for an answer'}
          </span>
        </button>
      );
    case 'plan': {
      const plan = message.plan!;
      const going = [...plan.going.filter((p) => p !== 'me'), ...(rsvp === 'in' ? ['me'] : [])];
      return (
        <div className="w-72 max-w-full overflow-hidden rounded-2xl bg-[var(--surface-solid)] shadow-card">
          <div className="flex items-start gap-3 p-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-snug">{plan.title}</span>
              <span className="mt-0.5 block text-xs text-text-3">
                {plan.when}
                {plan.where && ` · ${plan.where}`}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
            <span className="flex -space-x-1.5">
              {going.slice(0, 4).map((p) => (
                <Avatar key={p} name={p === 'me' ? me.name : getPerson(p).name} seed={p === 'me' ? me.id : p} size="xs" className="ring-2 ring-[var(--surface-solid)]" />
              ))}
            </span>
            <span className="flex-1 text-xs text-text-3">{going.length ? `${going.length} in` : 'Be the first'}</span>
            <button type="button" aria-pressed={rsvp === 'in'} onClick={() => onRsvp('in')} className={cn('press h-8 rounded-full px-3 text-xs font-semibold', rsvp === 'in' ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2')}>
              I’m in
            </button>
            <button type="button" aria-pressed={rsvp === 'out'} onClick={() => onRsvp('out')} className={cn('press h-8 rounded-full px-3 text-xs font-semibold', rsvp === 'out' ? 'bg-text text-bg' : 'text-text-3 hover:bg-surface-2')}>
              Can’t
            </button>
          </div>
        </div>
      );
    }
    case 'sticker':
      return (
        <span className="animate-pop inline-block text-[52px] leading-none" role="img" aria-label={`Sticker ${message.sticker}`}>
          {message.sticker}
        </span>
      );
    case 'snap':
      return opened || !message.snap ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-solid)] px-3 py-1.5 text-xs font-semibold text-text-3 shadow-card">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Snap opened
        </p>
      ) : (
        <button
          type="button"
          onClick={onOpenSnap}
          className="press relative flex h-14 w-60 max-w-full items-center gap-3 overflow-hidden rounded-2xl px-3 text-left text-white shadow-card"
          style={{ background: gradientFor(message.snap.seed) }}
          aria-label="Open snap. It can be viewed once"
        >
          <span className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-white/80">
            <Camera className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="relative">
            <span className="block text-sm font-semibold">Snap · tap to view</span>
            <span className="block text-[11px] text-white/80">Views once</span>
          </span>
        </button>
      );
    case 'voice':
      return <VoiceNote seconds={message.voiceSeconds ?? 0} />;
    case 'file':
      return message.file ? (
        <span className="inline-flex max-w-full items-center gap-3 rounded-2xl bg-[var(--surface-solid)] px-3 py-2.5 text-left shadow-card">
          <FileText className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{message.file.name}</span>
            <span className="block text-xs text-text-3">{message.file.size}</span>
          </span>
          <Download className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
        </span>
      ) : null;
    case 'poll':
      return message.poll ? <InlinePoll poll={message.poll} /> : null;
    default:
      return null;
  }
}

/** Highlights @mentions in message text. */
function renderMentions(text: string, mine: boolean) {
  return text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className={cn('rounded-md px-1 font-semibold', mine ? 'bg-white/20' : 'bg-accent-soft text-accent-soft-ink')}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function InlinePoll({ poll }: { poll: NonNullable<Message['poll']> }) {
  const total = Math.max(1, poll.options.reduce((sum, o) => sum + o.votes, 0));
  return (
    <span className="block w-72 max-w-full space-y-1.5 rounded-2xl bg-[var(--surface-solid)] p-3 text-left shadow-card">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-3">
        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
        Poll
      </span>
      <span className="block text-sm font-semibold">{poll.question}</span>
      {poll.options.map((option) => {
        const pct = Math.round((option.votes / total) * 100);
        return (
          <span key={option.label} className="relative block overflow-hidden rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="animate-grow-x absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${pct}%` }} aria-hidden="true" />
            <span className="relative flex justify-between gap-3">
              <span>{option.label}</span>
              <span className="font-semibold">{pct}%</span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

function VoiceNote({ seconds }: { seconds: number }) {
  const [playing, setPlaying] = useState(false);
  const bars = Array.from({ length: 28 }, (_, i) => 5 + ((i * 37) % 17));
  return (
    <span className="inline-flex w-64 max-w-full items-center gap-3 rounded-full bg-[var(--surface-solid)] py-1.5 pl-1.5 pr-4 shadow-card">
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
      </button>
      <span className="flex h-7 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden="true">
        {bars.map((h, i) => (
          <span key={i} className={cn('w-[3px] shrink-0 rounded-full transition-colors duration-500', playing && i < 12 ? 'bg-accent' : 'bg-text-3/60')} style={{ height: h }} />
        ))}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-text-3">{clock(seconds)}</span>
    </span>
  );
}

/** Full-screen view-once snap with a countdown ring. */
function SnapViewer({ message, onDone }: { message: Message; onDone: () => void }) {
  const reduce = useAppState((s) => s.reduceMotion);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Snap" className="animate-fade fixed inset-0 z-[85] grid place-items-center bg-black/85">
      <div className="relative flex h-dvh w-full max-w-[440px] flex-col items-center justify-center overflow-hidden text-white md:h-[min(820px,92dvh)] md:rounded-3xl" style={{ background: gradientFor(message.snap?.seed ?? message.id) }}>
        <div className="pt-safe absolute left-0 right-0 top-0 flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Avatar name={senderLabel(message.from)} seed={message.from} size="sm" />
            {senderLabel(message.from)}
          </span>
          <span className="relative grid h-10 w-10 place-items-center">
            <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="20" cy="20" r="17" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="3" />
              <circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeDasharray="107"
                style={reduce ? undefined : { animation: 'snap-countdown 5s linear forwards' }}
                onAnimationEnd={reduce ? undefined : onDone}
              />
            </svg>
            <button type="button" onClick={onDone} aria-label="Close snap" className="relative grid h-8 w-8 place-items-center rounded-full">
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
        <p className="animate-rise px-8 text-center text-[28px] font-semibold leading-tight drop-shadow">{message.snap?.caption}</p>
        <p className="absolute bottom-10 text-xs font-semibold text-white/80">This snap disappears after you close it</p>
      </div>
    </div>,
    document.body,
  );
}
