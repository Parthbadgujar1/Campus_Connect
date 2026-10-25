'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookMarked, Check, ChevronRight, Download, ExternalLink, FileText, FolderOpen, GraduationCap, Layers, Link2, Plus, Search, Star, Upload } from 'lucide-react';
import { del, get, post, put, upload, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { ResourceView, ShelfFilters, SubjectView } from '@/lib/api/modules';
import type { FileView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, Skeleton, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable, Reveal, Stagger, StaggerItem, motion } from '@/components/motion';
import { useSession } from '@/lib/session';
import { can } from '@/lib/roles';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

// Campus → Shelf. Notes are found step by step: department, then semester, then subject, then
// the items for that subject (filter by type, sort, search). Every step is in the address bar,
// so Back goes one step back and links can be shared. Subjects come from the data: anyone can
// add a new one while uploading, and staff can rename or merge them.

const KIND_LABEL: Record<string, string> = {
  notes: 'Notes',
  previous_papers: 'Past papers',
  syllabus: 'Syllabus',
  lab_manual: 'Lab manual',
  cheat_sheet: 'Cheat sheet',
  book: 'Book',
  tutorial: 'Tutorial',
  video_link: 'Video',
  code: 'Code',
  pdf: 'PDF',
};

function useShelfParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = {
    dept: params.get('dept'),
    sem: params.get('sem') ? Number(params.get('sem')) : null,
    subject: params.get('subject'),
    kind: params.get('kind'),
    q: params.get('q') ?? '',
    view: (params.get('view') as 'browse' | 'mine' | 'saved' | null) ?? 'browse',
  };
  const go = useCallback(
    (next: Partial<Record<'dept' | 'sem' | 'subject' | 'kind' | 'q' | 'view', string | number | null>>) => {
      const merged: Record<string, string | number | null> = { dept: state.dept, sem: state.sem, subject: state.subject, kind: state.kind, q: state.q || null, view: state.view === 'browse' ? null : state.view, ...next };
      router.push(withQuery(pathname, merged as Record<string, string | number | null>), { scroll: false });
    },
    [router, pathname, state.dept, state.sem, state.subject, state.kind, state.q, state.view],
  );
  return { ...state, go };
}

function StepCard({ title, subtitle, count, onClick, icon: Icon }: { title: string; subtitle?: string; count: number; onClick: () => void; icon: typeof FolderOpen }) {
  return (
    <Pressable>
      <button type="button" onClick={onClick} disabled={count === 0} className={cn('flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-colors', count ? 'hover:border-accent/40' : 'opacity-50')}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate text-[13px] text-text-3">{subtitle ?? `${count} item${count === 1 ? '' : 's'}`}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
      </button>
    </Pressable>
  );
}

