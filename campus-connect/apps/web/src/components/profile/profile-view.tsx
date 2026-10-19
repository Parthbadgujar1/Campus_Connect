'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BadgeCheck, Bookmark, ExternalLink, PenLine, Settings, Share2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonClass } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { chats } from '@/data/chats';
import { badges } from '@/data/fun';
import { loops } from '@/data/videos';
import { posts } from '@/data/feed';
import { inkSummary } from '@/data/contributions';
import { me } from '@/data/people';
import type { Person } from '@/lib/types';
import { appActions, useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<Person['role'], string> = {
  student: 'Student',
  faculty: 'Teacher',
  expert: 'Industry expert',
  admin: 'Campus office',
  business: 'Partner',
};

type Tab = 'posts' | 'loops' | 'about' | 'ink';

/** The profile everyone sees. `isMe` swaps the actions and adds your own tabs. */
export function ProfileView({ person, isMe }: { person: Person; isMe: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const following = useAppState((s) => s.following);
  const email = useAppState((s) => s.session?.email ?? `${me.username}@csmss.edu`);
  const isFollowing = following.includes(person.id);
  const [tab, setTab] = useState<Tab>('posts');

  const myPosts = posts.filter((p) => p.authorId === person.id);
  const myLoops = loops.filter((l) => l.authorId === person.id);
  const earned = badges.filter((b) => b.earned);

  const tabs: { value: Tab; label: string }[] = [
    { value: 'posts', label: `Posts${myPosts.length ? ` · ${myPosts.length}` : ''}` },
    { value: 'loops', label: `Loops${myLoops.length ? ` · ${myLoops.length}` : ''}` },
    { value: 'about', label: 'About' },
    ...(isMe ? [{ value: 'ink' as Tab, label: 'Your ink' }] : []),
  ];

  const stats = isMe
    ? [
        { label: 'Followers', value: person.followers, href: undefined },
        { label: 'Following', value: person.following, href: undefined },
        { label: 'Thanks', value: inkSummary.thanks, href: '/contributions' },
        { label: 'Saved', value: 0, href: '/you/kept' },
      ]
    : [
        { label: 'Followers', value: person.followers + (isFollowing ? 1 : 0), href: undefined },
        { label: 'Following', value: person.following, href: undefined },
        { label: 'Posts', value: myPosts.length, href: undefined },
        { label: 'Loops', value: myLoops.length, href: undefined },
      ];

  const directChat = chats.find((c) => c.kind === 'direct' && c.memberIds.includes(person.id));

  return (
    <div className="mx-auto w-full max-w-3xl pb-36 md:px-8 md:pb-16">
      {/* Cover: a flat band in the brand colour, no gradients */}
      <div className="h-28 bg-accent-soft md:h-36 md:rounded-b-3xl" aria-hidden="true" />

      <header className="px-4 md:px-0">
        <div className="-mt-12 flex items-end justify-between gap-4">
          <span className="rounded-full bg-bg p-1">
            <Avatar name={person.name} seed={person.id} size="xl" className="h-24 w-24 text-3xl" />
          </span>
          <div className="flex gap-2 pb-1">
            {isMe ? (
              <>
                <Link href="/profile/edit" className={buttonClass({ variant: 'primary', size: 'sm' })}>
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Edit profile
                </Link>
                <Link href="/settings" aria-label="Settings" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <Button size="sm" variant={isFollowing ? 'secondary' : 'primary'} aria-pressed={isFollowing} onClick={() => appActions.toggleFollowing(person.id)}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => (directChat ? router.push(`/chats/${directChat.id}`) : toast('Message request sent (preview)'))}>
                  Message
                </Button>
              </>
            )}
            <button
              type="button"
              aria-label="Share profile"
              onClick={() => toast('Profile link copied (preview)')}
              className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-text-2 hover:text-text"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="flex items-center gap-2 text-[26px] font-bold leading-tight tracking-tight">
            {person.name}
            {person.verified && <BadgeCheck className="h-5 w-5 text-accent" aria-label="Verified student" role="img" />}
          </h1>
          <p className="text-[15px] text-text-3">
            @{person.username} · {ROLE_LABEL[person.role]}
            {person.branch && ` · ${person.branch}`}
            {person.year && ` · Year ${person.year}`}
          </p>
          {person.bio && <p className="mt-3 text-[16px] leading-relaxed text-text-2">{person.bio}</p>}
          {(person.github || person.linkedin) && (
            <div className="mt-3 flex flex-wrap gap-4 text-[14px] font-semibold text-accent">
              {person.github && (
                <a href={`https://${person.github}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  GitHub
                </a>
              )}
              {person.linkedin && (
                <a href={`https://${person.linkedin}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  LinkedIn
                </a>
              )}
            </div>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-4 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {stats.map((stat) => {
            const body = (
              <>
                <dt className="text-[12px] text-text-3">{stat.label}</dt>
                <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{stat.value.toLocaleString('en-IN')}</dd>
              </>
            );
            return (
              <div key={stat.label} className="px-2 py-3 text-center">
                {stat.href ? (
                  <Link href={stat.href} className="block rounded-lg transition-colors hover:bg-surface-2">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </div>
            );
          })}
        </dl>

        {isMe && (
          <Link href="/you/kept" className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold transition-colors hover:bg-surface-2">
            <span className="flex items-center gap-2.5">
              <Bookmark className="h-4 w-4 text-accent" aria-hidden="true" />
              Saved
            </span>
            <span className="text-text-3">{inkSummary.points.toLocaleString('en-IN')} points</span>
          </Link>
        )}
      </header>

      <div className="mt-7 px-4 md:px-0">
        <UnderlineTabs<Tab> label="Profile sections" value={tab} onChange={setTab} options={tabs} />
      </div>

      <div className="mt-5 px-4 md:px-0">
        {tab === 'posts' &&
          (myPosts.length ? (
            <ul className="space-y-3">
              {myPosts.map((post) => (
                <li key={post.id} className="rounded-2xl border border-border bg-surface p-4 text-[15px] leading-relaxed">
                  {post.body}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PenLine}
              title={isMe ? 'Share your first post' : 'No posts yet'}
              description={isMe ? 'Posts you share show up here and on your classmates’ streams.' : undefined}
              action={isMe ? <Link href="/create" className={buttonClass({ size: 'sm' })}>Write a post</Link> : undefined}
            />
          ))}

        {tab === 'loops' &&
          (myLoops.length ? (
            <div className="grid grid-cols-3 gap-2">
              {myLoops.map((loop) => (
                <Link key={loop.id} href={`/loops?start=${loop.id}`} className="flex aspect-[9/16] items-end rounded-xl bg-accent p-2 text-[13px] font-semibold text-accent-ink">
                  <span className="line-clamp-3">{loop.caption}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={PenLine} title={isMe ? 'No loops yet' : 'No loops yet'} description={isMe ? 'Short videos you make appear here.' : undefined} />
          ))}

        {tab === 'about' && (
          <div className="space-y-6">
            {person.skills.length > 0 && (
              <section>
                <h2 className="mb-2.5 text-[16px] font-semibold">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {person.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-surface-2 px-3 py-1.5 text-[14px] font-semibold text-text-2">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {person.interests.length > 0 && (
              <section>
                <h2 className="mb-2.5 text-[16px] font-semibold">Interests</h2>
                <div className="flex flex-wrap gap-2">
                  {person.interests.map((item) => (
                    <span key={item} className="rounded-full border border-border px-3 py-1.5 text-[14px] text-text-2">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {isMe && (
              <section>
                <h2 className="mb-2.5 text-[16px] font-semibold">Badges</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {badges.map((badge) => (
                    <li key={badge.id} className={cn('rounded-2xl border border-border p-4', !badge.earned && 'opacity-60')}>
                      <p className="text-[15px] font-semibold">{badge.name}</p>
                      <p className="text-[13px] text-text-3">{badge.description}</p>
                      <p className="mt-1 text-[12px] font-semibold text-text-2">{badge.earned ? 'Earned' : `${badge.progress} of ${badge.target}`}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] text-text-3">{earned.length} of {badges.length} earned</p>
              </section>
            )}
          </div>
        )}

        {tab === 'ink' && isMe && (
          <div className="space-y-4">
            <p className="text-[15px] text-text-2">
              {inkSummary.notesApproved} notes approved · {inkSummary.answersAccepted} answers accepted · {inkSummary.thanks} thanks
            </p>
            <Link href="/contributions" className={buttonClass({ variant: 'secondary' })}>
              Open your ink
            </Link>
          </div>
        )}
      </div>

      {isMe && (
        <p className="mt-10 px-4 text-center text-[13px] text-text-3 md:px-0">
          Signed in as {email}.{' '}
          <button
            type="button"
            onClick={() => {
              appActions.signOut();
              router.replace('/login');
            }}
            className="font-semibold text-danger hover:underline"
          >
            Sign out
          </button>
        </p>
      )}
    </div>
  );
}
