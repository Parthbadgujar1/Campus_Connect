'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bookmark, Briefcase, CalendarClock, Check, IndianRupee, MapPin, Star, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DetailHero, EmptyState, MetaLine, PageHeader, ProgressBar, SectionHeader, Stars } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { opportunities } from '@/data/careers';
import { me } from '@/data/people';
import { appActions, useAppState } from '@/lib/store';
import { deadlineLabel, formatLongDate, daysUntil } from '@/lib/time';
import { cn } from '@/lib/utils';

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const op = opportunities.find((o) => o.id === id);
  const toast = useToast();
  const saved = useAppState((s) => (op ? s.saved.includes(op.id) : false));
  const stage = useAppState((s) => (op ? s.applications[op.id] : undefined));

  if (!op) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Opportunity" back backHref="/opportunities" />
        <EmptyState icon={Briefcase} title="This opportunity has closed" className="mt-6" />
      </div>
    );
  }

  const yearOk = op.minYear <= (me.year ?? 1);
  const branchOk = op.eligibleBranches.length === 0 || op.eligibleBranches.includes(me.branch ?? '');
  const matchedSkills = op.skills.filter((skill) => me.skills.some((s) => s.toLowerCase() === skill.toLowerCase()));
  const matchPct = op.skills.length ? Math.round((matchedSkills.length / op.skills.length) * 100) : 100;
  const closed = daysUntil(op.deadline) < 0;
  const checklist = [
    { label: `Year ${op.minYear}+ students`, ok: yearOk },
    { label: op.eligibleBranches.length ? `Branch: ${op.eligibleBranches.join(', ')}` : 'Open to all branches', ok: branchOk },
    { label: 'Student ID verified', ok: me.verified },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={op.org} back backHref="/opportunities" />

      <div className="mt-2 space-y-5 md:mt-4">
        <DetailHero seed={op.seed} icon={Briefcase} eyebrow={op.kind} title={op.title}>
          <MetaLine icon={IndianRupee}>{op.pay}</MetaLine>
          <MetaLine icon={MapPin}>
            {op.location} · {op.mode}
          </MetaLine>
          <MetaLine icon={CalendarClock}>
            Apply by {formatLongDate(op.deadline)} · <span className={cn('font-semibold', daysUntil(op.deadline) <= 3 ? 'text-danger' : 'text-text')}>{deadlineLabel(op.deadline)}</span>
          </MetaLine>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-text-2">
            <Stars value={op.reviewsRating} />
            <span className="text-text-3">{op.reviewsCount} student reviews</span>
            <span className="flex items-center gap-1 text-text-3">
              <Users className="h-4 w-4" aria-hidden="true" />
              {op.applicants} applicants
            </span>
          </div>
        </DetailHero>

        <div className="flex flex-col gap-3 sm:flex-row">
          {stage ? (
            <Card className="flex flex-1 items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-3">Application status</p>
                <p className="font-semibold">{stage}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { appActions.withdrawApplication(op.id); toast('Application withdrawn'); }}>
                Withdraw
              </Button>
            </Card>
          ) : (
            <Button
              size="lg"
              className="flex-1"
              disabled={closed}
              onClick={() => {
                appActions.applyFor(op.id);
                toast('Applied. Track it in Jobs → Applied');
              }}
            >
              {closed ? 'Applications closed' : 'Apply now'}
            </Button>
          )}
          <Button size="lg" variant="secondary" aria-pressed={saved} onClick={() => appActions.toggleSaved(op.id)}>
            <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>

        <Card className="space-y-4 p-5">
          <SectionHeader title="About the role" />
          <p className="text-[15px] leading-relaxed text-text-2">{op.description}</p>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="space-y-3 p-5">
            <p className="font-semibold">Eligibility</p>
            <ul className="space-y-2.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5 text-sm">
                  <span className={cn('grid h-5 w-5 place-items-center rounded-full', item.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
                    {item.ok ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
                  </span>
                  <span>{item.label}</span>
                  <span className="sr-only">{item.ok ? 'You meet this' : 'You do not meet this'}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="space-y-3 p-5">
            <p className="font-semibold">Skill match</p>
            <ProgressBar value={matchPct} tone={matchPct >= 60 ? 'success' : 'warning'} label="Skill match" />
            <p className="text-sm text-text-3">
              {matchPct}% · you have {matchedSkills.length} of {op.skills.length} skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {op.skills.map((skill) => {
                const have = matchedSkills.includes(skill);
                return (
                  <Badge key={skill} tone={have ? 'success' : 'neutral'}>
                    {skill}
                  </Badge>
                );
              })}
            </div>
            <Link href="/profile/edit" className="text-sm font-semibold text-accent hover:underline">
              Add missing skills to your profile →
            </Link>
          </Card>
        </div>

        <section>
          <SectionHeader title="Student reviews" description={`${op.reviewsCount} reviews · ${op.reviewsRating.toFixed(1)} average`} />
          <Card className="space-y-3 p-5 text-sm text-text-2">
            <p className="flex items-center gap-2 text-text">
              <Star className="h-4 w-4 fill-warning text-warning" aria-hidden="true" />
              “Mentors were responsive and the work was real, not busywork.”
            </p>
            <p className="text-xs text-text-3">Verified student review · anonymised</p>
          </Card>
        </section>
      </div>
    </div>
  );
}
