'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Eye, Film, Plus, Radio, Search, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { VideoCard, VideoThumb } from '@/components/watch/video-card';
import { watchParties } from '@/data/fun';
import { getPerson } from '@/data/people';
import { channels, getVideo, loops, videos, watchProgress } from '@/data/videos';
import { appActions, useAppState } from '@/lib/store';
import { formatDay, formatTime } from '@/lib/time';
import { compactNumber, gradientFor } from '@/lib/visuals';

type Tab = 'foryou' | 'lectures' | 'creators' | 'together';
const TABS: { value: Tab; label: string }[] = [
  { value: 'foryou', label: 'For you' },
  { value: 'lectures', label: 'Lectures' },
  { value: 'creators', label: 'Creators' },
  { value: 'together', label: 'Together' },
];

export default function WatchPage() {
  return (
    <Suspense fallback={null}>
      <WatchHub />
    </Suspense>
  );
}

function WatchHub() {
  const params = useSearchParams();
  const requested = params.get('tab');
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === requested) ? (requested as Tab) : 'foryou');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Watch"
        subtitle="Lectures, campus creators and watch parties"
        back
        backHref="/discover"
        actions={
          <Link href="/search" aria-label="Search videos" className="press grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-text-2 shadow-card">
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        }
      />
      <UnderlineTabs<Tab> label="Watch sections" value={tab} onChange={setTab} options={TABS} className="mt-2" />
      <div key={tab} className="animate-rise mt-5">
        {tab === 'foryou' && <ForYou />}
        {tab === 'lectures' && <Lectures />}
        {tab === 'creators' && <Creators />}
        {tab === 'together' && <Together />}
      </div>
    </div>
  );
}

