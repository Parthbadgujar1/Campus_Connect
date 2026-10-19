'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowBigUp, Bell, CalendarClock, ChevronRight, MessageCircleQuestion, Megaphone, PenLine } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/ui/layout';
import { AmbienceButton } from '@/components/shell/ambience';
import { MomentsRail } from '@/components/feed/moments';
import { PostCard } from '@/components/feed/post-card';
import { posts } from '@/data/feed';
import { events } from '@/data/events';
import { opportunities } from '@/data/careers';
import { announcements, notifications } from '@/data/campus';
import { me, getPerson } from '@/data/people';
import { hushQuestions } from '@/data/hush';
import { spaces, threads } from '@/data/spaces';
import { loops } from '@/data/videos';
import { useAppState } from '@/lib/store';
import { NOW, daysUntil, formatTime, relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { AdminHome, ExpertHome, TeacherHome } from '@/components/home/role-homes';

const PAGE_SIZE = 5;

function StudentHome() {
  const readIds = useAppState((s) => s.readNotifications);
  const unread = notifications.filter((n) => !readIds.includes(n.id)).length;
  const [shown, setShown] = useState(PAGE_SIZE);
  const dateLabel = NOW.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

  const upcoming = [...events]
    .filter((e) => new Date(e.endsAt).getTime() >= NOW.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);
  const closing = [...opportunities]
    .filter((o) => daysUntil(o.deadline) >= 0)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3);
  const notices = [...announcements].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  const boardTop = [...threads].sort((a, b) => b.score - a.score).slice(0, 3);
  const questions = [...hushQuestions].sort((a, b) => b.votes - a.votes).slice(0, 3);
  const stream = posts.slice(0, shown);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
        <div className="min-w-0">
          <p className="text-[14px] text-text-3">{dateLabel}</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight md:text-[32px]">Hi, {me.name.split(' ')[0]}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <span className="md:hidden">
            <AmbienceButton />
          </span>
          <Link
            href="/notifications"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            className="press relative grid h-10 w-10 place-items-center rounded-full bg-surface text-text-2 shadow-card hover:text-text"
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />}
          </Link>
        </div>
      </header>

      <MomentsRail className="mt-5" />

      <div className="mt-8 space-y-10">
        {/* Happening soon */}
        <section aria-labelledby="soon">
          <SectionHeader title="Happening soon" action={{ label: 'All events', href: '/events' }} />
          <div className="stagger grid gap-3 md:grid-cols-3">
            {upcoming.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="press flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:border-accent/40">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-accent-soft text-center text-accent-soft-ink">
                  <span className="leading-tight">
                    <span className="block text-[11px] font-semibold uppercase">
                      {new Date(event.startsAt).toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}
                    </span>
                    <span className="block text-[20px] font-bold">{new Date(event.startsAt).toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{event.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-text-3">
                    {formatTime(event.startsAt)} · {event.venue}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Closing soon and notices */}
        <div className="grid gap-10 md:grid-cols-2">
          <section aria-labelledby="closing">
            <SectionHeader title="Closing soon" action={{ label: 'Opportunities', href: '/opportunities' }} />
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {closing.map((op) => {
                const days = daysUntil(op.deadline);
                return (
                  <li key={op.id}>
                    <Link href={`/opportunities/${op.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                      <CalendarClock className={cn('h-5 w-5 shrink-0', days <= 3 ? 'text-warning' : 'text-text-3')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{op.title}</span>
                        <span className="block truncate text-[13px] text-text-3">{op.org}</span>
                      </span>
                      <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', days <= 3 ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-text-2')}>
                        {days === 0 ? 'Today' : `${days} days`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="notices">
            <SectionHeader title="Notices" action={{ label: 'All notices', href: '/news' }} />
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {notices.map((notice) => (
                <li key={notice.id}>
                  <Link href="/news" className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                    <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold leading-snug">{notice.title}</span>
                      <span className="mt-0.5 block text-[13px] text-text-3">
                        {notice.author} · {relativeTime(notice.at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* For you */}
        <section aria-labelledby="stream">
          <SectionHeader title="For you" description="Picked from your classes, spaces and people you follow" />
          <Link href="/create" className="press flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 pr-4 transition-colors hover:border-accent/40">
            <Avatar name={me.name} seed={me.id} size="sm" />
            <span className="flex-1 text-[15px] text-text-3">Share a thought, a win or a question</span>
            <PenLine className="h-[18px] w-[18px] text-text-3" aria-hidden="true" />
          </Link>
          <div className="mt-4 space-y-4">
            {stream.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          {shown < posts.length && (
            <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="mt-5 h-11 w-full rounded-full border border-border bg-surface text-[15px] font-semibold text-text-2 hover:text-text">
              Show more
            </button>
          )}
        </section>

        {/* Boards */}
        <section aria-labelledby="boards">
          <SectionHeader title="Boards" description="Threads from the spaces you follow" action={{ label: 'Open boards', href: '/spaces' }} />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {boardTop.map((thread) => {
              const space = spaces.find((s) => s.slug === thread.spaceSlug);
              return (
                <li key={thread.id}>
                  <Link href={`/spaces/${thread.spaceSlug}/t/${thread.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2">
                    <span className="flex w-10 shrink-0 flex-col items-center text-text-2">
                      <ArrowBigUp className="h-5 w-5" aria-hidden="true" />
                      <span className="text-[13px] font-semibold">{thread.score}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-text-3">
                        {space?.name} · {getPerson(thread.authorId).name.split(' ')[0]}
                      </span>
                      <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{thread.title}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Loops */}
        <section aria-labelledby="loops-preview">
          <SectionHeader title="Loops" description="Short videos from campus" action={{ label: 'Watch all', href: '/loops' }} />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {loops.map((loop) => (
              <Link
                key={loop.id}
                href={`/loops?start=${loop.id}`}
                className="press flex aspect-[9/16] w-36 shrink-0 flex-col justify-end rounded-2xl bg-accent p-3 text-accent-ink md:w-44"
              >
                <span className="line-clamp-3 text-[14px] font-semibold leading-snug">{loop.caption}</span>
                <span className="mt-1 text-[12px] opacity-80">{getPerson(loop.authorId).name.split(' ')[0]}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Hush */}
        <section aria-labelledby="hush-preview">
          <SectionHeader title="Hush" description="Anonymous questions, answered by people who know" action={{ label: 'Open Hush', href: '/hush' }} />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {questions.map((question) => (
              <li key={question.id}>
                <Link href={`/hush/${question.id}`} className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2">
                  <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-text-3">{question.topic}</span>
                    <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">{question.body}</span>
                    <span className="mt-1 block text-[13px] text-text-3">
                      {question.answers.length} {question.answers.length === 1 ? 'answer' : 'answers'}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Each role lands on its own work: students see the feed, teachers and experts their tools, admins the queue. */
export default function HomePage() {
  const role = useAppState((s) => s.role);
  if (role === 'faculty') return <TeacherHome />;
  if (role === 'expert') return <ExpertHome />;
  if (role === 'admin') return <AdminHome />;
  return <StudentHome />;
}
