'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/**
 * A small action menu (⋯). Keyboard: Enter/Space opens, arrow keys move, Esc closes and returns
 * focus to the button. Closes when clicking outside.
 */
export function Menu({ label, items, trigger, align = 'right' }: { label: string; items: MenuItem[]; trigger: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const visible = items.filter((i) => !i.hidden);
  const popup = useRef<HTMLDivElement>(null);
  // Opens upward when there is not enough room below (for example a composer at the bottom).
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const b = button.current?.getBoundingClientRect();
    const h = popup.current?.offsetHeight ?? 0;
    if (!b) return;
    const below = window.innerHeight - b.bottom;
    setUp(below < h + 12 && b.top > below);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={popup}
          id={id}
          role="menu"
          aria-label={label}
          className={cn(
            'font-sans animate-pop absolute z-30 min-w-[200px] overflow-hidden rounded-2xl border border-border bg-[var(--surface-solid)] py-1.5 shadow-float',
            up ? 'bottom-10' : 'top-10',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] font-medium outline-none hover:bg-surface-2 focus-visible:bg-surface-2',
                  item.danger ? 'text-danger' : 'text-text',
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
