'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Circle, Clock, Mail, Phone, ShieldCheck, Upload, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { InfoBanner } from '@/components/common/cards';
import { useToast } from '@/components/ui/toast';
import { me } from '@/data/people';
import { cn } from '@/lib/utils';

type StepState = 'done' | 'pending' | 'todo';

export default function VerifyPage() {
  const toast = useToast();
  const [idState, setIdState] = useState<StepState>('done');
  const [phoneState, setPhoneState] = useState<StepState>('todo');

  const steps: { key: string; title: string; detail: string; state: StepState; icon: LucideIcon }[] = [
    { key: 'email', title: 'College email', detail: 'Verified with your college address', state: 'done', icon: Mail },
    { key: 'id', title: 'Student ID card', detail: idState === 'pending' ? 'Under review by the admin office (usually 24 hours)' : 'Approved', state: idState, icon: UserCheck },
    { key: 'phone', title: 'Phone number', detail: 'Optional. Adds account recovery and lower spam risk.', state: phoneState, icon: Phone },
  ];
  const completed = steps.filter((s) => s.state === 'done').length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="College verification" back backHref="/settings" subtitle="Get the verified badge and full access" />

      <Card className="mt-4 flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-success-soft text-success">
          <ShieldCheck className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            {me.name}
            <Badge tone="success">Verified student</Badge>
          </p>
          <p className="mt-0.5 text-sm text-text-3">
            Verification keeps campus spaces safe: marketplace, housing, dating and anonymous rooms depend on it.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={completed} max={steps.length} tone="success" className="flex-1" label="Verification progress" />
            <span className="text-xs font-semibold text-text-2">{completed}/{steps.length}</span>
          </div>
        </div>
      </Card>

      <section className="mt-6">
        <SectionHeader title="Steps" />
        <ol className="space-y-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.key} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
                <span className="mt-0.5">
                  {step.state === 'done' ? (
                    <CheckCircle2 className="h-5 w-5 text-success" aria-label="Done" />
                  ) : step.state === 'pending' ? (
                    <Clock className="h-5 w-5 text-warning" aria-label="Pending" />
                  ) : (
                    <Circle className="h-5 w-5 text-text-3" aria-label="To do" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <Icon className="h-4 w-4 text-text-3" aria-hidden="true" />
                    {step.title}
                  </p>
                  <p className={cn('mt-0.5 text-sm', step.state === 'pending' ? 'text-warning' : 'text-text-3')}>{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6">
        <SectionHeader title="Student ID card" />
        <Card className="space-y-3 p-4">
          <p className="text-sm text-text-2">Upload a clear photo of your current college ID. Blur your roll number if you prefer; we only check name, college and validity.</p>
          <Button
            variant="secondary"
            type="button"
            disabled={idState !== 'done'}
            onClick={() => {
              setIdState('pending');
              toast('ID submitted for review');
            }}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {idState === 'done' ? 'Upload a new ID (after re-verification)' : 'Upload ID'}
          </Button>
        </Card>
      </section>

      <section className="mt-6 space-y-3">
        <SectionHeader title="Phone number" />
        {phoneState === 'todo' ? (
          <Button variant="soft" type="button" onClick={() => setPhoneState('done')}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            Add phone (demo)
          </Button>
        ) : (
          <InfoBanner icon={Phone} title="Phone added" tone="success">
            Used only for account recovery and login alerts.
          </InfoBanner>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-text-3">
        Adults only features (Connect dating) also need an 18+ check. You can complete that in Connect.
      </p>
    </div>
  );
}
