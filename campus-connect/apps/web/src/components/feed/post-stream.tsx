'use client';

import type { LucideIcon } from 'lucide-react';
import { get, type Query } from '@/lib/api/client';
import { useInfinite, type Page } from '@/lib/api/hooks';
import type { PostView } from '@/lib/api/types';
import { InfiniteList } from '@/components/ui/infinite';
import { LivePostCard } from './live-post-card';

/** Any slice of the feed (trending, a tag, one person...), paged, with a clear end. */
export function PostStream({ query, cacheKey, empty, endMessage, endHint }: { query: Query; cacheKey: string; empty: { icon: LucideIcon; title: string; description?: string }; endMessage?: string; endHint?: string }) {
  const feed = useInfinite<PostView>(`feed:${cacheKey}`, (cursor, signal) => get<Page<PostView>>('/feed', { ...query, cursor: cursor ?? undefined, limit: 10 }, signal));
  return (
    <InfiniteList
      state={feed}
      className="space-y-3"
      empty={empty}
      endMessage={endMessage}
      endHint={endHint}
      render={(p) => (
        <LivePostCard post={p} onChange={(next) => feed.setItems((items) => items.map((x) => (x.id === next.id ? next : x)))} onRemove={(id) => feed.setItems((items) => items.filter((x) => x.id !== id))} />
      )}
    />
  );
}
