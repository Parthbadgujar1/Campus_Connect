import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export function buttonClass({
  variant = 'primary',
  size = 'md',
  full = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
} = {}) {
  return cn(
    'press font-sans inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,opacity] duration-300 select-none',
    size === 'sm' && 'h-9 px-3.5 text-[14px]',
    size === 'md' && 'h-11 px-5 text-[15px]',
    size === 'lg' && 'h-[52px] px-6 text-[15px]',
    variant === 'primary' && 'bg-accent text-accent-ink hover:opacity-90',
    variant === 'secondary' && 'border border-border bg-surface text-text hover:bg-surface-2',
    variant === 'soft' && 'bg-accent-soft text-accent-soft-ink hover:opacity-90',
    variant === 'ghost' && 'text-text-2 hover:bg-surface-2 hover:text-text',
    variant === 'danger' && 'bg-danger-soft text-danger hover:opacity-90',
    full && 'w-full',
    className,
  );
}

export function Button({
  variant,
  size,
  full,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}) {
  return <button type={type} className={buttonClass({ variant, size, full, className })} {...props} />;
}

export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'press grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-2 transition-colors duration-300 hover:bg-surface-2 hover:text-text',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
