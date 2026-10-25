'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Chip({
  active = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-300',
        active
          ? 'bg-text text-bg'
          : 'border border-border bg-surface text-text-2 hover:text-text',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Horizontally scrollable row of chips. Bleeds to the screen edge on phones. */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Segmented control with a thumb that glides between options. Options share the
 * width equally, so the thumb position is just index × width.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const width = 100 / options.length;
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('relative flex rounded-full border border-border bg-surface-2 p-1', className)}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 top-1 rounded-full bg-surface-solid shadow-card transition-[left] duration-500 ease-drift"
        style={{ left: `calc(4px + ${index} * (100% - 8px) * ${width / 100})`, width: `calc((100% - 8px) * ${width / 100})` }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[13px] font-semibold transition-colors duration-300 sm:px-3',
              active ? 'text-text' : 'text-text-3 hover:text-text-2',
            )}
          >
            <span className="truncate">{option.label}</span>
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] leading-5',
                  active ? 'bg-accent-soft text-accent-soft-ink' : 'bg-surface-3 text-text-3',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Section tabs: text labels with a soft dot that grows under the active one. */
export function UnderlineTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 md:mx-0 md:px-0', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative shrink-0 whitespace-nowrap pb-3 pt-1 text-[15px] font-semibold transition-colors duration-300',
              active ? 'text-text' : 'text-text-3 hover:text-text-2',
            )}
          >
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 align-middle text-[11px] leading-5 text-text-2">{option.count}</span>
            )}
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-x-0 bottom-0 mx-auto h-1 rounded-full bg-accent transition-all duration-500 ease-drift',
                active ? 'w-6 opacity-100' : 'w-0 opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
