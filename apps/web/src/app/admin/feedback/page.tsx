'use client';

import { useState } from 'react';
import { MessageSquareHeart, Search, Star } from 'lucide-react';
import { get, patch } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, type Page } from '@/lib/api/hooks';
import type { FeedbackStats, FeedbackView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Input, Select } from '@/components/ui/fields';
import { Card } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { FormAlert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { DownloadButtons, Figure } from '@/components/admin/admin-ui';
import { ago } from '@/lib/live-time';

type Category = FeedbackView['category'];
type Status = FeedbackView['status'];
const CATEGORY_LABEL: Record<Category, string> = { bug: 'Problem', idea: 'Idea', praise: 'Praise', question: 'Question', other: 'Other' };
const CATEGORY_TONE: Record<Category, 'danger' | 'accent' | 'success' | 'info' | 'neutral'> = { bug: 'danger', idea: 'accent', praise: 'success', question: 'info', other: 'neutral' };
const STATUS_LABEL: Record<Status, string> = { new: 'New', reviewed: 'Reviewed', planned: 'Planned', done: 'Done' };

function Row({ f, onChange }: { f: FeedbackView; onChange: (f: FeedbackView) => void }) {
  const toast = useToast();
  const set = useAction(async (status: Status) => {
    await patch(`/admin/feedback/${f.id}`, { status });
    onChange({ ...f, status });
    invalidate('admin:overview');
    toast(`Marked ${STATUS_LABEL[status].toLowerCase()}. They have been told.`);
  });
  return (
    <Card className="space-y-2.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CATEGORY_TONE[f.category]}>{CATEGORY_LABEL[f.category]}</Badge>
        {f.rating && <span className="flex items-center gap-0.5 text-warning" aria-label={`${f.rating} of 5 stars`}>{Array.from({ length: f.rating }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />)}</span>}
        <span className="text-[12px] text-text-3">{ago(f.createdAt)}{f.page ? ` · from ${f.page}` : ''}</span>
      </div>
      <p className="whitespace-pre-wrap text-[15px]">{f.message}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-text-3">{f.from && <><PersonAvatar person={f.from} size="xs" /> {f.from.displayName}</>}</span>
        <Select value={f.status} disabled={set.pending} onChange={(e) => void set.run(e.target.value as Status)} aria-label="Feedback status" className="h-10 w-auto min-w-[140px] text-[14px]">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
      </div>
      {set.error && <FormAlert>{set.error.message}</FormAlert>}
    </Card>
  );
}

export default function AdminFeedbackPage() {
  const [category, setCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const filters = { category: category ?? undefined, status: status ?? undefined, rating: rating ?? undefined, q: q || undefined };
  const list = useInfinite<FeedbackView>(`admin:feedback:${category}:${status}:${rating}:${q}`, async (cursor, signal) => {
    const page = await get<Page<FeedbackView> & { stats: FeedbackStats | null }>('/admin/feedback', { ...filters, cursor: cursor ?? undefined, limit: 20 }, signal);
    if (page.stats) setStats(page.stats);
    return page;
  });
  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="All feedback" value={stats.total} />
          <Figure label="New" value={stats.byStatus.new} tone={stats.byStatus.new ? 'warning' : 'neutral'} />
          <Figure label="Average rating" value={stats.averageRating ? `${stats.averageRating} ★` : '—'} />
          <Figure label="Problems reported" value={stats.byCategory.bug} tone={stats.byCategory.bug ? 'danger' : 'neutral'} />
        </div>
      )}
      <form className="relative" onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); }}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={text} onChange={(e) => { setText(e.target.value); if (!e.target.value) setQ(''); }} placeholder="Search feedback" className="h-11 pl-10" aria-label="Search feedback" enterKeyHint="search" />
      </form>
      <div className="space-y-2">
        <ChipRow>
          <Chip active={!category} onClick={() => setCategory(null)}>All types</Chip>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c]}{stats ? ` · ${stats.byCategory[c]}` : ''}</Chip>)}
        </ChipRow>
        <ChipRow>
          <Chip active={!status} onClick={() => setStatus(null)}>Any status</Chip>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</Chip>)}
          <Chip active={rating !== null} onClick={() => setRating(rating === null ? 1 : rating >= 5 ? null : rating + 1)}>{rating === null ? 'Any rating' : `${rating} star${rating === 1 ? '' : 's'}`}</Chip>
        </ChipRow>
      </div>
      <DownloadButtons path="/admin/feedback/export" query={filters} label="Download (current filters)" />
      <InfiniteList
        state={list}
        skeleton="card"
        className="space-y-3"
        empty={{ icon: MessageSquareHeart, title: 'No feedback here', description: 'People send feedback from Settings → Feedback.' }}
        endMessage="That’s all the feedback"
        render={(f) => <Row f={f} onChange={(next) => list.setItems((items) => items.map((x) => (x.id === next.id ? next : x)))} />}
      />
    </div>
  );
}
