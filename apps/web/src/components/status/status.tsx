'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, ImageIcon, Plus, Send, Trash2, Type, X } from 'lucide-react';
import { clientId, del, errorMessage, get, post, uploadWithProgress } from '@/lib/api/client';
import { invalidate, useQuery } from '@/lib/api/hooks';
import type { FileView, PersonSummary } from '@/lib/api/types';
import type { StatusBackground, StatusFeed, StatusGroup, StatusItem } from '@/lib/api/modules';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Textarea } from '@/components/ui/fields';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ensureDuration, formatBytes } from '@/components/loops/media';
import { useSession } from '@/lib/session';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

// Status, like WhatsApp: photos, short videos or coloured text that disappear after 24 hours.
// People who follow you see yours; you see the statuses of people you follow.

export const BACKGROUNDS: Record<StatusBackground, string> = {
  violet: 'linear-gradient(160deg,#7c3aed,#4f46e5)',
  blue: 'linear-gradient(160deg,#2563eb,#0891b2)',
  green: 'linear-gradient(160deg,#059669,#65a30d)',
  rose: 'linear-gradient(160deg,#e11d48,#db2777)',
  amber: 'linear-gradient(160deg,#d97706,#ea580c)',
  slate: 'linear-gradient(160deg,#334155,#0f172a)',
};
const IMAGE_MS = 5000;

function Ring({ person, seen, size = 'md', children }: { person: PersonSummary; seen: boolean; size?: 'sm' | 'md'; children?: React.ReactNode }) {
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full p-[2.5px]', seen ? 'bg-border' : 'bg-[conic-gradient(from_200deg,#7c3aed,#ec4899,#f59e0b,#22c55e,#7c3aed)]')}>
      <span className="rounded-full bg-[var(--surface-solid)] p-[2px]"><PersonAvatar person={person} size={size} /></span>
      {children}
    </span>
  );
}

/** The row of statuses at the top of Chats. */
export function StatusStrip() {
  const { user } = useSession();
  const feed = useQuery<StatusFeed>('status:feed', (signal) => get('/status', undefined, signal), { refreshMs: 60_000 });
  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<{ groups: StatusGroup[]; index: number } | null>(null);
  if (!user) return null;
  const me: PersonSummary = { id: user.id, username: user.profile.username, displayName: user.profile.displayName, avatarUrl: user.profile.avatarUrl, role: user.role, isVerified: user.profile.isVerified, year: user.profile.year, department: user.profile.department };
  const mine = feed.data?.mine;
  const updates = feed.data?.updates ?? [];
  return (
    <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1" aria-label="Status updates">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1">
        <span className="relative">
          {mine ? (
            <button type="button" onClick={() => setViewing({ groups: [mine], index: 0 })} aria-label="View my status"><Ring person={me} seen={mine.allSeen} /></button>
          ) : (
            <button type="button" onClick={() => setComposing(true)} aria-label="Add a status"><Ring person={me} seen /></button>
          )}
          <button type="button" onClick={() => setComposing(true)} aria-label="Add to my status" className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--surface-solid)] bg-accent text-accent-ink"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </span>
        <span className="w-full truncate text-center text-[11px] font-semibold">My status</span>
      </div>
      {feed.loading && <SkeletonList variant="row" count={1} className="w-40" />}
      {updates.map((g, i) => (
        <button key={g.person.id} type="button" onClick={() => setViewing({ groups: updates, index: i })} className="flex w-16 shrink-0 flex-col items-center gap-1" aria-label={`${g.person.displayName}'s status${g.allSeen ? '' : ', new'}`}>
          <Ring person={g.person} seen={g.allSeen} />
          <span className={cn('w-full truncate text-center text-[11px]', g.allSeen ? 'text-text-3' : 'font-semibold')}>{g.person.displayName.split(' ')[0]}</span>
        </button>
      ))}
      {!feed.loading && !updates.length && <p className="self-center text-[12px] text-text-3">Follow people to see their status here.</p>}
      {composing && <StatusComposer onClose={() => setComposing(false)} onPosted={() => { setComposing(false); invalidate('status:'); }} />}
      {viewing && <StatusViewer groups={viewing.groups} start={viewing.index} meId={user.id} onClose={() => { setViewing(null); invalidate('status:'); }} />}
    </div>
  );
}

