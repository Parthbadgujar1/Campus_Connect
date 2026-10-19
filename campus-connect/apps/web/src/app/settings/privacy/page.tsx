'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Ban, ShieldCheck, Flag } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Switch } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { getPerson } from '@/data/people';
import { appActions, useAppState } from '@/lib/store';

type Audience = 'everyone' | 'connections' | 'nobody';

const REPORTS = [
  { id: 'rp-own-1', target: 'Post on DBMS thread', reason: 'Spam', status: 'Reviewed', at: '2 days ago' },
  { id: 'rp-own-2', target: 'Marketplace listing', reason: 'Fake listing', status: 'Action taken', at: '1 week ago' },
];

export default function PrivacyPage() {
  const toast = useToast();
  const blocked = useAppState((s) => s.blocked);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    publicProfile: true,
    showBranch: true,
    showProjects: true,
    showActivity: false,
    showEmail: false,
  });
  const [messages, setMessages] = useState<Audience>('everyone');

  const toggle = (key: string) => (checked: boolean) => setVisibility((s) => ({ ...s, [key]: checked }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Privacy controls" back backHref="/settings" subtitle="Choose what others can see and do" />

      <section className="mt-5">
        <SectionHeader title="Profile visibility" />
        <Card className="divide-y divide-border overflow-hidden">
          <Switch label="Public profile" description="Anyone on campus can find your profile" checked={visibility.publicProfile} onChange={toggle('publicProfile')} />
          <Switch label="Show branch and year" checked={visibility.showBranch} onChange={toggle('showBranch')} />
          <Switch label="Show projects and certificates" checked={visibility.showProjects} onChange={toggle('showProjects')} />
          <Switch label="Show activity status" description="Let people see when you were last active" checked={visibility.showActivity} onChange={toggle('showActivity')} />
          <Switch label="Show email address" description="Only verified students can see it" checked={visibility.showEmail} onChange={toggle('showEmail')} />
        </Card>
      </section>

      <section className="mt-6">
        <SectionHeader title="Who can message you" description="Requests from others go to a separate inbox" />
        <Card className="p-4">
          <Segmented<Audience>
            label="Who can message you"
            value={messages}
            onChange={(next) => {
              setMessages(next);
              toast('Messaging preference saved');
            }}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'connections', label: 'Connections' },
              { value: 'nobody', label: 'Nobody' },
            ]}
          />
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="blocked">
        <div id="blocked" className="scroll-mt-20" />
        <SectionHeader title="Blocked people" description="They can’t message you or see your posts" />
        <Card className="overflow-hidden">
          {blocked.length === 0 ? (
            <EmptyState icon={Ban} title="No one is blocked" description="Use the block option on a profile or chat to add someone here." className="m-4" />
          ) : (
            <ul className="divide-y divide-border">
              {blocked.map((id) => {
                const person = getPerson(id);
                return (
                  <li key={id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={person.name} seed={person.id} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>
                    <Button size="sm" variant="secondary" onClick={() => appActions.toggleBlocked(id)}>
                      Unblock
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <SectionHeader title="Your reports" description="Reports you filed. Identities of reporters are never shown to the reported person." />
        <Card className="divide-y divide-border overflow-hidden">
          {REPORTS.map((report) => (
            <div key={report.id} className="flex items-start gap-3 px-4 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
                <Flag className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{report.target}</p>
                <p className="text-xs text-text-3">
                  {report.reason} · {report.at}
                </p>
              </div>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-2">{report.status}</span>
            </div>
          ))}
        </Card>
      </section>

      <section className="mt-6">
        <SectionHeader title="Trust score" description="Built from verification, reports and community feedback" />
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              Trusted student
            </p>
            <p className="text-sm font-bold">86 / 100</p>
          </div>
          <ProgressBar value={86} tone="success" className="mt-3" label="Trust score" />
          <p className="mt-3 text-xs text-text-3">
            Verify more details in <Link href="/verify" className="font-semibold text-accent">College verification</Link> to raise it.
          </p>
        </Card>
      </section>
    </div>
  );
}
