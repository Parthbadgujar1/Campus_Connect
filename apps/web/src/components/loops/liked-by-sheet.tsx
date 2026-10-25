'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { get, post, errorMessage } from '@/lib/api/client';
import { useInfinite, type Page } from '@/lib/api/hooks';
import type { PersonSummary } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { EndOfList } from '@/components/ui/infinite';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, LoadMore, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

type Liker = PersonSummary & { isFollowing: boolean; isMe: boolean };

/** The people who liked a post or loop, newest first, with a Follow button beside each (like Instagram's "Likes"). */
export function LikedBySheet({ postId, total, onClose }: { postId: string; total: number; onClose: () => void }) {
  const toast = useToast();
  const list = useInfinite<Liker>(`likes:${postId}`, (cursor, signal) => get<Page<Liker> & { total: number }>(`/posts/${postId}/likes`, { cursor: cursor ?? undefined, limit: 30 }, signal));
  const [followed, setFollowed] = useState<string[]>([]);

  const follow = async (p: Liker) => {
    setFollowed((f) => [...f, p.id]);
    try {
      await post(`/users/${p.id}/follow`);
    } catch (err) {
      setFollowed((f) => f.filter((x) => x !== p.id));
      toast(errorMessage(err));
    }
  };

  return (
    <Sheet open onClose={onClose} title={total ? `${total} like${total === 1 ? '' : 's'}` : 'Likes'}>
      {list.loading && <SkeletonList variant="row" count={4} />}
      {list.error && !list.items.length && <ErrorState error={list.error} onRetry={list.reload} compact />}
      {!list.loading && !list.error && !list.items.length && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Heart className="h-8 w-8 text-text-3" aria-hidden="true" />
          <p className="font-semibold">No likes yet</p>
        </div>
      )}
      <ul className="divide-y divide-border">
        {list.items.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <PersonAvatar person={p} size="md" link />
            <span className="min-w-0 flex-1">
              <PersonName person={p} className="block max-w-full" />
              <span className="block truncate text-[13px] text-text-3">@{p.username}</span>
            </span>
            {!p.isMe && (p.isFollowing || followed.includes(p.id) ? (
              <span className="font-sans text-[13px] font-semibold text-text-3">Following</span>
            ) : (
              <Button size="sm" onClick={() => void follow(p)}>Follow</Button>
            ))}
          </li>
        ))}
      </ul>
      {list.hasMore ? <LoadMore hasMore loading={list.loadingMore} onClick={list.loadMore} label="Show more" /> : list.items.length > 6 ? <EndOfList message="That’s everyone" className="py-4" /> : null}
    </Sheet>
  );
}
