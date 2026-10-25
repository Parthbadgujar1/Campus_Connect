'use client';

// A paged list that loads the next page as you scroll and, when there is nothing more, says so
// clearly ("You've reached the end") instead of repeating or spinning forever. It also covers
// the first load (skeletons), errors (a retry), and empty lists (a friendly empty state).

import { useEffect, useRef, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InfiniteState } from '@/lib/api/hooks';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { EmptyState } from './layout';
import { ErrorState, LoadMore, SkeletonList, Spinner } from './states';
import { cn } from '@/lib/utils';

export function EndOfList({ message = 'You’ve reached the end', hint, className }: { message?: string; hint?: string; className?: string }) {
  return (
    <Reveal className={cn('flex flex-col items-center gap-1.5 py-8 text-center', className)}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold">{message}</p>
      {hint && <p className="max-w-xs text-[13px] text-text-3">{hint}</p>}
    </Reveal>
  );
}

export function InfiniteList<T extends { id: string }>({
  state,
  render,
  skeleton = 'post',
  empty,
  endMessage,
  endHint,
  className,
  itemClassName,
  as = 'div',
}: {
  state: InfiniteState<T>;
  render: (item: T, index: number) => ReactNode;
  skeleton?: 'post' | 'row' | 'card' | 'message' | 'tile';
  empty: { icon: LucideIcon; title: string; description?: string; action?: ReactNode };
  endMessage?: string;
  endHint?: string;
  className?: string;
  itemClassName?: string;
  as?: 'div' | 'ul';
}) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  const { items, loading, loadingMore, hasMore, loadMore, error, reload } = state;

  // Load the next page a little before the end comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: '600px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, items.length]);

  if (loading) return <SkeletonList variant={skeleton} count={skeleton === 'row' ? 6 : 3} className={className} />;
  if (error && !items.length) return <ErrorState error={error} onRetry={reload} className={className} />;
  if (!items.length) return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} action={empty.action} className={className} />;

  return (
    <div>
      <Stagger as={as === 'ul' ? 'ul' : 'div'} className={className}>
        {items.map((it, i) => (
          <StaggerItem key={it.id} as={as === 'ul' ? 'li' : 'div'} className={itemClassName}>
            {render(it, i)}
          </StaggerItem>
        ))}
      </Stagger>
      {error && items.length > 0 && <ErrorState error={error} onRetry={loadMore} compact className="mt-3" />}
      {hasMore ? (
        <div ref={sentinel} className="flex justify-center py-4" aria-live="polite">
          {loadingMore ? <Spinner label="Loading more" /> : <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />}
        </div>
      ) : (
        <EndOfList message={endMessage} hint={endHint} />
      )}
    </div>
  );
}
