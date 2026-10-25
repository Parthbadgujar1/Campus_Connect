'use client';

import { useParams } from 'next/navigation';
import { LiveProfile } from '@/components/profile/live-profile';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  return <LiveProfile handle={decodeURIComponent(username)} />;
}
