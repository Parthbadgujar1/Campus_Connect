'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpenCheck,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Home as HomeIcon,
  Megaphone,
  MessageCircleQuestion,
  PenLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Target,
  Timer,
  UsersRound,
  Video,
  Wrench,
} from 'lucide-react';
import { AmbienceButton } from '@/components/shell/ambience';
import { SectionHeader } from '@/components/ui/layout';
import { UnseenDot } from '@/components/ui/unseen';
import { Pressable, Reveal, Stagger, StaggerItem } from '@/components/motion';
import { usePendingSurveys } from '@/components/surveys/survey-gate';
import { appActions } from '@/lib/store';
import { useSession } from '@/lib/session';
import { can, type Capability } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface Tile {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  needs?: Capability;
}

// Order matters: each group reads top to bottom as a student's day. Every tile opens a section
// with real data from the college; tiles a role cannot use are not shown.
const STUDY: Tile[] = [
  { href: '/resources', title: 'Shelf', description: 'Notes and past papers by subject', icon: FolderOpen, needs: 'shelf' },
  { href: '/lectures', title: 'Lectures', description: 'Videos and links from teachers', icon: Video, needs: 'lectures' },
  { href: '/study', title: 'Study tools', description: 'Focus timer, notes and study groups', icon: BookOpenCheck, needs: 'study' },
  { href: '/contributions', title: 'My contributions', description: 'Your uploads, questions and listings', icon: PenLine },
];

const COLLEGE_LIFE: Tile[] = [
  { href: '/events', title: 'Events', description: 'Fests, workshops, RSVP', icon: CalendarDays, needs: 'events' },
  { href: '/news', title: 'Notices & news', description: 'Department notices and results', icon: Megaphone, needs: 'news' },
  { href: '/feedback', title: 'Feedback', description: 'Surveys and ideas for the app', icon: HeartHandshake, needs: 'feedback' },
  { href: '/lost-found', title: 'Lost & found', description: 'Report or claim', icon: Search, needs: 'lostFound' },
  { href: '/hush', title: 'Ask anonymously', description: 'Questions you would rather not sign', icon: MessageCircleQuestion, needs: 'hush' },
  { href: '/safety', title: 'Safety', description: 'Emergency numbers and help', icon: ShieldAlert },
];

const CAREER: Tile[] = [
  { href: '/opportunities', title: 'Opportunities', description: 'Internships, hackathons, scholarships', icon: Target, needs: 'opportunities' },
  { href: '/jobs', title: 'Jobs', description: 'Full-time and part-time roles', icon: Briefcase, needs: 'opportunities' },
  { href: '/placements', title: 'Placements', description: 'Drives and your applications', icon: GraduationCap, needs: 'opportunities' },
  { href: '/mentorship', title: 'Mentors', description: 'Industry experts and alumni', icon: UsersRound },
  { href: '/teams', title: 'Team up', description: 'Find teammates for competitions', icon: Handshake, needs: 'spaces' },
];

const LIVING: Tile[] = [
  { href: '/marketplace', title: 'Market', description: 'Buy, borrow, swap or give away', icon: ShoppingBag, needs: 'market' },
  { href: '/housing', title: 'Rooms & PGs', description: 'Rooms to rent near campus', icon: HomeIcon, needs: 'market' },
  { href: '/services', title: 'Services', description: 'Tutoring, repairs, design by students', icon: Wrench, needs: 'market' },
];

const TEACHING: Tile[] = [
  { href: '/news?compose=1', title: 'Publish a notice', description: 'To the college, a department or a year', icon: Megaphone, needs: 'news.publish' },
  { href: '/lectures?add=1', title: 'Add a lecture', description: 'A video upload or a YouTube link', icon: Video, needs: 'lectures.publish' },
  { href: '/admin/content', title: 'Review uploads', description: 'Shelf items waiting for approval', icon: ClipboardCheck, needs: 'shelf.review' },
];

