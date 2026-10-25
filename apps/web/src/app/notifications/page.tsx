'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AtSign, Bell, BriefcaseBusiness, CalendarClock, CheckCheck, Heart, Hourglass, Megaphone, MessageCircle, Reply, Settings, ShieldAlert, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { refreshBadges } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ErrorState, LoadMore, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, get, post } from '@/lib/api/client';
import { useInfinite } from '@/lib/api/hooks';
import type { NotificationView } from '@/lib/api/types';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<string, LucideIcon> = {
  message: MessageCircle, mention: AtSign, comment: MessageCircle, reply: Reply, like: Heart, follow: UserPlus, event: CalendarClock,
  deadline: Hourglass, opportunity: BriefcaseBusiness, application: BriefcaseBusiness, space: Users, announcement: Megaphone,
  moderation: ShieldAlert, verification: ShieldCheck, system: Bell, security: ShieldAlert,
};

const FILTERS: Array<{ label: string; kinds: string[] | null }> = [
  { label: 'All', kinds: null },
  { label: 'Unread', kinds: [] },
  { label: 'Messages', kinds: ['message'] },
  { label: 'Replies & mentions', kinds: ['comment', 'reply', 'mention'] },
  { label: 'Likes & follows', kinds: ['like', 'follow'] },
  { label: 'Events', kinds: ['event', 'deadline'] },
  { label: 'Opportunities', kinds: ['opportunity', 'application'] },
  { label: 'Notices', kinds: ['announcement', 'system'] },
  { label: 'Account', kinds: ['security', 'verification', 'moderation', 'space'] },
];

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export default function NotificationsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState('All');
  const unreadOnly = filter === 'Unread';
  const list = useInfinite<NotificationView>(`notifications:${unreadOnly ? 'unread' : 'all'}`, (cursor, signal) =>
    get('/notifications', { cursor: cursor ?? undefined, limit: 30, unread: unreadOnly || undefined }, signal),
  );
  const kinds = FILTERS.find((f) => f.label === filter)?.kinds;
  const items = useMemo(() => (kinds && kinds.length ? list.items.filter((n) => kinds.includes(n.kind)) : list.items), [list.items, kinds]);
  const unreadCount = list.items.filter((n) => !n.read).length;

  const markAll = async () => {
    list.setItems((all) => all.map((n) => ({ ...n, read: true })));
    try {
      await post('/notifications/read', { all: true });
      refreshBadges();
    } catch (err) {
      toast(errorMessage(err));
      list.reload();
    }
  };
  const markOne = (n: NotificationView) => {
    if (n.read) return;
    list.setItems((all) => all.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    void post('/notifications/read', { ids: [n.id] }).then(refreshBadges).catch(() => undefined);
  };
  const dismiss = async (n: NotificationView) => {
    list.setItems((all) => all.filter((x) => x.id !== n.id));
    try {
      await del(`/notifications/${n.id}`);
      refreshBadges();
    } catch (err) {
      toast(errorMessage(err));
      list.reload();
    }
  };

  const today = items.filter((n) => isToday(n.createdAt));
  const earlier = items.filter((n) => !isToday(n.createdAt));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Notifications"
        back
        backHref="/"
        actions={
          <Link href="/settings/notifications" aria-label="Notification settings" className="grid h-10 w-10 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        }
      />
      <ChipRow className="mt-2">
        {FILTERS.map((f) => (
          <Chip key={f.label} active={filter === f.label} onClick={() => setFilter(f.label)}>
            {f.label}
          </Chip>
        ))}
      </ChipRow>
      <div className="mt-3 flex items-center justify-between">
        <p className="font-sans text-sm text-text-3" aria-live="polite">{unreadCount} unread</p>
        <Button size="sm" variant="ghost" disabled={unreadCount === 0} onClick={markAll}>
          <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all as read
        </Button>
      </div>

      {list.loading ? (
        <SkeletonList variant="row" count={6} className="mt-6" label="Loading notifications" />
      ) : list.error && !list.items.length ? (
        <ErrorState className="mt-6" error={list.error} onRetry={list.reload} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="You’re all caught up" description="New messages, replies, deadlines and campus updates will appear here." className="mt-6" />
      ) : (
        <>
          {today.length > 0 && <Group title="Today" items={today} onOpen={markOne} onDismiss={dismiss} />}
          {earlier.length > 0 && <Group title="Earlier" items={earlier} onOpen={markOne} onDismiss={dismiss} />}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </>
      )}
    </div>
  );
}

function Group({ title, items, onOpen, onDismiss }: { title: string; items: NotificationView[]; onOpen: (n: NotificationView) => void; onDismiss: (n: NotificationView) => void }) {
  return (
    <section className="mt-6" aria-label={title}>
      <SectionHeader title={title} />
      <Card className="divide-y divide-border overflow-hidden">
        {items.map((n) => {
          const Icon = KIND_ICON[n.kind] ?? Bell;
          const body = (
            <>
              {n.actor ? (
                <span className="relative shrink-0">
                  <PersonAvatar person={n.actor} size="sm" />
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-ink ring-2 ring-[var(--surface)]">
                    <Icon className="h-3 w-3" aria-hidden="true" />
                  </span>
                </span>
              ) : (
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', n.read ? 'bg-surface-2 text-text-2' : 'bg-accent text-accent-ink')}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug">{n.title}</span>
                {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-text-3">{n.body}</span>}
                <span className="font-sans mt-1 block text-[11px] text-text-3">{ago(n.createdAt)}</span>
              </span>
            </>
          );
          return (
            <div key={n.id} className={cn('group flex items-start gap-1 pr-2 transition-colors hover:bg-surface-2', !n.read && 'bg-accent-soft/40')}>
              {n.link ? (
                <Link href={n.link} onClick={() => onOpen(n)} className="flex min-w-0 flex-1 gap-3 px-4 py-3.5">
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={() => onOpen(n)} className="flex min-w-0 flex-1 gap-3 px-4 py-3.5 text-left">
                  {body}
                </button>
              )}
              <div className="flex shrink-0 flex-col items-center gap-2 pt-3.5">
                {!n.read && <span className="h-2 w-2 rounded-full bg-accent" role="img" aria-label="Unread" />}
                <button type="button" onClick={() => onDismiss(n)} aria-label={`Dismiss: ${n.title}`} className="press grid h-7 w-7 place-items-center rounded-full text-text-3 opacity-70 hover:bg-surface-3 hover:text-text group-hover:opacity-100">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
