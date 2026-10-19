'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { ExternalLink, Play, Plus, Search, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { lectureLibrary, lectureSubjects, teacherName, type LectureSource } from '@/data/lectures-library';
import { useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

const SOURCES: ('All' | LectureSource)[] = ['All', 'Uploaded', 'YouTube', 'Other link'];

export default function LecturesPage() {
  return (
    <Suspense fallback={null}>
      <Lectures />
    </Suspense>
  );
}

function Lectures() {
  const params = useSearchParams();
  const toast = useToast();
  const role = useAppState((s) => s.role);
  const canAdd = role === 'faculty' || role === 'admin';
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('All');
  const [source, setSource] = useState<'All' | LectureSource>('All');
  const [semester, setSemester] = useState('All');
  const [adding, setAdding] = useState(params.get('add') === '1' && canAdd);
  const [draft, setDraft] = useState({ title: '', subject: lectureSubjects[0] ?? '', semester: '6', source: 'YouTube' as LectureSource, link: '', fileName: '' });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lectureLibrary.filter((lecture) => {
      if (subject !== 'All' && lecture.subject !== subject) return false;
      if (source !== 'All' && lecture.source !== source) return false;
      if (semester !== 'All' && String(lecture.semester) !== semester) return false;
      if (!q) return true;
      return lecture.title.toLowerCase().includes(q) || lecture.subject.toLowerCase().includes(q) || teacherName(lecture.teacherId).toLowerCase().includes(q);
    });
  }, [query, subject, source, semester]);

  const linkNeeded = draft.source !== 'Uploaded';
  const canSave = draft.title.trim().length >= 4 && (linkNeeded ? /^https?:\/\//.test(draft.link.trim()) : draft.fileName !== '');

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Lectures"
        subtitle="From teachers, YouTube and other platforms"
        back
        backHref="/campus"
        actions={
          canAdd ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, subject or teacher" aria-label="Search lectures" className="pl-10" />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
          {SOURCES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={source === item}
              onClick={() => setSource(item)}
              className={cn('h-9 rounded-full px-3.5 text-[14px] font-semibold', source === item ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
            <option value="All">All subjects</option>
            {lectureSubjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select value={semester} onChange={(e) => setSemester(e.target.value)} aria-label="Semester">
            <option value="All">All semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="mt-6 text-[14px] text-text-3">
        {visible.length} {visible.length === 1 ? 'lecture' : 'lectures'}
      </p>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {visible.map((lecture) => {
          const body = (
            <>
              <span className="relative grid h-16 w-24 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                {lecture.external ? <ExternalLink className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5 fill-current" aria-hidden="true" />}
                <span className="absolute bottom-1 right-1 rounded bg-surface px-1 text-[11px] font-semibold text-text-2">{lecture.durationMin}m</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{lecture.title}</span>
                <span className="mt-1 block truncate text-[13px] text-text-3">
                  {teacherName(lecture.teacherId)} · {lecture.subject} · Sem {lecture.semester}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-text-3">
                  <span className={cn('rounded-full px-2 py-0.5 font-semibold', lecture.source === 'Uploaded' ? 'bg-surface-2 text-text-2' : 'bg-highlight text-highlight-ink')}>{lecture.source}</span>
                  <span>
                    {lecture.views.toLocaleString('en-IN')} views · {relativeTime(lecture.uploadedAt)}
                  </span>
                </span>
              </span>
            </>
          );
          return (
            <li key={lecture.id}>
              {lecture.external ? (
                <a href={lecture.href} target="_blank" rel="noopener noreferrer" className="flex gap-4 p-4 transition-colors hover:bg-surface-2">
                  {body}
                </a>
              ) : (
                <Link href={lecture.href} className="flex gap-4 p-4 transition-colors hover:bg-surface-2">
                  {body}
                </Link>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Video className="h-6 w-6 text-text-3" aria-hidden="true" />
            <p className="text-[15px] font-semibold">No lectures match these filters</p>
            <p className="text-[14px] text-text-3">Try another subject, or clear the search.</p>
          </li>
        )}
      </ul>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a lecture"
        description="Teachers add videos or links. The office checks them before students see them."
        footer={
          <Button
            full
            disabled={!canSave}
            onClick={() => {
              setAdding(false);
              toast('Sent for approval');
              setDraft({ title: '', subject: lectureSubjects[0] ?? '', semester: '6', source: 'YouTube', link: '', fileName: '' });
            }}
          >
            Send for approval
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="lec-title">
            <Input id="lec-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Normal forms, with examples" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject" htmlFor="lec-subject">
              <Select id="lec-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
                {lectureSubjects.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Field label="Semester" htmlFor="lec-sem">
              <Select id="lec-sem" value={draft.semester} onChange={(e) => setDraft({ ...draft, semester: e.target.value })}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Where is the lecture?" htmlFor="lec-source">
            <Select id="lec-source" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as LectureSource })}>
              <option value="Uploaded">Upload a video file</option>
              <option value="YouTube">YouTube link</option>
              <option value="Other link">Another platform</option>
            </Select>
          </Field>
          {draft.source === 'Uploaded' ? (
            <Field label="Video file" htmlFor="lec-file" hint="MP4 or MOV, up to 2 GB. Processing takes a few minutes.">
              <label className="flex h-12 cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 text-[15px] text-text-2 hover:border-accent">
                <Video className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{draft.fileName || 'Choose a file'}</span>
                <input
                  id="lec-file"
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  onChange={(e) => setDraft({ ...draft, fileName: e.target.files?.[0]?.name ?? '' })}
                />
              </label>
            </Field>
          ) : (
            <Field label="Link" htmlFor="lec-link" hint="Paste the full address, starting with https://">
              <Input id="lec-link" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
            </Field>
          )}
        </div>
      </Sheet>
    </div>
  );
}
