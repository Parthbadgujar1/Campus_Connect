'use client';

import { useMemo, useState } from 'react';
import { Briefcase, Search, SlidersHorizontal } from 'lucide-react';
import { OpportunityCard } from '@/components/common/opportunity-card';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Sheet } from '@/components/ui/sheet';
import { Input, Select, Switch } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { opportunities } from '@/data/careers';
import { me } from '@/data/people';
import type { OpportunityKind, WorkMode } from '@/lib/types';

const KINDS: ('All' | OpportunityKind)[] = [
  'All',
  'Internship',
  'Job',
  'Freelance',
  'Hackathon',
  'Competition',
  'Scholarship',
  'Research',
  'Workshop',
  'Certification',
  'Open Source',
  'Startup',
  'Ambassador',
  'Volunteering',
  'Part-time',
];

export default function OpportunitiesPage() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'Any' | WorkMode>('Any');
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [sort, setSort] = useState<'deadline' | 'applicants'>('deadline');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities
      .filter((o) => kind === 'All' || o.kind === kind)
      .filter((o) => mode === 'Any' || o.mode === mode)
      .filter((o) => !eligibleOnly || (o.minYear <= (me.year ?? 1) && (o.eligibleBranches.length === 0 || o.eligibleBranches.includes(me.branch ?? ''))))
      .filter((o) => !q || o.title.toLowerCase().includes(q) || o.org.toLowerCase().includes(q) || o.skills.some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'deadline' ? a.deadline.localeCompare(b.deadline) : b.applicants - a.applicants));
  }, [kind, query, mode, eligibleOnly, sort]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Opportunities"
        subtitle="Internships, scholarships, hackathons and freelance"
        back
        backHref="/campus"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setFiltersOpen(true)} aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
          </Button>
        }
      />

      <div className="mt-4 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Role, company or skill"
            aria-label="Search opportunities"
            className="pl-10"
          />
        </div>
        <ChipRow>
          {KINDS.map((item) => (
            <Chip key={item} active={kind === item} onClick={() => setKind(item)}>
              {item}
            </Chip>
          ))}
        </ChipRow>
        <div className="flex items-center justify-between text-sm">
          <p className="text-text-3">
            {list.length} {list.length === 1 ? 'opportunity' : 'opportunities'}
            {eligibleOnly ? ' you’re eligible for' : ''}
          </p>
          <Segmented<'deadline' | 'applicants'>
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'deadline', label: 'Closing soon' },
              { value: 'applicants', label: 'Popular' },
            ]}
            className="w-auto"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {list.length === 0 ? (
          <EmptyState icon={Briefcase} title="No opportunities match" description="Turn off the eligibility filter or try another category." className="md:col-span-2" />
        ) : (
          list.map((op) => <OpportunityCard key={op.id} opportunity={op} />)
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <Button full onClick={() => setFiltersOpen(false)}>
            Show {list.length} results
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Work mode</p>
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'Any' | WorkMode)} aria-label="Work mode">
              <option value="Any">Any</option>
              <option value="Remote">Remote</option>
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
            </Select>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <Switch
              label="Only show what I’m eligible for"
              description={`Year ${me.year} · ${me.branch}`}
              checked={eligibleOnly}
              onChange={setEligibleOnly}
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
