'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ClipboardList, Lock, Plus, ShieldCheck, Users } from 'lucide-react';
import { get } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import type { AdminSurveyRow } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { EmptyState, ProgressBar } from '@/components/ui/layout';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { Pressable, Stagger, StaggerItem } from '@/components/motion';
import { EndOfList } from '@/components/ui/infinite';
import { ROLE_LABEL } from '@/lib/roles';
import { ago, day } from '@/lib/live-time';

const STATUS_TONE = { draft: 'neutral', published: 'success', closed: 'warning' } as const;
const STATUS_LABEL = { draft: 'Draft', published: 'Live', closed: 'Closed' } as const;

export default function AdminSurveysPage() {
  const [status, setStatus] = useState<AdminSurveyRow['status'] | null>(null);
  const list = useQuery<{ items: AdminSurveyRow[] }>(`admin:surveys:list:${status ?? 'all'}`, (signal) => get('/admin/surveys', { status: status ?? undefined }, signal));
  const items = list.data?.items ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipRow>
          <Chip active={!status} onClick={() => setStatus(null)}>All</Chip>
          <Chip active={status === 'published'} onClick={() => setStatus('published')}>Live</Chip>
          <Chip active={status === 'draft'} onClick={() => setStatus('draft')}>Drafts</Chip>
          <Chip active={status === 'closed'} onClick={() => setStatus('closed')}>Closed</Chip>
        </ChipRow>
        <Link href="/admin/surveys/new" className={buttonClass({ size: 'sm' })}><Plus className="h-4 w-4" aria-hidden="true" /> New survey</Link>
      </div>
      <div className="mt-4">
        {list.loading && <SkeletonList variant="card" count={3} />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && !items.length && (
          <EmptyState icon={ClipboardList} title={status ? 'No surveys here' : 'No surveys yet'} description="Ask about the app, campus life, classes or events. Make it compulsory when every answer matters." action={<Link href="/admin/surveys/new" className={buttonClass({ size: 'sm' })}>Create a survey</Link>} />
        )}
        {items.length > 0 && (
          <Stagger className="grid gap-3 md:grid-cols-2">
            {items.map((s) => (
              <StaggerItem key={s.id}>
                <Pressable className="h-full">
                  <Link href={`/admin/surveys/${s.id}`} className="block h-full rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                      {s.compulsory && <Badge tone="danger" icon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />}>Compulsory</Badge>}
                      {s.anonymous && <Badge tone="info" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}>Anonymous</Badge>}
                    </div>
                    <p className="mt-2 text-[17px] font-semibold leading-snug">{s.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-text-3">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" /> {s.audienceRoles.length ? s.audienceRoles.map((r) => ROLE_LABEL[r]).join(', ') : 'Everyone'} · {s.questionsCount} question{s.questionsCount === 1 ? '' : 's'}
                    </p>
                    {s.status !== 'draft' && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[12px] text-text-3"><span>{s.responsesCount} of {s.audienceSize} answered</span><span>{s.responseRate}%</span></div>
                        <ProgressBar value={s.responsesCount} max={Math.max(1, s.audienceSize)} label="Response rate" />
                      </div>
                    )}
                    <p className="mt-2 text-[12px] text-text-3">{s.publishedAt ? `Published ${ago(s.publishedAt)}` : `Created ${ago(s.createdAt)}`}{s.closesAt ? ` · closes ${day(s.closesAt)}` : ''}</p>
                  </Link>
                </Pressable>
              </StaggerItem>
            ))}
          </Stagger>
        )}
        {items.length > 0 && <EndOfList message="That’s every survey" />}
      </div>
    </div>
  );
}
