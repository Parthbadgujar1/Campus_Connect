'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { AmbienceButton } from '@/components/shell/ambience';
import { chats } from '@/data/chats';
import { me } from '@/data/people';
import { FULLSCREEN_PATTERN, TABS, sectionFor, type Section, type TabItem } from '@/lib/nav';
import { useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

const noopSubscribe = () => () => undefined;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAppState((s) => s.session);
  const onLogin = pathname === '/login';
  // The saved session only exists in the browser. Wait until mounted before deciding anything.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  useEffect(() => {
    if (mounted && !session && !onLogin) router.replace('/login');
  }, [mounted, session, onLogin, router]);
  // Sign-in screen: no tabs, no rail. Everything else needs a session.
  if (onLogin) return <>{children}</>;
  if (!mounted || !session) return null;
  const section = sectionFor(pathname);
  const fullscreen = FULLSCREEN_PATTERN.test(pathname);
  const unread = chats.reduce((sum, chat) => sum + (chat.muted ? 0 : chat.unread), 0);
  // Re-run the entrance animation when moving between areas, not inside one (e.g. chat to chat).
  const areaKey = pathname.split('/')[1] || 'home';

  return (
    <>
      <div className="aura" aria-hidden="true" />
      <Rail section={section} unread={unread} />
      <div className="app-zoom min-h-dvh min-w-0 md:pl-[88px]">
        <div key={areaKey} className="animate-page">
          {children}
        </div>
      </div>
      {!fullscreen && <TabBar section={section} unread={unread} />}
    </>
  );
}

function TabIcon({ tab, active, unread }: { tab: TabItem; active: boolean; unread: number }) {
  if (tab.section === 'you') {
    return (
      <span className={cn('rounded-full p-[2px]', active ? 'ring-2 ring-text' : '')}>
        <Avatar name={me.name} seed={me.id} size="xs" className="h-[22px] w-[22px] text-[9px]" />
      </span>
    );
  }
  const Icon = tab.icon;
  return (
    <span className="relative">
      <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.7} aria-hidden="true" />
      {tab.section === 'chats' && unread > 0 && (
        <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-[var(--surface-solid)]">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </span>
  );
}

/** Phone: a standard bottom tab bar. Five equal tabs, the active one in full ink. */
function TabBar({ section, unread }: { section: Section; unread: number }) {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--surface-solid)] pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid h-[60px] max-w-[520px] grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.section === section;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors',
                  active ? 'font-semibold text-text' : 'font-medium text-text-3 hover:text-text-2',
                )}
              >
                <TabIcon tab={tab} active={active} unread={unread} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop: a slim rail on the left with the same five places. */
function Rail({ section, unread }: { section: Section; unread: number }) {
  const role = useAppState((s) => s.role);
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[88px] flex-col items-center border-r border-border bg-[var(--surface-solid)] py-5 md:flex">
      <Link href="/" aria-label="CampusConnect home" className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-text text-[17px] font-bold text-bg">
        c
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col items-center gap-1">
        {TABS.map((tab) => {
          const active = tab.section === section;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex w-[68px] flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors',
                active ? 'bg-surface-2 font-semibold text-text' : 'font-medium text-text-3 hover:bg-surface-2 hover:text-text',
              )}
            >
              <TabIcon tab={tab} active={active} unread={unread} />
              {tab.label}
            </Link>
          );
        })}
        {role === 'admin' && (
          <Link
            href="/admin"
            className="mt-2 flex w-[68px] flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium text-text-3 hover:bg-surface-2 hover:text-text"
          >
            <ShieldCheck className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" />
            Admin
          </Link>
        )}
      </nav>
      <AmbienceButton />
    </aside>
  );
}
