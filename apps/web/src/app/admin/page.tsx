'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Activity, BookOpen, Briefcase, Calendar, ChevronRight, ClipboardList, Film, Flag, Inbox, LayoutGrid, MailWarning, MessageSquareHeart, ShieldQuestion, UserCheck, Users } from 'lucide-react';
import { get } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import type { AdminOverview } from '@/lib/api/modules';
import { SectionHeader } from '@/components/ui/layout';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { Stagger, StaggerItem } from '@/components/motion';
import { Figure } from '@/components/admin/admin-ui';
import { useSession } from '@/lib/session';
import { can, type Capability } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface Todo {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  needs: Capability;
  urgent?: string;
}

const TODOS: Todo[] = [
  { key: 'open_reports', label: 'Open reports', href: '/admin/moderation', icon: Flag, needs: 'admin.moderation', urgent: 'urgent_reports' },
  { key: 'verifications', label: 'Verification and role requests', href: '/admin/people?tab=requests', icon: UserCheck, needs: 'admin.people' },
  { key: 'resources', label: 'Shelf uploads to review', href: '/admin/content?tab=resource', icon: BookOpen, needs: 'admin.queue' },
  { key: 'lectures', label: 'Lectures to review', href: '/admin/content?tab=lecture', icon: Film, needs: 'admin.queue' },
  { key: 'events', label: 'Events to approve', href: '/admin/content?tab=event', icon: Calendar, needs: 'admin.moderation' },
  { key: 'opportunities', label: 'Opportunities to approve', href: '/admin/content?tab=opportunity', icon: Briefcase, needs: 'admin.moderation' },
  { key: 'spaces', label: 'Spaces to approve', href: '/admin/content?tab=space', icon: LayoutGrid, needs: 'admin.moderation' },
  { key: 'identity_reveals', label: 'Identity reveal requests', href: '/admin/moderation?tab=reveals', icon: ShieldQuestion, needs: 'admin.system' },
  { key: 'feedback_new', label: 'New app feedback', href: '/admin/feedback', icon: MessageSquareHeart, needs: 'admin.feedback' },
  { key: 'contact', label: 'Contact messages', href: '/admin/inbox', icon: Inbox, needs: 'admin.system' },
  { key: 'data_requests', label: 'Data requests in progress', href: '/admin/inbox?tab=data', icon: Inbox, needs: 'admin.system' },
];

export default function AdminOverviewPage() {
  const { user } = useSession();
  const o = useQuery<AdminOverview>('admin:overview', (signal) => get('/admin/overview', undefined, signal));
  if (o.loading) return <SkeletonList variant="row" count={6} />;
  if (o.error) return <ErrorState error={o.error} onRetry={o.reload} />;
  const d = o.data!;
  const p = d.people;
  const q = d.queues;
  const todos = TODOS.filter((t) => can(user, t.needs));
  const waiting = todos.reduce((n, t) => n + (q[t.key] ?? 0), 0);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader title="Needs attention" description={waiting ? `${waiting} item${waiting === 1 ? '' : 's'} waiting` : 'Nothing is waiting. All clear.'} />
        <Stagger className="grid gap-2 sm:grid-cols-2">
          {todos.map((t) => {
            const n = q[t.key] ?? 0;
            const urgent = t.urgent ? (q[t.urgent] ?? 0) : 0;
            return (
              <StaggerItem key={t.key}>
                <Link href={t.href} className={cn('flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2', n ? 'border-border' : 'border-border opacity-70')}>
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', urgent ? 'bg-danger-soft text-danger' : n ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-text-3')}>
                    <t.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.label}</span>
                    {urgent > 0 && <span className="block text-[12px] font-semibold text-danger">{urgent} urgent</span>}
                  </span>
                  <span className="font-sans text-[20px] font-bold tabular-nums">{n}</span>
                  <ChevronRight className="h-4 w-4 text-text-3" aria-hidden="true" />
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <section>
        <SectionHeader title="People" action={can(user, 'admin.people') ? { label: 'Manage', href: '/admin/people' } : undefined} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Active accounts" value={p.active ?? 0} />
          <Figure label="Signed in today" value={p.active_today ?? 0} tone="success" />
          <Figure label="New this week" value={p.new_this_week ?? 0} />
          <Figure label="Waiting for a role" value={p.pending_roles ?? 0} tone={p.pending_roles ? 'warning' : 'neutral'} />
          <Figure label="Students" value={p.students ?? 0} />
          <Figure label="Faculty" value={p.faculty ?? 0} />
          <Figure label="Experts" value={p.experts ?? 0} />
          <Figure label="Suspended" value={p.suspended ?? 0} tone={p.suspended ? 'danger' : 'neutral'} />
        </div>
      </section>

      <section>
        <SectionHeader title="Activity" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Figure label="Posts today" value={d.activity.posts_today ?? 0} />
          <Figure label="Discussions today" value={d.activity.discussions_today ?? 0} />
          <Figure label="Messages today" value={d.activity.messages_today ?? 0} />
          <Figure label="Events this week" value={d.activity.events_this_week ?? 0} />
          <Figure label="Live sessions" value={d.activity.active_sessions ?? 0} />
        </div>
      </section>

      {can(user, 'admin.system') && (
        <section>
          <SectionHeader title="Health" action={{ label: 'System', href: '/admin/system' }} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Figure label="Emails waiting" value={d.email.waiting ?? 0} />
            <Figure label="Emails failed" value={d.email.failed ?? 0} tone={d.email.failed ? 'danger' : 'neutral'} />
            <Figure label="Emails sent today" value={d.email.sent_today ?? 0} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.modules.map((m) => (
              <span key={m.name} className={cn('font-sans inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold', m.status === 'ok' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
                {m.status === 'ok' ? <Activity className="h-3.5 w-3.5" aria-hidden="true" /> : <MailWarning className="h-3.5 w-3.5" aria-hidden="true" />} {m.name}
              </span>
            ))}
          </div>
          {can(user, 'admin.surveys') && (
            <Link href="/admin/surveys" className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-accent"><ClipboardList className="h-4 w-4" aria-hidden="true" /> {q.surveys_live ?? 0} survey{q.surveys_live === 1 ? '' : 's'} live</Link>
          )}
        </section>
      )}
      {!can(user, 'admin.people') && (
        <p className="flex items-center gap-2 text-[13px] text-text-3"><Users className="h-4 w-4" aria-hidden="true" /> Numbers cover everyone on CampusConnect.</p>
      )}
    </div>
  );
}
