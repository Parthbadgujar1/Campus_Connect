'use client';

import { Flame } from 'lucide-react';
import { PageHeader } from '@/components/ui/layout';
import { PostStream } from '@/components/feed/post-stream';

export default function TrendingPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Trending" subtitle="The most liked posts at your college this week" back backHref="/discover" />
      <PostStream
        cacheKey="trending"
        query={{ scope: 'trending' }}
        empty={{ icon: Flame, title: 'Nothing trending yet', description: 'Posts from the last 7 days with the most likes show up here.' }}
        endMessage="You’ve seen everything trending"
        endHint="Check back later: this list follows what people like during the week."
      />
    </div>
  );
}
