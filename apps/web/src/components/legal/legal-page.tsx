'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { usePublicConfig } from '@/components/shell/public-shell';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** A readable, printable policy page with a table of contents and the last-updated date. */
export function LegalPage({ title, summary, sections }: { title: string; summary: ReactNode; sections: LegalSection[] }) {
  const { data } = usePublicConfig();
  const updated = data ? new Date(data.legal.lastUpdated).toLocaleDateString('en-IN', { dateStyle: 'long' }) : null;
  return (
    <article className="legal">
      <header>
        <h1 className="marker-heading hl-blue text-[34px] font-bold leading-tight">{title}</h1>
        <p className="font-sans mt-2 text-[14px] text-text-3">
          {updated ? <>Last updated <time dateTime={data!.legal.lastUpdated}>{updated}</time></> : 'Loading…'}
          <button type="button" onClick={() => window.print()} className="ml-3 inline-flex items-center gap-1 font-semibold text-accent hover:underline print:hidden">
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print
          </button>
        </p>
        <div className="mt-5 rounded-2xl border border-border bg-surface p-5 text-[16px] leading-relaxed text-text-2">{summary}</div>
      </header>

      <nav aria-label="On this page" className="font-sans mt-8 rounded-2xl border border-border bg-surface p-5 print:hidden">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-text-3">On this page</p>
        <ol className="mt-3 grid gap-1.5 text-[14px] sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-accent hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
            <h2 id={`${s.id}-title`} className="text-[22px] font-semibold">
              {i + 1}. {s.title}
            </h2>
            <div className="legal-body mt-3 space-y-3 text-[16px] leading-relaxed text-text-2">{s.body}</div>
          </section>
        ))}
      </div>

      <footer className="font-sans mt-12 rounded-2xl border border-border bg-surface p-5 text-[14px] text-text-2">
        <p className="font-semibold text-text">Questions about this page?</p>
        <p className="mt-1">
          Write to {data ? <a className="text-accent hover:underline" href={`mailto:${data.operator.privacyEmail}`}>{data.operator.privacyEmail}</a> : 'our privacy team'} or use the{' '}
          <Link href="/contact?topic=privacy" className="text-accent hover:underline">contact form</Link>.
        </p>
      </footer>
    </article>
  );
}

/** The operator's registered details, from the server configuration. */
export function OperatorDetails() {
  const { data } = usePublicConfig();
  if (!data) return <span>Loading the operator’s details…</span>;
  const op = data.operator;
  // A span (not <address>), so it can sit inside a paragraph.
  return (
    <span>
      <strong className="text-text">{op.name}</strong>, {op.address}. Support: <a className="text-accent hover:underline" href={`mailto:${op.supportEmail}`}>{op.supportEmail}</a>. Privacy and Grievance Officer: <a className="text-accent hover:underline" href={`mailto:${op.privacyEmail}`}>{op.privacyEmail}</a>.
    </span>
  );
}
