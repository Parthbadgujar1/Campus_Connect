'use client';

import { useState } from 'react';
import { BadgeCheck, Copy, MapPin, Store, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Card, EmptyState, PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { offers } from '@/data/commerce';
import { daysUntil, formatLongDate } from '@/lib/time';
import { gradientFor } from '@/lib/visuals';
import type { Offer } from '@/lib/types';

const CATEGORIES = ['All', 'Cafe', 'Printing', 'Gym', 'Clothing', 'Laptop repair', 'Mobile repair', 'Stationery', 'Coaching', 'Salon', 'Food'];

export default function OffersPage() {
  const toast = useToast();
  const [category, setCategory] = useState('All');
  const [claimed, setClaimed] = useState<Offer | null>(null);

  const visible = offers.filter((o) => category === 'All' || o.category === category);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Local offers" subtitle="Student discounts from verified shops near campus" back backHref="/campus" />

      <div className="mt-4 space-y-4">
        <ChipRow>
          {CATEGORIES.map((item) => (
            <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
              {item}
            </Chip>
          ))}
        </ChipRow>

        {visible.length === 0 ? (
          <EmptyState icon={Store} title="No offers in this category yet" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((offer) => {
              const expired = daysUntil(offer.validTill) < 0;
              return (
                <Card key={offer.id} className="overflow-hidden">
                  <div className="flex items-stretch">
                    <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 p-3 text-center text-white" style={{ background: gradientFor(offer.seed) }}>
                      <Ticket className="h-5 w-5" aria-hidden="true" />
                      <span className="text-xs font-extrabold leading-tight">{offer.discount}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5 p-4">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold">{offer.business}</p>
                        {offer.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label="Verified business" role="img" />}
                      </div>
                      <p className="text-sm text-text-2">{offer.headline}</p>
                      <p className="flex items-center gap-1 text-xs text-text-3">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {offer.distanceKm} km · {expired ? 'Expired' : `Valid till ${formatLongDate(offer.validTill)}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {expired ? (
                          <Badge>Expired</Badge>
                        ) : (
                          <Button size="sm" onClick={() => setClaimed(offer)}>
                            Get code
                          </Button>
                        )}
                        <span className="text-xs text-text-3">{offer.redeemed.toLocaleString('en-IN')} redeemed</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={claimed !== null}
        onClose={() => setClaimed(null)}
        title={claimed?.business ?? 'Offer'}
        description={claimed?.headline}
        footer={
          <Button
            full
            onClick={() => {
              if (claimed) navigator.clipboard?.writeText(claimed.code).catch(() => {});
              toast(`Code ${claimed?.code ?? ''} copied`);
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy code
          </Button>
        }
      >
        {claimed && (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-dashed border-accent/50 bg-accent-soft p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent-soft-ink">Show at the counter</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-accent-soft-ink">{claimed.code}</p>
            </div>
            <p className="text-sm text-text-2">{claimed.terms}</p>
            <p className="text-xs text-text-3">Valid till {formatLongDate(claimed.validTill)}. Show your student ID with the code.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
