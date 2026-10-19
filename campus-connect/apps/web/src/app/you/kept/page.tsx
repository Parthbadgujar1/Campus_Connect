'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Chip, ChipRow } from '@/components/ui/chip';
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PostCard } from '@/components/feed/post-card';
import { OpportunityCard } from '@/components/common/opportunity-card';
import { ListingCard } from '@/components/common/cards';
import { VideoCard } from '@/components/watch/video-card';
import { opportunities } from '@/data/careers';
import { posts } from '@/data/feed';
import { marketListings } from '@/data/living';
import { loops, videos } from '@/data/videos';
import { useAppState } from '@/lib/store';
import { gradientFor } from '@/lib/visuals';

const LENSES = ['Everything', 'Posts', 'Videos', 'Loops', 'Opportunities', 'Market'] as const;
type Lens = (typeof LENSES)[number];

export default function KeptPage() {
  const saved = useAppState((s) => s.saved);
  const [lens, setLens] = useState<Lens>('Everything');

  const groups = {
    Posts: posts.filter((p) => saved.includes(p.id)),
    Videos: videos.filter((v) => saved.includes(v.id)),
    Loops: loops.filter((l) => saved.includes(l.id)),
    Opportunities: opportunities.filter((o) => saved.includes(o.id)),
    Market: marketListings.filter((m) => saved.includes(m.id)),
  };
  const count = Object.values(groups).reduce((n, list) => n + list.length, 0);
  const show = (name: Exclude<Lens, 'Everything'>) => (lens === 'Everything' || lens === name) && groups[name].length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Saved" subtitle={`${count} saved`} back backHref="/you" />

      <ChipRow className="mt-2">
        {LENSES.map((item) => (
          <Chip key={item} active={lens === item} onClick={() => setLens(item)}>
            {item}
            {item !== 'Everything' && groups[item].length > 0 && <span className="opacity-60">{groups[item].length}</span>}
          </Chip>
        ))}
      </ChipRow>

      {count === 0 && (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Save a post, video, loop or opportunity and it shows up here."
          className="mt-6"
          action={<Link href="/discover" className="text-sm font-semibold text-accent">Explore Discover</Link>}
        />
      )}

      <div key={lens} className="animate-rise mt-6 space-y-10">
        {show('Posts') && (
          <section>
            <SectionHeader title="Posts" />
            <div className="space-y-4">
              {groups.Posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}
        {show('Videos') && (
          <section>
            <SectionHeader title="Videos" />
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
              {groups.Videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        )}
        {show('Loops') && (
          <section>
            <SectionHeader title="Loops" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
              {groups.Loops.map((loop) => (
                <Link
                  key={loop.id}
                  href={`/loops?start=${loop.id}`}
                  className="press flex aspect-[9/16] w-32 shrink-0 items-end overflow-hidden rounded-2xl p-3 text-sm font-semibold text-white shadow-card"
                  style={{ background: gradientFor(loop.seed) }}
                >
                  <span className="line-clamp-3 drop-shadow">{loop.caption}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {show('Opportunities') && (
          <section>
            <SectionHeader title="Opportunities" />
            <div className="space-y-3">
              {groups.Opportunities.map((op) => (
                <OpportunityCard key={op.id} opportunity={op} />
              ))}
            </div>
          </section>
        )}
        {show('Market') && (
          <section>
            <SectionHeader title="Market" />
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.Market.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
