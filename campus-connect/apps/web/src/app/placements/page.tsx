'use client';

import { useState } from 'react';
import { Briefcase, CalendarDays, CheckCircle2, ChevronDown, Info, XCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { InfoBanner } from '@/components/common/cards';
import { getPerson } from '@/data/people';
import { interviewExperiences, interviewQuestions, placementDrives, placementStats } from '@/data/careers';
import { formatDay, formatTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type Tab = 'Drives' | 'Experiences' | 'Questions' | 'Eligibility' | 'Info';

export default function PlacementsPage() {
  const [tab, setTab] = useState<Tab>('Drives');
  const [cgpa, setCgpa] = useState('7.4');
  const [backlogs, setBacklogs] = useState('0');
  const [openQ, setOpenQ] = useState<string | null>(null);

  const cg = Number(cgpa);
  const bl = Number(backlogs);
  const eligible = placementDrives.filter((d) => cg >= d.minCgpa && bl <= d.maxBacklogs);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Placement hub" subtitle="Drives, eligibility, experiences and interview questions" back backHref="/campus" />

      <div className="mt-4">
        <Segmented<Tab>
          label="Placement sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Drives', label: 'Drives' },
            { value: 'Experiences', label: 'Experiences' },
            { value: 'Questions', label: 'Questions' },
            { value: 'Eligibility', label: 'Eligibility' },
            { value: 'Info', label: 'Info' },
          ]}
          className="flex-wrap sm:flex-nowrap"
        />
      </div>

      {tab === 'Drives' && (
        <section className="mt-5 space-y-3">
          {placementDrives.map((drive) => (
            <Card key={drive.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{drive.company}</p>
                  <p className="text-sm text-text-2">{drive.role}</p>
                </div>
                <Badge tone={drive.status === 'Open' ? 'success' : drive.status === 'Upcoming' ? 'accent' : 'neutral'}>{drive.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-3">
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatDay(drive.date)} · {formatTime(drive.date)}</span>
                <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" />{drive.package}</span>
              </div>
              <p className="text-xs text-text-3">{drive.eligibility}</p>
              <div className="flex flex-wrap gap-1.5">
                {drive.rounds.map((round, i) => (
                  <Badge key={round}>
                    {i + 1}. {round}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </section>
      )}

      {tab === 'Experiences' && (
        <section className="mt-5 space-y-3">
          {interviewExperiences.map((exp) => {
            const author = getPerson(exp.authorId);
            return (
              <Card key={exp.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{exp.company} · {exp.role}</p>
                    <p className="flex items-center gap-2 text-xs text-text-3">
                      <Avatar name={author.name} seed={author.id} size="xs" />
                      {author.name} (verified placement)
                    </p>
                  </div>
                  <Badge tone={exp.verdict === 'Selected' ? 'success' : 'danger'} icon={exp.verdict === 'Selected' ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <XCircle className="h-3 w-3" aria-hidden="true" />}>
                    {exp.verdict}
                  </Badge>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-text-2">
                  {exp.rounds.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ol>
                <p className="rounded-xl bg-surface-2 p-3 text-sm text-text-2">
                  <span className="font-semibold text-text">Tip: </span>
                  {exp.tips}
                </p>
              </Card>
            );
          })}
        </section>
      )}

      {tab === 'Questions' && (
        <section className="mt-5">
          <Card className="divide-y divide-border overflow-hidden">
            {interviewQuestions.map((q) => {
              const open = openQ === q.id;
              return (
                <div key={q.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenQ(open ? null : q.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{q.question}</span>
                      <span className="mt-0.5 block text-xs text-text-3">{q.topic} · asked at {q.company}</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {open && <p className="px-4 pb-4 text-sm text-text-2">Practise this aloud, then compare with the peers’ answers in the DSA group.</p>}
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {tab === 'Eligibility' && (
        <section className="mt-5 space-y-5">
          <Card className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Current CGPA" htmlFor="el-cgpa">
              <Input id="el-cgpa" inputMode="decimal" value={cgpa} onChange={(e) => setCgpa(e.target.value)} />
            </Field>
            <Field label="Active backlogs" htmlFor="el-bl">
              <Select id="el-bl" value={backlogs} onChange={(e) => setBacklogs(e.target.value)}>
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </Field>
          </Card>
          <SectionHeader title={`You can apply to ${eligible.length} of ${placementDrives.length} drives`} />
          {eligible.length === 0 ? (
            <EmptyState icon={XCircle} title="No drives match your current record" description="Clearing backlogs or improving CGPA opens more drives." />
          ) : (
            <div className="space-y-3">
              {eligible.map((d) => (
                <Card key={d.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{d.company}</p>
                    <p className="text-xs text-text-3">{d.eligibility}</p>
                  </div>
                  <Badge tone="success">{d.package}</Badge>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'Info' && (
        <section className="mt-5 space-y-4">
          <Card className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            {placementStats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                <p className="text-xs text-text-3">{s.label}</p>
              </div>
            ))}
          </Card>
          <InfoBanner icon={Info} title="Official placement information">
            Placement Cell office hours are 10 AM to 4 PM on weekdays. Offers are reported on the portal within 48 hours. Median package figures are from last year’s records.
          </InfoBanner>
        </section>
      )}
    </div>
  );
}
