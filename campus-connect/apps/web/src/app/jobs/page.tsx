'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Building2, Clock } from 'lucide-react';
import { OpportunityCard } from '@/components/common/opportunity-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { Card, EmptyState, PageHeader, SectionHeader, Stars } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { opportunities } from '@/data/careers';
import type { ApplicationStage, Opportunity } from '@/lib/types';

import { appActions, useAppState } from '@/lib/store';
import { daysUntil, deadlineLabel } from '@/lib/time';
import { cn } from '@/lib/utils';

type View = 'Listings' | 'Applied' | 'Saved' | 'Deadlines';

const JOB_KINDS = ['Job', 'Internship', 'Part-time'] as const;
const STAGES: ApplicationStage[] = ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected'];

export default function JobsPage() {
  const [view, setView] = useState<View>('Listings');
  const saved = useAppState((s) => s.saved);
  const applications = useAppState((s) => s.applications);
  const toast = useToast();

  const isJob = (o: Opportunity) => (JOB_KINDS as readonly string[]).includes(o.kind);
  const jobs = opportunities.filter(isJob);
  const applied = opportunities.filter((o) => applications[o.id]);
  const savedJobs = jobs.filter((o) => saved.includes(o.id));
  const deadlines = [...jobs].filter((o) => daysUntil(o.deadline) >= 0).sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Jobs & internships" subtitle="Listings, application tracking and deadlines" back backHref="/campus" />

      <div className="mt-4">
        <UnderlineTabs<View>
          label="Jobs sections"
          value={view}
          onChange={setView}
          options={[
            { value: 'Listings', label: 'Listings', count: jobs.length },
            { value: 'Applied', label: 'Applied', count: applied.length },
            { value: 'Saved', label: 'Saved', count: savedJobs.length },
            { value: 'Deadlines', label: 'Deadlines' },
          ]}
        />
      </div>

      {view === 'Listings' && (
        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {jobs.map((op) => (
            <OpportunityCard key={op.id} opportunity={op} />
          ))}
        </section>
      )}

      {view === 'Applied' && (
        <section className="mt-5 space-y-6">
          {applied.length === 0 ? (
            <EmptyState icon={Building2} title="No applications yet" description="Apply from a listing to track it here." action={<Button variant="soft" onClick={() => setView('Listings')}>Browse listings</Button>} />
          ) : (
            STAGES.map((stage) => {
              const items = applied.filter((o) => applications[o.id] === stage);
              if (items.length === 0) return null;
              return (
                <div key={stage}>
                  <SectionHeader title={stage} description={`${items.length} application${items.length === 1 ? '' : 's'}`} />
                  <div className="space-y-3">
                    {items.map((op) => (
                      <TrackerRow key={op.id} op={op} stage={stage} onAdvance={(next) => { appActions.setApplicationStage(op.id, next); toast(`Moved to ${next}`); }} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {view === 'Saved' && (
        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {savedJobs.length === 0 ? (
            <EmptyState icon={Building2} title="Nothing saved" description="Tap the bookmark on any listing to keep it here." className="md:col-span-2" />
          ) : (
            savedJobs.map((op) => <OpportunityCard key={op.id} opportunity={op} />)
          )}
        </section>
      )}

      {view === 'Deadlines' && (
        <section className="mt-5">
          <Card className="divide-y divide-border overflow-hidden">
            {deadlines.map((op) => {
              const days = daysUntil(op.deadline);
              return (
                <Link key={op.id} href={`/opportunities/${op.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2">
                  <span className={cn('grid h-12 w-14 shrink-0 place-items-center rounded-xl text-center text-xs font-bold', days <= 3 ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-soft-ink')}>
                    <span className="text-base leading-none">{days}</span>
                    <span className="text-[10px]">days</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{op.title}</span>
                    <span className="block truncate text-xs text-text-3">
                      {op.org} · {deadlineLabel(op.deadline)}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-text-3" aria-hidden="true" />
                </Link>
              );
            })}
          </Card>
          <p className="mt-4 flex items-center gap-2 text-xs text-text-3">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Deadline reminders go out 3 days and 1 day before. Change them in notification settings.
          </p>
        </section>
      )}
    </div>
  );
}

function TrackerRow({
  op,
  stage,
  onAdvance,
}: {
  op: Opportunity;
  stage: ApplicationStage;
  onAdvance: (next: ApplicationStage) => void;
}) {
  const next = STAGES[STAGES.indexOf(stage) + 1];
  const terminal = stage === 'Offer' || stage === 'Rejected';
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Link href={`/opportunities/${op.id}`} className="block truncate font-semibold hover:underline">
          {op.title}
        </Link>
        <p className="truncate text-xs text-text-3">
          {op.org} · {op.kind}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Stars value={op.reviewsRating} size={11} />
          <Badge tone={stage === 'Offer' ? 'success' : stage === 'Rejected' ? 'danger' : 'accent'}>{stage}</Badge>
        </div>
      </div>
      {!terminal && next && (
        <Button size="sm" variant="secondary" onClick={() => onAdvance(next)}>
          Move to {next.toLowerCase()}
        </Button>
      )}
    </Card>
  );
}
