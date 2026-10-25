'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, BookmarkCheck, CalendarClock, Flag, MapPin, MessageCircle, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import { del, get, patch, post, put } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { ListingView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Card, MetaLine, PageHeader } from '@/components/ui/layout';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ReportSheet } from '@/components/common/report-sheet';
import { Reveal, motion, AnimatePresence } from '@/components/motion';
import { CATEGORY_LABEL, CONDITION_LABEL, MODE_LABEL, priceLabel } from '@/components/market/market-ui';
import { ago, day } from '@/lib/live-time';
import { gradientFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

export default function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const q = useQuery<ListingView>(`market:one:${id}`, (signal) => get(`/listings/${id}`, undefined, signal));
  const [index, setIndex] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const contact = useAction(async () => {
    const r = await post<{ chatId: string }>(`/listings/${id}/contact`);
    router.push(`/chats/${r.chatId}`);
  });
  const status = useAction(async (next: 'available' | 'reserved' | 'sold' | 'borrowed') => {
    await patch(`/listings/${id}`, { status: next });
    q.setData((l) => (l ? { ...l, status: next } : l));
    invalidate('market:list');
    toast('Updated');
  });
  const save = useAction(async () => {
    const l = q.data!;
    q.setData({ ...l, saved: !l.saved });
    await (l.saved ? del(`/saved/listing/${id}`) : put(`/saved/listing/${id}`));
  });
  const remove = useAction(async () => {
    await del(`/listings/${id}`);
    invalidate('market:');
    router.replace('/marketplace');
  });
  const l = q.data;
  const img = l?.images[index];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Listing" back backHref="/marketplace" />
      {q.loading && <SkeletonList variant="card" count={1} />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {l && (
        <Reveal className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface-2">
            <div className="relative aspect-[4/3]" style={img ? undefined : { background: gradientFor(l.id) }}>
              <AnimatePresence initial={false}>
                {img?.url && (
                  <motion.img key={img.id} src={img.url} alt={`${l.title}, photo ${index + 1}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 h-full w-full object-cover" />
                )}
              </AnimatePresence>
            </div>
            {l.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-2">
                {l.images.map((im, i) => (
                  <button key={im.id} type="button" onClick={() => setIndex(i)} aria-label={`Photo ${i + 1}`} aria-pressed={i === index} className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2', i === index ? 'border-accent' : 'border-transparent')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.thumbnailUrl ?? im.url ?? ''} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{MODE_LABEL[l.mode]}</Badge>
              <Badge tone="neutral">{CATEGORY_LABEL[l.category] ?? l.category}</Badge>
              {l.status !== 'available' && <Badge tone="warning">{l.status}</Badge>}
            </div>
            <p className="mt-2 text-[28px] font-bold">{priceLabel(l)}</p>
            <h2 className="text-[20px] font-semibold leading-snug">{l.title}</h2>
            <div className="mt-3 space-y-1.5">
              <MetaLine icon={MapPin}>{l.location}</MetaLine>
              <MetaLine icon={Tag}>Condition: {CONDITION_LABEL[l.condition]}</MetaLine>
              {l.returnBy && <MetaLine icon={CalendarClock}>Return by {day(l.returnBy)}</MetaLine>}
            </div>
            {l.description && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{l.description}</p>}
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
              <PersonAvatar person={l.seller} size="sm" link />
              <div className="min-w-0 flex-1">
                <PersonName person={l.seller} />
                <p className="text-[12px] text-text-3">Listed {ago(l.createdAt)}</p>
              </div>
            </div>
          </Card>
          {l.isMine ? (
            <Card className="space-y-3 p-4">
              <p className="font-semibold">Update your listing</p>
              <Segmented label="Status" value={l.status === 'removed' ? 'available' : l.status} onChange={(v) => void status.run(v as 'available' | 'reserved' | 'sold' | 'borrowed')} options={[{ value: 'available', label: 'Available' }, { value: 'reserved', label: 'Reserved' }, { value: l.mode === 'borrow' ? 'borrowed' : 'sold', label: l.mode === 'borrow' ? 'Lent out' : l.mode === 'rent' ? 'Rented' : 'Sold' }]} />
              <Button variant="danger" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove listing</Button>
              {status.error && <FormAlert>{status.error.message}</FormAlert>}
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button full size="lg" onClick={() => void contact.run()} disabled={contact.pending || !['available', 'reserved'].includes(l.status)}>
                  {contact.pending ? <Spinner /> : <MessageCircle className="h-4 w-4" aria-hidden="true" />} Message seller
                </Button>
                <Button size="lg" variant="secondary" onClick={() => void save.run()} aria-pressed={l.saved} aria-label={l.saved ? 'Saved' : 'Save'}>
                  {l.saved ? <BookmarkCheck className="h-5 w-5 text-accent" aria-hidden="true" /> : <Bookmark className="h-5 w-5" aria-hidden="true" />}
                </Button>
              </div>
              {contact.error && <FormAlert>{contact.error.message}</FormAlert>}
              <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-text-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Meet in a public place on campus, check the item before paying, and never share OTPs or pay in advance to strangers.</p>
              <Button variant="ghost" size="sm" onClick={() => setReporting(true)}><Flag className="h-4 w-4" aria-hidden="true" /> Report listing</Button>
            </div>
          )}
        </Reveal>
      )}
      <ConfirmDialog open={removing} onClose={() => setRemoving(false)} onConfirm={() => void remove.run()} title="Remove this listing?" description="It disappears from the market for everyone." confirmLabel="Remove" danger pending={remove.pending} error={remove.error?.message} />
      {l && <ReportSheet open={reporting} onClose={() => setReporting(false)} targetType="listing" targetId={l.id} label="this listing" />}
    </div>
  );
}
