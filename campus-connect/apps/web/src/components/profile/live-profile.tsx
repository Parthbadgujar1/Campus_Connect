'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Ban, Bookmark, ExternalLink, Flag, Lock, MessageCircle, MoreHorizontal, PenLine, Settings, Share2, UserCheck, UserPlus } from 'lucide-react';
import { LivePostCard } from '@/components/feed/live-post-card';
import { ReportSheet } from '@/components/common/report-sheet';
import { VerifiedMark } from '@/components/ui/avatar';
import { Button, buttonClass } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/layout';
import { Menu } from '@/components/ui/menu';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ConfirmDialog, ErrorState, LoadMore, Skeleton, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, get, post } from '@/lib/api/client';
import { invalidate, useInfinite, useQuery } from '@/lib/api/hooks';
import type { PostView } from '@/lib/api/types';
import { longDate } from '@/lib/live-time';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isVerified: boolean;
  year: number | null;
  department: string | null;
  avatarUrl: string | null;
  headline: string | null;
  isSelf: boolean;
  isFollowing: boolean;
  followsYou: boolean;
  canMessage: boolean;
  followersCount: number;
  followingCount: number;
  restricted: boolean;
  bio?: string | null;
  semester?: number | null;
  division?: string | null;
  skills?: string[];
  interests?: string[];
  links?: Record<string, string>;
  email?: string | null;
  postsCount?: number;
  joinedAt?: string;
}

const ROLE_LABEL: Record<string, string> = { student: 'Student', faculty: 'Faculty', expert: 'Industry expert', moderator: 'Moderator', admin: 'Campus office' };
const LINK_LABEL: Record<string, string> = { github: 'GitHub', linkedin: 'LinkedIn', portfolio: 'Portfolio', leetcode: 'LeetCode', twitter: 'X / Twitter', instagram: 'Instagram' };

type Tab = 'posts' | 'about' | 'saved';

function Posts({ authorId }: { authorId: string }) {
  const feed = useInfinite<PostView>(`feed:author:${authorId}`, async (cursor, signal) => {
    const r = await get<{ items: PostView[]; nextCursor: string | null }>('/feed', { scope: 'author', authorId, cursor: cursor ?? undefined, limit: 10 }, signal);
    return r;
  });
  if (feed.loading) return <SkeletonList count={2} />;
  if (feed.error && !feed.items.length) return <ErrorState error={feed.error} onRetry={feed.reload} />;
  if (!feed.items.length) return <EmptyState icon={PenLine} title="No posts yet" />;
  return (
    <div className="space-y-4">
      {feed.items.map((p) => (
        <LivePostCard key={p.id} post={p} onChange={(np) => feed.setItems((all) => all.map((x) => (x.id === np.id ? np : x)))} onRemove={(id) => feed.setItems((all) => all.filter((x) => x.id !== id))} />
      ))}
      <LoadMore hasMore={feed.hasMore} loading={feed.loadingMore} onClick={feed.loadMore} />
    </div>
  );
}

function Saved() {
  const saved = useInfinite<{ type: string; id: string; title: string; available: boolean; link: string | null; savedAt: string }>('me:saved', (cursor, signal) => get('/me/saved', { cursor: cursor ?? undefined, limit: 30 }, signal));
  if (saved.loading) return <SkeletonList variant="row" count={4} />;
  if (saved.error && !saved.items.length) return <ErrorState error={saved.error} onRetry={saved.reload} />;
  if (!saved.items.length) return <EmptyState icon={Bookmark} title="Nothing saved yet" description="Tap the bookmark on posts, events and opportunities to keep them here." />;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {saved.items.map((s) => (
        <li key={`${s.type}-${s.id}`} className="flex items-center gap-3 px-4 py-3.5">
          <span className="font-sans shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-text-2">{s.type.replace('_', ' ')}</span>
          {s.link && s.available ? (
            <Link href={s.link} className="min-w-0 flex-1 truncate text-[15px] font-semibold hover:underline">{s.title}</Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[15px] text-text-3">{s.title}</span>
          )}
          <button
            type="button"
            className="font-sans shrink-0 text-[13px] font-semibold text-text-3 hover:text-danger"
            onClick={async () => {
              saved.setItems((all) => all.filter((x) => !(x.id === s.id && x.type === s.type)));
              await del(`/saved/${s.type}/${s.id}`).catch(() => saved.reload());
            }}
          >
            Remove
          </button>
        </li>
      ))}
      <LoadMore hasMore={saved.hasMore} loading={saved.loadingMore} onClick={saved.loadMore} />
    </ul>
  );
}

