'use client';

import { Suspense } from 'react';
import { SkeletonList } from '@/components/ui/states';
import { MarketBoard } from '@/components/market/market-ui';

export default function Page() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={4} className="mx-auto mt-24 max-w-5xl px-4" />}>
      <MarketBoard title="Rooms & PGs" subtitle="Rooms and PGs near campus, listed by students" category="housing" />
    </Suspense>
  );
}
