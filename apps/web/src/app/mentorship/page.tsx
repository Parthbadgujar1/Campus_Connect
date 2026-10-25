'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Briefcase, ChevronRight, GraduationCap, UsersRound } from 'lucide-react';
import { Segmented } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { Reveal } from '@/components/motion';
import { PeopleList } from '@/components/people/people-list';

// Mentors: industry experts and alumni (approved by the college), and faculty. Message them
// directly; experts also post mentorship sessions and referrals in Opportunities.

type Tab = 'expert' | 'faculty';

export default function MentorshipPage() {
  const [tab, setTab] = useState<Tab>('expert');
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Mentors" subtitle="Experts, alumni and faculty who are happy to help" back backHref="/campus" />
      <Reveal className="space-y-3">
        <Segmented<Tab> label="Mentors" value={tab} onChange={setTab} options={[{ value: 'expert', label: 'Industry & alumni' }, { value: 'faculty', label: 'Faculty' }]} />
        <Link href="/opportunities?kind=workshop" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
          <Briefcase className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Mentorship sessions and referrals</span>
            <span className="block text-[13px] text-text-3">Posted by experts in Opportunities</span>
          </span>
          <ChevronRight className="h-4 w-4 text-text-3" aria-hidden="true" />
        </Link>
      </Reveal>
      <div className="mt-4">
        <PeopleList
          cacheKey={`mentors:${tab}`}
          query={{ role: tab }}
          empty={tab === 'expert' ? { icon: UsersRound, title: 'No experts yet', description: 'When alumni and industry mentors join and are approved, they appear here.' } : { icon: GraduationCap, title: 'No faculty yet' }}
        />
      </div>
    </div>
  );
}
