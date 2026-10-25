'use client';

// The frame for pages that work without an account: sign-in and sign-up, password reset, legal
// pages, contact and help. Header with a mobile menu, a footer with the legal links and the
// operator's business details, and a floating contact button.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Mail, Menu, X } from 'lucide-react';
import { get } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import type { PublicConfig } from '@/lib/api/types';
import { useOptionalSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { AmbienceButton } from './ambience';
import { openCookieSettings } from './cookie-banner';

const NAV = [
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
];

export function usePublicConfig() {
  return useQuery<PublicConfig>('meta:config', (signal) => get<PublicConfig>('/meta/config', undefined, signal));
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="CampusConnect home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-text text-[16px] font-bold text-bg">c</span>
      <span className="font-display text-[22px] leading-none">CampusConnect</span>
    </Link>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const session = useOptionalSession();
  const signedIn = session?.status === 'signed-in';
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const actions = signedIn ? (
    <Link href="/" className="press font-sans inline-flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-ink">
      Open the app
    </Link>
  ) : (
    <>
      <Link href="/login" className="press font-sans inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold text-text-2 hover:bg-surface-2 hover:text-text">
        Sign in
      </Link>
      <Link href="/register" className="press font-sans inline-flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-ink">
        Create account
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--surface-solid)] print:static print:border-0">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <Brand />
        <nav aria-label="Site" className="font-sans hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname === n.href ? 'page' : undefined}
              className={cn('rounded-full px-3 py-2 text-[14px] font-medium hover:bg-surface-2', pathname === n.href ? 'text-text' : 'text-text-2')}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-1.5 md:flex print:hidden">
          <AmbienceButton />
          {actions}
        </div>
        <button
          type="button"
          className="press grid h-10 w-10 place-items-center rounded-full border border-border md:hidden print:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="animate-fade border-t border-border bg-[var(--surface-solid)] px-4 pb-5 pt-3 md:hidden">
          <nav aria-label="Site" className="font-sans grid gap-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-surface-2">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AmbienceButton />
            {actions}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { data } = usePublicConfig();
  const op = data?.operator;
  return (
    <footer className="font-sans mt-16 border-t border-border bg-[var(--surface-solid)] print:mt-6">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-[14px] sm:grid-cols-3">
        <div>
          <p className="font-semibold text-text">CampusConnect</p>
          <p className="mt-2 text-text-3">One calm app for your college: friends, spaces, events, learning and campus life.</p>
        </div>
        <nav aria-label="Legal" className="grid content-start gap-2">
          <Link href="/privacy" className="text-text-2 hover:text-text">Privacy policy</Link>
          <Link href="/terms" className="text-text-2 hover:text-text">Terms of service</Link>
          <Link href="/cookies" className="text-text-2 hover:text-text">Cookie policy</Link>
          <button type="button" onClick={openCookieSettings} className="text-left text-text-2 hover:text-text print:hidden">
            Cookie settings
          </button>
          <Link href="/privacy#your-rights" className="text-text-2 hover:text-text">Request or delete my data</Link>
        </nav>
        <div className="text-text-3">
          <p className="font-semibold text-text">Operated by</p>
          <address className="mt-2 not-italic">
            {op ? (
              <>
                {op.name}
                <br />
                {op.address}
                <br />
                <a className="text-accent hover:underline" href={`mailto:${op.supportEmail}`}>{op.supportEmail}</a>
              </>
            ) : (
              'Loading business details…'
            )}
          </address>
          {data && <p className="mt-3 text-[12px]">Policies last updated {new Date(data.legal.lastUpdated).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>}
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-[12px] text-text-3">
        © {new Date().getFullYear()} CampusConnect. No ads, no selling of your data, no hidden fees.
      </p>
    </footer>
  );
}

/** Round button bottom-right on public pages: the quickest way to reach a person. */
export function FloatingContact() {
  const pathname = usePathname();
  if (pathname === '/contact') return null;
  return (
    <Link
      href="/contact"
      aria-label="Contact us"
      title="Contact us"
      className="press font-sans fixed bottom-6 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-ink shadow-float md:right-6 print:hidden"
    >
      <Mail className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">Contact us</span>
    </Link>
  );
}

export function PublicShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <div id="main-content" tabIndex={-1} className={cn('mx-auto w-full flex-1 px-4 py-8 outline-none', wide ? 'max-w-5xl' : 'max-w-3xl')}>
        {children}
      </div>
      <PublicFooter />
      <FloatingContact />
    </div>
  );
}
