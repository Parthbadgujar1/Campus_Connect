'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Hourglass, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/states';
import { AmbienceButton } from '@/components/shell/ambience';
import { CookieBanner } from '@/components/shell/cookie-banner';
import { PublicShell } from '@/components/shell/public-shell';
import { BackToTop, OfflineBanner, ScrollProgress, SkipLink } from '@/components/shell/site-chrome';
import { START_TOUR_EVENT, Tour } from '@/components/shell/tour';
import { LiveSync } from './live-sync';
import { del, get } from '@/lib/api/client';
import { useQuery, invalidate } from '@/lib/api/hooks';
import { FULLSCREEN_PATTERN, TABS, sectionFor, type Section, type TabItem } from '@/lib/nav';
import { useSession } from '@/lib/session';
import { can, capabilityFor, ROLE_LABEL } from '@/lib/roles';
import { SurveyGate } from '@/components/surveys/survey-gate';
import { cn } from '@/lib/utils';

// Pages anyone can open without signing in. Everything else needs an account.
const PUBLIC = /^\/(login|register|forgot-password|reset-password|verify-email|privacy|terms|cookies|contact|unsubscribe|faq)(\/|$)/;
// Signed-in pages shown without the tab bar and rail.
const BARE = /^\/welcome(\/|$)/;
// Sign-in pages that make no sense once signed in.
const AUTH_ONLY = /^\/(login|register|forgot-password)(\/|$)/;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, settings, refresh, updateSettings } = useSession();
  const isPublic = PUBLIC.test(pathname);
  const onboardingDone = !settings || settings.onboarding.completed || settings.onboarding.skipped;
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (status === 'signed-out' && !isPublic) {
      const here = `${pathname}${typeof window !== 'undefined' ? window.location.search : ''}`;
      const next = pathname && here !== '/' ? `?next=${encodeURIComponent(here)}` : '';
      router.replace(`/login${next}`);
    }
    if (status === 'signed-in' && AUTH_ONLY.test(pathname)) {
      // Back to where the person was going before sign-in (same-site paths only).
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(next && /^\/(?![/\\])/.test(next) ? next : '/');
    }
    if (status === 'signed-in' && !onboardingDone && !BARE.test(pathname) && !isPublic) router.replace('/welcome');
  }, [status, isPublic, pathname, router, onboardingDone]);

  // New people get the tour once, on Home, right after setup. Settings > Help can replay it.
  useEffect(() => {
    if (status !== 'signed-in' || !settings || !onboardingDone || pathname !== '/') return;
    const t = settings.tour;
    if (!t.completed && !t.skipped) setTourOpen(true);
    else if (t.version < t.current && t.current > 1) setTourOpen(true);
  }, [status, settings, onboardingDone, pathname]);
  useEffect(() => {
    const start = () => setTourOpen(true);
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);
  const finishTour = useCallback(
    (how: 'completed' | 'skipped') => {
      setTourOpen(false);
      void updateSettings({ tour: how }).catch(() => undefined);
    },
    [updateSettings],
  );

  if (isPublic && !AUTH_ONLY.test(pathname) && pathname !== '/verify-email' && pathname !== '/reset-password') {
    return (
      <>
        <SkipLink />
        <ScrollProgress />
        <OfflineBanner />
        <PublicShell>{children}</PublicShell>
        <BackToTop withTabBar={false} />
        <CookieBanner />
      </>
    );
  }
  if (isPublic) {
    // Sign-in, sign-up and email-link pages: a calm full-screen card, no app chrome.
    return (
      <>
        <SkipLink />
        <OfflineBanner />
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <CookieBanner />
      </>
    );
  }

  if (status === 'loading' || (status === 'signed-out' && !isPublic)) return <Splash />;
  if (status === 'unavailable') return <Unavailable onRetry={() => void refresh()} />;
  if (!user) return <Splash />;

  if (BARE.test(pathname)) {
    return (
      <>
        <SkipLink />
        <OfflineBanner />
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </>
    );
  }

  const section = sectionFor(pathname);
  const fullscreen = FULLSCREEN_PATTERN.test(pathname);
  // Re-run the entrance animation when moving between areas, not inside one (e.g. chat to chat).
  const areaKey = pathname.split('/')[1] || 'home';

  return (
    <>
      <SkipLink />
      {!fullscreen && <ScrollProgress />}
      <div className="aura" aria-hidden="true" />
      <Rail section={section} />
      <div className="app-zoom min-h-dvh min-w-0 md:pl-[88px]">
        <OfflineBanner />
        <DeletionBanner />
        <PendingRoleBanner />
        <div key={areaKey} id="main-content" tabIndex={-1} className="animate-page outline-none">
          <RoleGate pathname={pathname}>{children}</RoleGate>
        </div>
      </div>
      {!fullscreen && <TabBar section={section} />}
      {!fullscreen && <BackToTop />}
      <CookieBanner />
      <Tour open={tourOpen} onFinish={finishTour} />
      <SurveyGate />
      {status === 'signed-in' && <LiveSync />}
    </>
  );
}

