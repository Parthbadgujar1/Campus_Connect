'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ClipboardCheck, FileText, Flag, Handshake, Megaphone, MessageCircleQuestion, UserPlus, Users, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/ui/layout';
import { AmbienceButton } from '@/components/shell/ambience';
import { contentQueue, reportQueue, verificationQueue } from '@/data/admin';
import { mentors, referralRequests } from '@/data/careers';
import { hushQuestions } from '@/data/hush';
import { getPerson } from '@/data/people';
import { lectures, resources } from '@/data/learning';
import { useAppState } from '@/lib/store';
import { NOW, relativeTime } from '@/lib/time';

const firstName = (name: string) => name.replace(/^(Prof\.|Dr\.)\s*/, '').split(' ')[0];

function Header({ name }: { name: string }) {
  const dateLabel = NOW.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  return (
    <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
      <div>
        <p className="text-[14px] text-text-3">{dateLabel}</p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight md:text-[32px]">Hi, {firstName(name)}</h1>
      </div>
      <span className="md:hidden">
        <AmbienceButton />
      </span>
    </header>
  );
}

function ActionTile({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="press flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
      <Icon className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] text-text-3">{description}</span>
      </span>
    </Link>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
      <span className="block text-[13px] text-text-3">{label}</span>
      <span className="mt-1 block text-[28px] font-bold tabular-nums">{value}</span>
    </Link>
  );
}

/** Teachers: lectures, shared notes to review, and questions from students. */
export function TeacherHome() {
  const name = useAppState((s) => s.session?.name ?? 'Teacher');
  const myLectures = lectures.filter((l) => l.facultyId === 'f-anita');
  const toReview = resources.filter((r) => !r.approved);
  const questions = hushQuestions.filter((q) => ['DBMS', 'Machine Learning', 'Operating Systems'].includes(q.topic)).slice(0, 3);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <Header name={name} />
      <div className="mt-8 space-y-10">
        <section aria-label="Teaching tools" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ActionTile href="/lectures?add=1" title="Add a lecture" description="Upload a video or share a link" icon={Video} />
          <ActionTile href="/resources?review=1" title="Review notes" description={`${toReview.length} waiting for approval`} icon={ClipboardCheck} />
          <ActionTile href="/hush" title="Answer questions" description="Students asking in Hush" icon={MessageCircleQuestion} />
          <ActionTile href="/news?new=1" title="Post a notice" description="Reach your class" icon={Megaphone} />
        </section>

        <section aria-labelledby="my-lectures">
          <SectionHeader title="Your lectures" action={{ label: 'All lectures', href: '/lectures' }} />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {myLectures.map((lecture) => (
              <li key={lecture.id}>
                <Link href="/lectures" className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                  <Video className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{lecture.title}</span>
                    <span className="block truncate text-[13px] text-text-3">
                      {lecture.subject} · {lecture.views.toLocaleString('en-IN')} views · {relativeTime(lecture.uploadedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="student-questions">
          <SectionHeader title="Questions from students" action={{ label: 'Open Hush', href: '/hush' }} />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {questions.map((question) => (
              <li key={question.id}>
                <Link href={`/hush/${question.id}`} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-text-3">{question.topic}</span>
                    <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{question.body}</span>
                  </span>
                  <span className="hand-label shrink-0 bg-mark-soft px-2.5 py-0.5 text-[13px] text-mark">
                    {question.answers.length === 0 ? 'Unanswered' : `${question.answers.length} answers`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Industry experts: mentoring requests, referrals and opportunities to post. */
export function ExpertHome() {
  const name = useAppState((s) => s.session?.name ?? 'Expert');
  const mine = mentors.find((m) => getPerson(m.personId).name === name) ?? mentors[0]!;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <Header name={name} />
      <div className="mt-8 space-y-10">
        <section aria-label="Expert tools" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ActionTile href="/opportunities?new=1" title="Post an opportunity" description="Internship, job or project" icon={Handshake} />
          <ActionTile href="/mentorship" title="Mentoring" description={`${mine.slotsOpen} slots open`} icon={UserPlus} />
          <ActionTile href="/hush" title="Answer on Hush" description="Questions in your expertise" icon={MessageCircleQuestion} />
          <ActionTile href="/mentorship?tab=referrals" title="Referrals" description={`${referralRequests.filter((r) => r.status === 'Open').length} open requests`} icon={Users} />
        </section>

        <section aria-labelledby="referral-requests">
          <SectionHeader title="Referral requests" description="Students asking for a referral at your company or a similar one" />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {referralRequests.map((request) => {
              const asker = getPerson(request.askerId);
              return (
                <li key={request.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar name={asker.name} seed={asker.id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{request.role}</span>
                    <span className="block truncate text-[13px] text-text-3">
                      {request.company} · {asker.name.split(' ')[0]}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-semibold text-text-2">{request.status}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Admins: what needs a decision today. */
export function AdminHome() {
  const name = useAppState((s) => s.session?.name ?? 'Admin');
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <Header name={name} />
      <div className="mt-8 space-y-10">
        <section aria-label="Waiting for a decision" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Content to approve" value={contentQueue.length} href="/admin/content" />
          <Stat label="Reports" value={reportQueue.length} href="/admin/moderation" />
          <Stat label="Verifications" value={verificationQueue.length} href="/admin/students" />
          <Stat label="Notes to review" value={resources.filter((r) => !r.approved).length} href="/admin/content" />
        </section>

        <section aria-label="Admin tools" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ActionTile href="/admin/announcements" title="Send a notice" description="To students or staff" icon={Megaphone} />
          <ActionTile href="/admin/lectures" title="Lectures" description="Review uploads and links" icon={Video} />
          <ActionTile href="/admin/moderation" title="Moderation" description="Reports and flags" icon={Flag} />
          <ActionTile href="/admin/content" title="Content" description="Approve notes and events" icon={FileText} />
        </section>
      </div>
    </div>
  );
}

