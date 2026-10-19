'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Armchair, Check, Flag, MapPin, ShieldCheck, Star, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DetailHero, EmptyState, MetaLine, PageHeader, SectionHeader, Stars } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { Select } from '@/components/ui/fields';
import { useToast } from '@/components/ui/toast';
import { housing } from '@/data/living';
import { gradientFor, formatINR } from '@/lib/visuals';
import { formatLongDate } from '@/lib/time';

const REPORT_REASONS = ['Asks for money before a visit', 'Photos are not of this place', 'Owner is not verified', 'Misleading price or rules', 'Other'];

export default function HousingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const listing = housing.find((h) => h.id === id);
  const toast = useToast();
  const [photo, setPhoto] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]!);
  const [contacted, setContacted] = useState(false);

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Listing" back backHref="/housing" />
        <EmptyState icon={Armchair} title="This listing has been removed" className="mt-6" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={listing.title} back backHref="/housing" />

      <div className="mt-2 space-y-5 md:mt-4">
        <section aria-label="Photos">
          <div
            className="relative flex aspect-[16/10] items-end justify-between overflow-hidden rounded-3xl p-4 text-white"
            style={{ background: gradientFor(listing.seeds[photo] ?? listing.id) }}
          >
            <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold">
              Photo {photo + 1} of {listing.seeds.length} · illustrative
            </span>
            {listing.seeds.length > 1 && (
              <div className="flex gap-1.5">
                {listing.seeds.map((seed, i) => (
                  <button
                    key={seed}
                    type="button"
                    aria-label={`Show photo ${i + 1}`}
                    onClick={() => setPhoto(i)}
                    className={`h-2 rounded-full bg-white transition-all ${i === photo ? 'w-6' : 'w-2 opacity-60'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <DetailHero seed={listing.id} icon={Armchair} eyebrow={`${listing.kind} · ${listing.gender}`} title={listing.title}>
          <p className="text-2xl font-bold">
            {formatINR(listing.rent)}
            <span className="text-sm font-normal text-text-3"> / month</span>
          </p>
          <MetaLine icon={MapPin}>
            {listing.area} · {listing.distanceKm} km from campus
          </MetaLine>
          <div className="flex flex-wrap items-center gap-2">
            {listing.verified ? (
              <Badge tone="success" icon={<ShieldCheck className="h-3 w-3" aria-hidden="true" />}>
                Verified listing
              </Badge>
            ) : (
              <Badge tone="warning">Owner not verified yet</Badge>
            )}
            <Stars value={listing.rating} />
            {listing.reports > 0 && <Badge tone="danger">{listing.reports} reports</Badge>}
          </div>
        </DetailHero>

        {!listing.verified && (
          <Card className="border-warning/40 bg-warning-soft p-4 text-sm text-text-2">
            <p className="font-semibold text-warning">Be careful with unverified listings</p>
            <p className="mt-1">Visit in person, never pay a deposit before you have seen the room and signed an agreement, and check the owner’s ID.</p>
          </Card>
        )}

        <Card className="space-y-3 p-5">
          <SectionHeader title="About this place" />
          <p className="text-[15px] leading-relaxed text-text-2">{listing.description}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 text-sm">
            <div>
              <dt className="text-text-3">Deposit</dt>
              <dd className="font-semibold">{formatINR(listing.deposit)}</dd>
            </div>
            <div>
              <dt className="text-text-3">Available from</dt>
              <dd className="font-semibold">{formatLongDate(listing.availableFrom)}</dd>
            </div>
            <div>
              <dt className="text-text-3">Food</dt>
              <dd className="font-semibold">{listing.food}</dd>
            </div>
            <div>
              <dt className="text-text-3">Owner</dt>
              <dd className="font-semibold">{listing.ownerName}</dd>
            </div>
          </dl>
        </Card>

        <Card className="space-y-3 p-5">
          <SectionHeader title="Amenities" />
          <ul className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            {listing.amenities.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-success-soft text-success">
                  {item.toLowerCase().includes('wi-fi') ? <Wifi className="h-3 w-3" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={() => setContactOpen(true)}>
            Contact owner
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setReportOpen(true)}>
            <Flag className="h-4 w-4" aria-hidden="true" />
            Report listing
          </Button>
        </div>
        <p className="text-center text-xs text-text-3">
          Looking for a roommate for this place?{' '}
          <Link href="/housing?tab=roommates" className="font-semibold text-accent">
            See matches
          </Link>
        </p>
      </div>

      <Sheet
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title={`Contact ${listing.ownerName}`}
        description="Your message goes through CampusConnect. Your number is shared only if you accept."
        footer={
          <Button
            full
            onClick={() => {
              setContacted(true);
              setContactOpen(false);
              toast('Message sent. Chat opens when the owner replies (demo)');
            }}
          >
            Send enquiry
          </Button>
        }
      >
        <div className="space-y-3 text-sm text-text-2">
          <p>Good questions to ask: exact deposit, notice period, visiting hours, and what is included in rent.</p>
          <p className="flex items-center gap-2">
            <Star className="h-4 w-4 text-warning" aria-hidden="true" /> {contacted ? 'Enquiry sent' : 'Enquiries usually get a reply within a day.'}
          </p>
        </div>
      </Sheet>

      <Sheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this listing"
        description="Reports go to the housing review team. The owner is not told who reported."
        footer={
          <Button
            full
            variant="danger"
            onClick={() => {
              setReportOpen(false);
              toast('Report sent. Thanks for keeping campus safe.');
            }}
          >
            Submit report
          </Button>
        }
      >
        <div className="space-y-3">
          <label htmlFor="report-reason" className="text-sm font-medium">
            What is wrong?
          </label>
          <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </div>
      </Sheet>
    </div>
  );
}