function TileCard({ tile }: { tile: Tile }) {
  return (
    <Pressable className="h-full">
      <Link
        href={tile.href}
        onClick={() => appActions.markSeen(tile.href.split('?')[0]!)}
        className="relative flex h-full min-h-[132px] flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
      >
        <UnseenDot href={tile.href.split('?')[0]!} />
        <tile.icon className="h-6 w-6 text-accent" strokeWidth={1.8} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-semibold">{tile.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] text-text-3">{tile.description}</span>
        </span>
      </Link>
    </Pressable>
  );
}

/** Four tiles to start with, then a "See more" control that says how many are left. */
function TileGrid({ tiles, preview = 4 }: { tiles: Tile[]; preview?: number }) {
  const [open, setOpen] = useState(false);
  const hidden = Math.max(0, tiles.length - preview);
  const shown = open ? tiles : tiles.slice(0, preview);
  return (
    <div>
      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((tile) => (
          <StaggerItem key={tile.href}>
            <TileCard tile={tile} />
          </StaggerItem>
        ))}
      </Stagger>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="press mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface text-[14px] font-semibold text-accent transition-colors hover:bg-surface-2"
        >
          {open ? 'Show less' : `See more · ${hidden} more`}
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', open && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function CampusPage() {
  const { user } = useSession();
  const surveys = usePendingSurveys();
  const allowed = (tiles: Tile[]) => tiles.filter((t) => !t.needs || can(user, t.needs));
  const groups: Array<{ id: string; title: string; description: string; tiles: Tile[] }> = [
    { id: 'teaching', title: 'Teaching', description: 'Tools for faculty and staff', tiles: allowed(TEACHING) },
    { id: 'study', title: 'Study', description: 'Notes, lectures and tools', tiles: allowed(STUDY) },
    { id: 'life', title: 'College life', description: 'Everything happening on campus', tiles: allowed(COLLEGE_LIFE) },
    { id: 'career', title: 'Career', description: 'Opportunities, mentors and teammates', tiles: allowed(CAREER) },
    { id: 'living', title: 'Living', description: 'Buying, rooms and help from students', tiles: allowed(LIVING) },
  ].filter((g) => g.tiles.length > 0);
  const optional = surveys.data?.optional ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 md:px-8 md:pb-16">
      <header className="pt-safe flex items-start justify-between gap-4 pt-6 md:pt-10">
        <Reveal className="min-w-0">
          <h1 className="marker-heading hl-blue text-[30px] font-bold leading-tight tracking-tight md:text-[32px]">Campus</h1>
          {user?.role !== 'expert' && <p className="mt-1 text-[14px] text-text-3">{user?.college.name}</p>}
        </Reveal>
        <div className="flex shrink-0 items-center gap-2">
          {can(user, 'study') && (
            <Link href="/study/focus" onClick={() => appActions.markSeen('/study/focus')} className="press relative inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[14px] font-semibold text-accent-ink shadow-card">
              <Timer className="h-4 w-4" aria-hidden="true" />
              Focus
              <UnseenDot href="/study/focus" placement="inline" className="bg-highlight ring-accent" />
            </Link>
          )}
          {can(user, 'admin') && (
            <Link href="/admin" className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[14px] font-semibold">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {user?.role === 'faculty' ? 'Review' : 'Admin'}
            </Link>
          )}
          <span className="md:hidden">
            <AmbienceButton />
          </span>
        </div>
      </header>

      {optional.length > 0 && (
        <Reveal delay={0.05}>
          <Link href={`/surveys/${optional[0]!.id}`} className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4 text-accent-soft-ink">
            <ClipboardCheck className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{optional[0]!.title}</span>
              <span className="block text-[13px] opacity-80">A short survey from CampusConnect{optional.length > 1 ? ` · ${optional.length - 1} more waiting` : ''}</span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold">Answer</span>
          </Link>
        </Reveal>
      )}

      {groups.map((g) => (
        <section key={g.id} aria-label={g.title} className="mt-9">
          <SectionHeader title={g.title} description={g.description} />
          <TileGrid tiles={g.tiles} />
        </section>
      ))}
    </div>
  );
}
