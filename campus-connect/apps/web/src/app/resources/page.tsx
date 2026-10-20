'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Download, FileText, Plus, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { resources } from '@/data/learning';
import { getPerson } from '@/data/people';
import type { Resource, ResourceKind } from '@/lib/types';
import { useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

// Shelf: notes and previous papers from students, teachers and the office.
const KINDS: ('All' | ResourceKind)[] = ['All', 'Notes', 'Previous papers', 'Syllabus', 'Lab manual', 'Cheat sheet', 'Book'];
type Contributor = 'All' | 'Student' | 'Teacher' | 'Office';

const CONTRIBUTOR_LABEL: Record<string, Contributor> = { student: 'Student', faculty: 'Teacher', admin: 'Office', business: 'Office' };

function contributorOf(resource: Resource): Contributor {
  // Ids that are not people in this prototype (e.g. the office) fall back to the office.
  const id = resource.uploaderId;
  if (id.startsWith('a-')) return 'Office';
  return CONTRIBUTOR_LABEL[getPerson(id).role] ?? 'Student';
}

export default function ResourcesPage() {
  return (
    <Suspense fallback={null}>
      <Shelf />
    </Suspense>
  );
}

function Shelf() {
  const params = useSearchParams();
  const toast = useToast();
  const role = useAppState((s) => s.role);
  const reviewing = params.get('review') === '1' && (role === 'faculty' || role === 'admin');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'All' | ResourceKind>('All');
  const [contributor, setContributor] = useState<Contributor>('All');
  const [subject, setSubject] = useState('All');
  const [sort, setSort] = useState<'Top rated' | 'Most downloaded'>('Top rated');
  const [uploading, setUploading] = useState(params.get('upload') === '1');
  const [draft, setDraft] = useState({ title: '', kind: 'Notes' as ResourceKind, subject: 'DBMS', fileName: '' });

  const subjects = useMemo(() => ['All', ...new Set(resources.map((r) => r.subject))], []);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources
      .filter((r) => (reviewing ? !r.approved : r.approved))
      .filter((r) => kind === 'All' || r.kind === kind)
      .filter((r) => contributor === 'All' || contributorOf(r) === contributor)
      .filter((r) => subject === 'All' || r.subject === subject)
      .filter((r) => !q || r.title.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q)))
      .sort((a, b) => (sort === 'Top rated' ? b.rating - a.rating : b.downloads - a.downloads));
  }, [query, kind, contributor, subject, sort, reviewing]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title={reviewing ? 'Review notes' : 'Shelf'}
        subtitle={reviewing ? 'Shared notes waiting for approval' : 'Notes and previous papers from your campus'}
        back
        backHref="/campus"
        actions={
          !reviewing ? (
            <Button size="sm" onClick={() => setUploading(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Share
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, papers and tags" aria-label="Search shelf" className="pl-10" />
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Kind">
          {KINDS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={kind === item}
              onClick={() => setKind(item)}
              className={cn('h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold', kind === item ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Shared by">
          {(['All', 'Student', 'Teacher', 'Office'] as Contributor[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={contributor === item}
              onClick={() => setContributor(item)}
              className={cn('h-9 rounded-xl border text-[14px] font-semibold', contributor === item ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border bg-surface text-text-2')}
            >
              {item === 'All' ? 'Anyone' : item === 'Office' ? 'Office' : `${item}s`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
            {subjects.map((item) => (
              <option key={item} value={item}>
                {item === 'All' ? 'All subjects' : item}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option>Top rated</option>
            <option>Most downloaded</option>
          </Select>
        </div>
      </div>

      <p className="mt-6 text-[14px] text-text-3">
        {visible.length} {visible.length === 1 ? 'item' : 'items'}
      </p>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {visible.map((resource) => {
          const uploader = getPerson(resource.uploaderId);
          return (
            <li key={resource.id} className="flex items-start gap-3.5 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{resource.title}</p>
                <p className="mt-1 text-[13px] text-text-3">
                  {resource.kind} · {resource.subject} · Sem {resource.semester}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-2">
                  <span className="font-medium">
                    {uploader.name} <span className="text-text-3">· {contributorOf(resource)}</span>
                  </span>
                  <span className="flex items-center gap-1 text-text-3">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    {resource.rating.toFixed(1)}
                  </span>
                  <span className="text-text-3">{resource.downloads.toLocaleString('en-IN')} downloads</span>
                  <span className="text-text-3">{resource.sizeLabel}</span>
                </p>
              </div>
              {reviewing ? (
                <Button size="sm" onClick={() => toast(`Approved “${resource.title}”`)}>
                  Approve
                </Button>
              ) : (
                <button type="button" onClick={() => toast(`Download starts for “${resource.title}” (preview)`)} aria-label={`Download ${resource.title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2 hover:text-text">
                  <Download className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-6 py-12 text-center text-[15px] text-text-3">Nothing matches these filters yet.</li>}
      </ul>

      <Sheet
        open={uploading}
        onClose={() => setUploading(false)}
        title="Share a note or paper"
        description="Students' shares are reviewed by a teacher before everyone sees them."
        footer={
          <Button
            full
            disabled={draft.title.trim().length < 4 || draft.fileName === ''}
            onClick={() => {
              setUploading(false);
              toast('Sent for review. You will be notified when it is live.');
              setDraft({ title: '', kind: 'Notes', subject: 'DBMS', fileName: '' });
            }}
          >
            Share
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="res-title">
            <Input id="res-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="DBMS unit 2, handwritten" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind" htmlFor="res-kind">
              <Select id="res-kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ResourceKind })}>
                {KINDS.slice(1).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" htmlFor="res-subject">
              <Select id="res-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
                {subjects.slice(1).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="File" htmlFor="res-file" hint="PDF or images, up to 25 MB">
            <label className="flex h-12 cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 text-[15px] text-text-2 hover:border-accent">
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">{draft.fileName || 'Choose a file'}</span>
              <input id="res-file" type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setDraft({ ...draft, fileName: e.target.files?.[0]?.name ?? '' })} />
            </label>
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
