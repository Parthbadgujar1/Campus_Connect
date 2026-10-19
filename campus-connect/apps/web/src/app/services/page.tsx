'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Briefcase, Clock, Plus, Star } from 'lucide-react';
import { Avatar, IconTile } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { services } from '@/data/commerce';
import { getPerson } from '@/data/people';

const CATEGORIES = ['All', 'Coding help', 'Design', 'Video editing', 'Event photography', 'Printing', 'Resume creation', 'Website development', 'Freelancing'];

export default function ServicesPage() {
  const toast = useToast();
  const [category, setCategory] = useState('All');
  const [sheet, setSheet] = useState<'offer' | 'request' | null>(null);

  const visible = services.filter((s) => category === 'All' || s.category === category);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Student services"
        subtitle="Help from students who do it well"
        back
        backHref="/campus"
        actions={
          <Button size="sm" variant="soft" onClick={() => setSheet('request')}>
            Request
          </Button>
        }
      />

      <div className="mt-4 space-y-4">
        <ChipRow>
          {CATEGORIES.map((item) => (
            <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
              {item}
            </Chip>
          ))}
        </ChipRow>
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((service) => {
            const provider = getPerson(service.providerId);
            return (
              <Card key={service.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <IconTile seed={service.seed} size="md">
                    <Briefcase className="h-5 w-5" aria-hidden="true" />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{service.title}</p>
                    <p className="text-xs text-text-3">{service.category}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold">{service.price}</span>
                </div>
                <p className="text-sm text-text-2">{service.description}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Link href={provider.role === 'business' ? '/offers' : `/profile/${provider.username}`} className="flex min-w-0 items-center gap-2 text-xs text-text-2">
                    <Avatar name={provider.name} seed={provider.id} size="xs" />
                    <span className="truncate font-medium">{provider.name}</span>
                  </Link>
                  <div className="flex items-center gap-3 text-xs text-text-3">
                    <span className="flex items-center gap-1 font-semibold text-text">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />
                      {service.rating.toFixed(1)} ({service.reviews})
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {service.delivery}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="secondary" className="self-start" onClick={() => toast(`Message sent to ${provider.name.split(' ')[0]} (demo)`)}>
                  Message
                </Button>
              </Card>
            );
          })}
        </div>

        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-semibold">Good at something? Offer it.</p>
            <p className="text-sm text-text-3">Post a service once. Your reviews build your rating for every student.</p>
          </div>
          <Button variant="secondary" onClick={() => setSheet('offer')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Offer a service
          </Button>
        </Card>
      </div>

      <Sheet
        open={sheet === 'offer'}
        onClose={() => setSheet(null)}
        title="Offer a service"
        footer={<Button full onClick={() => { setSheet(null); toast('Service submitted for a quick review'); }}>Submit</Button>}
      >
        <ServiceForm />
      </Sheet>
      <Sheet
        open={sheet === 'request'}
        onClose={() => setSheet(null)}
        title="Request a service"
        description="Students who offer this will reply in chat"
        footer={<Button full onClick={() => { setSheet(null); toast('Request posted (demo)'); }}>Post request</Button>}
      >
        <div className="space-y-4">
          <Field label="What do you need?" htmlFor="sr-what">
            <Input id="sr-what" placeholder="e.g. Review my React portfolio" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Budget (₹)" htmlFor="sr-budget">
              <Input id="sr-budget" inputMode="numeric" placeholder="500" />
            </Field>
            <Field label="Needed by" htmlFor="sr-when">
              <Input id="sr-when" type="date" />
            </Field>
          </div>
        </div>
      </Sheet>
      <p className="mt-6 text-center text-xs text-text-3">
        <Badge tone="neutral">Payments are settled directly</Badge>
      </p>
    </div>
  );
}

function ServiceForm() {
  return (
    <div className="space-y-4">
      <Field label="Title" htmlFor="sv-title">
        <Input id="sv-title" placeholder="e.g. Figma posters for clubs" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Category" htmlFor="sv-cat">
          <Select id="sv-cat">
            {CATEGORIES.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Price" htmlFor="sv-price">
          <Input id="sv-price" placeholder="₹600 / poster" />
        </Field>
      </div>
      <Field label="Description" htmlFor="sv-desc">
        <Textarea id="sv-desc" placeholder="What you deliver, turnaround and what is included" />
      </Field>
    </div>
  );
}
