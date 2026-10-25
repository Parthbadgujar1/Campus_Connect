'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Bookmark, BookmarkX, Briefcase, Calendar, Hash, MessageSquare, PlayCircle, ShoppingBag, VenetianMask } from 'lucide-react';
import { del, get } from '@/lib/api/client';
import { useAction, useInfinite, type Page } from '@/lib/api/hooks';
import { Chip, ChipRow } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

type SavedType = 'post' | 'discussion' | 'event' | 'opportunity' | 'listing' | 'resource' | 'lecture' | 'hush_question';
interface SavedItem {
  type: SavedType;
  id: string;
  title: string;
  available: boolean;
  link: string;
  savedAt: string;
}

const KINDS: Array<{ type: SavedType; label: string; icon: LucideIcon }> = [
  { type: 'post', label: 'Posts', icon: MessageSquare },
  { type: 'discussion', label: 'Discussions', icon: Hash },
  { type: 'event', label: 'Events', icon: Calendar },
  { type: 'opportunity', label: 'Opportunities', icon: Briefcase },
  { type: 'resource', label: 'Shelf', icon: BookOpen },
  { type: 'lecture', label: 'Lectures', icon: PlayCircle },
  { type: 'listing', label: 'Marketplace', icon: ShoppingBag },
  { type: 'hush_question', label: 'Hush', icon: VenetianMask },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.type, k])) as Record<SavedType, (typeof KINDS)[number]>;

function SavedRow({ item, onRemoved }: { item: SavedItem; onRemoved: () => void }) {
  const remove = useAction(async () => {
    await del(`/saved/${item.type}/${item.id}`);
    onRemoved();
  });
  const k = KIND[item.type];
  const body = (
    <>
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', item.available ? 'bg-accent-soft text-accent-soft-ink' : 'bg-surface-2 text-text-3')}>
        <k.icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('line-clamp-2 font-semibold', !item.available && 'italic text-text-3')}>{item.title}</span>
        <span className="block text-[12px] text-text-3">{k.label} · saved {ago(item.savedAt)}</span>
      </span>
    </>
  );
  return (
    <div>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 pr-1 shadow-card">
        {item.available ? <Link href={item.link} className="press flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5">{body}</Link> : <div className="flex min-w-0 flex-1 items-center gap-3 p-1.5">{body}</div>}
        <button type="button" onClick={() => void remove.run()} disabled={remove.pending} aria-label={`Remove “${item.title}” from saved`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-danger">
          <BookmarkX className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {remove.error && <p className="mt-1 text-[12px] text-danger">{remove.error.message}</p>}
    </div>
  );
}

export default function SavedPage() {
  const [type, setType] = useState<SavedType | null>(null);
  const list = useInfinite<SavedItem>(`me:saved:${type ?? 'all'}`, (cursor, signal) => get<Page<SavedItem>>('/me/saved', { type: type ?? undefined, cursor: cursor ?? undefined, limit: 20 }, signal));
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Saved" subtitle="Everything you bookmarked, newest first" back backHref="/you" />
      <ChipRow className="mb-4 mt-2">
        <Chip active={!type} onClick={() => setType(null)}>Everything</Chip>
        {KINDS.map((k) => (
          <Chip key={k.type} active={type === k.type} onClick={() => setType(k.type)}>{k.label}</Chip>
        ))}
      </ChipRow>
      <InfiniteList
        state={list}
        skeleton="row"
        className="space-y-2.5"
        empty={{ icon: Bookmark, title: type ? `No saved ${KIND[type].label.toLowerCase()}` : 'Nothing saved yet', description: 'Tap the bookmark on posts, events, notes, openings and listings to keep them here.' }}
        endMessage="That’s everything you saved"
        render={(item) => <SavedRow item={item} onRemoved={() => list.setItems((items) => items.filter((x) => !(x.id === item.id && x.type === item.type)))} />}
      />
    </div>
  );
}