function About({ p }: { p: Profile }) {
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      {p.bio && <p className="whitespace-pre-line text-[15.5px] leading-relaxed">{p.bio}</p>}
      <dl className="font-sans grid gap-3 text-[14px] sm:grid-cols-2">
        {p.department && (<div><dt className="text-text-3">Department</dt><dd className="font-semibold">{p.department}</dd></div>)}
        {p.year && (<div><dt className="text-text-3">Year</dt><dd className="font-semibold">Year {p.year}{p.semester ? ` · Semester ${p.semester}` : ''}{p.division ? ` · Div ${p.division}` : ''}</dd></div>)}
        {p.email && (<div><dt className="text-text-3">Email</dt><dd className="font-semibold"><a href={`mailto:${p.email}`} className="text-accent hover:underline">{p.email}</a></dd></div>)}
        {p.joinedAt && (<div><dt className="text-text-3">Joined</dt><dd className="font-semibold">{longDate(p.joinedAt)}</dd></div>)}
      </dl>
      {Boolean(p.skills?.length) && (
        <div>
          <p className="font-sans text-[13px] font-semibold text-text-3">Skills</p>
          <p className="mt-2 flex flex-wrap gap-1.5">{p.skills!.map((s) => <span key={s} className="font-sans rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-soft-ink">{s}</span>)}</p>
        </div>
      )}
      {Boolean(p.interests?.length) && (
        <div>
          <p className="font-sans text-[13px] font-semibold text-text-3">Interests</p>
          <p className="mt-2 flex flex-wrap gap-1.5">{p.interests!.map((s) => <span key={s} className="font-sans rounded-full bg-surface-2 px-3 py-1 text-[13px] font-semibold text-text-2">{s}</span>)}</p>
        </div>
      )}
      {p.links && Object.keys(p.links).length > 0 && (
        <div className="font-sans flex flex-wrap gap-2">
          {Object.entries(p.links).map(([k, url]) => (
            <a key={k} href={url} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {LINK_LABEL[k] ?? k}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function LiveProfile({ handle }: { handle: string }) {
  const router = useRouter();
  const toast = useToast();
  const q = useQuery<Profile>(`profile:${handle}`, (s) => get(`/users/${encodeURIComponent(handle)}`, undefined, s));
  const [tab, setTab] = useState<Tab>('posts');
  const [busy, setBusy] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reporting, setReporting] = useState(false);

  if (q.loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-8 md:px-8" aria-busy="true">
        <div className="flex items-center gap-4"><Skeleton className="h-24 w-24 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-1/3" /></div></div>
        <SkeletonList className="mt-8" count={2} />
      </div>
    );
  }
  if (q.error) return <div className="mx-auto max-w-3xl px-4 pt-8"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const p = q.data!;

  const follow = async () => {
    setBusy(true);
    const next = !p.isFollowing;
    q.setData({ ...p, isFollowing: next, followersCount: p.followersCount + (next ? 1 : -1) });
    try {
      await (next ? post(`/users/${p.id}/follow`) : del(`/users/${p.id}/follow`));
      invalidate('feed:following');
    } catch (err) {
      q.setData(p);
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const message = async () => {
    setBusy(true);
    try {
      const r = await post<{ chatId: string }>('/chats/direct', { userId: p.id });
      router.push(`/chats/${r.chatId}`);
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  };
  const block = async () => {
    setBusy(true);
    try {
      await post(`/users/${p.id}/block`);
      toast(`You blocked ${p.displayName}`);
      invalidate('feed:');
      router.replace('/');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
      setBlocking(false);
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/profile/${p.username}`;
    try {
      if (navigator.share) await navigator.share({ title: p.displayName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Profile link copied');
      }
    } catch {
      // closed
    }
  };

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'posts', label: `Posts${p.postsCount ? ` · ${p.postsCount}` : ''}` },
    { value: 'about', label: 'About' },
    ...(p.isSelf ? [{ value: 'saved' as Tab, label: 'Saved' }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <header className="pt-safe pt-6 md:pt-10">
        <div className="flex items-start gap-4">
          <PersonAvatar person={p} size="xl" />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="flex items-center gap-1.5 text-[26px] font-bold leading-tight">
              <span className="truncate">{p.displayName}</span>
              {p.isVerified && <VerifiedMark />}
            </h1>
            <p className="font-sans text-[14px] text-text-3">@{p.username} · {ROLE_LABEL[p.role] ?? p.role}</p>
            {p.headline && <p className="mt-1 text-[15px] text-text-2">{p.headline}</p>}
            {(p.department || p.year) && <p className="font-sans mt-1 text-[13px] text-text-3">{[p.department, p.year ? `Year ${p.year}` : null].filter(Boolean).join(' · ')}</p>}
            {p.followsYou && !p.isSelf && <span className="font-sans mt-2 inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-semibold text-text-2">Follows you</span>}
          </div>
          {p.isSelf ? (
            <Link href="/settings" aria-label="Settings" className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-text-2 hover:text-text">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
          ) : (
            <Menu
              label="More"
              trigger={<MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
              items={[
                { label: 'Share profile', icon: Share2, onSelect: share },
                { label: 'Report', icon: Flag, danger: true, onSelect: () => setReporting(true) },
                { label: 'Block', icon: Ban, danger: true, onSelect: () => setBlocking(true) },
              ]}
            />
          )}
        </div>

        <dl className="font-sans mt-5 flex gap-6 text-[14px]">
          <div><dt className="text-text-3">Followers</dt><dd className="text-[18px] font-bold">{p.followersCount}</dd></div>
          <div><dt className="text-text-3">Following</dt><dd className="text-[18px] font-bold">{p.followingCount}</dd></div>
          {p.postsCount !== undefined && <div><dt className="text-text-3">Posts</dt><dd className="text-[18px] font-bold">{p.postsCount}</dd></div>}
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {p.isSelf ? (
            <>
              <Link href="/profile/edit" className={buttonClass({ variant: 'primary' })}><PenLine className="h-4 w-4" aria-hidden="true" /> Edit profile</Link>
              <Button variant="secondary" onClick={share}><Share2 className="h-4 w-4" aria-hidden="true" /> Share</Button>
            </>
          ) : (
            <>
              <Button variant={p.isFollowing ? 'secondary' : 'primary'} onClick={follow} disabled={busy} aria-pressed={p.isFollowing}>
                {p.isFollowing ? <UserCheck className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                {p.isFollowing ? 'Following' : p.followsYou ? 'Follow back' : 'Follow'}
              </Button>
              {p.canMessage && (
                <Button variant="secondary" onClick={message} disabled={busy}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Message
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      {p.restricted ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-text-3" aria-hidden="true" />
          <p className="mt-3 text-[16px] font-semibold">This profile is for connections</p>
          <p className="mt-1 text-[14px] text-text-3">Follow each other to see posts and details.</p>
        </div>
      ) : (
        <>
          <UnderlineTabs<Tab> className="mt-8" label="Profile sections" value={tab} onChange={setTab} options={tabs} />
          <div className={cn('mt-5')}>
            {tab === 'posts' && <Posts authorId={p.id} />}
            {tab === 'about' && <About p={p} />}
            {tab === 'saved' && p.isSelf && <Saved />}
          </div>
        </>
      )}

      <ConfirmDialog open={blocking} onClose={() => setBlocking(false)} onConfirm={block} title={`Block ${p.displayName}?`} description="You will not see each other’s posts, profiles or messages, and you will stop following each other. They are not told. You can unblock in Settings." confirmLabel="Block" danger pending={busy} />
      <ReportSheet open={reporting} onClose={() => setReporting(false)} targetType="user" targetId={p.id} label={p.displayName} />
    </div>
  );
}
