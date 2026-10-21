'use client';

import { useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

/** True until a student has opened this link once. */
export function useUnseen(href: string): boolean {
  return useAppState((s) => !s.seen.includes(href));
}

/**
 * A small dot that says "not opened yet". Corner placement sits on a tile; inline placement sits
 * beside a label. Opening the link clears it (appActions.markSeen runs on click).
 */
export function UnseenDot({
  href,
  placement = 'corner',
  className,
}: {
  href: string;
  placement?: 'corner' | 'inline';
  className?: string;
}) {
  const unseen = useUnseen(href);
  if (!unseen) return null;
  return (
    <span
      role="img"
      aria-label="New, not opened yet"
      className={cn(
        'h-2.5 w-2.5 shrink-0 rounded-full bg-accent ring-2 ring-surface',
        placement === 'corner' ? 'absolute right-3 top-3' : 'inline-block',
        className,
      )}
    />
  );
}