function ForYou() {
  const featured = getVideo('v-hack-recap') ?? videos[0];
  const continuing = Object.keys(watchProgress).flatMap((id) => {
    const video = getVideo(id);
    return video ? [video] : [];
  });
  const rest = videos.filter((v) => v.id !== featured.id);

  return (
    <div className="space-y-10">
      {/* Featured: a calm, wide window */}
      <Link href={`/watch/v/${featured.id}`} className="press group grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
        <VideoThumb video={featured} />
        <span className="block">
          <Badge tone="accent">
            Picked for this week
          </Badge>
          <span className="mt-3 block font-display text-[26px] font-semibold leading-tight tracking-tight text-balance md:text-[34px]">{featured.title}</span>
          <span className="mt-2 block text-[15px] text-text-2 text-pretty">{featured.description}</span>
          <span className={buttonClass({ className: 'mt-5' })}>Watch now</span>
        </span>
      </Link>

      {continuing.length > 0 && (
        <section>
          <SectionHeader title="Pick up where you left off" />
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {continuing.map((video) => (
              <VideoCard key={video.id} video={video} className="w-72 shrink-0 md:w-auto" />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Loops" description="Short, vertical, made on campus" action={{ label: 'Open loops', href: '/loops' }} />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {loops.map((loop) => {
            const author = getPerson(loop.authorId);
            return (
              <Link
                key={loop.id}
                href={`/loops?start=${loop.id}`}
                className="press relative flex aspect-[9/16] w-36 shrink-0 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white shadow-card md:w-44"
                style={{ background: gradientFor(loop.seed) }}
              >
                <span className="relative line-clamp-3 text-sm font-semibold leading-snug">{loop.caption}</span>
                <span className="relative mt-2 flex items-center gap-1.5 text-[11px] text-white/85">
                  <Avatar name={author.name} seed={author.id} size="xs" className="h-5 w-5 text-[8px]" />
                  {compactNumber(loop.likes)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="Fresh on campus" />
        <div className="stagger grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Lectures() {
  const lectureVideos = videos.filter((v) => v.kind === 'Lecture');
  const subjects = ['All', ...Array.from(new Set(lectureVideos.map((v) => v.subject ?? 'Other')))];
  const [subject, setSubject] = useState('All');
  const visible = lectureVideos.filter((v) => subject === 'All' || v.subject === subject);

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent-soft-ink">
        Recorded by your faculty and published by the admin office. Chapters and notes are attached to each lecture.
      </p>
      <ChipRow>
        {subjects.map((s) => (
          <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
            {s}
          </Chip>
        ))}
      </ChipRow>
      {visible.length === 0 ? (
        <EmptyState icon={Film} title="No lectures for this subject yet" />
      ) : (
        <div key={subject} className="stagger grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}

function Creators() {
  const subscriptions = useAppState((s) => s.subscriptions);
  const creatorVideos = videos.filter((v) => v.kind === 'Creator');
  return (
    <div className="space-y-10">
      <section>
        <SectionHeader title="Channels" description="Faculty, clubs and student creators" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
          {channels.map((channel) => {
            const on = subscriptions.includes(channel.id);
            return (
              <div key={channel.id} className="flex w-60 shrink-0 flex-col items-center rounded-2xl border border-border bg-surface p-5 text-center shadow-card md:w-auto">
                <Avatar name={channel.name} seed={channel.personId} size="lg" />
                <p className="mt-3 line-clamp-1 font-semibold">{channel.name}</p>
                <p className="text-xs text-text-3">
                  {channel.kind} · {compactNumber(channel.subscribers + (on ? 1 : 0))} following
                </p>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm text-text-2">{channel.blurb}</p>
                <Button size="sm" variant={on ? 'secondary' : 'primary'} className="mt-4" aria-pressed={on} onClick={() => appActions.toggleSubscribed(channel.id)}>
                  {on ? 'Following' : 'Follow'}
                </Button>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <SectionHeader title="From creators" />
        <div className="stagger grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {creatorVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Together() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('Educational');
  const live = watchParties.filter((w) => w.live);
  const later = watchParties.filter((w) => !w.live);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-xl font-semibold">Watch with your people</p>
          <p className="mt-1 text-sm text-text-3">Everyone stays in sync. Talk, react and pause together.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Host a party
        </Button>
      </div>

      {[
        { label: 'Live now', list: live },
        { label: 'Coming up', list: later },
      ].map(
        (group) =>
          group.list.length > 0 && (
            <section key={group.label}>
              <SectionHeader title={group.label} />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.list.map((party) => {
                  const host = getPerson(party.hostId);
                  return (
                    <Link key={party.id} href={`/watch/party/${party.id}`} className="press block">
                      <span className="relative flex aspect-video items-end justify-between overflow-hidden rounded-2xl p-3 text-white" style={{ background: gradientFor(party.seed) }}>
                        {party.live ? (
                          <span className="relative flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-[11px] font-bold">
                            <Radio className="h-3 w-3" aria-hidden="true" />
                            Live
                          </span>
                        ) : (
                          <span className="relative rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-semibold">
                            {formatDay(party.startsAt)} · {formatTime(party.startsAt)}
                          </span>
                        )}
                        <span className="relative flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold">
                          <Eye className="h-3 w-3" aria-hidden="true" />
                          {party.viewers}
                        </span>
                      </span>
                      <span className="mt-3 flex gap-3 px-1">
                        <Avatar name={host.name} seed={host.id} size="sm" />
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{party.title}</span>
                          <span className="block truncate text-xs text-text-3">
                            Hosted by {host.name.split(' ')[0]} · {party.source}
                          </span>
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ),
      )}

      {watchParties.length === 0 && <EmptyState icon={Users} title="No parties right now" description="Host one and invite your friends." />}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Host a watch party"
        description="Everyone who joins sees the same moment"
        footer={
          <Button
            full
            disabled={title.trim().length < 3}
            onClick={() => {
              setOpen(false);
              setTitle('');
              toast('Watch party created. Invite link copied (preview)');
            }}
          >
            Create watch party
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="wp-title">
            <Input id="wp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 4 lecture recap" />
          </Field>
          <Field label="Source" htmlFor="wp-source" hint="Only share content you have the right to show.">
            <Select id="wp-source" value={source} onChange={(e) => setSource(e.target.value)}>
              <option>Educational</option>
              <option>Campus video</option>
              <option>Movie</option>
              <option>Screen share</option>
            </Select>
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