function ResourceCard({ r, onChanged }: { r: ResourceView; onChanged: (next: ResourceView) => void }) {
  const toast = useToast();
  const open = useAction(async () => {
    const res = await post<{ url: string | null; external: boolean }>(`/resources/${r.id}/download`);
    if (res.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    onChanged({ ...r, downloadsCount: r.isMine ? r.downloadsCount : r.downloadsCount + 1 });
  });
  const rate = useAction(async (n: number) => {
    const res = await put<{ rating: number; ratingCount: number; myRating: number }>(`/resources/${r.id}/rating`, { rating: n });
    onChanged({ ...r, rating: res.rating, ratingCount: res.ratingCount, myRating: res.myRating });
    toast('Thanks for rating');
  });
  const save = useAction(async () => {
    if (r.saved) await del(`/saved/resource/${r.id}`);
    else await put(`/saved/resource/${r.id}`);
    onChanged({ ...r, saved: !r.saved });
  });
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-text-2">
          {r.hasFile ? <FileText className="h-5 w-5" aria-hidden="true" /> : <Link2 className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{r.title}</h3>
          <p className="mt-0.5 text-[13px] text-text-3">
            {KIND_LABEL[r.kind] ?? r.kind} · {r.subject}
            {r.semester ? ` · Sem ${r.semester}` : ''}
            {r.uploader ? ` · by ${r.uploader.displayName}` : ''} · {ago(r.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {r.status !== 'approved' && <Badge tone={r.status === 'pending' ? 'warning' : 'danger'}>{r.status === 'pending' ? 'Waiting for review' : r.status}</Badge>}
            {r.rating !== null && (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-2">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" /> {r.rating} ({r.ratingCount})
              </span>
            )}
            <span className="text-[13px] text-text-3">{r.downloadsCount} opened</span>
            {r.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[12px] text-text-3">#{t}</span>
            ))}
          </div>
          {r.status === 'pending' && r.isMine && <p className="mt-1.5 text-[13px] text-text-3">A teacher checks every upload before it appears for everyone.</p>}
          {r.reviewNote && r.isMine && <p className="mt-1.5 text-[13px] text-text-2">Reviewer: “{r.reviewNote}”</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void open.run()} disabled={open.pending}>
          {open.pending ? <Spinner /> : r.hasFile ? <Download className="h-4 w-4" aria-hidden="true" /> : <ExternalLink className="h-4 w-4" aria-hidden="true" />}
          {r.hasFile ? 'Open' : 'Open link'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void save.run()} aria-pressed={r.saved}>
          <BookMarked className="h-4 w-4" aria-hidden="true" /> {r.saved ? 'Saved' : 'Save'}
        </Button>
        {!r.isMine && r.status === 'approved' && (
          <span className="ml-auto flex items-center gap-0.5" role="radiogroup" aria-label="Rate this">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={r.myRating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => void rate.run(n)} className="p-1">
                <Star className={cn('h-4 w-4', (r.myRating ?? 0) >= n ? 'fill-warning text-warning' : 'text-text-3')} aria-hidden="true" />
              </button>
            ))}
          </span>
        )}
      </div>
      {(open.error || rate.error || save.error) && <FormAlert className="mt-3">{(open.error ?? rate.error ?? save.error)!.message}</FormAlert>}
    </article>
  );
}

