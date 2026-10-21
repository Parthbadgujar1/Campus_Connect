'use client';

import { Suspense } from 'react';
import { SkeletonList } from '@/components/ui/states';
import { OpportunityBoard } from '@/components/opportunities/opportunity-board';

export default function Page() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={3} className="mx-auto mt-24 max-w-3xl px-4" />}>
      <OpportunityBoard title="Placements" subtitle="Internships and jobs for placement season" kinds={['internship', 'job']} />
    </Suspense>
  );
}
