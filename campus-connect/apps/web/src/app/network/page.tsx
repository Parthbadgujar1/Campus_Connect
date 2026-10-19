'use client';

import { useState } from 'react';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { cityNetwork, interCollege, type NetworkItem } from '@/data/campus';
import { cn } from '@/lib/utils';

// Beyond campus: other colleges and meetups in the city.
type Scope = 'Other colleges' | 'In your city';
const SCOPES: { value: Scope; label: string }[] = [
  { value: 'Other colleges', label: 'Other colleges' },
  { value: 'In your city', label: 'In your city' },
];

export default function BeyondCampusPage() {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>('Other colleges');
  const [joined, setJoined] = useState<string[]>([]);
  const items: NetworkItem[] = scope === 'Other colleges' ? interCollege : cityNetwork;

  const toggle = (item: NetworkItem) => {
    const isIn = joined.includes(item.id);
    setJoined((list) => (isIn ? list.filter((id) => id !== item.id) : [...list, item.id]));
    toast(isIn ? `Left ${item.title}` : `You are in: ${item.title}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Beyond campus" subtitle="Competitions, meetups and teams across colleges" back backHref="/discover" />
      <div className="mt-4">
        <UnderlineTabs<Scope> label="Scope" value={scope} onChange={setScope} options={SCOPES} />
      </div>
      <ChipRow className="mt-4">
        <Chip active>{scope === 'Other colleges' ? 'Competitions and teams' : 'Meetups this month'}</Chip>
      </ChipRow>

      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((item) => {
          const isIn = joined.includes(item.id);
          return (
            <li key={item.id} className="flex items-start gap-4 px-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                {scope === 'Other colleges' ? <Trophy className="h-5 w-5" aria-hidden="true" /> : <MapPin className="h-5 w-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-text-3">{item.tag}</p>
                <p className="mt-0.5 text-[16px] font-semibold leading-snug">{item.title}</p>
                <p className="mt-1 text-[14px] text-text-2">{item.detail}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-text-3">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.date}
                </p>
              </div>
              <Button size="sm" variant={isIn ? 'secondary' : 'primary'} aria-pressed={isIn} onClick={() => toggle(item)} className={cn('shrink-0')}>
                {isIn ? 'Joined' : 'Join'}
              </Button>
            </li>
          );
        })}
        {items.length === 0 && <li className="px-6 py-12 text-center text-[15px] text-text-3">Nothing scheduled yet.</li>}
      </ul>
    </div>
  );
}
