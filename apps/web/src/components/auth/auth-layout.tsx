'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AmbienceButton } from '@/components/shell/ambience';

/** A calm, centred card for sign-in, sign-up and email-link pages. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pt-5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="CampusConnect home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-text text-[16px] font-bold text-bg">c</span>
          <span className="font-display text-[20px] leading-none">CampusConnect</span>
        </Link>
        <AmbienceButton />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <h1 className="marker-heading hl-blue text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <div className="mt-2 text-[15px] text-text-2">{subtitle}</div>}
        <div className="mt-7">{children}</div>
        {footer && <div className="font-sans mt-6 text-center text-[14px] text-text-2">{footer}</div>}
      </main>
      <nav aria-label="Legal" className="font-sans flex flex-wrap justify-center gap-x-4 gap-y-1 px-5 pb-6 text-[13px] text-text-3">
        <Link href="/privacy" className="hover:text-text">Privacy</Link>
        <Link href="/terms" className="hover:text-text">Terms</Link>
        <Link href="/cookies" className="hover:text-text">Cookies</Link>
        <Link href="/faq" className="hover:text-text">FAQ</Link>
        <Link href="/contact" className="hover:text-text">Contact</Link>
      </nav>
    </div>
  );
}

/** A labelled field with its error underneath, wired up for screen readers. */
export function FormField({ id, label, error, hint, children, trailing }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="font-sans text-sm font-semibold text-text">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="font-sans text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="font-sans text-[13px] text-text-3">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function Checkbox({ id, checked, onChange, children, error }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="font-sans flex cursor-pointer items-start gap-3 text-[14px] text-text-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded-md accent-[var(--accent)]"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="font-sans ml-8 mt-1 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
