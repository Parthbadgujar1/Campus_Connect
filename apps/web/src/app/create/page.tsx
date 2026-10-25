'use client';

import { useRouter } from 'next/navigation';
import { Composer } from '@/components/feed/composer';
import { PageHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { invalidate } from '@/lib/api/hooks';

/** A full-page composer (from the profile, Loops and other "Write a post" links). */
export default function CreatePostPage() {
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="New post" subtitle="Text, photos, a video, a poll or a question" back />
      <Composer
        placeholder="What would you like to share?"
        onPosted={(p) => {
          invalidate('feed:');
          toast('Posted');
          router.replace(`/post/${p.id}`);
        }}
      />
    </div>
  );
}
