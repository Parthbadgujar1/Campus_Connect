'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ProfileView } from '@/components/profile/profile-view';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { getPersonByUsername, me } from '@/data/people';
import { UserRound } from 'lucide-react';

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const person = getPersonByUsername(username);

  if (!person) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Profile" back />
        <EmptyState icon={UserRound} title="This profile is not available" action={<Link href="/discover" className="text-[15px] font-semibold text-accent">Back to Discover</Link>} className="mt-6" />
      </div>
    );
  }

  return <ProfileView person={person} isMe={person.id === me.id} />;
}
