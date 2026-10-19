'use client';

import Link from 'next/link';
import { Bookmark, CheckCircle2, Clock, MessageCircleQuestion, PenLine, ThumbsUp } from 'lucide-react';
import { PageHeader, SectionHeader } from '@/components/ui/layout';
import { inkSummary, myInk, type Ink } from '@/data/contributions';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

const KIND_ICON = {
  Note: PenLine,
  Answer: MessageCircleQuestion,
  Help: ThumbsUp,
  Question: Bookmark,
} as const;

const STATUS_STYLE: Record<Ink['status'], string> = {
  Approved: 'bg-success-soft text-success',
  Answered: 'bg-accent-soft text-accent-soft-ink',
  Pending: 'bg-warning-soft text-warning',
  Open: 'bg-surface-2 text-text-2',
};

export default function ContributionsPage() {
  const toNext = inkSummary.nextLevelPoints - inkSummary.points;
  const progress = Math.round((inkSummary.points / inkSummary.nextLevelPoints) * 100);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Your ink" subtitle="What you have shared, answered and helped with" back backHref="/campus" />

      <section aria-label="Summary" className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[14px] text-text-3">Level {inkSummary.level}</p>
            <p className="text-[30px] font-bold leading-none tabular-nums">{inkSummary.points.toLocaleString('en-IN')} points</p>
          </div>
          <p className="text-[14px] text-text-3">{toNext} to level {inkSummary.level + 1}</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Notes approved', value: inkSummary.notesApproved },
            { label: 'Answers accepted', value: inkSummary.answersAccepted },
            { label: 'Thanks received', value: inkSummary.thanks },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-[12px] text-text-3">{stat.label}</dt>
              <dd className="mt-0.5 text-[20px] font-bold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/resources?upload=1" className="press flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[15px] font-semibold text-accent-ink">
          <PenLine className="h-4 w-4" aria-hidden="true" />
          Share a note
        </Link>
        <Link href="/hush" className="press flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-[15px] font-semibold">
          <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
          Answer a question
        </Link>
      </div>

      <section aria-labelledby="ink-list" className="mt-10">
        <SectionHeader title="Everything you have shared" />
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {myInk.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id}>
                <Link href={item.href} className="flex items-start gap-3.5 px-4 py-4 transition-colors hover:bg-surface-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{item.title}</span>
                    <span className="mt-1 block text-[13px] text-text-3">
                      {item.kind} · {item.subject} · {relativeTime(item.at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', STATUS_STYLE[item.status])}>
                      {item.status === 'Pending' ? <Clock className="h-3 w-3" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                      {item.status}
                    </span>
                    {item.thanks > 0 && <span className="mt-1 block text-[12px] text-text-3">{item.thanks} thanks</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-6">
          <Link href="/help" className="flex h-11 w-full items-center justify-center rounded-full border border-border bg-surface text-[15px] font-semibold">
            Find people who need help
          </Link>
        </div>
      </section>
    </div>
  );
}
