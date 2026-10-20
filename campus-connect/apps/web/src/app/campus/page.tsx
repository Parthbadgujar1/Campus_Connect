'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Briefcase,
  CalendarDays,
  FolderOpen,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Home as HomeIcon,
  Layers,
  LifeBuoy,
  Megaphone,
  NotebookPen,
  Package,
  PenLine,
  PiggyBank,
  Plane,
  Search,
  ShieldAlert,
  ShoppingBag,
  Store,
  Target,
  Timer,
  UsersRound,
  Video,
  Wrench,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/layout';
import { AmbienceButton } from '@/components/shell/ambience';
import { college } from '@/data/people';
import { cn } from '@/lib/utils';

interface Tile {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

// Order matters: each group reads top to bottom as a student's day.
const COLLEGE_LIFE: Tile[] = [
  { href: '/events', title: 'Events', description: 'Fests, workshops, RSVP', icon: CalendarDays },
  { href: '/news', title: 'Notices & news', description: 'Department notices and results', icon: Megaphone },
  { href: '/lost-found', title: 'Lost & found', description: 'Report or claim', icon: Search },
  { href: '/help', title: 'Ask a peer', description: 'Notes, help and tips', icon: LifeBuoy },
  { href: '/feedback', title: 'Feedback', description: 'Surveys and ideas', icon: HeartHandshake },
  { href: '/safety', title: 'Safety', description: 'Emergency contacts', icon: ShieldAlert },
];

const CAREER: Tile[] = [
  { href: '/opportunities', title: 'Opportunities', description: 'Internships, scholarships', icon: Target },
  { href: '/jobs', title: 'Jobs', description: 'Apply and track', icon: Briefcase },
  { href: '/teams', title: 'Teams', description: 'Find teammates', icon: Handshake },
  { href: '/placements', title: 'Placements', description: 'Drives and preparation', icon: GraduationCap },
  { href: '/achievements', title: 'Achievements', description: 'XP and badges', icon: Award },
  { href: '/mentorship', title: 'Alumni & mentors', description: 'Referrals, advice, seniors', icon: UsersRound },
];

const LIVING: Tile[] = [
  { href: '/housing', title: 'Housing', description: 'PGs and roommates', icon: HomeIcon },
  { href: '/marketplace', title: 'Market', description: 'Buy, borrow, swap', icon: ShoppingBag },
  { href: '/services', title: 'Services', description: 'Help from students', icon: Wrench },
  { href: '/offers', title: 'Offers', description: 'Student discounts', icon: Store },
  { href: '/travel', title: 'Travel', description: 'Trips and partners', icon: Plane },
  { href: '/finance', title: 'Money', description: 'Budget and splits', icon: PiggyBank },
  { href: '/business', title: 'Business hub', description: 'For local shops', icon: Package },
];

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          className="press flex h-[124px] w-[148px] shrink-0 flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40 md:w-auto"
        >
          <tile.icon className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
          <span>
            <span className="block truncate text-[15px] font-semibold">{tile.title}</span>
            <span className="block truncate text-[13px] text-text-3">{tile.description}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function CampusPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
        <div className="min-w-0">
          <h1 className="marker-heading text-[30px] font-bold leading-tight tracking-tight md:text-[32px]">Campus</h1>
          <p className="mt-1 text-[14px] text-text-3">
            {college.name} · Semester {college.semester}
          </p>
        </div>
        <span className="md:hidden">
          <AmbienceButton />
        </span>
      </header>

      {/* Study: the first thing on Campus */}
      <section aria-labelledby="study" className="mt-8">
        <SectionHeader title="Study" description="Focus first, then the notes, lectures and people to study with" />
        <div className="stagger grid gap-3 md:grid-cols-3">
          <Link href="/study/focus" className="press flex min-h-[156px] flex-col justify-between rounded-2xl bg-accent p-5 text-accent-ink md:row-span-2">
            <Timer className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
            <span>
              <span className="block text-[22px] font-bold">Focus</span>
              <span className="mt-1 block text-[15px] opacity-85">A timer for deep work, with breaks you can actually take</span>
            </span>
          </Link>
          <Link href="/resources" className="press flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40">
            <FolderOpen className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
            <span>
              <span className="block text-[16px] font-semibold">Stacks</span>
              <span className="block text-[14px] text-text-3">Notes and previous papers from students, teachers and the office</span>
            </span>
          </Link>
          <Link href="/contributions" className="press flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40">
            <PenLine className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
            <span>
              <span className="block text-[16px] font-semibold">Your ink</span>
              <span className="block text-[14px] text-text-3">What you have shared, answered and helped with</span>
            </span>
          </Link>
          <Link href="/lectures" className="press flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40">
            <Video className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
            <span>
              <span className="block text-[16px] font-semibold">Lectures</span>
              <span className="block text-[14px] text-text-3">Videos from teachers, YouTube and other links</span>
            </span>
          </Link>
          <Link href="/study" className="press flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40">
            <UsersRound className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
            <span>
              <span className="block text-[16px] font-semibold">Study together</span>
              <span className="block text-[14px] text-text-3">Find a partner, join a circle or see who is studying now</span>
            </span>
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[14px] font-semibold">
          {[
            { href: '/study/flashcards', label: 'Flashcards', icon: Layers },
            { href: '/study/notes', label: 'Personal notes', icon: NotebookPen },
            { href: '/academics', label: 'Timetable and attendance', icon: GraduationCap },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 text-text-2 hover:text-text">
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="College life" className="mt-10">
        <SectionHeader title="College life" description="Everything happening on campus" />
        <TileGrid tiles={COLLEGE_LIFE} />
      </section>

      <section aria-label="Career" className="mt-10">
        <SectionHeader title="Career" description="Opportunities, teams and people who have been there" />
        <TileGrid tiles={CAREER} />
      </section>

      <section aria-label="Living" className="mt-10">
        <SectionHeader title="Living" description="Rooms, buying, travel and money" />
        <TileGrid tiles={LIVING} />
      </section>

      <p className={cn('mt-12 text-center text-[13px] text-text-3')}>More campus services will appear here as they open.</p>
    </div>
  );
}
