'use client';

import { useMemo, useState } from 'react';
import { MapPin, PackageSearch, Plus, Search, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { lostFound } from '@/data/living';
import { getPerson } from '@/data/people';
import type { LostFoundItem } from '@/lib/types';
import { formatDay, relativeTime } from '@/lib/time';
import { gradientFor } from '@/lib/visuals';

type View = 'lost' | 'found';

export default function LostFoundPage() {
  const toast = useToast();
  const [view, setView] = useState<View>('lost');
  const [query, setQuery] = useState('');
  const [reportOpen, setReportOpen] = useState<View | null>(null);
  const [claiming, setClaiming] = useState<LostFoundItem | null>(null);
  const [claimAnswer, setClaimAnswer] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lostFound
      .filter((i) => i.kind === view)
      .filter((i) => !q || i.item.toLowerCase().includes(q) || i.location.toLowerCase().includes(q))
      .sort((a, b) => b.when.localeCompare(a.when));
  }, [view, query]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Lost & found"
        subtitle="Report and claim items on campus"
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setReportOpen(view)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {view === 'lost' ? 'Lost' : 'Found'}
          </Button>
        }
      />

      <div className="mt-4 space-y-4">
        <Segmented<View>
          label="Lost or found"
          value={view}
          onChange={setView}
          options={[
            { value: 'lost', label: 'Lost items' },
            { value: 'found', label: 'Found items' },
          ]}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Item or location" aria-label="Search lost and found" className="pl-10" />
        </div>

        {items.length === 0 ? (
          <EmptyState icon={PackageSearch} title={`No ${view} items right now`} description="Posts stay for 30 days." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => {
              const reporter = getPerson(item.reporterId);
              return (
                <Card key={item.id} className="flex gap-3 p-3">
                  <div className="h-24 w-24 shrink-0 rounded-xl" style={{ background: gradientFor(item.seed) }} aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={item.kind === 'lost' ? 'warning' : 'accent'}>{item.kind === 'lost' ? 'Lost' : 'Found'}</Badge>
                      <Badge tone={item.status === 'Returned' ? 'success' : item.status === 'Claim pending' ? 'warning' : 'neutral'}>{item.status}</Badge>
                    </div>
                    <p className="line-clamp-2 font-semibold leading-snug">{item.item}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-text-3">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.location}</span>
                    </p>
                    <p className="text-xs text-text-3">
                      {relativeTime(item.when)} ago · {formatDay(item.when)}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-text-3">
                        <Avatar name={reporter.name} seed={reporter.id} size="xs" />
                        <span className="truncate">{reporter.name.split(' ')[0]}</span>
                      </span>
                      {item.kind === 'found' && item.status === 'Open' && (
                        <Button size="sm" variant="soft" onClick={() => { setClaiming(item); setClaimAnswer(''); }}>
                          Claim
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={reportOpen !== null}
        onClose={() => setReportOpen(null)}
        title={reportOpen === 'found' ? 'I found something' : 'I lost something'}
        description="Don’t include a full ID number or bank details in the post"
        footer={
          <Button full onClick={() => { setReportOpen(null); toast('Posted to lost & found'); }}>
            Post
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Item" htmlFor="lf-item">
            <Input id="lf-item" placeholder="e.g. Blue water bottle with stickers" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Category" htmlFor="lf-cat">
              <Select id="lf-cat">
                <option>Electronics</option>
                <option>Books</option>
                <option>ID card</option>
                <option>Keys</option>
                <option>Clothing</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Where" htmlFor="lf-where">
              <Input id="lf-where" placeholder="Building or room" />
            </Field>
          </div>
          <Field label="Description" htmlFor="lf-desc">
            <Textarea id="lf-desc" placeholder="Colour, marks, what is inside" />
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={claiming !== null}
        onClose={() => setClaiming(null)}
        title="Claim this item"
        description="Answer a question only the owner would know. The finder checks before handing it over."
        footer={
          <Button
            full
            disabled={claimAnswer.trim().length < 3}
            onClick={() => {
              setClaiming(null);
              toast('Claim sent to the finder for verification');
            }}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Send claim
          </Button>
        }
      >
        {claiming && (
          <div className="space-y-4">
            <p className="text-sm text-text-2">{claiming.item} · found at {claiming.location}</p>
            <Field label="What is inside or on it?" htmlFor="lf-claim">
              <Input id="lf-claim" value={claimAnswer} onChange={(e) => setClaimAnswer(e.target.value)} placeholder="A detail only the owner would know" />
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}
