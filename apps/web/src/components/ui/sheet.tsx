'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockScroll } from '@/lib/scroll-lock';

/**
 * Frosted sheet that glides up from the bottom on phones and floats in the centre
 * on desktop. Every quick action uses it, so screens stay on one route.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/40"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-sheet md:animate-dialog relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-[var(--surface-solid)] shadow-float md:max-w-lg md:rounded-3xl"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-surface-3 md:hidden" aria-hidden="true" />
        <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-[22px] font-semibold leading-tight tracking-tight">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-text-3">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-border px-6 py-3.5 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
