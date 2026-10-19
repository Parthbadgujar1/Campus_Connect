'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Armchair, Lightbulb, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { HousingCard } from '@/components/common/cards';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Select } from '@/components/ui/fields';
import { Input } from '@/components/ui/fields';
import { Sheet } from '@/components/ui/sheet';
import { Card, EmptyState, PageHeader, ScoreRing, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { housing, roommateMatches } from '@/data/living';
import { getPerson } from '@/data/people';
import { formatINR } from '@/lib/visuals';
import type { HousingKind } from '@/lib/types';

type Tab = 'Listings' | 'Roommates';
const KINDS: ('All' | HousingKind)[] = ['All', 'PG', 'Room', 'Hostel', 'Flat'];

export default function HousingPage() {
  return (
    <Suspense fallback={null}>
      <HousingContent />
    </Suspense>
  );
}

function HousingContent() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'roommates' ? 'Roommates' : 'Listings');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxRent, setMaxRent] = useState<number>(10000);
  const [gender, setGender] = useState<'Any' | 'Boys' | 'Girls' | 'Co-ed'>('Any');
  const [food, setFood] = useState<'Any' | 'Veg' | 'Non-veg' | 'Both' | 'No meals'>('Any');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const toast = useToast();

  const listings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return housing
      .filter((h) => kind === 'All' || h.kind === kind)
      .filter((h) => !verifiedOnly || h.verified)
      .filter((h) => h.rent <= maxRent)
      .filter((h) => gender === 'Any' || h.gender === gender)
      .filter((h) => food === 'Any' || h.food === food)
      .filter((h) => !q || h.title.toLowerCase().includes(q) || h.area.toLowerCase().includes(q));
  }, [kind, verifiedOnly, maxRent, gender, food, query]);

  const toggleCompare = (id: string) =>
    setCompare((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length >= 2 ? [list[1]!, id] : [...list, id]));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Housing"
        subtitle="PGs, rooms, hostels and roommates"
        back
        backHref="/campus"
        actions={
          tab === 'Listings' ? (
            <Button size="sm" variant="secondary" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4 space-y-4">
        <Segmented<Tab>
          label="Housing sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Listings', label: 'Find a place' },
            { value: 'Roommates', label: 'Find roommates' },
          ]}
        />

        {tab === 'Listings' && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Area or name" aria-label="Search housing" className="pl-10" />
            </div>
            <ChipRow>
              {KINDS.map((item) => (
                <Chip key={item} active={kind === item} onClick={() => setKind(item)}>
                  {item}
                </Chip>
              ))}
              <Chip active={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified only
              </Chip>
            </ChipRow>
          </>
        )}
      </div>

      {tab === 'Listings' && (
        <section className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {listings.length === 0 ? (
              <EmptyState icon={Armchair} title="No places match these filters" className="md:col-span-2" />
            ) : (
              listings.map((listing) => (
                <div key={listing.id} className="relative">
                  <HousingCard listing={listing} />
                  <button
                    type="button"
                    onClick={() => toggleCompare(listing.id)}
                    aria-pressed={compare.includes(listing.id)}
                    className={`absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${compare.includes(listing.id) ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2'}`}
                  >
                    {compare.includes(listing.id) ? 'Comparing' : 'Compare'}
                  </button>
                </div>
              ))
            )}
          </div>

          {compare.length === 2 && (() => {
            const [a, b] = compare.map((id) => housing.find((h) => h.id === id)!);
            if (!a || !b) return null;
            const rows: [string, string, string][] = [
              ['Rent / month', formatINR(a.rent), formatINR(b.rent)],
              ['Deposit', formatINR(a.deposit), formatINR(b.deposit)],
              ['Distance', `${a.distanceKm} km`, `${b.distanceKm} km`],
              ['Gender', a.gender, b.gender],
              ['Food', a.food, b.food],
              ['Verified', a.verified ? 'Yes' : 'No', b.verified ? 'Yes' : 'No'],
            ];
            return (
              <Card className="overflow-hidden">
                <div className="grid grid-cols-3 border-b border-border bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-2">
                  <span>Compare</span>
                  <span className="truncate">{a.title}</span>
                  <span className="truncate">{b.title}</span>
                </div>
                {rows.map(([label, left, right]) => (
                  <div key={label} className="grid grid-cols-3 gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0">
                    <span className="text-text-3">{label}</span>
                    <span className="font-medium">{left}</span>
                    <span className="font-medium">{right}</span>
                  </div>
                ))}
              </Card>
            );
          })()}
        </section>
      )}

      {tab === 'Roommates' && (
        <section className="mt-5 space-y-4">
          <p className="flex items-start gap-2 rounded-2xl bg-accent-soft p-4 text-sm text-accent-soft-ink">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Scores weigh budget, area, food, smoking, and when you study or sleep. Nothing is shared until you accept a request.
          </p>
          <SectionHeader title="Top matches" />
          <div className="space-y-3">
            {roommateMatches.map((match) => {
              const person = getPerson(match.personId);
              return (
                <Card key={match.personId} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={person.name} seed={person.id} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{person.name}</p>
                      <p className="truncate text-xs text-text-3">
                        {person.branch} · Year {person.year}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge>Budget {formatINR(match.budget)}</Badge>
                        <Badge>{match.area}</Badge>
                        <Badge>{match.food}</Badge>
                        <Badge>{match.studyTime}</Badge>
                        <Badge>Sleeps {match.sleepBy}</Badge>
                        {!match.smoking && <Badge tone="success">Non-smoker</Badge>}
                      </div>
                      {match.sharedInterests.length > 0 && (
                        <p className="mt-1.5 text-xs text-text-3">Shared: {match.sharedInterests.join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <ScoreRing value={match.score} />
                    <Button size="sm" variant="soft" onClick={() => toast(`Roommate request sent to ${person.name.split(' ')[0]} (demo)`)}>
                      Connect
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-center text-xs text-text-3">
            Share a flat with someone you have met in person. Meet before paying a deposit.
          </p>
        </section>
      )}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter places"
        footer={
          <Button full onClick={() => setFiltersOpen(false)}>
            Show {listings.length} places
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Maximum rent</p>
            <Select value={String(maxRent)} onChange={(e) => setMaxRent(Number(e.target.value))} aria-label="Maximum rent">
              <option value="10000">Any budget</option>
              <option value="4500">Up to ₹4,500</option>
              <option value="6000">Up to ₹6,000</option>
              <option value="8000">Up to ₹8,000</option>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Gender</p>
            <Select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} aria-label="Gender preference">
              <option>Any</option>
              <option>Boys</option>
              <option>Girls</option>
              <option>Co-ed</option>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Food</p>
            <Select value={food} onChange={(e) => setFood(e.target.value as typeof food)} aria-label="Food preference">
              <option>Any</option>
              <option>Veg</option>
              <option>Non-veg</option>
              <option>Both</option>
              <option>No meals</option>
            </Select>
          </div>
          <Link href="/housing?tab=roommates" onClick={() => setFiltersOpen(false)} className={buttonClass({ variant: 'ghost', full: true })}>
            Looking for a roommate instead?
          </Link>
        </div>
      </Sheet>
    </div>
  );
}
