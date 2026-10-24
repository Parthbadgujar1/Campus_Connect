'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, CalendarClock, Camera, Eye, FileText, Image as ImageIcon, MapPin, Plus, Search, UserRound, X } from 'lucide-react';
import { errorMessage, get, uploadWithProgress } from '@/lib/api/client';
import { useQuery, type Page } from '@/lib/api/hooks';
import type { FileView, PersonSummary } from '@/lib/api/types';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/fields';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { formatBytes } from '@/components/loops/media';
import { cn } from '@/lib/utils';

export type OutgoingMessage = { kind: string; body?: string; fileId?: string; payload?: Record<string, unknown> };
export type AttachChoice = 'media' | 'camera' | 'document' | 'snap' | 'poll' | 'plan' | 'location' | 'contact';

const OPTIONS: Array<{ id: AttachChoice; label: string; icon: LucideIcon; tone: string }> = [
  { id: 'media', label: 'Photos & videos', icon: ImageIcon, tone: 'bg-violet-500' },
  { id: 'camera', label: 'Camera', icon: Camera, tone: 'bg-rose-500' },
  { id: 'document', label: 'Document', icon: FileText, tone: 'bg-indigo-500' },
  { id: 'snap', label: 'View once', icon: Eye, tone: 'bg-slate-600' },
  { id: 'poll', label: 'Poll', icon: BarChart3, tone: 'bg-amber-500' },
  { id: 'plan', label: 'Plan', icon: CalendarClock, tone: 'bg-pink-500' },
  { id: 'location', label: 'Location', icon: MapPin, tone: 'bg-emerald-500' },
  { id: 'contact', label: 'Contact', icon: UserRound, tone: 'bg-sky-500' },
];

