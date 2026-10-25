'use client';

import { FileDown, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { withQuery, type Query } from '@/lib/api/client';
import { cn } from '@/lib/utils';

/** Download links for a report endpoint (Excel, Word, PDF, CSV). Same-origin, so the session cookie applies. */
export function DownloadButtons({ path, query, className, label = 'Download' }: { path: string; query?: Query; className?: string; label?: string }) {
  const formats: Array<{ format: string; label: string; icon: LucideIcon }> = [
    { format: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
    { format: 'docx', label: 'Word', icon: FileText },
    { format: 'pdf', label: 'PDF', icon: FileType },
    { format: 'csv', label: 'CSV', icon: FileDown },
  ];
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="font-sans text-[13px] font-semibold text-text-3">{label}</span>
      {formats.map((f) => (
        <a
          key={f.format}
          href={withQuery(`/api/v1${path}`, { ...query, format: f.format })}
          download
          className="font-sans inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold text-text-2 shadow-card hover:text-text"
        >
          <f.icon className="h-4 w-4" aria-hidden="true" /> {f.label}
        </a>
      ))}
    </div>
  );
}

/** Small "label · number" figure used across the console. */
export function Figure({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'warning' | 'danger' | 'success' }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-card">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-text-3">{label}</p>
      <p className={cn('font-sans mt-0.5 text-[24px] font-bold tabular-nums', tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>{value}</p>
    </div>
  );
}

export const ROLE_INFO_LABEL: Record<string, string> = {
  enrollmentNumber: 'Enrollment no.',
  admissionYear: 'Admission year',
  employeeId: 'Employee ID',
  designation: 'Designation',
  organization: 'Organisation',
  linkedinUrl: 'LinkedIn',
};

/** What someone told us at sign-up, for reviewers. */
export function RoleInfoList({ info }: { info: Record<string, string | number | null> }) {
  const entries = Object.entries(info).filter(([, v]) => v !== null && v !== '');
  if (!entries.length) return <p className="text-[13px] text-text-3">No sign-up details given.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-sans font-semibold text-text-3">{ROLE_INFO_LABEL[k] ?? k}</dt>
          <dd className="min-w-0 break-words">{k === 'linkedinUrl' && typeof v === 'string' && /^https:\/\//.test(v) ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-accent underline">{v}</a> : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
