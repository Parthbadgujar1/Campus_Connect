import type { ReactNode } from 'react';
import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gradientFor, initials } from '@/lib/visuals';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<Size, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
};

/** Orb avatar: a soft gradient sphere with a highlight, initials on top. */
export function Avatar({
  name,
  seed,
  size = 'md',
  ring = false,
  presence = false,
  className,
}: {
  name: string;
  seed?: string;
  size?: Size;
  ring?: boolean;
  /** Shows a calm glow ring for people who are active now. */
  presence?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        SIZE[size],
        ring && 'ring-2 ring-[var(--bg)]',
        presence && 'ring-2 ring-success ring-offset-2 ring-offset-[var(--bg)]',
        className,
      )}
      style={{
        background: `${gradientFor(seed ?? name)}`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function VerifiedMark({ className }: { className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verified student"
      role="img"
      className={cn('inline-block h-4 w-4 shrink-0 text-accent', className)}
    />
  );
}