/** The WhatsApp-style attach menu: a grid of choices. File choices open the system picker. */
export function AttachSheet({ open, onClose, onFiles, onChoose }: { open: boolean; onClose: () => void; onFiles: (files: File[], mode: 'media' | 'document' | 'snap') => void; onChoose: (choice: 'poll' | 'plan' | 'location' | 'contact') => void }) {
  const media = useRef<HTMLInputElement | null>(null);
  const camera = useRef<HTMLInputElement | null>(null);
  const doc = useRef<HTMLInputElement | null>(null);
  const snap = useRef<HTMLInputElement | null>(null);
  const take = (mode: 'media' | 'document' | 'snap') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length) {
      onClose();
      onFiles(files, mode);
    }
  };
  const pick = (id: AttachChoice) => {
    if (id === 'media') media.current?.click();
    else if (id === 'camera') camera.current?.click();
    else if (id === 'document') doc.current?.click();
    else if (id === 'snap') snap.current?.click();
    else {
      onClose();
      onChoose(id);
    }
  };
  return (
    <>
      <input ref={media} type="file" accept="image/*,video/*" multiple hidden onChange={take('media')} />
      <input ref={camera} type="file" accept="image/*,video/*" capture="environment" hidden onChange={take('media')} />
      <input ref={doc} type="file" multiple hidden onChange={take('document')} />
      <input ref={snap} type="file" accept="image/*,video/*" hidden onChange={take('snap')} />
      <Sheet open={open} onClose={onClose} title="Share">
        <div className="grid grid-cols-4 gap-y-5">
          {OPTIONS.map((o) => (
            <button key={o.id} type="button" onClick={() => pick(o.id)} className="flex flex-col items-center gap-2 text-[12px] font-semibold text-text-2">
              <span className={cn('grid h-14 w-14 place-items-center rounded-full text-white shadow-card', o.tone)}><o.icon className="h-6 w-6" aria-hidden="true" /></span>
              {o.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function Preview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => (file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <div className="relative">
      {url && file.type.startsWith('image/') ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="aspect-square w-full rounded-xl object-cover" />
      ) : url ? (
        <video src={url} muted playsInline preload="metadata" className="aspect-square w-full rounded-xl bg-black object-cover" />
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl bg-surface-2 p-2 text-center">
          <FileText className="h-7 w-7 text-accent" aria-hidden="true" />
          <span className="line-clamp-2 text-[11px] font-semibold">{file.name}</span>
          <span className="text-[11px] text-text-3">{formatBytes(file.size)}</span>
        </div>
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  );
}

/** Review photos, videos or documents before sending, add a caption, then send with progress. */
export function MediaComposer({ files: initial, mode, maxMb, onClose, onSend }: { files: File[]; mode: 'media' | 'document' | 'snap'; maxMb: number; onClose: () => void; onSend: (m: OutgoingMessage) => Promise<void> }) {
  const [files, setFiles] = useState(initial.slice(0, mode === 'snap' ? 1 : 10));
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const more = useRef<HTMLInputElement | null>(null);
  const tooBig = files.find((f) => f.size > maxMb * 1024 * 1024);

  const send = async () => {
    setError(null);
    try {
      for (const [i, f] of files.entries()) {
        setProgress(i / files.length);
        const up = await uploadWithProgress<FileView>('message', f, f.name, (p) => setProgress((i + p) / files.length));
        const kind = mode === 'snap' ? 'snap' : mode === 'document' ? 'file' : up.kind === 'image' ? 'image' : up.kind === 'video' ? 'video' : 'file';
        await onSend({ kind, fileId: up.id, body: i === 0 && caption.trim() && mode !== 'snap' ? caption.trim() : undefined });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setProgress(null);
    }
  };

  const title = mode === 'snap' ? 'View-once photo' : mode === 'document' ? `Send ${files.length} document${files.length === 1 ? '' : 's'}` : `Send ${files.length} item${files.length === 1 ? '' : 's'}`;
  return (
    <Sheet
      open
      onClose={() => progress === null && onClose()}
      title={title}
      description={mode === 'snap' ? 'They can open it once; it cannot be saved from the app.' : undefined}
      footer={
        <div className="w-full space-y-2">
          {progress !== null && (
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Sending">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <Button full onClick={() => void send()} disabled={progress !== null || !files.length || Boolean(tooBig)}>
            {progress !== null ? <><Spinner /> Sending… {Math.round(progress * 100)}%</> : 'Send'}
          </Button>
        </div>
      }
    >
      {error && <FormAlert className="mb-3">{error}</FormAlert>}
      {tooBig && <FormAlert className="mb-3">“{tooBig.name}” is {formatBytes(tooBig.size)}. Files can be up to {maxMb} MB.</FormAlert>}
      <div className="grid grid-cols-3 gap-2">
        {files.map((f, i) => <Preview key={`${f.name}-${i}`} file={f} onRemove={() => setFiles((list) => list.filter((_, j) => j !== i))} />)}
        {mode !== 'snap' && files.length < 10 && (
          <>
            <input ref={more} type="file" accept={mode === 'media' ? 'image/*,video/*' : undefined} multiple hidden onChange={(e) => { const add = [...(e.target.files ?? [])]; e.target.value = ''; setFiles((list) => [...list, ...add].slice(0, 10)); }} />
            <button type="button" onClick={() => more.current?.click()} className="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-border text-text-3 hover:bg-surface-2" aria-label="Add more">
              <Plus className="h-6 w-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {mode !== 'snap' && (
        <Field label="Caption (optional)" htmlFor="media-caption" className="mt-4">
          <Textarea id="media-caption" rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={1000} placeholder="Add a caption" />
        </Field>
      )}
    </Sheet>
  );
}

/** Create a poll: a question and 2–8 options. */
export function PollSheet({ onClose, onSend }: { onClose: () => void; onSend: (m: OutgoingMessage) => Promise<void> }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && filled.length >= 2 && new Set(filled.map((o) => o.toLowerCase())).size === filled.length;
  const send = async () => {
    setPending(true);
    setError(null);
    try {
      await onSend({ kind: 'poll', body: question.trim(), payload: { question: question.trim(), options: filled, multiple: false } });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Create poll" footer={<Button full disabled={!valid || pending} onClick={() => void send()}>{pending && <Spinner />} Send poll</Button>}>
      {error && <FormAlert className="mb-3">{error}</FormAlert>}
      <div className="space-y-4">
        <Field label="Question" htmlFor="poll-q"><Input id="poll-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder="Where should we meet?" /></Field>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Options</p>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input value={o} onChange={(e) => setOptions((list) => list.map((x, j) => (j === i ? e.target.value : x)))} maxLength={80} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} />
              {options.length > 2 && <button type="button" onClick={() => setOptions((list) => list.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`} className="grid h-12 w-12 shrink-0 place-items-center rounded-full hover:bg-surface-2"><X className="h-4 w-4" aria-hidden="true" /></button>}
            </div>
          ))}
          {options.length < 8 && <Button variant="secondary" size="sm" onClick={() => setOptions((list) => [...list, ''])}><Plus className="h-4 w-4" aria-hidden="true" /> Add option</Button>}
        </div>
      </div>
    </Sheet>
  );
}

/** Share someone's profile in the chat. */
export function ContactSheet({ onClose, onSend }: { onClose: () => void; onSend: (m: OutgoingMessage) => Promise<void> }) {
  const [q, setQ] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const people = useQuery<Page<PersonSummary & { headline: string | null }>>(`chats:contact:${q}`, (signal) => get('/users', { q: q || undefined, limit: 20 }, signal));
  const share = async (p: PersonSummary) => {
    setSending(p.id);
    try {
      await onSend({ kind: 'text', body: `👤 ${p.displayName}\n${window.location.origin}/profile/${p.username}` });
      onClose();
    } finally {
      setSending(null);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Share a contact">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="pl-10" />
      </div>
      {people.loading && <SkeletonList variant="row" count={4} />}
      <ul className="divide-y divide-border">
        {people.data?.items.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => void share(p)} disabled={Boolean(sending)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2">
              <PersonAvatar person={p} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.displayName}</span>
                <span className="block truncate text-[12px] text-text-3">@{p.username}{p.headline ? ` · ${p.headline}` : ''}</span>
              </span>
              {sending === p.id && <Spinner />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Sends where you are now as a map link (asks the browser for permission first). */
export function shareLocation(): Promise<OutgoingMessage> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This device cannot share its location.'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve({ kind: 'text', body: `📍 My location\nhttps://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}` });
      },
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied.' : 'Your location could not be found. Try again.')),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  });
}
