'use client';

import Link from 'next/link';
import { Laugh, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/layout';
import { buttonClass } from '@/components/ui/button';
import { PostStream } from '@/components/feed/post-stream';

// The meme wall is every post tagged #memes. Keep it kind: the usual reporting rules apply.
export default function MemesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Meme wall"
        subtitle="Campus humour, tagged #memes"
        back
        backHref="/discover"
        actions={
          <Link href="/?compose=memes" className={buttonClass({ size: 'sm' })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Post
          </Link>
        }
      />
      <PostStream
        cacheKey="tag:memes"
        query={{ scope: 'tag', tag: 'memes' }}
        empty={{ icon: Laugh, title: 'The wall is empty', description: 'Post something funny and add the tag “memes”.' }}
        endMessage="That’s all the memes for now"
      />
    </div>
  );
}
