'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, ShieldCheck, ShoppingBag } from 'lucide-react';
import { ListingCard, InfoBanner } from '@/components/common/cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { marketListings } from '@/data/living';
import { formatDay } from '@/lib/time';

type View = 'Buy' | 'Borrow' | 'Exchange' | 'Mine';
const CATEGORIES = ['All', 'Books', 'Electronics', 'Laptops & phones', 'Furniture', 'Cycles & bikes', 'College equipment', 'Clothes & accessories', 'Sports equipment'];

export default function MarketplacePage() {
  const toast = useToast();
  const [view, setView] = useState<View>('Buy');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sellOpen, setSellOpen] = useState(false);
  const [sort, setSort] = useState<'new' | 'low' | 'high'>('new');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = marketListings.filter((l) => {
      if (view === 'Buy') return l.mode === 'Buy' || l.mode === 'Free';
      if (view === 'Borrow') return l.mode === 'Borrow';
      if (view === 'Exchange') return l.mode === 'Exchange';
      return false;
    });
    return base
      .filter((l) => category === 'All' || l.category.toLowerCase().includes(category.toLowerCase().split(' ')[0] ?? ''))
      .filter((l) => !q || l.title.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'low') return (a.price ?? 0) - (b.price ?? 0);
        if (sort === 'high') return (b.price ?? 0) - (a.price ?? 0);
        return b.postedAt.localeCompare(a.postedAt);
      });
  }, [view, category, query, sort]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Marketplace"
        subtitle="Buy, sell, borrow and swap with verified students"
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setSellOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Sell
          </Button>
        }
      />

      <div className="mt-4 space-y-4">
        <UnderlineTabs<View>
          label="Marketplace sections"
          value={view}
          onChange={setView}
          options={[
            { value: 'Buy', label: 'Buy & sell' },
            { value: 'Borrow', label: 'Borrow' },
            { value: 'Exchange', label: 'Exchange' },
            { value: 'Mine', label: 'My listings' },
          ]}
        />

        {view !== 'Mine' && (
          <>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
                <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books, laptops, cycles…" aria-label="Search marketplace" className="pl-10" />
              </div>
              <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort listings" className="md:w-48">
                <option value="new">Newest first</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </Select>
            </div>
            <ChipRow>
              {CATEGORIES.map((item) => (
                <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
                  {item}
                </Chip>
              ))}
            </ChipRow>
          </>
        )}
      </div>

      {view === 'Buy' && (
        <section className="mt-5 space-y-4">
          <InfoBanner icon={ShieldCheck} title="Meet on campus, pay on pickup">
            Local pickup at gates or the library only. Don’t pay in advance to people you have not met.
          </InfoBanner>
          <Results items={items} />
        </section>
      )}

      {view === 'Borrow' && (
        <section className="mt-5 space-y-4">
          <InfoBanner icon={ShoppingBag} title="Borrow with a return date">
            Items show when they are due back. Late returns affect your trust score.
          </InfoBanner>
          <Results items={items} empty="Nothing to borrow in this category right now." />
          <SectionHeader title="Your borrowing" description="Return tracking" />
          <Card className="divide-y divide-border">
            {marketListings
              .filter((l) => l.mode === 'Borrow' && l.returnBy)
              .map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <span className="min-w-0 truncate text-sm font-medium">{l.title}</span>
                  <Badge tone={l.status === 'Borrowed' ? 'warning' : 'neutral'}>Return by {formatDay(l.returnBy ?? l.postedAt)}</Badge>
                </div>
              ))}
          </Card>
        </section>
      )}

      {view === 'Exchange' && (
        <section className="mt-5 space-y-4">
          <p className="text-sm text-text-3">Swap notes, books or gear. Propose a swap in chat; both people confirm the pickup.</p>
          <Results items={items} empty="No swaps posted yet. Offer yours with Sell → Exchange." />
        </section>
      )}

      {view === 'Mine' && (
        <section className="mt-5">
          <EmptyState
            icon={ShoppingBag}
            title="You have no listings"
            description="Items you sell, lend or swap appear here with their chat requests and status."
            action={
              <Button variant="soft" onClick={() => setSellOpen(true)}>
                Create a listing
              </Button>
            }
          />
        </section>
      )}

      <Sheet
        open={sellOpen}
        onClose={() => setSellOpen(false)}
        title="New listing"
        description="Photos and a clear condition get more replies"
        footer={
          <Button full onClick={() => { setSellOpen(false); toast('Listing published after a quick safety check (demo)'); }}>
            Publish listing
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="What are you listing?" htmlFor="ml-title">
            <Input id="ml-title" placeholder="e.g. Galvin OS textbook (9th ed.)" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type" htmlFor="ml-mode">
              <Select id="ml-mode">
                <option>Sell</option>
                <option>Borrow</option>
                <option>Exchange</option>
                <option>Free</option>
              </Select>
            </Field>
            <Field label="Category" htmlFor="ml-cat">
              <Select id="ml-cat">
                {CATEGORIES.slice(1).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Price (₹)" htmlFor="ml-price" hint="Leave empty for borrow or swap">
              <Input id="ml-price" inputMode="numeric" placeholder="500" />
            </Field>
            <Field label="Condition" htmlFor="ml-cond">
              <Select id="ml-cond">
                <option>New</option>
                <option>Like new</option>
                <option>Good</option>
                <option>Fair</option>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="ml-desc">
            <Textarea id="ml-desc" placeholder="Age, defects, what is included, pickup spot" />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}

function Results({ items, empty = 'No items match. Try another category or sort.' }: { items: (typeof marketListings)[number][]; empty?: string }) {
  if (items.length === 0) return <EmptyState icon={ShoppingBag} title={empty} />;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {items.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
