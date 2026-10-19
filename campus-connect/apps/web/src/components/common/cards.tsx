'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Lock, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Stars } from '@/components/ui/layout';
import { getPerson } from '@/data/people';
import type { Community, HousingListing, MarketListing } from '@/lib/types';
import { appActions, useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { formatINR, gradientFor, initials } from '@/lib/visuals';
import { cn } from '@/lib/utils';

/** A space (community or club) with a join toggle. */
export function CommunityCard({ community }: { community: Community }) {
  const joined = useAppState((s) => s.joined.includes(community.id));
  const members = community.members + (joined ? 1 : 0);
  const PrivacyIcon = community.privacy === 'Private' ? Lock : Users;
  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <span
        aria-hidden="true"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display font-semibold text-white"
        style={{ background: `${gradientFor(`${community.seed}-icon`)}` }}
      >
        {initials(community.name)}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/spaces/${community.slug}`} className="block truncate font-semibold hover:underline">
          {community.name}
        </Link>
        <p className="flex items-center gap-1.5 text-[13px] text-text-3">
          <PrivacyIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {community.kind} · {members.toLocaleString('en-IN')} members
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] text-text-2">{community.description}</p>
      </div>
      <Button size="sm" variant={joined ? 'secondary' : 'primary'} aria-pressed={joined} onClick={() => appActions.toggleJoined(community.id)} className="self-start">
        {joined ? 'Joined' : 'Join'}
      </Button>
    </article>
  );
}

/** Market tile: the price sits on the picture like a hand-written tag. */
export function ListingCard({ listing }: { listing: MarketListing }) {
  const seller = getPerson(listing.sellerId);
  const priceLabel =
    listing.price === null ? (listing.mode === 'Exchange' ? 'Swap' : 'Borrow') : listing.price === 0 ? 'Free' : formatINR(listing.price);
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="press group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-colors hover:border-accent/40"
    >
      <div className="relative flex h-32 items-start justify-between overflow-hidden p-3 text-white" style={{ background: gradientFor(listing.seed) }}>
        <span className="relative rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-semibold">{listing.mode}</span>
        {listing.status !== 'Available' && <span className="relative rounded-full bg-black/35 px-2.5 py-0.5 text-[11px] font-semibold">{listing.status}</span>}
        <span
          className={cn(
            'absolute bottom-3 left-3 rotate-[-3deg] rounded-xl bg-white px-2.5 py-1 font-display text-[17px] font-semibold text-zinc-900 shadow-card transition-transform duration-500 ease-spring group-hover:rotate-0',
            listing.status === 'Sold' && 'line-through opacity-70',
          )}
        >
          {priceLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{listing.title}</p>
        <p className="mt-auto truncate text-xs text-text-3">
          {listing.condition} · {listing.location}
        </p>
        <p className="truncate text-xs text-text-3">
          {seller.name.split(' ')[0]} · {relativeTime(listing.postedAt)}
        </p>
      </div>
    </Link>
  );
}

/** Housing row with trust signals (verified owner, rating). */
export function HousingCard({ listing }: { listing: HousingListing }) {
  return (
    <Link href={`/housing/${listing.id}`} className="press flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition-colors hover:border-accent/40">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl text-white" style={{ background: gradientFor(listing.seeds[0] ?? listing.id) }} aria-hidden="true">
        <span className="absolute bottom-2 left-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold">{listing.seeds.length} photos</span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-text-2">{listing.kind}</span>
          {listing.verified ? (
            <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">Unverified</span>
          )}
        </p>
        <p className="mt-1.5 truncate font-semibold">{listing.title}</p>
        <p className="truncate text-[13px] text-text-3">
          {listing.area} · {listing.distanceKm} km from campus
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-display text-[18px] font-semibold">
            {formatINR(listing.rent)}
            <span className="font-sans text-xs font-normal text-text-3"> / month</span>
          </p>
          <Stars value={listing.rating} size={11} />
        </div>
      </div>
    </Link>
  );
}

/** Banner for trust notices, tips and warnings. */
export function InfoBanner({
  icon: Icon,
  title,
  children,
  tone = 'accent',
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  tone?: 'accent' | 'warning' | 'danger' | 'success';
  action?: ReactNode;
}) {
  const toneClass = {
    accent: 'bg-accent-soft text-accent-soft-ink',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-success-soft text-success',
  }[tone];
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', toneClass)}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-text-2">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
