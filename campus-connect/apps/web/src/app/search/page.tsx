'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Briefcase, Calendar, FileText, Hash, Search, ShoppingBag, Users, Layers, MessageSquare, Palette, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { Input } from '@/components/ui/fields';
import { IconButton } from '@/components/ui/button';
import { communities } from '@/data/communities';
import { events } from '@/data/events';
import { allPeople } from '@/data/people';
import { opportunities, teamPosts } from '@/data/careers';
import { marketListings } from '@/data/living';
import { resources, attendance } from '@/data/learning';
import { creatorProjects } from '@/data/fun';
import { posts, trendingTopics } from '@/data/feed';
import { personMeta } from '@/components/common/person-row';
import { formatDay } from '@/lib/time';
import { formatINR } from '@/lib/visuals';

type Category = 'All' | 'People' | 'Communities' | 'Posts' | 'Notes' | 'Jobs' | 'Events' | 'Projects' | 'Courses' | 'Marketplace';
const CATEGORIES: Category[] = ['All', 'People', 'Communities', 'Posts', 'Notes', 'Jobs', 'Events', 'Projects', 'Courses', 'Marketplace'];

const RECENT = ['DBMS viva', 'Hackathon', 'Hostel B', 'Internship'];

/** Case-insensitive "contains" check across any number of fields. */
function matcher(q: string) {
  return (...fields: (string | undefined)[]) =>
    q.length > 0 && fields.some((field) => field?.toLowerCase().includes(q));
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const q = query.trim().toLowerCase();
  const has = matcher(q);

  const results = (() => {
    const show = (c: Category) => category === 'All' || category === c;
    return {
      people: show('People') ? allPeople.filter((p) => has(p.name, p.username, p.branch, p.department)).slice(0, 6) : [],
      communities: show('Communities') ? communities.filter((c) => has(c.name, c.description, ...c.tags)).slice(0, 6) : [],
      posts: show('Posts') ? posts.filter((p) => has(p.body, ...p.tags)).slice(0, 6) : [],
      notes: show('Notes') ? resources.filter((r) => has(r.title, r.subject, ...r.tags)).slice(0, 6) : [],
      jobs: show('Jobs') ? opportunities.filter((o) => has(o.title, o.org, o.kind, ...o.skills)).slice(0, 6) : [],
      events: show('Events') ? events.filter((e) => has(e.title, e.category, ...e.tags)).slice(0, 6) : [],
      projects: show('Projects')
        ? [
            ...teamPosts.filter((t) => has(t.title, t.description, ...t.lookingFor)).map((t) => ({ id: t.id, title: t.title, meta: t.type, href: `/teams/${t.id}` })),
            ...creatorProjects.filter((c) => has(c.title, c.blurb)).map((c) => ({ id: c.id, title: c.title, meta: c.kind, href: '/creators' })),
          ].slice(0, 6)
        : [],
      courses: show('Courses') ? attendance.filter((a) => has(a.subject)).slice(0, 6) : [],
      market: show('Marketplace') ? marketListings.filter((m) => has(m.title, m.category)).slice(0, 6) : [],
    };
  })();

  const total =
    results.people.length +
    results.communities.length +
    results.posts.length +
    results.notes.length +
    results.jobs.length +
    results.events.length +
    results.projects.length +
    results.courses.length +
    results.market.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Search"
        back
        backHref="/discover"
      />

      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="People, notes, jobs, events, projects…"
          aria-label="Search everything"
          className="h-12 pl-11 pr-11 text-base"
        />
        {query && (
          <IconButton label="Clear search" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>

      <ChipRow className="mt-4">
        {CATEGORIES.map((item) => (
          <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      {!q ? (
        <div className="mt-8 space-y-8">
          <section>
            <SectionHeader title="Trending" action={{ label: 'All trends', href: '/trending' }} />
            <div className="flex flex-wrap gap-2">
              {trendingTopics.map((topic) => (
                <Link
                  key={topic.tag}
                  href="/discover"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-2 hover:text-text"
                >
                  <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                  {topic.tag}
                </Link>
              ))}
            </div>
          </section>
          <section>
            <SectionHeader title="Recent" />
            <div className="flex flex-wrap gap-2">
              {RECENT.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="rounded-full bg-surface-2 px-3 py-1.5 text-sm text-text-2 hover:text-text"
                >
                  {term}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : total === 0 ? (
        <EmptyState icon={Search} title={`No results for “${query}”`} description="Try a shorter word, or switch the category." className="mt-8" />
      ) : (
        <div className="mt-6 space-y-8">
          {results.people.length > 0 && (
            <ResultGroup title="People" icon={Users}>
              {results.people.map((p) => (
                <ResultRow key={p.id} href={`/profile/${p.username}`} title={p.name} subtitle={personMeta(p)} leading={<Avatar name={p.name} seed={p.id} size="sm" />} />
              ))}
            </ResultGroup>
          )}
          {results.communities.length > 0 && (
            <ResultGroup title="Communities" icon={Layers}>
              {results.communities.map((c) => (
                <ResultRow key={c.id} href={`/spaces/${c.slug}`} title={c.name} subtitle={`${c.kind} · ${c.members} members`} />
              ))}
            </ResultGroup>
          )}
          {results.posts.length > 0 && (
            <ResultGroup title="Posts" icon={MessageSquare}>
              {results.posts.map((p) => (
                <ResultRow key={p.id} href={`/post/${p.id}`} title={p.body.slice(0, 80) + (p.body.length > 80 ? '…' : '')} subtitle={p.tags.map((t) => `#${t}`).join(' ')} />
              ))}
            </ResultGroup>
          )}
          {results.notes.length > 0 && (
            <ResultGroup title="Notes & resources" icon={FileText}>
              {results.notes.map((r) => (
                <ResultRow key={r.id} href="/resources" title={r.title} subtitle={`${r.kind} · ${r.subject}`} />
              ))}
            </ResultGroup>
          )}
          {results.jobs.length > 0 && (
            <ResultGroup title="Jobs & internships" icon={Briefcase}>
              {results.jobs.map((o) => (
                <ResultRow key={o.id} href={`/opportunities/${o.id}`} title={o.title} subtitle={`${o.org} · ${o.kind} · ${o.mode}`} />
              ))}
            </ResultGroup>
          )}
          {results.events.length > 0 && (
            <ResultGroup title="Events" icon={Calendar}>
              {results.events.map((e) => (
                <ResultRow key={e.id} href={`/events/${e.id}`} title={e.title} subtitle={`${formatDay(e.startsAt)} · ${e.venue}`} />
              ))}
            </ResultGroup>
          )}
          {results.projects.length > 0 && (
            <ResultGroup title="Projects" icon={Palette}>
              {results.projects.map((p) => (
                <ResultRow key={p.id} href={p.href} title={p.title} subtitle={p.meta} />
              ))}
            </ResultGroup>
          )}
          {results.courses.length > 0 && (
            <ResultGroup title="Courses" icon={BookOpen}>
              {results.courses.map((c) => (
                <ResultRow key={c.subject} href="/academics" title={c.subject} subtitle={`${Math.round((c.attended / c.total) * 100)}% attendance`} />
              ))}
            </ResultGroup>
          )}
          {results.market.length > 0 && (
            <ResultGroup title="Marketplace" icon={ShoppingBag}>
              {results.market.map((m) => (
                <ResultRow
                  key={m.id}
                  href={`/marketplace/${m.id}`}
                  title={m.title}
                  subtitle={`${m.mode} · ${m.price === null ? 'No price' : m.price === 0 ? 'Free' : formatINR(m.price)}`}
                  trailing={<Badge>{m.condition}</Badge>}
                />
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {title}
      </h2>
      <Card className="divide-y divide-border">{children}</Card>
    </section>
  );
}

function ResultRow({
  href,
  title,
  subtitle,
  leading,
  trailing,
}: {
  href: string;
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-text-3">{subtitle}</span>}
      </span>
      {trailing}
    </Link>
  );
}