function AddSheet({ open, onClose, filters, preset }: { open: boolean; onClose: () => void; filters: ShelfFilters | undefined; preset: { dept: string | null; sem: number | null; subject: string | null } }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('notes');
  const [dept, setDept] = useState(preset.dept ?? '');
  const [sem, setSem] = useState<string>(preset.sem ? String(preset.sem) : '');
  const [subjectText, setSubjectText] = useState('');
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<FileView | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const subjects = useQuery<{ items: SubjectView[] }>(open ? `shelf:subjects:${dept}:${sem}:${subjectText}` : null, (signal) => get('/subjects', { departmentId: dept || undefined, semester: sem || undefined, q: subjectText || undefined, limit: 8 }, signal));
  const exact = subjects.data?.items.find((s) => s.name.toLowerCase() === subjectText.trim().toLowerCase());
  const pick = useAction(async (f: File) => setFile(await upload<FileView>('resource', f)));
  const send = useAction(async () => {
    const res = await post<{ status: string; message: string }>('/resources', {
      title: title.trim(),
      kind,
      ...(exact ? { subjectId: exact.id } : { subject: subjectText.trim() }),
      semester: sem ? Number(sem) : undefined,
      departmentId: dept || undefined,
      fileId: mode === 'file' ? file?.id : undefined,
      externalUrl: mode === 'link' ? url.trim() : undefined,
      tags: [],
    });
    toast(res.message);
    invalidate('shelf:');
    setTitle('');
    setFile(null);
    setUrl('');
    onClose();
  });
  const fields = send.error && 'fields' in send.error ? (send.error as { fields: Record<string, string> }).fields : {};
  const ready = title.trim().length >= 4 && subjectText.trim().length >= 2 && (mode === 'file' ? Boolean(file) : /^https?:\/\/\S+$/.test(url.trim()));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to the Shelf"
      description="Notes, past papers, lab manuals… Student uploads are checked by a teacher first."
      footer={
        <Button full onClick={() => void send.run()} disabled={!ready || send.pending} aria-busy={send.pending}>
          {send.pending && <Spinner />} {send.pending ? 'Adding…' : 'Add to the Shelf'}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Title" htmlFor="shelf-title" hint={fields.title}>
          <Input id="shelf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="For example: DBMS Unit 2 notes" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="shelf-kind">
            <Select id="shelf-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(KIND_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Semester" htmlFor="shelf-sem">
            <Select id="shelf-sem" value={sem} onChange={(e) => setSem(e.target.value)}>
              <option value="">Any</option>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Semester {i + 1}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Department" htmlFor="shelf-dept">
          <Select id="shelf-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {filters?.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Subject" htmlFor="shelf-subject" hint={exact ? 'Existing subject' : subjectText.trim().length >= 2 ? 'A new subject will be created' : 'Pick one below or type a new one'}>
          <Input id="shelf-subject" value={subjectText} onChange={(e) => setSubjectText(e.target.value)} maxLength={80} placeholder="Start typing, e.g. Operating Systems" autoComplete="off" />
        </Field>
        {subjects.data && subjects.data.items.length > 0 && !exact && (
          <ChipRow>
            {subjects.data.items.map((s) => (
              <Chip key={s.id} onClick={() => setSubjectText(s.name)}>{s.name}</Chip>
            ))}
          </ChipRow>
        )}
        <Segmented<'file' | 'link'> label="File or link" value={mode} onChange={setMode} options={[{ value: 'file', label: 'Upload a file' }, { value: 'link', label: 'Add a link' }]} />
        {mode === 'file' ? (
          <div>
            <input ref={input} type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick.run(f); e.target.value = ''; }} />
            <Button variant="secondary" full onClick={() => input.current?.click()} disabled={pick.pending}>
              {pick.pending ? <Spinner /> : file ? <Check className="h-4 w-4" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {file ? file.name : pick.pending ? 'Uploading…' : 'Choose a file (PDF, Office, ZIP, image)'}
            </Button>
            {pick.error && <FormAlert className="mt-2">{pick.error.message}</FormAlert>}
          </div>
        ) : (
          <Field label="Link" htmlFor="shelf-url" hint={fields.externalUrl}>
            <Input id="shelf-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
          </Field>
        )}
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

function Breadcrumb({ parts, onBack }: { parts: string[]; onBack: () => void }) {
  if (!parts.length) return null;
  return (
    <div className="mb-4 flex items-center gap-2">
      <button type="button" onClick={onBack} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface" aria-label="One step back">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <nav aria-label="Where you are" className="no-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto text-[14px] font-semibold">
        {parts.map((p, i) => (
          <span key={i} className="flex shrink-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-3" aria-hidden="true" />}
            <span className={i === parts.length - 1 ? 'text-text' : 'text-text-3'}>{p}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}

function Browse() {
  const { dept, sem, subject, kind, q, go } = useShelfParams();
  const filters = useQuery<ShelfFilters>(`shelf:filters:${dept}:${sem}`, (signal) => get('/resources/filters', { departmentId: dept ?? undefined, semester: sem ?? undefined }, signal));
  const [search, setSearch] = useState(q);
  const [sort, setSort] = useState<'new' | 'popular' | 'top_rated'>('new');
  const department = filters.data?.departments.find((d) => d.id === dept);
  const subjectRow = filters.data?.subjects.find((s) => s.id === subject);
  const showItems = Boolean(subject) || q.length > 0;
  const listKey = showItems ? `shelf:list:${subject}:${kind}:${q}:${sort}:${dept}:${sem}` : null;
  const list = useInfinite<ResourceView>(listKey, (cursor, signal) =>
    get<Page<ResourceView>>('/resources', { cursor: cursor ?? undefined, subjectId: subject ?? undefined, kind: kind ?? undefined, q: q || undefined, sort, departmentId: subject ? undefined : (dept ?? undefined), semester: subject ? undefined : (sem ?? undefined), limit: 15 }, signal),
  );
  const crumbs = [department?.name ?? (dept ? 'Department' : null), sem ? `Semester ${sem}` : null, subjectRow?.name ?? (subject ? 'Subject' : null)].filter((x): x is string => Boolean(x));
  const back = () => {
    if (q) go({ q: null });
    else if (subject) go({ subject: null, kind: null });
    else if (sem) go({ sem: null });
    else go({ dept: null });
  };

  return (
    <div>
      <form
        className="relative mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: search.trim() || null });
        }}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the whole Shelf (title, subject, tag)" className="pl-10" aria-label="Search the Shelf" enterKeyHint="search" />
      </form>

      <Breadcrumb parts={q ? [`“${q}”`] : crumbs} onBack={back} />
      {filters.error && <ErrorState error={filters.error} onRetry={filters.reload} />}

      <>
        {!showItems && !dept && (
          <motion.section key="dept" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} aria-label="Choose a department">
            <h2 className="mb-3 text-[17px] font-semibold">1. Choose your department</h2>
            {filters.loading ? (
              <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[76px]" />)}</div>
            ) : (
              <Stagger className="grid gap-3 sm:grid-cols-2">
                {filters.data?.departments.map((d) => (
                  <StaggerItem key={d.id}>
                    <StepCard title={d.name} icon={GraduationCap} count={d.count} onClick={() => go({ dept: d.id })} />
                  </StaggerItem>
                ))}
              </Stagger>
            )}
            <p className="mt-3 text-[13px] text-text-3">Departments without notes yet are faded. Be the first to add some.</p>
          </motion.section>
        )}

        {!showItems && dept && !sem && (
          <motion.section key="sem" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} aria-label="Choose a semester">
            <h2 className="mb-3 text-[17px] font-semibold">2. Choose the semester</h2>
            {filters.loading ? (
              <Skeleton className="h-28" />
            ) : filters.data && filters.data.semesters.length ? (
              <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {filters.data.semesters.map((s) => (
                  <StaggerItem key={s.value}>
                    <StepCard title={`Semester ${s.value}`} icon={Layers} count={s.count} onClick={() => go({ sem: s.value })} />
                  </StaggerItem>
                ))}
              </Stagger>
            ) : (
              <EmptyState icon={Layers} title="Nothing here yet" description="No notes for this department so far. Add the first ones." />
            )}
          </motion.section>
        )}

        {!showItems && dept && sem && (
          <motion.section key="subject" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} aria-label="Choose a subject">
            <h2 className="mb-3 text-[17px] font-semibold">3. Choose the subject</h2>
            {filters.loading ? (
              <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[76px]" />)}</div>
            ) : filters.data && filters.data.subjects.length ? (
              <Stagger className="grid gap-3 sm:grid-cols-2">
                {filters.data.subjects.map((s) => (
                  <StaggerItem key={s.id}>
                    <StepCard title={s.name} icon={FolderOpen} count={s.count} onClick={() => go({ subject: s.id })} />
                  </StaggerItem>
                ))}
              </Stagger>
            ) : (
              <EmptyState icon={FolderOpen} title="No subjects yet" description="Add notes and type a subject name: it appears here for everyone." />
            )}
          </motion.section>
        )}

        {showItems && (
          <motion.section key="items" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} aria-label="Notes">
            <div className="mb-4 space-y-3">
              <ChipRow>
                <Chip active={!kind} onClick={() => go({ kind: null })}>All types</Chip>
                {(filters.data?.kinds ?? []).filter((k) => k.count > 0).map((k) => (
                  <Chip key={k.value} active={kind === k.value} onClick={() => go({ kind: k.value })}>
                    {KIND_LABEL[k.value] ?? k.value}
                  </Chip>
                ))}
              </ChipRow>
              <Segmented<'new' | 'popular' | 'top_rated'> label="Sort" value={sort} onChange={setSort} options={[{ value: 'new', label: 'Newest' }, { value: 'popular', label: 'Most opened' }, { value: 'top_rated', label: 'Top rated' }]} />
            </div>
            <InfiniteList
              state={list}
              skeleton="card"
              className="space-y-3"
              empty={{ icon: FileText, title: 'Nothing matches yet', description: q ? 'Try another word, or browse by department.' : 'No notes of this type for this subject yet.' }}
              endMessage="That’s everything for now"
              endHint="Missing something? Add it to the Shelf and help your batch."
              render={(r) => <ResourceCard r={r} onChanged={(next) => list.setItems((items) => items.map((x) => (x.id === next.id ? next : x)))} />}
            />
          </motion.section>
        )}
      </>
    </div>
  );
}

