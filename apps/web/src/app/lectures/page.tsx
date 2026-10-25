'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, PlayCircle, Plus, Search, Upload, Video } from 'lucide-react';
import { get, post, upload, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { LectureView } from '@/lib/api/modules';
import type { FileView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable, Reveal } from '@/components/motion';
import { useSession } from '@/lib/session';
import { can } from '@/lib/roles';
import { ago } from '@/lib/live-time';
import { gradientFor } from '@/lib/visuals';

function duration(s: number | null): string | null {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function LectureCard({ l, onOpen }: { l: LectureView; onOpen: () => void }) {
  return (
    <Pressable>
      <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card transition-colors hover:border-accent/40">
        <div className="relative aspect-video" style={l.thumbnailUrl ? undefined : { background: gradientFor(l.id) }}>
          {l.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/10">
            <PlayCircle className="h-12 w-12 text-white drop-shadow" aria-hidden="true" />
          </span>
          {l.status !== 'published' && <span className="absolute left-2 top-2"><Badge tone="warning">{l.status === 'pending' ? 'Waiting for approval' : l.status}</Badge></span>}
        </div>
        <div className="p-3.5">
          <p className="line-clamp-2 font-semibold leading-snug">{l.title}</p>
          <p className="mt-1 truncate text-[13px] text-text-3">
            {l.subject}
            {l.teacher ? ` · ${l.teacher.displayName}` : ''}
          </p>
          <p className="mt-1 flex items-center gap-3 text-[12px] text-text-3">
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{l.viewsCount}</span>
            {duration(l.durationSeconds) && <span>{duration(l.durationSeconds)}</span>}
            <span>{ago(l.publishedAt ?? l.createdAt)}</span>
          </p>
        </div>
      </button>
    </Pressable>
  );
}

function Player({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery<LectureView>(`lectures:one:${id}`, (signal) => get(`/lectures/${id}`, undefined, signal));
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    void post(`/lectures/${id}/view`).catch(() => undefined);
  }, [id]);
  const l = q.data;
  return (
    <Sheet open onClose={onClose} title={l?.title ?? 'Lecture'} description={l ? `${l.subject}${l.teacher ? ` · ${l.teacher.displayName}` : ''}` : undefined}>
      {q.loading && <SkeletonList variant="tile" count={1} />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {l && (
        <div className="space-y-4">
          {l.embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <iframe src={l.embedUrl} title={l.title} className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          ) : l.file?.url ? (
            <video src={l.file.url} controls playsInline className="aspect-video w-full rounded-2xl bg-black" />
          ) : l.url ? (
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 font-semibold text-accent">
              <ExternalLink className="h-5 w-5" aria-hidden="true" /> Open the lecture
            </a>
          ) : null}
          {l.description && <p className="whitespace-pre-wrap text-[15px] text-text-2">{l.description}</p>}
          {l.chapters.length > 0 && (
            <ol className="space-y-1 text-[14px]">
              {l.chapters.map((c) => (
                <li key={c.at} className="flex gap-3"><span className="font-mono text-text-3">{Math.floor(c.at / 60)}:{String(c.at % 60).padStart(2, '0')}</span>{c.title}</li>
              ))}
            </ol>
          )}
          <p className="text-[12px] text-text-3">YouTube videos play in privacy-enhanced mode: no tracking cookies until you press play.</p>
        </div>
      )}
    </Sheet>
  );
}

function AddLecture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', subject: '', semester: '', description: '', source: 'youtube', url: '' });
  const [file, setFile] = useState<FileView | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const pick = useAction(async (f: File) => setFile(await upload<FileView>('lecture', f)));
  const send = useAction(async () => {
    await post('/lectures', { title: form.title.trim(), subject: form.subject.trim(), semester: form.semester ? Number(form.semester) : undefined, description: form.description.trim() || undefined, source: form.source, url: form.source !== 'upload' ? form.url.trim() : undefined, fileId: form.source === 'upload' ? file?.id : undefined });
    toast('Lecture added');
    invalidate('lectures:');
    onClose();
  });
  const ready = form.title.trim().length >= 4 && form.subject.trim().length >= 2 && (form.source === 'upload' ? Boolean(file) : /^https:\/\/\S+$/.test(form.url.trim()));
  return (
    <Sheet open={open} onClose={onClose} title="Add a lecture" description="Upload a video, or link a YouTube video or another page." footer={<Button full onClick={() => void send.run()} disabled={!ready || send.pending}>{send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Add lecture</Button>}>
      <div className="space-y-4">
        <Field label="Title" htmlFor="l-title"><Input id="l-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject" htmlFor="l-subject"><Input id="l-subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} maxLength={80} /></Field>
          <Field label="Semester" htmlFor="l-sem">
            <Select id="l-sem" value={form.semester} onChange={(e) => set('semester', e.target.value)}>
              <option value="">Any</option>
              {Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>Semester {i + 1}</option>)}
            </Select>
          </Field>
        </div>
        <Segmented label="Source" value={form.source} onChange={(v) => set('source', v)} options={[{ value: 'youtube', label: 'YouTube' }, { value: 'link', label: 'Other link' }, { value: 'upload', label: 'Upload video' }]} />
        {form.source === 'upload' ? (
          <div>
            <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick.run(f); e.target.value = ''; }} />
            <Button variant="secondary" full onClick={() => input.current?.click()} disabled={pick.pending}>{pick.pending ? <Spinner /> : <Upload className="h-4 w-4" aria-hidden="true" />}{file ? file.name : pick.pending ? 'Uploading…' : 'Choose a video'}</Button>
            {pick.error && <FormAlert className="mt-2">{pick.error.message}</FormAlert>}
          </div>
        ) : (
          <Field label={form.source === 'youtube' ? 'YouTube link' : 'Link'} htmlFor="l-url"><Input id="l-url" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" inputMode="url" /></Field>
        )}
        <Field label="Description" htmlFor="l-desc"><Textarea id="l-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} rows={3} /></Field>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

function LecturesInner() {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const subject = params.get('subject');
  const q = params.get('q') ?? '';
  const open = params.get('id');
  const view = (params.get('view') as 'library' | 'mine') ?? 'library';
  const [search, setSearch] = useState(q);
  const [adding, setAdding] = useState(params.get('add') === '1');
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { subject, q: q || null, view: view === 'library' ? null : view, id: open, ...next }), { scroll: false });
  const subjects = useQuery<{ items: Array<{ name: string; count: number }> }>('lectures:subjects', (signal) => get('/lectures/subjects', undefined, signal));
  const list = useInfinite<LectureView>(`lectures:list:${subject}:${q}:${view}`, (cursor, signal) => get<Page<LectureView>>('/lectures', { subject: subject ?? undefined, q: q || undefined, mine: view === 'mine' ? 'true' : undefined, cursor: cursor ?? undefined, limit: 12 }, signal));
  const teacher = can(user, 'lectures.publish');
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Lectures" subtitle="Videos and links shared by your teachers" back backHref="/campus" actions={teacher && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Add</Button>} />
      <Reveal className="space-y-3">
        {teacher && <Segmented label="Lecture views" value={view} onChange={(v) => go({ view: v === 'library' ? null : v })} options={[{ value: 'library', label: 'Library' }, { value: 'mine', label: 'Added by me' }]} />}
        <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: search.trim() || null }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lectures" className="pl-10" aria-label="Search lectures" enterKeyHint="search" />
        </form>
        {subjects.data && subjects.data.items.length > 0 && (
          <ChipRow>
            <Chip active={!subject} onClick={() => go({ subject: null })}>All subjects</Chip>
            {subjects.data.items.map((s) => <Chip key={s.name} active={subject === s.name} onClick={() => go({ subject: s.name })}>{s.name} · {s.count}</Chip>)}
          </ChipRow>
        )}
      </Reveal>
      <div className="mt-4">
        <InfiniteList state={list} skeleton="card" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" empty={{ icon: Video, title: 'No lectures yet', description: 'When teachers add lectures, they appear here.' }} endMessage="That’s the whole library" render={(l) => <LectureCard l={l} onOpen={() => go({ id: l.id })} />} />
      </div>
      {open && <Player id={open} onClose={() => go({ id: null })} />}
      <AddLecture open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

export default function LecturesPage() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={3} className="mx-auto mt-24 max-w-4xl px-4" />}>
      <LecturesInner />
    </Suspense>
  );
}
