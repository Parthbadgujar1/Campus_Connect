'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Briefcase, Calendar, Clock, FileText, Hash, MessageSquare, PlayCircle, Search, ShoppingBag, Users, VenetianMask, X, PackageSearch } from 'lucide-react';
import { get, withQuery } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import type { SearchResults, SearchType } from '@/lib/api/modules';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Input } from '@/components/ui/fields';
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { Stagger, StaggerItem } from '@/components/motion';
import { EndOfList } from '@/components/ui/infinite';
import { ago, day } from '@/lib/live-time';
import { cn } from '@/lib/utils';

type Row = Record<string, any> & { id: string; link: string };

const TYPES: Array<{ type: SearchType; label: string; icon: LucideIcon }> = [
  { type: 'people', label: 'People', icon: Users },
  { type: 'posts', label: 'Posts', icon: MessageSquare },
  { type: 'discussions', label: 'Discussions', icon: Hash },
  { type: 'spaces', label: 'Spaces', icon: Users },
  { type: 'events', label: 'Events', icon: Calendar },
  { type: 'opportunities', label: 'Opportunities', icon: Briefcase },
  { type: 'resources', label: 'Shelf', icon: BookOpen },
  { type: 'lectures', label: 'Lectures', icon: PlayCircle },
  { type: 'hush', label: 'Hush', icon: VenetianMask },
  { type: 'listings', label: 'Marketplace', icon: ShoppingBag },
  { type: 'lost_found', label: 'Lost & found', icon: PackageSearch },
];
const LABEL = Object.fromEntries(TYPES.map((t) => [t.type, t])) as Record<SearchType, (typeof TYPES)[number]>;

const RECENT_KEY = 'cc.search.recent';
function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    // Private mode: recent searches are just not remembered.
  }
}

function rupees(paise: number | null | undefined) {
  return paise ? `₹${(paise / 100).toLocaleString('en-IN')}` : 'Free';
}

function describe(type: SearchType, r: Row): { title: string; subtitle: string } {
  switch (type) {
    case 'people':
      return { title: r.displayName, subtitle: r.headline ?? [r.department, r.year ? `Year ${r.year}` : null].filter(Boolean).join(' · ') };
    case 'posts':
      return { title: r.body, subtitle: `${r.author} · ${ago(r.createdAt)}` };
    case 'discussions':
      return { title: r.title, subtitle: `${r.space} · ${r.replies} replies · ${r.score} votes` };
    case 'spaces':
      return { title: r.name, subtitle: `${r.members} members · ${r.kind}` };
    case 'events':
      return { title: r.title, subtitle: `${day(r.startsAt)} · ${r.venue ?? 'Online'}` };
    case 'opportunities':
      return { title: r.title, subtitle: `${r.orgName} · ${String(r.kind).replace('_', ' ')} · closes ${day(r.deadline)}` };
    case 'resources':
      return { title: r.title, subtitle: `${r.subject ?? 'General'} · ${r.downloads} downloads` };
    case 'lectures':
      return { title: r.title, subtitle: [r.subject, r.durationSeconds ? `${Math.round(r.durationSeconds / 60)} min` : null].filter(Boolean).join(' · ') };
    case 'hush':
      return { title: r.body, subtitle: `${r.topic} · ${r.answers} answers` };
    case 'listings':
      return { title: r.title, subtitle: `${r.mode === 'sell' || r.mode === 'rent' ? rupees(r.pricePaise) : r.mode}${r.condition ? ` · ${String(r.condition).replace('_', ' ')}` : ''}` };
    case 'lost_found':
      return { title: r.title, subtitle: `${r.kind === 'lost' ? 'Lost' : 'Found'} · ${r.location ?? ''} · ${day(r.occurredAt)}` };
  }
}