function ViewersSheet({ statusId, onClose }: { statusId: string; onClose: () => void }) {
  const list = useQuery<{ items: Array<{ person: PersonSummary; viewedAt: string }> }>(`status:viewers:${statusId}`, (signal) => get(`/status/${statusId}/viewers`, undefined, signal));
  return (
    <Sheet open onClose={onClose} title={list.data ? `Viewed by ${list.data.items.length}` : 'Viewed by'}>
      {list.loading && <SkeletonList variant="row" count={3} />}
      {list.data && !list.data.items.length && <p className="py-6 text-center text-[14px] text-text-3">No views yet.</p>}
      <ul className="divide-y divide-border">
        {list.data?.items.map((v) => (
          <li key={v.person.id} className="flex items-center gap-3 py-2.5">
            <PersonAvatar person={v.person} size="sm" link />
            <span className="min-w-0 flex-1 truncate font-semibold">{v.person.displayName}</span>
            <span className="text-[12px] text-text-3">{ago(v.viewedAt)}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Full-screen viewer: tap right/left for next/previous, hold to pause, reply to send a message. */
export function StatusViewer({ groups, start, meId, onClose }: { groups: StatusGroup[]; start: number; meId: string; onClose: () => void }) {
  const toast = useToast();
  const [g, setG] = useState(start);
  const [i, setI] = useState(() => Math.max(0, groups[start]?.items.findIndex((x) => !x.seen) ?? 0));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [viewers, setViewers] = useState(false);
  const [deleted, setDeleted] = useState<string[]>([]);
  const video = useRef<HTMLVideoElement | null>(null);
  const startedAt = useRef(0);
  const elapsed = useRef(0);
  const group = groups[g];
  const items = useMemo(() => (group?.items ?? []).filter((x) => !deleted.includes(x.id)), [group, deleted]);
  const item: StatusItem | undefined = items[i];
  const mine = group?.person.id === meId;

  const next = useCallback(() => {
    setProgress(0);
    elapsed.current = 0;
    if (i < items.length - 1) setI(i + 1);
    else if (g < groups.length - 1) {
      setG(g + 1);
      setI(Math.max(0, groups[g + 1]!.items.findIndex((x) => !x.seen)));
    } else onClose();
  }, [i, items.length, g, groups, onClose]);
  const prev = () => {
    setProgress(0);
    elapsed.current = 0;
    if (i > 0) setI(i - 1);
    else if (g > 0) {
      setG(g - 1);
      setI(0);
    }
  };

  // Mark as seen.
  useEffect(() => {
    if (item && !mine && !item.seen) void post(`/status/${item.id}/view`).catch(() => undefined);
  }, [item, mine]);

  // Timer for photos and text; videos follow their own length.
  useEffect(() => {
    if (!item || item.kind === 'video' || paused || viewers) return;
    startedAt.current = performance.now() - elapsed.current;
    let raf = 0;
    const tick = () => {
      elapsed.current = performance.now() - startedAt.current;
      const p = Math.min(1, elapsed.current / IMAGE_MS);
      setProgress(p);
      if (p >= 1) next();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [item, paused, viewers, next]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (paused || viewers) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, viewers, item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest?.('input, textarea')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sendReply = async () => {
    if (!reply.trim() || !group) return;
    try {
      const { chatId } = await post<{ chatId: string }>('/chats/direct', { userId: group.person.id });
      const quote = item?.kind === 'text' ? `“${(item.text ?? '').slice(0, 60)}”` : item?.kind === 'video' ? 'a video' : 'a photo';
      await post(`/chats/${chatId}/messages`, { clientId: clientId(), kind: 'text', body: `↩️ Replying to your status (${quote})\n${reply.trim()}` });
      setReply('');
      invalidate('chats:list');
      toast('Reply sent');
    } catch (err) {
      toast(errorMessage(err));
    }
  };
  const remove = async () => {
    if (!item) return;
    try {
      await del(`/status/${item.id}`);
      setDeleted((d) => [...d, item.id]);
      toast('Status deleted');
      if (items.length <= 1) onClose();
      else if (i >= items.length - 1) setI(i - 1);
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  if (!group || !item || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black text-white" role="dialog" aria-modal="true" aria-label={`${group.person.displayName}'s status`}>
      <div className="relative flex h-full w-full flex-col md:aspect-[9/16] md:h-[94dvh] md:w-auto md:overflow-hidden md:rounded-2xl" style={item.kind === 'text' ? { background: BACKGROUNDS[item.background] } : undefined}>
        {/* Progress */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          {items.map((x, k) => (
            <span key={x.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
              <span className="block h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))]">
          <PersonAvatar person={group.person} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{mine ? 'My status' : group.person.displayName}</span>
            <span className="block text-[12px] text-white/75">{ago(item.createdAt)}</span>
          </span>
          {mine && <button type="button" onClick={() => void remove()} aria-label="Delete this status" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><Trash2 className="h-5 w-5" aria-hidden="true" /></button>}
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {item.kind === 'text' && <p className="max-w-md whitespace-pre-wrap px-8 text-center text-[26px] font-bold leading-snug">{item.text}</p>}
          {item.kind === 'image' && item.file?.url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.file.url} alt={item.caption ?? 'Status photo'} className="max-h-full max-w-full object-contain" />}
          {item.kind === 'video' && item.file?.url && (
            <video
              ref={video}
              key={item.id}
              src={item.file.url}
              autoPlay
              playsInline
              onLoadedMetadata={(e) => void ensureDuration(e.currentTarget).then(() => void e.currentTarget.play().catch(() => undefined))}
              onTimeUpdate={(e) => Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 && setProgress(e.currentTarget.currentTime / e.currentTarget.duration)}
              onEnded={next}
              className="max-h-full max-w-full object-contain"
            />
          )}
          {/* Tap zones: left third back, the rest forward; hold anywhere to pause. */}
          <div className="absolute inset-0 grid grid-cols-3" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
            <button type="button" onClick={prev} aria-label="Previous" className="h-full" />
            <button type="button" onClick={next} aria-label="Next" className="col-span-2 h-full" />
          </div>
        </div>
        {item.caption && <p className="z-10 bg-black/40 px-4 py-2 text-center text-[15px]">{item.caption}</p>}

        <footer className="z-10 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {mine ? (
            <button type="button" onClick={() => setViewers(true)} className="mx-auto flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[14px] font-semibold">
              <Eye className="h-4 w-4" aria-hidden="true" /> {item.viewsCount ?? 0} view{item.viewsCount === 1 ? '' : 's'}
            </button>
          ) : (
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void sendReply(); }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} maxLength={1000} placeholder="Reply…" aria-label="Reply to status" className="h-11 min-w-0 flex-1 rounded-full border border-white/40 bg-black/30 px-4 text-[15px] text-white placeholder:text-white/60 focus:border-white focus:outline-none" />
              <button type="submit" disabled={!reply.trim()} aria-label="Send reply" className="grid h-11 w-11 place-items-center rounded-full bg-white text-black disabled:opacity-50"><Send className="h-5 w-5" aria-hidden="true" /></button>
            </form>
          )}
        </footer>
      </div>
      {viewers && <ViewersSheet statusId={item.id} onClose={() => setViewers(false)} />}
    </div>,
    document.body,
  );
}

/** Post a status: coloured text, or a photo / short video with a caption. */
export function StatusComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [background, setBackground] = useState<StatusBackground>('violet');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) return setError('Choose a photo or a video.');
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const share = async () => {
    setError(null);
    try {
      if (mode === 'text') {
        setProgress(0.5);
        await post('/status', { kind: 'text', text: text.trim(), background });
      } else if (file) {
        setProgress(0);
        const up = await uploadWithProgress<FileView>('post', file, file.name, (p) => setProgress(p * 0.95));
        await post('/status', { kind: up.kind === 'video' ? 'video' : 'image', fileId: up.id, caption: caption.trim() || undefined });
      }
      onPosted();
    } catch (err) {
      setError(errorMessage(err));
      setProgress(null);
    }
  };

  const ready = mode === 'text' ? text.trim().length > 0 : Boolean(file);
  return (
    <Sheet
      open
      onClose={() => progress === null && onClose()}
      title="New status"
      description="Disappears after 24 hours. Your followers can see it."
      footer={<Button full disabled={!ready || progress !== null} onClick={() => void share()}>{progress !== null ? <><Spinner /> Sharing… {Math.round(progress * 100)}%</> : 'Share status'}</Button>}
    >
      <Segmented<'text' | 'media'> label="Status type" value={mode} onChange={setMode} className="mb-4" options={[{ value: 'text', label: 'Text' }, { value: 'media', label: 'Photo or video' }]} />
      {error && <FormAlert className="mb-3">{error}</FormAlert>}
      {mode === 'text' ? (
        <div className="space-y-3">
          <div className="grid aspect-[4/5] max-h-80 w-full place-items-center rounded-2xl p-6" style={{ background: BACKGROUNDS[background] }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={700} placeholder="Type a status" aria-label="Status text" className="h-full w-full resize-none bg-transparent text-center text-[24px] font-bold text-white placeholder:text-white/60 focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-text-3" aria-hidden="true" />
            {(Object.keys(BACKGROUNDS) as StatusBackground[]).map((b) => (
              <button key={b} type="button" onClick={() => setBackground(b)} aria-label={`Background ${b}`} aria-pressed={background === b} className={cn('h-8 w-8 rounded-full border-2', background === b ? 'border-text' : 'border-transparent')} style={{ background: BACKGROUNDS[b] }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input ref={input} type="file" accept="image/*,video/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          {preview && file ? (
            <div className="overflow-hidden rounded-2xl bg-black">
              {file.type.startsWith('video/') ? <video src={preview} controls playsInline className="max-h-80 w-full object-contain" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Status preview" className="max-h-80 w-full object-contain" />}
            </div>
          ) : null}
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={progress !== null}><ImageIcon className="h-4 w-4" aria-hidden="true" /> {file ? 'Choose another' : 'Choose a photo or video'}</Button>
          {file && <p className="text-[13px] text-text-3">{file.name} · {formatBytes(file.size)}</p>}
          {file && <Textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="Add a caption" aria-label="Caption" />}
        </div>
      )}
    </Sheet>
  );
}
