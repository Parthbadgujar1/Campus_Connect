'use client';

import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PostCard } from '@/components/feed/post-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { getPerson } from '@/data/people';
import { posts } from '@/data/feed';
import { MessageCircle } from 'lucide-react';
import { relativeTime } from '@/lib/time';
import { hueFor } from '@/lib/visuals';

interface Comment {
  id: string;
  authorId: string;
  text: string;
  at: string;
}

const SEED_COMMENTS: Comment[] = [
  { id: 'c1', authorId: 'p-tanvi', text: 'Is the Web3 track open to first years as well?', at: '2026-10-14T08:00:00+05:30' },
  { id: 'c2', authorId: 'p-diya', text: 'Pitch track is also open. Happy to mentor for the business side.', at: '2026-10-14T08:20:00+05:30' },
  { id: 'c3', authorId: 'p-harsh', text: 'Last year’s checkpoint was at 2 AM. Bring snacks.', at: '2026-10-14T09:10:00+05:30' },
];

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const post = posts.find((p) => p.id === id);
  const [comments, setComments] = useState(SEED_COMMENTS);
  const [text, setText] = useState('');

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Post" back />
        <EmptyState icon={MessageCircle} title="This post is no longer available" className="mt-6" />
      </div>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setComments((list) => [...list, { id: `new-${Date.now()}`, authorId: 'me', text: value, at: new Date().toISOString() }]);
    setText('');
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Post" back />
      <div className="mt-2 md:mt-4">
        <PostCard post={post} detailed />
      </div>

      <section className="mt-6" aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="mb-4 font-display text-[20px] font-semibold">
          Replies <span className="text-text-3">· {comments.length}</span>
        </h2>
        <ul className="stagger space-y-5">
          {comments.map((comment) => {
            const author = comment.authorId === 'me' ? null : getPerson(comment.authorId);
            return (
              <li key={comment.id} className="flex gap-3">
                <Avatar name={author?.name ?? 'Riya Deshmukh'} seed={author?.id ?? 'me'} size="sm" />
                <div className="min-w-0 flex-1 border-l-[3px] pl-3" style={{ borderColor: author ? `hsl(${hueFor(author.id)} 42% 58%)` : 'var(--accent)' }}>
                  <p className="text-xs text-text-3">
                    <span className="font-semibold text-text-2">{author?.name ?? 'You'}</span> · {relativeTime(comment.at)}
                  </p>
                  <p className="mt-0.5 text-[15px] leading-relaxed">{comment.text}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={submit} className="glass sticky bottom-[72px] mt-8 flex items-center gap-2 rounded-full p-1.5 pl-2 shadow-float md:bottom-6">
          <Input
            aria-label="Write a comment"
            placeholder="Add a comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-10 rounded-full border-0 bg-transparent focus:ring-0"
          />
          <Button type="submit" size="sm" disabled={!text.trim()}>
            Post
          </Button>
        </form>
      </section>
    </div>
  );
}
