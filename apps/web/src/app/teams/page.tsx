'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronRight, Handshake, MessageCircle, Plus } from 'lucide-react';
import { get, post } from '@/lib/api/client';
import { invalidate, useAction, useQuery, type Page } from '@/lib/api/hooks';
import type { HomeDiscussion } from '@/lib/api/modules';
import type { SpaceView } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { EndOfList } from '@/components/ui/infinite';
import { Pressable, Stagger, StaggerItem } from '@/components/motion';
import { ago } from '@/lib/live-time';

// Team up: discussions with the "Team up" flair from every space you can read, newest first.
// Posting one starts a discussion in a space you belong to, so replies stay in context.

const FLAIR = 'Team up';

function NewTeamUp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const mine = useQuery<Page<SpaceView>>(open ? 'spaces:mine' : null, (signal) => get('/spaces', { mine: 'true', limit: 50 }, signal));
  const [spaceId, setSpaceId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const send = useAction(async () => {
    const res = await post<{ id: string }>(`/spaces/${spaceId}/discussions`, { title: title.trim(), body: body.trim(), flair: FLAIR });
    invalidate('teams:', 'spaces:');
    const slug = mine.data?.items.find((s) => s.id === spaceId)?.slug;
    onClose();
    if (slug) router.push(`/spaces/${slug}/t/${res.id}`);
  });
  const spaces = mine.data?.items ?? [];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Look for teammates"
      description="Say what you are building and who you need. It is posted in one of your spaces."
      footer={
        <Button full onClick={() => void send.run()} disabled={!spaceId || title.trim().length < 5 || send.pending} aria-busy={send.pending}>
          {send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Post
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Post in" htmlFor="team-space" hint={!mine.loading && !spaces.length ? 'Join a space first (Discover → Boards).' : undefined}>
          <Select id="team-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            <option value="">Choose a space</option>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Headline" htmlFor="team-title">
          <Input id="team-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Need a designer for the SIH hackathon" />
        </Field>
        <Field label="Details" htmlFor="team-body">
          <Textarea id="team-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} rows={4} placeholder="The idea, the skills you need, the deadline" />
        </Field>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

export default function TeamsPage() {
  const [open, setOpen] = useState(false);
  const list = useQuery<{ items: HomeDiscussion[] }>('teams:list', (signal) => get('/discussions', { sort: 'new', flair: FLAIR, limit: 30 }, signal));
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Team up"
        subtitle="People looking for teammates for hackathons, projects and competitions"
        back
        backHref="/discover"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Post
          </Button>
        }
      />
      {list.loading && <SkeletonList variant="row" count={4} />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && !list.data.items.length && <EmptyState icon={Handshake} title="No team-ups right now" description="Be the first: tell people what you are building and who you need." action={<Button onClick={() => setOpen(true)}>Look for teammates</Button>} />}
      {list.data && list.data.items.length > 0 && (
        <>
          <Stagger className="space-y-3">
            {list.data.items.map((d) => (
              <StaggerItem key={d.id}>
                <Pressable>
                  <Link href={`/spaces/${d.space.slug}/t/${d.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug">{d.title}</span>
                      {d.excerpt && <span className="mt-1 line-clamp-2 block text-[14px] text-text-2">{d.excerpt}</span>}
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12px] text-text-3">
                        <span>{d.author.displayName}</span>
                        <span>{d.space.name}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{d.commentsCount}</span>
                        <span>{ago(d.createdAt)}</span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                  </Link>
                </Pressable>
              </StaggerItem>
            ))}
          </Stagger>
          <EndOfList message="That’s every team-up from the last two months" />
        </>
      )}
      <NewTeamUp open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
