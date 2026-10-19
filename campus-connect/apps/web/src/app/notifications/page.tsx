'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  Car,
  Home,
  Hourglass,
  Megaphone,
  MessageCircle,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { notifications } from '@/data/campus';
import { appActions, useAppState } from '@/lib/store';
import { relativeTime, NOW, dayKey } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

const KIND_ICON: Record<Notification['kind'], LucideIcon> = {
  message: MessageCircle,
  event: CalendarClock,
  deadline: Hourglass,
  opportunity: BriefcaseBusiness,
  community: Users,
  roommate: Home,
  marketplace: ShoppingBag,
  travel: Car,
  announcement: Megaphone,
  system: Bell,
};

const FILTERS = [
  { label: 'All', kinds: null },
  { label: 'Messages', kinds: ['message'] },
  { label: 'Events', kinds: ['event'] },
  { label: 'Deadlines', kinds: ['deadline'] },
  { label: 'Opportunities', kinds: ['opportunity'] },
  { label: 'Communities', kinds: ['community'] },
  { label: 'Roommates', kinds: ['roommate'] },
  { label: 'Marketplace', kinds: ['marketplace'] },
  { label: 'Travel', kinds: ['travel'] },
  { label: 'Notices', kinds: ['announcement', 'system'] },
] as const;

export default function NotificationsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['label']>('All');
  const readIds = useAppState((s) => s.readNotifications);

  const active = FILTERS.find((f) => f.label === filter);
  const items = notifications.filter((n) => !active?.kinds || (active.kinds as readonly string[]).includes(n.kind));
  const unreadIds = items.filter((n) => !readIds.includes(n.id)).map((n) => n.id);

  const today = dayKey(NOW.toISOString());
  const todayItems = items.filter((n) => dayKey(n.at) === today);
  const earlier = items.filter((n) => dayKey(n.at) !== today);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Notifications"
        back
        backHref="/"
        actions={
          <>
            <Link
              href="/settings/notifications"
              aria-label="Notification settings"
              className="grid h-10 w-10 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
          </>
        }
      />

      <ChipRow className="mt-2">
        {FILTERS.map((item) => (
          <Chip key={item.label} active={filter === item.label} onClick={() => setFilter(item.label)}>
            {item.label}
          </Chip>
        ))}
      </ChipRow>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-text-3">
          {unreadIds.length} unread
        </p>
        <Button size="sm" variant="ghost" disabled={unreadIds.length === 0} onClick={() => appActions.markRead(unreadIds)}>
          Mark all as read
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="You’re all caught up" description="New messages, deadlines and campus updates will appear here." className="mt-6" />
      ) : (
        <>
          {todayItems.length > 0 && (
            <Section title="Today" items={todayItems} readIds={readIds} />
          )}
          {earlier.length > 0 && <Section title="Earlier" items={earlier} readIds={readIds} />}
        </>
      )}
    </div>
  );
}

function Section({ title, items, readIds }: { title: string; items: Notification[]; readIds: string[] }) {
  return (
    <section className="mt-6">
      <SectionHeader title={title} />
      <Card className="divide-y divide-border overflow-hidden">
        {items.map((n) => {
          const Icon = KIND_ICON[n.kind];
          const unread = !readIds.includes(n.id);
          return (
            <Link
              key={n.id}
              href={n.href ?? '/'}
              onClick={() => appActions.markRead([n.id])}
              className={cn('flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2', unread && 'bg-accent-soft/40')}
            >
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', unread ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2')}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug">{n.title}</span>
                <span className="mt-0.5 block text-[13px] text-text-3">{n.body}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5 text-[11px] text-text-3">
                {relativeTime(n.at)}
                {unread && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
              </span>
            </Link>
          );
        })}
      </Card>
    </section>
  );
}