function MineOrSaved({ view }: { view: 'mine' | 'saved' }) {
  const list = useInfinite<ResourceView>(`shelf:${view}`, (cursor, signal) => get<Page<ResourceView>>('/resources', { cursor: cursor ?? undefined, [view]: 'true', limit: 15 }, signal));
  return (
    <InfiniteList
      state={list}
      skeleton="card"
      className="space-y-3"
      empty={view === 'mine' ? { icon: Upload, title: 'You have not added anything yet', description: 'Your uploads and their review status show here.' } : { icon: BookMarked, title: 'Nothing saved', description: 'Tap Save on any note to keep it here.' }}
      render={(r) => <ResourceCard r={r} onChanged={(next) => list.setItems((items) => items.map((x) => (x.id === next.id ? next : x)))} />}
    />
  );
}

// A single item opened from a link (search results, notifications).
function OneItem({ id }: { id: string }) {
  const item = useQuery<ResourceView>(`shelf:one:${id}`, (signal) => get(`/resources/${id}`, undefined, signal));
  return (
    <div className="space-y-3">
      {item.loading && <Skeleton className="h-40" />}
      {item.error && <ErrorState error={item.error} onRetry={item.reload} />}
      {item.data && <ResourceCard r={item.data} onChanged={(next) => item.setData(() => next)} />}
      <Link href="/resources" className={buttonClass({ variant: 'secondary', size: 'sm' })}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Browse the whole Shelf</Link>
    </div>
  );
}

