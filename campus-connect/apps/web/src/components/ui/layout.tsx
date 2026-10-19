'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronRight, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { gradientFor } from '@/lib/visuals';

/**
 * Frosted sticky header on phones; a large editorial title on desktop.
 * Pass `back` on detail screens; it goes to the previous screen or `backHref`.
 */
export function PageHeader({
  title,
  subtitle,
  back = false,
  backHref,
  actions,
  leading,
  className,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  backHref?: string;
  actions?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header
      className={cn(
        'pt-safe sticky top-0 z-30 -mx-4 flex min-h-[60px] items-center gap-2 bg-bg px-4',
        'md:static md:mx-0 md:min-h-0 md:bg-transparent md:px-0 md:pb-5 md:pt-10',
        className,
      )}
    >
      {back && (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => (backHref ? router.push(backHref) : router.back())}
          className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-text hover:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      {leading}
      <div className="min-w-0 flex-1 py-3 md:py-0">
        <h1 className="truncate text-[30px] font-bold leading-tight tracking-tight md:whitespace-normal md:text-[32px]">
          {title}
        </h1>
        {subtitle && <p className="truncate text-[13px] text-text-3 md:mt-1.5 md:text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  action,
  description,
  className,
}: {
  title: string;
  action?: { label: string; href: string };
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-3.5 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[20px] font-semibold leading-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-text-3">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="font-sans shrink-0 text-[13px] font-semibold text-accent hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={cn('rounded-2xl border border-border bg-surface shadow-card', className)}>{children}</Tag>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-text-3">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-[16px] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-text-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'accent',
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
}) {
  const toneClass = {
    accent: 'bg-accent-soft text-accent-soft-ink',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
  }[tone];
  const body = (
    <>
      <div className="flex items-center gap-2 text-[13px] font-medium text-text-3">
        {Icon && (
          <span className={cn('grid h-7 w-7 place-items-center rounded-xl', toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 font-display text-[28px] font-semibold leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-1.5 truncate text-xs text-text-3">{hint}</p>}
    </>
  );
  const cls = 'rounded-2xl border border-border bg-surface p-4 shadow-card';
  if (href) {
    return (
      <Link href={href} className={cn(cls, 'press transition-colors hover:border-accent/40')}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  label?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const fill = {
    accent: 'var(--accent)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      <div className="h-full rounded-full transition-[width] duration-700 ease-drift" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
}

export function ScoreRing({ value, size = 54 }: { value: number; size?: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="4" className="stroke-surface-3" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-accent transition-[stroke-dasharray] duration-700"
          strokeDasharray={`${circumference * (value / 100)} ${circumference}`}
        />
      </svg>
      <span className="absolute text-[11px] font-bold">{value}%</span>
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          aria-hidden="true"
          className={cn(n <= Math.round(value) ? 'fill-warning text-warning' : 'text-surface-3')}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-text-2">{value.toFixed(1)}</span>
    </span>
  );
}

export function ListRow({
  icon: Icon,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  danger = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {Icon && (
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
            danger ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-text-2',
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[15px] font-semibold', danger && 'text-danger')}>{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-text-3">{subtitle}</span>}
      </span>
      {trailing}
      {href && !trailing && <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />}
    </>
  );
  const cls = cn(
    'flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-300 hover:bg-surface-2',
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}

/** Page-level hero used on detail screens: a soft gradient field with floating orbs. */
export function DetailHero({
  seed,
  icon: Icon,
  eyebrow,
  title,
  children,
  className,
}: {
  seed: string;
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-3xl border border-border bg-surface shadow-card', className)}>
      <div
        aria-hidden="true"
        className="relative flex h-40 items-end justify-between overflow-hidden p-5 text-white md:h-48"
        style={{ background: gradientFor(seed) }}
      >
        {eyebrow && (
          <span className="relative rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            {eyebrow}
          </span>
        )}
        {Icon && (
          <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white/20">
            <Icon className="h-7 w-7" />
          </span>
        )}
      </div>
      <div className="p-5 md:p-6">
        <h2 className="font-display text-[24px] font-semibold leading-tight tracking-tight md:text-[30px]">{title}</h2>
        {children && <div className="mt-3.5 space-y-3">{children}</div>}
      </div>
    </section>
  );
}

export function MetaLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-sm text-text-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
