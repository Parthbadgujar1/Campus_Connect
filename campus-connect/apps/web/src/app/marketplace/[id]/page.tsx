'use client';

import Link from 'next/link';
import { gradientFor } from '@/lib/visuals';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Bookmark, Flag, MapPin, MessageCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import { Avatar, VerifiedMark } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, DetailHero, EmptyState, MetaLine, PageHeader, SectionHeader, Stars } from '@/components/ui/layout';
import { Select } from '@/components/ui/fields';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { marketListings } from '@/data/living';
import { chats } from '@/data/chats';
import { getPerson } from '@/data/people';
import { appActions, useAppState } from '@/lib/store';
import { formatDay, relativeTime } from '@/lib/time';
import { formatINR } from '@/lib/visuals';
import { cn } from '@/lib/utils';

export default function MarketplaceItemPage() {
  const { id } = useParams<{ id: string }>();
  const listing = marketListings.find((l) => l.id === id);
  const toast = useToast();
  const saved = useAppState((s) => (listing ? s.saved.includes(listing.id) : false));
  const [reportOpen, setReportOpen] = useState(false);
  const [reserved, setReserved] = useState(false);

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Listing" back backHref="/marketplace" />
        <EmptyState icon={ShoppingBag} title="This listing is no longer available" className="mt-6" />
      </div>
    );
  }

  const seller = getPerson(listing.sellerId);
  const sellerChat = chats.find((c) => c.kind === 'direct' && c.memberIds.includes(listing.sellerId));
  const isSold = listing.status === 'Sold';
  const priceLabel = listing.price === null ? (listing.mode === 'Exchange' ? 'Swap' : 'Borrow') : listing.price === 0 ? 'Free' : formatINR(listing.price);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Listing" back backHref="/marketplace" />

      <div className="mt-2 space-y-5 md:mt-4">
        <div className="aspect-[16/10] overflow-hidden rounded-3xl text-white" style={{ background: gradientFor(listing.seed) }} role="img" aria-label={`Photo of ${listing.title}`}>
          <div className="flex h-full items-end justify-between p-4">
            <Badge tone="accent" className="bg-white/90 text-zinc-900">
              {listing.mode}
            </Badge>
            <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold">Photos from seller</span>
          </div>
        </div>

        <DetailHero seed={listing.seed} icon={ShoppingBag} eyebrow={listing.category} title={listing.title}>
          <p className={cn('text-2xl font-bold', isSold && 'text-text-3 line-through')}>{priceLabel}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{listing.condition}</Badge>
            <Badge tone={listing.status === 'Available' ? 'success' : 'warning'}>{reserved && listing.status === 'Available' ? 'Reserved by you' : listing.status}</Badge>
          </div>
          <MetaLine icon={MapPin}>
            Pickup at {listing.location} · posted {relativeTime(listing.postedAt)} ago
          </MetaLine>
          {listing.returnBy && <MetaLine icon={ShoppingBag}>Return by {formatDay(listing.returnBy)}</MetaLine>}
        </DetailHero>

        <Card className="flex items-center gap-4 p-4">
          <Link href={`/profile/${seller.username}`} className="shrink-0">
            <Avatar name={seller.name} seed={seller.id} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              {seller.name}
              {seller.verified && <VerifiedMark />}
            </p>
            <p className="text-xs text-text-3">{seller.branch} · Year {seller.year}</p>
            <div className="mt-1">
              <Stars value={4.6} size={11} />
            </div>
          </div>
          <Link href={`/profile/${seller.username}`} className="text-sm font-semibold text-accent hover:underline">
            Profile
          </Link>
        </Card>

        <Card className="space-y-3 p-5">
          <SectionHeader title="Description" />
          <p className="text-[15px] leading-relaxed text-text-2">{listing.description}</p>
          <p className="flex items-center gap-2 text-xs text-text-3">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            Chat stays inside CampusConnect. Never pay before you see the item.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_auto]">
          {sellerChat ? (
            <Link href={`/chats/${sellerChat.id}`} className={buttonClass({ size: 'lg', className: 'col-span-2 md:col-span-1' })}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Chat with seller
            </Link>
          ) : (
            <Button size="lg" className="col-span-2 md:col-span-1" onClick={() => toast(`Message sent to ${seller.name.split(' ')[0]} (demo)`)}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Message seller
            </Button>
          )}
          <Button
            size="lg"
            variant="secondary"
            disabled={isSold}
            onClick={() => {
              setReserved((r) => !r);
              toast(reserved ? 'Reservation cancelled' : 'Reserved for 24 hours (demo)');
            }}
          >
            {reserved ? 'Cancel reserve' : 'Reserve'}
          </Button>
          <Button size="lg" variant="ghost" aria-pressed={saved} onClick={() => appActions.toggleSaved(listing.id)} className="col-span-2 md:col-span-1">
            <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
        <button type="button" onClick={() => setReportOpen(true)} className="mx-auto flex items-center gap-2 text-xs font-semibold text-text-3 hover:text-danger">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          Report this listing
        </button>
      </div>

      <Sheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report listing"
        footer={
          <Button full variant="danger" onClick={() => { setReportOpen(false); toast('Report sent to moderators'); }}>
            Submit report
          </Button>
        }
      >
        <div className="space-y-3">
          <label htmlFor="mk-report" className="text-sm font-medium">Reason</label>
          <Select id="mk-report">
            <option>Fake or misleading listing</option>
            <option>Asks for advance payment</option>
            <option>Prohibited item</option>
            <option>Spam</option>
          </Select>
        </div>
      </Sheet>
    </div>
  );
}
