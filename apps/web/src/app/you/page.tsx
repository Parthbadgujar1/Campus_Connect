'use client';

import { LiveProfile } from '@/components/profile/live-profile';
import { SkeletonList } from '@/components/ui/states';
import { useSession } from '@/lib/session';

/** Your own profile: edit, share, your posts and everything you saved. */
export default function YouPage() {
  const { user } = useSession();
  if (!user) return <SkeletonList className="mx-auto mt-8 max-w-3xl px-4" count={2} />;
  return <LiveProfile handle={user.profile.username} />;
}
