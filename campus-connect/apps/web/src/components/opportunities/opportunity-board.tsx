'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Briefcase, ChevronRight, ClipboardList, Plus, Search, Target } from 'lucide-react';
import { get, withQuery } from '@/lib/api/client';
import { useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { OpportunityView } from '@/lib/api/types';
import type { ApplicationTrackerItem } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Input, Switch } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { useSession } from '@/lib/session';
import { can } from '@/lib/roles';
import { ago } from '@/lib/live-time';
import { KIND_LABEL, OpportunityCard, PostOpportunitySheet, STAGE_LABEL } from './opportunity-ui';

type Tab = 'open' | 'applied' | 'mine' | 'closed';

function Tracker() {
  const q = useQuery<{ items: ApplicationTrackerItem[] }>('opps:tracker', (signal) => get('/me/applications', undefined, signal));
  if (q.loading) return <SkeletonList variant="row" count={3} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <EmptyState icon={ClipboardList} title="No applications yet" description="When you apply to something, you can follow every step here." />;
  return (
    <Stagger className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((a) => (
        <StaggerItem key={a.id}>
          <Link href={`/opportunities/${a.opportunity.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{a.opportunity.title}</span>
              <span className="block truncate text-[13px] text-text-3">
                {a.opportunity.orgName} · applied {ago(a.appliedAt)} · updated {ago(a.updatedAt)}
              </span>
            </span>
            <Badge tone={STAGE_LABEL[a.stage]?.tone ?? 'info'}>{STAGE_LABEL[a.stage]?.label ?? a.stage}</Badge>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Opportunities, optionally limited to some kinds (Jobs and Placements are views of this board). */
export function OpportunityBoard({ title, subtitle, kinds, backHref = '/campus', defaultKind }: { title: string; subtitle: string; kinds?: string[]; backHref?: string; defaultKind?: string }) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'open';
  const kind = params.get('kind');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [eligible, setEligible] = useState(false);
  const [posting, setPosting] = useState(params.get('post') === '1');
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { tab: tab === 'open' ? null : tab, kind, q: params.get('q'), ...next }), { scroll: false });
  const include = tab === 'mine' ? 'mine' : tab === 'closed' ? 'closed' : 'open';
  const searchQ = params.get('q') ?? '';
  const kindParam = kind ?? (kinds && kinds.length === 1 ? kinds[0] : undefined);
  const list = useInfinite<OpportunityView>(tab === 'applied' ? null : `opps:list:${include}:${kindParam}:${searchQ}:${eligible}:${(kinds ?? []).join(',')}`, (cursor, signal) =>
    get<Page<OpportunityView>>('/opportunities', { include, kind: kindParam, kinds: !kindParam && kinds ? kinds.join(',') : undefined, q: searchQ || undefined, eligibleOnly: eligible ? 'true' : undefined, cursor: cursor ?? undefined, limit: 15 }, signal),
  );
  const shownKinds = kinds ?? Object.keys(KIND_LABEL);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title={title}
        subtitle={subtitle}
        back
        backHref={backHref}
        actions={
          can(user, 'opportunities.post') && (
            <Button size="sm" onClick={() => setPosting(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Post
            </Button>
          )
        }
      />
      <Reveal className="space-y-3">
        <Segmented<Tab>
          label="Opportunity views"
          value={tab}
          onChange={(v) => go({ tab: v === 'open' ? null : v })}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'applied', label: 'My applications' },
            { value: 'mine', label: 'Posted by me' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        {tab !== 'applied' && (
          <>
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                go({ q: q.trim() || null });
              }}
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by role, company or skill" className="pl-10" aria-label="Search opportunities" enterKeyHint="search" />
            </form>
            {shownKinds.length > 1 && (
              <ChipRow>
                <Chip active={!kind} onClick={() => go({ kind: null })}>All</Chip>
                {shownKinds.map((k) => (
                  <Chip key={k} active={kind === k} onClick={() => go({ kind: k })}>{KIND_LABEL[k] ?? k}</Chip>
                ))}
              </ChipRow>
            )}
            {tab === 'open' && (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                <Switch checked={eligible} onChange={setEligible} label="Only ones I can apply to" description="Hides roles not open to your department or year" />
              </div>
            )}
          </>
        )}
      </Reveal>
      <div className="mt-4">
        {tab === 'applied' ? (
          <Tracker />
        ) : (
          <InfiniteList
            state={list}
            skeleton="card"
            className="space-y-3"
            empty={{ icon: tab === 'mine' ? Briefcase : Target, title: tab === 'mine' ? 'You have not posted anything' : 'Nothing here right now', description: tab === 'mine' ? 'Share an internship, a hackathon or a referral with your college.' : 'New opportunities appear here as soon as they are posted.' }}
            endMessage="You’ve seen every opportunity"
            endHint="Turn on notifications to hear about new ones."
            render={(o) => <OpportunityCard o={o} onChange={(next) => list.setItems((items) => items.map((x) => (x.id === next.id ? next : x)))} />}
          />
        )}
      </div>
      <PostOpportunitySheet open={posting} onClose={() => setPosting(false)} defaultKind={defaultKind ?? kinds?.[0]} />
    </div>
  );
}