/** Pages a role cannot use say so plainly instead of failing on every request. */
function RoleGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { user } = useSession();
  const needed = capabilityFor(pathname);
  if (!needed || can(user, needed)) return <>{children}</>;
  return (
    <main className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-6 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-text-2">
          <Lock className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[26px] font-bold">Not part of your account</h1>
        <p className="mt-2 text-[15px] text-text-2">This section is not available for {user ? ROLE_LABEL[user.role].toLowerCase() : 'your'} accounts. If you think you should have access, ask your college admin.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink">Go to Home</Link>
      </div>
    </main>
  );
}

/** Faculty and expert sign-ups work as student accounts until an admin approves them. */
function PendingRoleBanner() {
  const { user } = useSession();
  if (!user?.pendingRole) return null;
  return (
    <div role="status" className="font-sans flex items-center justify-center gap-2 bg-info-soft px-4 py-2.5 text-center text-[14px] font-medium text-info">
      <Hourglass className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Your {user.pendingRole === 'faculty' ? 'faculty' : 'expert'} access is being reviewed by your college. You can use CampusConnect as a student until then.</span>
    </div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <span className="animate-breathe grid h-14 w-14 place-items-center rounded-2xl bg-text text-[24px] font-bold text-bg">c</span>
        <Spinner label="Opening CampusConnect" />
      </div>
    </div>
  );
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warning-soft text-warning">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="font-display mt-4 text-[28px]">CampusConnect is taking a breather</h1>
        <p className="mt-2 text-[15px] text-text-2">We could not reach our servers. Check your connection; if it is fine, we are probably already on it.</p>
        <Button className="mt-6" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
      </div>
    </main>
  );
}

/** Shown on every screen while an account is scheduled for deletion, with a one-tap undo. */
function DeletionBanner() {
  const { user, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  if (!user?.deletionScheduledFor) return null;
  const when = new Date(user.deletionScheduledFor).toLocaleDateString('en-IN', { dateStyle: 'long' });
  return (
    <div role="alert" className="font-sans flex flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-danger-soft px-4 py-2.5 text-center text-[14px] font-medium text-danger">
      <span>Your account will be permanently deleted on {when}.</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await del('/me/deletion');
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="press rounded-full bg-danger px-3 py-1 text-[13px] font-semibold text-white"
      >
        {busy ? 'Keeping…' : 'Keep my account'}
      </button>
    </div>
  );
}

function useBadges() {
  const chats = useQuery<{ count: number }>('badge:chats', (signal) => get('/chats/unread-count', undefined, signal), { refreshMs: 60_000 });
  const bell = useQuery<{ count: number }>('badge:notifications', (signal) => get('/notifications/unread-count', undefined, signal), { refreshMs: 60_000 });
  return { chats: chats.data?.count ?? 0, notifications: bell.data?.count ?? 0 };
}

export function refreshBadges() {
  invalidate('badge:');
}

function TabIcon({ tab, active, unread }: { tab: TabItem; active: boolean; unread: number }) {
  const { user } = useSession();
  if (tab.section === 'you') {
    const name = user?.profile.displayName ?? 'You';
    return (
      <span className={cn('rounded-full p-[2px]', active ? 'ring-2 ring-text' : '')}>
        {user?.profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.profile.avatarUrl} alt="" className="h-[22px] w-[22px] rounded-full object-cover" />
        ) : (
          <Avatar name={name} seed={user?.id} size="xs" className="h-[22px] w-[22px] text-[9px]" />
        )}
      </span>
    );
  }
  const Icon = tab.icon;
  return (
    <span className="relative">
      <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.7} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-[var(--surface-solid)]">
          {unread > 99 ? '99+' : unread}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </span>
  );
}

/** Phone: a standard bottom tab bar. Five equal tabs, the active one in full ink. */
function TabBar({ section }: { section: Section }) {
  const badges = useBadges();
  return (
    <nav aria-label="Primary" className="font-sans fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--surface-solid)] pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
      <ul className="mx-auto grid h-[60px] max-w-[520px] grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.section === section;
          const unread = tab.section === 'chats' ? badges.chats : tab.section === 'home' ? badges.notifications : 0;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                data-tour={`tab-${tab.section}`}
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
function Rail({ section }: { section: Section }) {
  const { user } = useSession();
  const badges = useBadges();
  const pathname = usePathname();
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[88px] flex-col items-center border-r border-border bg-[var(--surface-solid)] py-5 md:flex print:hidden">
      <Link href="/" aria-label="CampusConnect home" className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-text text-[17px] font-bold text-bg">
        c
      </Link>
      <nav aria-label="Main" className="font-sans flex flex-1 flex-col items-center gap-1">
        {TABS.map((tab) => {
          const active = tab.section === section && !inAdmin;
          const unread = tab.section === 'chats' ? badges.chats : tab.section === 'home' ? badges.notifications : 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-tour={`tab-${tab.section}`}
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
        {can(user, 'admin') && (
          <Link
            href="/admin"
            aria-current={inAdmin ? 'page' : undefined}
            className={cn('mt-2 flex w-[68px] flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors', inAdmin ? 'bg-surface-2 font-semibold text-text' : 'font-medium text-text-3 hover:bg-surface-2 hover:text-text')}
          >
            <ShieldCheck className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" />
            {user?.role === 'faculty' ? 'Review' : 'Admin'}
          </Link>
        )}
      </nav>
      <span data-tour="appearance">
        <AmbienceButton />
      </span>
    </aside>
  );
}
