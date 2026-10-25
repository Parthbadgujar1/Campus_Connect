'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, CheckCircle2, Clock, MessageCircleQuestion, ShoppingBag, Upload, XCircle } from 'lucide-react';
import { get } from '@/lib/api/client';
import { useInfinite, type Page } from '@/lib/api/hooks';
import type { HushQuestionView, ListingView, ResourceView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { ListingTile } from '@/components/market/market-ui';
import { TOPICS } from '@/components/hush/hush-ui';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

// Campus → My contributions: what you have put on the Shelf (with its review status), the
// Hush questions you asked (anonymous ones too, only you see them here) and your listings.

type Tab = 'shelf' | 'hush' | 'listings';

const STATUS: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  approved: { label: 'Live', className: 'bg-success-soft text-success', icon: CheckCircle2 },
  pending: { label: 'Waiting for review', className: 'bg-warning-soft text-warning', icon: Clock },
  rejected: { label: 'Not approved', className: 'bg-danger-soft text-danger', icon: XCircle },
};

function ShelfUploads() {
  const list = useInfinite<ResourceView>('contrib:shelf', (cursor, signal) => get<Page<ResourceView>>('/resources', { mine: 'true', cursor: cursor ?? undefined, limit: 15 }, signal));
  return (
    <InfiniteList
      state={list}
      skeleton="row"
      className="space-y-2.5"
      empty={{ icon: Upload, title: 'Nothing on the Shelf from you yet', description: 'Share notes, past papers or a cheat sheet. Staff check each upload before it goes live.', action: <Link href="/resources" className={buttonClass({ size: 'sm' })}>Open the Shelf</Link> }}
      endMessage="That’s all your uploads"
      render={(r) => {
        const s = STATUS[r.status] ?? STATUS.pending!;
        return (
          <Link href={`/resources?id=${r.id}`} className="press flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink"><BookOpen className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-semibold">{r.title}</span>
              <span className="block text-[13px] text-text-3">{r.subject}{r.semester ? ` · Sem ${r.semester}` : ''} · {ago(r.createdAt)}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold', s.className)}><s.icon className="h-3.5 w-3.5" aria-hidden="true" />{s.label}</span>
                {r.status === 'approved' && <span className="text-text-3">{r.downloadsCount} downloads{r.rating ? ` · ★ ${r.rating.toFixed(1)}` : ''}</span>}
              </span>
              {r.status === 'rejected' && r.reviewNote && <span className="mt-1 block text-[13px] text-text-2">Reviewer: {r.reviewNote}</span>}
            </span>
          </Link>
        );
      }}
    />
  );
}

function HushMine() {
  const list = useInfinite<HushQuestionView>('contrib:hush', (cursor, signal) => get<Page<HushQuestionView>>('/hush', { mine: 'true', cursor: cursor ?? undefined, limit: 15 }, signal));
  return (
    <InfiniteList
      state={list}
      skeleton="row"
      className="space-y-2.5"
      empty={{ icon: MessageCircleQuestion, title: 'You have not asked anything', description: 'Ask seniors and classmates in Hush, with or without your name.', action: <Link href="/hush" className={buttonClass({ size: 'sm' })}>Go to Hush</Link> }}
      endMessage="That’s every question you asked"
      render={(h) => (
        <Link href={`/hush/${h.id}`} className="press block rounded-2xl border border-border bg-surface p-3.5 shadow-card">
          <span className="flex flex-wrap items-center gap-2 text-[12px] text-text-3">
            <Badge>{TOPICS[h.topic] ?? h.topic}</Badge>
            {h.anonymous && <span>Asked anonymously</span>}
            <span>· {ago(h.createdAt)}</span>
          </span>
          <span className="mt-1.5 line-clamp-3 block text-[15px]">{h.body}</span>
          <span className="mt-1.5 block text-[13px] text-text-3">{h.answersCount} answer{h.answersCount === 1 ? '' : 's'} · {h.votesCount} votes{h.acceptedAnswerId ? ' · answered ✓' : ''}</span>
        </Link>
      )}
    />
  );
}

function MyListings() {
  const list = useInfinite<ListingView>('contrib:listings', (cursor, signal) => get<Page<ListingView>>('/listings', { mine: 'true', cursor: cursor ?? undefined, limit: 16 }, signal));
  return (
    <InfiniteList
      state={list}
      skeleton="card"
      className="grid grid-cols-2 gap-3 md:grid-cols-3"
      empty={{ icon: ShoppingBag, title: 'You have no listings', description: 'Sell, rent, lend or give away things you no longer need.', action: <Link href="/marketplace" className={buttonClass({ size: 'sm' })}>Open Marketplace</Link> }}
      endMessage="That’s all your listings"
      render={(l) => <ListingTile l={l} />}
    />
  );
}

export default function ContributionsPage() {
  const [tab, setTab] = useState<Tab>('shelf');
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="My contributions" subtitle="What you have shared with your campus" back backHref="/campus" />
      <Segmented<Tab>
        label="Contribution type"
        value={tab}
        onChange={setTab}
        className="mb-5 mt-2"
        options={[
          { value: 'shelf', label: 'Shelf uploads' },
          { value: 'hush', label: 'Hush questions' },
          { value: 'listings', label: 'Listings' },
        ]}
      />
      {tab === 'shelf' && <ShelfUploads />}
      {tab === 'hush' && <HushMine />}
      {tab === 'listings' && <MyListings />}
    </div>
  );
}
