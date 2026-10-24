'use client';

import { useState } from 'react';
import { Check, Link2, Search, Send, Share2 } from 'lucide-react';
import { clientId, errorMessage, get, post } from '@/lib/api/client';
import { invalidate, useQuery, type Page } from '@/lib/api/hooks';
import type { ChatListItem } from '@/lib/api/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ErrorState, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ChatAvatar } from '@/components/chat/chat-list';
import { cn } from '@/lib/utils';

/** Send a loop to chats (one or several), copy its link, or use the phone's share sheet. */
export function ShareSheet({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const chats = useQuery<Page<ChatListItem>>(`share:chats:${q}`, (signal) => get('/chats', { q: q || undefined, limit: 30 }, signal));
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

  const sendNow = async () => {
    if (!picked.length) return;
    setSending(true);
    try {
      const body = note.trim() ? `${note.trim()}\n${url}` : url;
      await Promise.all(picked.map((id) => post(`/chats/${id}/messages`, { clientId: clientId(), kind: 'text', body })));
      invalidate('chats:list');
      toast(picked.length === 1 ? 'Sent' : `Sent to ${picked.length} chats`);
      onClose();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast('Could not copy the link');
    }
  };
  const shareOut = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // Closed the share sheet.
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Share"
      footer={
        picked.length ? (
          <div className="w-full space-y-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Write a message (optional)" aria-label="Message" className="h-11 w-full rounded-full border border-border bg-surface px-4 text-[15px] focus:border-accent focus:outline-none" />
            <Button full onClick={() => void sendNow()} disabled={sending}>{sending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />} Send{picked.length > 1 ? ` to ${picked.length}` : ''}</Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void copy()}><Link2 className="h-4 w-4" aria-hidden="true" /> Copy link</Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button variant="secondary" size="sm" onClick={() => void shareOut()}><Share2 className="h-4 w-4" aria-hidden="true" /> More options</Button>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-[15px] focus:border-accent focus:outline-none" />
        </div>
        {chats.loading && <SkeletonList variant="row" count={4} />}
        {chats.error && <ErrorState error={chats.error} onRetry={chats.reload} compact />}
        {chats.data && !chats.data.items.length && <p className="py-6 text-center text-[14px] text-text-3">{q ? 'No chats match.' : 'No chats yet. Start one in Chats.'}</p>}
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {chats.data?.items.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setPicked((list) => (on ? list.filter((x) => x !== c.id) : [...list, c.id]))} aria-pressed={on} className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-2 text-center hover:bg-surface-2">
                  <span className="relative">
                    <ChatAvatar chat={c} size="lg" />
                    {on && <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--surface-solid)] bg-accent text-accent-ink"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>}
                  </span>
                  <span className={cn('line-clamp-2 text-[12px]', on ? 'font-semibold' : 'text-text-2')}>{c.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
