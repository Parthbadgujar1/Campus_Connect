'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, ChevronRight, NotebookPen, PlayCircle, Timer, UsersRound } from 'lucide-react';
import { get } from '@/lib/api/client';
import { useQuery, type Page } from '@/lib/api/hooks';
import type { SpaceView } from '@/lib/api/types';
import { buttonClass } from '@/components/ui/button';
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { Pressable, Stagger, StaggerItem } from '@/components/motion';
import { useAppState } from '@/lib/store';

// Campus → Study: personal tools (focus timer and notes, kept on this device) and the
// real places to study with others: exam-prep spaces, the Shelf and recorded lectures.

function Tool({ href, title, description, icon: Icon, meta }: { href: string; title: string; description: string; icon: LucideIcon; meta?: string }) {
  return (
    <Pressable>
      <Link href={href} className="flex h-full items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-[13px] text-text-3">{description}</span>
          {meta && <span className="mt-1 block text-[12px] font-semibold text-accent">{meta}</span>}
        </span>
      </Link>
    </Pressable>
  );
}

export default function StudyPage() {
  const notes = useAppState((s) => s.notes.length);
  const groups = useQuery<Page<SpaceView>>('study:exam-spaces', (signal) => get('/spaces', { kind: 'exam', limit: 6 }, signal));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Study" subtitle="Focus, revise and prepare together" back backHref="/campus" />

      <SectionHeader title="Your tools" description="Saved on this device only" className="mt-2" />
      <Stagger className="grid gap-3 sm:grid-cols-2">
        <StaggerItem><Tool href="/study/focus" title="Focus timer" description="Pomodoro with calm sounds" icon={Timer} /></StaggerItem>
        <StaggerItem><Tool href="/study/notes" title="Notes" description="Quick private pages" icon={NotebookPen} meta={notes ? `${notes} note${notes === 1 ? '' : 's'}` : undefined} /></StaggerItem>
      </Stagger>

      <SectionHeader title="Study material" className="mt-8" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Tool href="/resources" title="Shelf" description="Notes and past papers by subject" icon={BookOpen} />
        <Tool href="/lectures" title="Lectures" description="Recorded classes and talks" icon={PlayCircle} />
      </div>

      <SectionHeader title="Exam-prep groups" action={{ label: 'All spaces', href: '/spaces?kind=exam' }} className="mt-8" />
      {groups.loading && <SkeletonList variant="row" count={3} />}
      {groups.error && <ErrorState error={groups.error} onRetry={groups.reload} compact />}
      {groups.data && !groups.data.items.length && (
        <EmptyState icon={UsersRound} title="No exam-prep groups yet" description="Start one for your subject or exam and invite classmates." action={<Link href="/spaces?kind=exam" className={buttonClass({ size: 'sm' })}>Start a group</Link>} />
      )}
      {groups.data && groups.data.items.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {groups.data.items.map((s) => (
            <li key={s.id}>
              <Link href={`/spaces/${s.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="block truncate text-[13px] text-text-3">{s.membersCount} members{s.membership?.status === 'active' ? ' · joined' : ''}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-text-3" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-center text-[14px] text-text-3">
        Looking for a study partner? <Link href="/connect" className="font-semibold text-accent">Find classmates by skill</Link>
      </p>
    </div>
  );
}
