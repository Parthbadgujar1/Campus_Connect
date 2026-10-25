import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Banner for trust notices, tips and warnings. */
export function InfoBanner({
  icon: Icon,
  title,
  children,
  tone = 'accent',
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  tone?: 'accent' | 'warning' | 'danger' | 'success';
  action?: ReactNode;
}) {
  const toneClass = {
    accent: 'bg-accent-soft text-accent-soft-ink',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-success-soft text-success',
  }[tone];
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', toneClass)}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-text-2">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
