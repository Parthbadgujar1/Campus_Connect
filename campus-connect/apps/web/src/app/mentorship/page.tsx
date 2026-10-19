'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { alumni, mentors, referralRequests } from '@/data/careers';
import { getPerson } from '@/data/people';
import { cn } from '@/lib/utils';

type Tab = 'alumni' | 'mentors' | 'referrals';
const TABS: { value: Tab; label: string }[] = [
  { value: 'alumni', label: 'Alumni' },
  { value: 'mentors', label: 'Mentors' },
  { value: 'referrals', label: 'Referrals' },
];

export default function AlumniAndMentorsPage() {
  return (
    <Suspense fallback={null}>
      <AlumniAndMentors />
    </Suspense>
  );
}

function AlumniAndMentors() {
  const params = useSearchParams();
  const toast = useToast();
  const requested = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === requested) ? (requested as Tab) : 'alumni');
  const [filter, setFilter] = useState<'All' | 'Open to mentoring' | 'Open to referrals'>('All');

  const alumniList = alumni.filter((a) => filter === 'All' || (filter === 'Open to mentoring' ? a.openToMentoring : a.openToReferrals));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Alumni & mentors" subtitle="People who have been where you are going" back backHref="/campus" />
      <div className="mt-4">
        <UnderlineTabs<Tab> label="Alumni and mentors sections" value={tab} onChange={setTab} options={TABS} />
      </div>

      {tab === 'alumni' && (
        <section className="mt-5 space-y-4" aria-label="Alumni">
          <ChipRow>
            {(['All', 'Open to mentoring', 'Open to referrals'] as const).map((item) => (
              <Chip key={item} active={filter === item} onClick={() => setFilter(item)}>
                {item}
              </Chip>
            ))}
          </ChipRow>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {alumniList.map((person) => (
              <li key={person.id} className="flex items-center gap-3.5 px-4 py-3.5">
                <Avatar name={person.name} seed={person.seed} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{person.name}</p>
                  <p className="truncate text-[14px] text-text-2">
                    {person.role} · {person.company}
                  </p>
                  <p className="truncate text-[13px] text-text-3">
                    Batch {person.batch} · {person.city}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {person.openToReferrals && (
                    <Button size="sm" variant="secondary" onClick={() => toast(`Referral request sent to ${person.name.split(' ')[0]} (preview)`)}>
                      Ask referral
                    </Button>
                  )}
                  {person.openToMentoring && (
                    <Button size="sm" variant="soft" onClick={() => toast(`Mentoring request sent (preview)`)}>
                      Mentor
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'mentors' && (
        <section className="mt-5" aria-label="Mentors">
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {mentors.map((mentor) => {
              const person = getPerson(mentor.personId);
              return (
                <li key={mentor.id} className="flex items-start gap-3.5 px-4 py-4">
                  <Avatar name={person.name} seed={person.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{person.name}</p>
                    <p className="text-[13px] text-text-3">
                      {mentor.kind} · {mentor.rating.toFixed(1)} rating
                    </p>
                    <p className="mt-2 text-[14px] text-text-2">{mentor.bio}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mentor.expertise.map((item) => (
                        <span key={item} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-semibold text-text-2">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button size="sm" variant={mentor.slotsOpen > 0 ? 'primary' : 'secondary'} disabled={mentor.slotsOpen === 0} onClick={() => toast('Session requested (preview)')}>
                      {mentor.slotsOpen > 0 ? `Book · ${mentor.slotsOpen} left` : 'Full'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'referrals' && (
        <section className="mt-5" aria-label="Referral requests">
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {referralRequests.map((request) => {
              const asker = getPerson(request.askerId);
              return (
                <li key={request.id} className="flex items-center gap-3.5 px-4 py-3.5">
                  <Avatar name={asker.name} seed={asker.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{request.role}</p>
                    <p className="truncate text-[13px] text-text-3">
                      {request.company} · {asker.name.split(' ')[0]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
                      request.status === 'Referred' ? 'bg-success-soft text-success' : request.status === 'Open' ? 'bg-accent-soft text-accent-soft-ink' : 'bg-surface-2 text-text-3',
                    )}
                  >
                    {request.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
