'use client';

import Link from 'next/link';
import { Film, Megaphone, ShieldAlert, Users, UserCheck, Flame, Calendar, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, SectionHeader, StatTile } from '@/components/ui/layout';
import { adminStats, aiFlags, reportQueue, verificationQueue } from '@/data/admin';
import { compactNumber } from '@/lib/visuals';
import { relativeTime } from '@/lib/time';

const ACTIVITY = [
  { label: 'Mon', value: 340 },
  { label: 'Tue', value: 412 },
  { label: 'Wed', value: 398 },
  { label: 'Thu', value: 455 },
  { label: 'Fri', value: 521 },
  { label: 'Sat', value: 287 },
  { label: 'Sun', value: 210 },
];

export default function AdminOverviewPage() {
  const max = Math.max(...ACTIVITY.map((d) => d.value));
  const verifiedPct = Math.round((adminStats.verified / adminStats.students) * 100);

  return (
    <div className="space-y-6 px-4 pb-28 md:px-8 md:pb-12">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Students" value={compactNumber(adminStats.students)} hint={`${verifiedPct}% verified`} icon={Users} href="/admin/students" />
        <StatTile label="Posts today" value={adminStats.postsToday} icon={Activity} tone="info" />
        <StatTile label="Open reports" value={adminStats.openReports} icon={ShieldAlert} tone="danger" href="/admin/moderation" />
        <StatTile label="AI flags today" value={adminStats.aiFlagsToday} icon={Flame} tone="warning" href="/admin/moderation" />
        <StatTile label="Active events" value={adminStats.activeEvents} icon={Calendar} />
        <StatTile label="Pending ID checks" value={verificationQueue.length} icon={UserCheck} href="/admin/students" />
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Weekly activity</p>
          <span className="text-xs text-text-3">Posts, chats and RSVPs</span>
        </div>
        <div className="flex h-36 items-end gap-2" role="img" aria-label="Bar chart of weekly activity">
          {ACTIVITY.map((d) => (
            <div key={d.label} className="flex h-full flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t-lg bg-accent/80" style={{ height: `${(d.value / max) * 100}%` }} />
              </div>
              <span className="text-xs text-text-3">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <SectionHeader title="Needs attention" action={{ label: 'Moderation', href: '/admin/moderation' }} />
          <Card className="divide-y divide-border overflow-hidden">
            {reportQueue.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.preview}</p>
                  <p className="text-xs text-text-3">
                    {r.target} · {r.count} reports · {relativeTime(r.at)}
                  </p>
                </div>
                <Badge tone={r.status === 'Open' ? 'danger' : 'warning'}>{r.status}</Badge>
              </div>
            ))}
            {aiFlags.slice(0, 2).map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.preview}</p>
                  <p className="text-xs text-text-3">
                    AI · {f.type} · {f.confidence}% confidence
                  </p>
                </div>
                <Badge tone="warning">{f.action}</Badge>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <SectionHeader title="Quick actions" />
          <div className="grid gap-3">
            <Link href="/admin/lectures" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-accent/40">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                <Film className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Upload a faculty lecture</span>
                <span className="block text-sm text-text-3">Publish to a semester and subject</span>
              </span>
            </Link>
            <Link href="/admin/announcements" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-accent/40">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                <Megaphone className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Post an announcement</span>
                <span className="block text-sm text-text-3">Pin notices for a department or year</span>
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
