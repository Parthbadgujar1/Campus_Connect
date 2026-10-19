'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Megaphone, Newspaper, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { announcements, news } from '@/data/campus';
import { useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

// Notices and news in one place. Notices come from the office and teachers; news comes from the campus feed.
type Filter = 'All' | 'Notices' | 'News' | 'Results' | 'Events';
const FILTERS: Filter[] = ['All', 'Notices', 'News', 'Results', 'Events'];

interface Item {
  id: string;
  kind: 'Notice' | 'News';
  category: Filter;
  title: string;
  body: string;
  source: string;
  at: string;
  pinned: boolean;
}

function toItems(): Item[] {
  const notices: Item[] = announcements.map((a) => ({
    id: a.id,
    kind: 'Notice',
    category: a.category === 'Results' ? 'Results' : a.category === 'Event' || a.category === 'Club' ? 'Events' : 'Notices',
    title: a.title,
    body: a.body,
    source: a.author,
    at: a.at,
    pinned: a.pinned,
  }));
  const stories: Item[] = news.map((n) => ({
    id: n.id,
    kind: 'News',
    category: n.category === 'Competition results' || n.category === 'Achievements' ? 'Results' : n.category === 'Event announcements' ? 'Events' : 'News',
    title: n.title,
    body: n.summary,
    source: n.source,
    at: n.at,
    pinned: !!n.featured,
  }));
  return [...notices, ...stories].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at));
}

export default function NewsPage() {
  return (
    <Suspense fallback={null}>
      <NoticesAndNews />
    </Suspense>
  );
}

function NoticesAndNews() {
  const params = useSearchParams();
  const toast = useToast();
  const role = useAppState((s) => s.role);
  const canPost = role === 'faculty' || role === 'admin';
  const [filter, setFilter] = useState<Filter>('All');
  const [posting, setPosting] = useState(params.get('new') === '1' && canPost);
  const [draft, setDraft] = useState({ title: '', body: '', audience: 'Whole campus', category: 'Notice' });
  const items = useMemo(() => toItems(), []);
  const visible = items.filter((item) => filter === 'All' || item.category === filter);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader
        title="Notices & news"
        subtitle="Department notices, results and campus stories"
        back
        backHref="/campus"
        actions={
          canPost ? (
            <Button size="sm" onClick={() => setPosting(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Post
            </Button>
          ) : undefined
        }
      />

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filter">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={cn('h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold', filter === item ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
          >
            {item}
          </button>
        ))}
      </div>

      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {visible.map((item) => {
          const Icon = item.kind === 'Notice' ? Megaphone : Newspaper;
          return (
            <li key={`${item.kind}-${item.id}`} className="flex gap-3.5 px-4 py-4">
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', item.kind === 'Notice' ? 'bg-accent-soft text-accent-soft-ink' : 'bg-surface-2 text-text-2')}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13px] text-text-3">
                  <span className="font-semibold text-text-2">{item.category}</span>
                  {item.pinned && <span className="rounded-full bg-highlight px-2 py-px text-[12px] font-semibold text-highlight-ink">Pinned</span>}
                </p>
                <p className="mt-1 text-[16px] font-semibold leading-snug">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-[14px] text-text-2">{item.body}</p>
                <p className="mt-2 text-[13px] text-text-3">
                  {item.source} · {relativeTime(item.at)}
                </p>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-6 py-12 text-center text-[15px] text-text-3">Nothing in this category yet.</li>}
      </ul>

      <Sheet
        open={posting}
        onClose={() => setPosting(false)}
        title="Post a notice"
        description="Notices reach the audience you choose."
        footer={
          <Button
            full
            disabled={draft.title.trim().length < 4}
            onClick={() => {
              setPosting(false);
              toast('Notice posted');
              setDraft({ title: '', body: '', audience: 'Whole campus', category: 'Notice' });
            }}
          >
            Post notice
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="notice-title">
            <Input id="notice-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Viva schedule released" />
          </Field>
          <Field label="Details" htmlFor="notice-body">
            <Textarea id="notice-body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="What, when and where" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience" htmlFor="notice-audience">
              <Select id="notice-audience" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}>
                <option>Whole campus</option>
                <option>My department</option>
                <option>My year</option>
                <option>My class</option>
              </Select>
            </Field>
            <Field label="Type" htmlFor="notice-type">
              <Select id="notice-type" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option>Notice</option>
                <option>Results</option>
                <option>Event</option>
              </Select>
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