function ShelfInner() {
  const { user } = useSession();
  const shelf = useShelfParams();
  const openId = useSearchParams().get('id');
  const [adding, setAdding] = useState(false);
  const filters = useQuery<ShelfFilters>(`shelf:filters:${shelf.dept}:${shelf.sem}`, (signal) => get('/resources/filters', { departmentId: shelf.dept ?? undefined, semester: shelf.sem ?? undefined }, signal));
  const total = useMemo(() => filters.data?.total, [filters.data]);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Shelf"
        subtitle={total !== undefined ? `${total} notes, papers and guides from your college` : 'Notes, papers and guides'}
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add
          </Button>
        }
      />
      <Reveal className="mb-5 mt-2">
        <Segmented<'browse' | 'mine' | 'saved'>
          label="Shelf views"
          value={shelf.view}
          onChange={(v) => shelf.go({ view: v === 'browse' ? null : v })}
          options={[
            { value: 'browse', label: 'Browse' },
            { value: 'saved', label: 'Saved' },
            { value: 'mine', label: 'My uploads' },
          ]}
        />
      </Reveal>
      {can(user, 'shelf.review') && (
        <Link href="/admin/content?tab=resource" className={buttonClass({ variant: 'soft', size: 'sm', className: 'mb-5' })}>
          Review uploads waiting for approval
        </Link>
      )}
      {openId ? <OneItem id={openId} /> : shelf.view === 'browse' ? <Browse /> : <MineOrSaved view={shelf.view} />}
      <AddSheet open={adding} onClose={() => setAdding(false)} filters={filters.data} preset={{ dept: shelf.dept, sem: shelf.sem, subject: shelf.subject }} />
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 max-w-3xl px-4"><Skeleton className="h-40" /></div>}>
      <ShelfInner />
    </Suspense>
  );
}
