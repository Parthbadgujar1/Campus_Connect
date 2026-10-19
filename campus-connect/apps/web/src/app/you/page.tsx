'use client';

import { ProfileView } from '@/components/profile/profile-view';
import { me } from '@/data/people';

export default function YouPage() {
  return <ProfileView person={me} isMe />;
}