function ResultRow({ type, r }: { type: SearchType; r: Row }) {
  const { title, subtitle } = describe(type, r);
  const Icon = LABEL[type].icon;
  return (
    <Link href={r.link} className="press flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-2">
      {type === 'people' ? (
        <PersonAvatar person={r as never} size="sm" />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 font-semibold">{title}</span>
        <span className="line-clamp-1 text-[13px] text-text-3">{subtitle}</span>
      </span>
    </Link>
  );
}

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = (params.get('q') ?? '').trim();
  const type = (params.get('type') as SearchType | null) ?? null;
  const [text, setText] = useState(q);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => setText(q), [q]);

  // Typing updates the address after a short pause, so Back returns to the previous search.
  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(() => router.replace(withQuery(pathname, { q: next || null, type }), { scroll: false }), 350);
    return () => clearTimeout(t);
  }, [text, q, type, router, pathname]);

  const ready = q.length >= 2;
  const results = useQuery<SearchResults>(ready ? `search:${type ?? 'all'}:${q}` : null, (signal) => get('/search', { q, type: type ?? 'all', limit: 30 }, signal));
  useEffect(() => {
    if (!results.data || !results.data.total) return;
    const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())];
    saveRecent(next);
    setRecent(next.slice(0, 8));
  }, [results.data, q]);

  const setType = (t: SearchType | null) => router.replace(withQuery(pathname, { q: q || null, type: t }), { scroll: false });
  const groups = results.data ? TYPES.filter((t) => (results.data!.results[t.type] ?? []).length > 0) : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Search" back />
      <form className="relative" onSubmit={(e) => { e.preventDefault(); router.replace(withQuery(pathname, { q: text.trim() || null, type }), { scroll: false }); }}>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="People, notes, events, jobs, spaces…" className="h-12 pl-12 pr-11 text-[16px]" aria-label="Search CampusConnect" autoFocus enterKeyHint="search" maxLength={80} />
        {text && (
          <button type="button" onClick={() => setText('')} aria-label="Clear search" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-surface-2">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>
      <ChipRow className="mt-3">
        <Chip active={!type} onClick={() => setType(null)}>All</Chip>
        {TYPES.map((t) => (
          <Chip key={t.type} active={type === t.type} onClick={() => setType(t.type)}>{t.label}</Chip>
        ))}
      </ChipRow>

      <div className="mt-5">
        {!ready && (
          <>
            {text.trim().length === 1 && <p className="mb-4 text-[14px] text-text-3">Type at least 2 characters.</p>}
            {recent.length > 0 ? (
              <section>
                <SectionHeader title="Recent searches" action={{ label: 'Clear', onClick: () => { saveRecent([]); setRecent([]); } }} />
                <ChipRow>
                  {recent.map((r) => (
                    <Chip key={r} onClick={() => setText(r)}><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {r}</Chip>
                  ))}
                </ChipRow>
              </section>
            ) : (
              <EmptyState icon={Search} title="Search all of campus" description="Find classmates, notes, events, openings, spaces, listings and more. Only things you are allowed to see show up." />
            )}
          </>
        )}
        {ready && results.loading && <SkeletonList variant="row" count={6} />}
        {ready && results.error && <ErrorState error={results.error} onRetry={results.reload} />}
        {ready && results.data && !results.data.total && (
          <EmptyState icon={FileText} title={`Nothing found for “${q}”`} description={type ? `Try All, or check the spelling.` : 'Try a shorter word or a different spelling.'} action={type ? <button type="button" className="font-semibold text-accent" onClick={() => setType(null)}>Search everything</button> : undefined} />
        )}
        {ready && results.data && results.data.total > 0 && (
          <Stagger className="space-y-6">
            {groups.map((g) => {
              const rows = (results.data!.results[g.type] ?? []) as Row[];
              return (
                <StaggerItem key={g.type}>
                  <section aria-label={g.label}>
                    <SectionHeader title={g.label} action={!type && rows.length >= 4 ? { label: 'See all', onClick: () => setType(g.type) } : undefined} />
                    <div className={cn('-mx-3 space-y-0.5')}>
                      {rows.map((r) => <ResultRow key={r.id} type={g.type} r={r} />)}
                    </div>
                  </section>
                </StaggerItem>
              );
            })}
            {type && <EndOfList message="That’s everything for this search" />}
            {results.data.unavailable.length > 0 && <p className="text-[12px] text-text-3">Some sections are switched off for your campus right now.</p>}
          </Stagger>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 pt-24"><SkeletonList variant="row" count={4} /></div>}>
      <SearchInner />
    </Suspense>
  );
}
