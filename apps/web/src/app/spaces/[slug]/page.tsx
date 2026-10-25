'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useState } from 'react';
import { Check, Hash, Lock, LogOut, MessageCircle, MessagesSquare, Pin, Plus, Shield, UserMinus, Users, X } from 'lucide-react';
import { del, get, post, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { DiscussionSummary } from '@/lib/api/types';
import type { SpaceDetail, SpaceMemberView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented, UnderlineTabs } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { PostStream } from '@/components/feed/post-stream';
import { Reveal } from '@/components/motion';
import { VoteControl } from '@/components/hush/hush-ui';
import { FLAIRS, SPACE_KINDS } from '@/components/spaces/space-kinds';
import { ago } from '@/lib/live-time';
import { gradientFor } from '@/lib/visuals';

type Tab = 'board' | 'posts' | 'members' | 'requests' | 'about';

function Board({ space }: { space: SpaceDetail }) {
  const [sort, setSort] = useState<'new' | 'top' | 'active'>('active');
  const [flair, setFlair] = useState<string | null>(null);
  const list = useInfinite<DiscussionSummary>(`spaces:board:${space.id}:${sort}:${flair}`, (cursor, signal) => get<Page<DiscussionSummary>>(`/spaces/${space.id}/discussions`, { sort, flair: flair ?? undefined, cursor: cursor ?? undefined, limit: 15 }, signal));
  return (
    <div className="space-y-3">
      <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: 'active', label: 'Active' }, { value: 'new', label: 'New' }, { value: 'top', label: 'Top' }]} />
      <ChipRow>
        <Chip active={!flair} onClick={() => setFlair(null)}>All</Chip>
        {FLAIRS.map((f) => <Chip key={f} active={flair === f} onClick={() => setFlair(f)}>{f}</Chip>)}
      </ChipRow>
      <InfiniteList
        state={list}
        className="space-y-3"
        empty={{ icon: MessageCircle, title: 'No discussions yet', description: space.membership?.status === 'active' ? 'Start the first one.' : 'Join the space to start one.' }}
        endMessage="That’s the whole board"
        render={(d) => (
          <article className="flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
            <VoteControl path={`/discussions/${d.id}/vote`} field="score" value={d.myVote} count={d.score} onChange={(v, c) => list.setItems((items) => items.map((x) => (x.id === d.id ? { ...x, myVote: v, score: c } : x)))} />
            <Link href={`/spaces/${space.slug}/t/${d.id}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{d.flair}</Badge>
                {d.pinned && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent"><Pin className="h-3.5 w-3.5" aria-hidden="true" />Pinned</span>}
                {d.locked && <span className="inline-flex items-center gap-1 text-[12px] text-text-3"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Locked</span>}
              </div>
              <p className="mt-1.5 font-semibold leading-snug">{d.title}</p>
              {d.excerpt && <p className="mt-1 line-clamp-2 text-[14px] text-text-2">{d.excerpt}</p>}
              <p className="mt-1.5 text-[12px] text-text-3">{d.author.displayName} · {d.commentsCount} repl{d.commentsCount === 1 ? 'y' : 'ies'} · active {ago(d.lastActivityAt)}</p>
            </Link>
          </article>
        )}
      />
    </div>
  );
}

function Members({ space, status }: { space: SpaceDetail; status: 'active' | 'pending' }) {
  const toast = useToast();
  const list = useInfinite<SpaceMemberView>(`spaces:members:${space.id}:${status}`, (cursor, signal) => get<Page<SpaceMemberView>>(`/spaces/${space.id}/members`, { status, cursor: cursor ?? undefined, limit: 30 }, signal));
  const act = useAction(async (userId: string, action: string) => {
    await post(`/spaces/${space.id}/members/${userId}`, { action });
    list.reload();
    invalidate(`spaces:one:${space.slug}`);
    toast('Done');
  });
  return (
    <>
      <InfiniteList
        state={list}
        skeleton="row"
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface"
        empty={{ icon: Users, title: status === 'pending' ? 'No requests waiting' : 'No members yet' }}
        endMessage={status === 'pending' ? 'No more requests' : 'That’s everyone'}
        render={(m) => (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <PersonAvatar person={m} size="sm" link />
            <div className="min-w-0 flex-1">
              <PersonName person={m} />
              <p className="text-[12px] text-text-3">{m.spaceRole === 'owner' ? 'Owner' : m.spaceRole === 'moderator' ? 'Moderator' : 'Member'} · joined {ago(m.joinedAt)}</p>
            </div>
            {space.canManage && status === 'pending' && (
              <>
                <Button size="sm" onClick={() => void act.run(m.id, 'approve')} disabled={act.pending}><Check className="h-4 w-4" aria-hidden="true" /> Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => void act.run(m.id, 'decline')} disabled={act.pending}><X className="h-4 w-4" aria-hidden="true" /> Decline</Button>
              </>
            )}
            {space.canManage && status === 'active' && m.spaceRole !== 'owner' && (
              <>
                <Button size="sm" variant="ghost" onClick={() => void act.run(m.id, m.spaceRole === 'moderator' ? 'make_member' : 'make_moderator')} disabled={act.pending}><Shield className="h-4 w-4" aria-hidden="true" />{m.spaceRole === 'moderator' ? 'Remove mod' : 'Make mod'}</Button>
                <Button size="sm" variant="ghost" onClick={() => void act.run(m.id, 'remove')} disabled={act.pending} aria-label={`Remove ${m.displayName}`}><UserMinus className="h-4 w-4" aria-hidden="true" /></Button>
              </>
            )}
          </div>
        )}
      />
      {act.error && <FormAlert className="mt-2">{act.error.message}</FormAlert>}
    </>
  );
}

function NewDiscussion({ space, open, onClose }: { space: SpaceDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [flair, setFlair] = useState('Discussion');
  const send = useAction(async () => {
    const r = await post<{ id: string }>(`/spaces/${space.id}/discussions`, { title: title.trim(), body: body.trim(), flair });
    invalidate(`spaces:board:${space.id}`);
    onClose();
    router.push(`/spaces/${space.slug}/t/${r.id}`);
  });
  return (
    <Sheet open={open} onClose={onClose} title={`New discussion in ${space.name}`} footer={<Button full onClick={() => void send.run()} disabled={title.trim().length < 5 || send.pending}>{send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Post</Button>}>
      <div className="space-y-4">
        <Field label="Title" htmlFor="d-title" hint="At least 5 characters"><Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
        <Field label="Type" htmlFor="d-flair"><Select id="d-flair" value={flair} onChange={(e) => setFlair(e.target.value)}>{FLAIRS.map((f) => <option key={f}>{f}</option>)}</Select></Field>
        <Field label="Details (optional)" htmlFor="d-body"><Textarea id="d-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} rows={5} /></Field>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

function SpaceInner({ slug }: { slug: string }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'board';
  const [writing, setWriting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const q = useQuery<SpaceDetail>(`spaces:one:${slug}`, (signal) => get(`/spaces/${slug}`, undefined, signal));
  const join = useAction(async () => {
    const r = await post<{ status: string }>(`/spaces/${q.data!.id}/join`);
    toast(r.status === 'pending' ? 'Request sent to the space owners' : `You joined ${q.data!.name}`);
    q.reload();
    invalidate('spaces:list');
  });
  const leave = useAction(async () => {
    await del(`/spaces/${q.data!.id}/membership`);
    toast('You left the space');
    setLeaving(false);
    q.reload();
    invalidate('spaces:list');
    invalidate('chats:list');
  });
  const s = q.data;
  const member = s?.membership?.status === 'active';
  // Every space has a group chat (like a WhatsApp community); opening it adds you to it.
  const openChat = useAction(async () => {
    const r = await post<{ chatId: string }>(`/spaces/${q.data!.id}/chat`);
    invalidate('chats:list');
    router.push(`/chats/${r.chatId}`);
  });
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'board', label: 'Board' },
    { value: 'posts', label: 'Posts' },
    { value: 'members', label: 'Members' },
    ...(s?.canManage ? [{ value: 'requests' as Tab, label: 'Requests' }] : []),
    { value: 'about', label: 'About' },
  ];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={s?.name ?? 'Space'} back backHref="/spaces" />
      {q.loading && <SkeletonList count={2} />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {s && (
        <Reveal className="space-y-5">
          <Card className="overflow-hidden">
            <div className="h-24" style={{ background: gradientFor(s.slug) }} />
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{SPACE_KINDS[s.kind] ?? s.kind}</Badge>
                {s.privacy === 'private' && <Badge tone="neutral" icon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />}>Private</Badge>}
                {s.status === 'pending' && <Badge tone="warning">Waiting for approval</Badge>}
                <span className="inline-flex items-center gap-1 text-[13px] text-text-3"><Users className="h-4 w-4" aria-hidden="true" />{s.membersCount} members</span>
              </div>
              {s.description && <p className="mt-2 text-[15px] text-text-2">{s.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {member ? (
                  <>
                    <Button onClick={() => setWriting(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New discussion</Button>
                    <Button variant="secondary" onClick={() => void openChat.run()} disabled={openChat.pending}>{openChat.pending ? <Spinner /> : <MessagesSquare className="h-4 w-4" aria-hidden="true" />} Group chat</Button>
                    {s.membership?.role !== 'owner' && <Button variant="ghost" onClick={() => setLeaving(true)} disabled={leave.pending}><LogOut className="h-4 w-4" aria-hidden="true" /> Leave</Button>}
                  </>
                ) : s.membership?.status === 'pending' ? (
                  <Badge tone="warning">Your request is waiting</Badge>
                ) : s.membership?.status === 'banned' ? (
                  <Badge tone="danger">You cannot join this space</Badge>
                ) : (
                  <Button onClick={() => void join.run()} disabled={join.pending || s.status !== 'active'}>{join.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />}{s.privacy === 'private' ? 'Ask to join' : 'Join'}</Button>
                )}
              </div>
              {(join.error || leave.error || openChat.error) && <FormAlert className="mt-3">{(join.error ?? leave.error ?? openChat.error)!.message}</FormAlert>}
            </div>
          </Card>
          {!s.canRead ? (
            <EmptyState icon={Lock} title="This space is private" description="Ask to join. Once an owner approves, you can read and post here." />
          ) : (
            <>
              <UnderlineTabs label="Space sections" value={tab} onChange={(v) => router.push(withQuery(pathname, { tab: v === 'board' ? null : v }), { scroll: false })} options={tabs} />
              {tab === 'board' && <Board space={s} />}
              {tab === 'posts' && <PostStream cacheKey={`space:${s.id}`} query={{ scope: 'space', spaceId: s.id }} empty={{ icon: MessageCircle, title: 'No posts in this space yet', description: 'Members can post here from Home by choosing this space as the audience.' }} />}
              {tab === 'members' && <Members space={s} status="active" />}
              {tab === 'requests' && s.canManage && <Members space={s} status="pending" />}
              {tab === 'about' && (
                <Card className="space-y-3 p-4">
                  <p className="text-[15px]">{s.description || 'No description yet.'}</p>
                  <p className="text-[13px] text-text-3">Created {ago(s.createdAt)} · {s.privacy === 'public' ? 'Anyone at the college can read and join' : 'Joining needs an owner’s approval'}</p>
                  {s.channels.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-sm font-semibold">Channels</p>
                      <ul className="space-y-1">
                        {s.channels.map((c) => (
                          <li key={c.id}><Link href={`/chats/${c.chatId}`} className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent"><Hash className="h-4 w-4" aria-hidden="true" />{c.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
          <NewDiscussion space={s} open={writing} onClose={() => setWriting(false)} />
          <ConfirmDialog
            open={leaving}
            onClose={() => setLeaving(false)}
            onConfirm={() => void leave.run()}
            title={`Leave ${s.name}?`}
            description="You will stop seeing its board and group chat. You can join again later (private spaces need an owner's approval)."
            confirmLabel="Leave"
            danger
            pending={leave.pending}
            error={leave.error?.message}
          />
        </Reveal>
      )}
    </div>
  );
}

export default function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense fallback={<SkeletonList count={2} className="mx-auto mt-24 max-w-3xl px-4" />}>
      <SpaceInner slug={slug} />
    </Suspense>
  );
}
