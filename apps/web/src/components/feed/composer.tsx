'use client';

import { useRef, useState } from 'react';
import { BarChart3, Ghost, ImagePlus, Loader2, MessageCircleQuestion, Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/fields';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage, isApiError, post, upload } from '@/lib/api/client';
import type { FileView, PostView } from '@/lib/api/types';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

type Kind = 'post' | 'question' | 'poll';
interface Pending {
  key: string;
  name: string;
  file?: FileView;
  error?: string;
}

const AUDIENCES = [
  { value: 'college', label: 'Whole campus' },
  { value: 'department', label: 'My department' },
  { value: 'year', label: 'My year' },
  { value: 'division', label: 'My division' },
] as const;

/** Writes a post. The feed passes onPosted to show it at the top straight away. */
export function Composer({ onPosted, spaceId, placeholder = 'Share a thought, a win or a question' }: { onPosted: (p: PostView) => void; spaceId?: string; placeholder?: string }) {
  const { user } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Kind>('post');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]['value']>('college');
  const [anonymous, setAnonymous] = useState(false);
  const [tags, setTags] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [files, setFiles] = useState<Pending[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploading = files.some((f) => !f.file && !f.error);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    for (const f of [...list].slice(0, 10 - files.length)) {
      const key = `${f.name}-${f.size}-${Math.random()}`;
      setFiles((all) => [...all, { key, name: f.name }]);
      try {
        const stored = await upload<FileView>('post', f);
        setFiles((all) => all.map((x) => (x.key === key ? { ...x, file: stored } : x)));
      } catch (err) {
        setFiles((all) => all.map((x) => (x.key === key ? { ...x, error: errorMessage(err) } : x)));
      }
    }
  };

  const reset = () => {
    setBody('');
    setKind('post');
    setAnonymous(false);
    setTags('');
    setOptions(['', '']);
    setFiles([]);
    setError(null);
    setOpen(false);
  };

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const created = await post<PostView>('/posts', {
        body: body.trim(),
        kind,
        audience: spaceId ? 'space' : audience,
        spaceId,
        anonymous,
        tags: tags.split(/[\s,]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 10),
        attachments: files.filter((f) => f.file).map((f) => f.file!.id),
        poll: kind === 'poll' ? { options: options.map((o) => o.trim()).filter(Boolean) } : undefined,
      });
      onPosted(created);
      toast(anonymous ? 'Posted anonymously' : 'Posted');
      reset();
    } catch (err) {
      setError(isApiError(err) && Object.keys(err.fields).length ? Object.values(err.fields).join(' ') : errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="press flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 pr-4 text-left transition-colors hover:border-accent/40">
        <PersonAvatar person={user ? { id: user.id, displayName: user.profile.displayName, avatarUrl: user.profile.avatarUrl, username: user.profile.username } : null} size="sm" />
        <span className="flex-1 text-[15px] text-text-3">{placeholder}</span>
      </button>
    );
  }

  const pollReady = kind !== 'poll' || options.filter((o) => o.trim()).length >= 2;
  const canPost = body.trim().length > 0 && pollReady && !uploading && !pending;

  return (
    <section aria-label="New post" className="animate-rise rounded-2xl border border-accent/40 bg-surface p-4 shadow-card">
      {error && <FormAlert className="mb-3">{error}</FormAlert>}
      <div className="font-sans mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of post">
        {([
          ['post', 'Post', null],
          ['question', 'Question', MessageCircleQuestion],
          ['poll', 'Poll', BarChart3],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" role="radio" aria-checked={kind === value} onClick={() => setKind(value)}
            className={cn('press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold', kind === value ? 'border-accent bg-accent text-accent-ink' : 'border-border text-text-2 hover:bg-surface-2')}>
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {label}
          </button>
        ))}
      </div>
      <label htmlFor="composer-body" className="sr-only">What do you want to share?</label>
      <Textarea id="composer-body" autoFocus value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder={kind === 'poll' ? 'Ask your question' : placeholder} className="min-h-24 border-0 bg-transparent px-0 focus:ring-0" />
      <p className="font-sans text-right text-[12px] text-text-3" aria-live="polite">{body.length}/5000</p>

      {kind === 'poll' && (
        <div className="font-sans mt-2 space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <label htmlFor={`opt-${i}`} className="sr-only">Option {i + 1}</label>
              <input id={`opt-${i}`} value={o} maxLength={120} onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`}
                className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-[14px] focus:border-accent focus:outline-none" />
              {options.length > 2 && (
                <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((all) => all.filter((_, j) => j !== i))} className="press grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <Button variant="ghost" size="sm" onClick={() => setOptions((all) => [...all, ''])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add option
            </Button>
          )}
        </div>
      )}

      {files.length > 0 && (
        <ul className="font-sans mt-3 flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.key} className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]', f.error ? 'border-danger text-danger' : 'border-border')}>
              {!f.file && !f.error && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              <span className="max-w-[180px] truncate">{f.error ? `${f.name}: ${f.error}` : f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((x) => x.key !== f.key))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-surface-2">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="font-sans mt-3 grid gap-2 sm:grid-cols-2">
        {!spaceId && (
          <div>
            <label htmlFor="composer-audience" className="sr-only">Who can see this</label>
            <Select id="composer-audience" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="h-10 text-[14px]">
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value} disabled={a.value !== 'college' && !user?.profile.departmentId}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <label htmlFor="composer-tags" className="sr-only">Tags</label>
          <input id="composer-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#tags, separated by spaces"
            className="h-10 w-full rounded-2xl border border-border bg-surface px-4 text-[14px] focus:border-accent focus:outline-none" />
        </div>
      </div>

      <div className="font-sans mt-3 flex flex-wrap items-center gap-1.5">
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,video/mp4,video/webm,audio/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        <button type="button" onClick={() => imageInput.current?.click()} className="press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-text-2 hover:bg-surface-2" aria-label="Add photos">
          <ImagePlus className="h-4 w-4" aria-hidden="true" /> Photo
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className="press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-text-2 hover:bg-surface-2" aria-label="Attach a file">
          <Paperclip className="h-4 w-4" aria-hidden="true" /> File
        </button>
        <button type="button" role="switch" aria-checked={anonymous} onClick={() => setAnonymous((a) => !a)}
          className={cn('press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold', anonymous ? 'bg-accent-soft text-accent-soft-ink' : 'text-text-2 hover:bg-surface-2')}>
          <Ghost className="h-4 w-4" aria-hidden="true" /> {anonymous ? 'Anonymous on' : 'Anonymous'}
        </button>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
          <Button size="sm" disabled={!canPost} onClick={submit} aria-busy={pending}>
            {pending && <Spinner />} {uploading ? 'Uploading…' : 'Post'}
          </Button>
        </div>
      </div>
      {anonymous && <p className="font-sans mt-2 text-[12px] text-text-3">Your name is hidden from everyone. Moderators can only reveal it with two admins&apos; approval, for serious safety reasons.</p>}
    </section>
  );
}
