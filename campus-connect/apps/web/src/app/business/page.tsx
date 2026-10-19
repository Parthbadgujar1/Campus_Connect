'use client';

import { useState } from 'react';
import { BarChart3, Eye, Megaphone, Plus, Store, Ticket, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader, StatTile } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { adPlans, businessLeads, businessProfile, coupons, dailyReach, featuredListing } from '@/data/commerce';
import { formatDay, formatTime } from '@/lib/time';
import { compactNumber, formatINR } from '@/lib/visuals';
import { cn } from '@/lib/utils';

type Tab = 'Overview' | 'Coupons' | 'Leads' | 'Ads' | 'Plans';

export default function BusinessPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Overview');
  const [couponOpen, setCouponOpen] = useState(false);
  const maxReach = Math.max(...dailyReach.map((d) => d.value));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Business hub"
        subtitle={`${businessProfile.name} · ${businessProfile.location}`}
        back
        backHref="/campus"
        actions={
          <Button size="sm" variant="secondary" onClick={() => toast('Business profile editor (demo)')}>
            <Store className="h-4 w-4" aria-hidden="true" />
            Profile
          </Button>
        }
      />

      <div className="mt-4">
        <UnderlineTabs<Tab>
          label="Business sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Overview', label: 'Overview' },
            { value: 'Coupons', label: 'Coupons' },
            { value: 'Leads', label: 'Leads' },
            { value: 'Ads', label: 'Promote' },
            { value: 'Plans', label: 'Plans' },
          ]}
        />
      </div>

      {tab === 'Overview' && (
        <section className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Reach (30d)" value={compactNumber(businessProfile.reach30d)} icon={Eye} />
            <StatTile label="Redemptions" value={businessProfile.redemptions30d} icon={Ticket} tone="success" />
            <StatTile label="Leads" value={businessProfile.leads30d} icon={Users} tone="info" />
            <StatTile label="Ad spend" value={formatINR(businessProfile.spend30d)} icon={BarChart3} tone="warning" />
          </div>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Daily reach</p>
              <span className="text-xs text-text-3">Last 7 days</span>
            </div>
            <div className="flex h-40 items-end gap-2" role="img" aria-label="Bar chart of daily reach for the last seven days">
              {dailyReach.map((day) => (
                <div key={day.day} className="flex h-full flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-semibold text-text-3">{compactNumber(day.value)}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-lg bg-accent/80" style={{ height: `${(day.value / maxReach) * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-3">{day.day}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{featuredListing.title}</p>
              <p className="text-sm text-text-3">
                {featuredListing.price} · <Badge>{featuredListing.status}</Badge>
              </p>
            </div>
          </Card>
        </section>
      )}

      {tab === 'Coupons' && (
        <section className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-3">{coupons.filter((c) => c.status === 'Active').length} active coupons</p>
            <Button size="sm" onClick={() => setCouponOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New coupon
            </Button>
          </div>
          {coupons.map((coupon) => {
            const pct = Math.min(100, Math.round((coupon.redeemed / coupon.limit) * 100));
            return (
              <Card key={coupon.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold tracking-wider">{coupon.code}</p>
                    <p className="text-sm text-text-2">{coupon.discount}</p>
                  </div>
                  <Badge tone={coupon.status === 'Active' ? 'success' : 'neutral'}>{coupon.status}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-text-3' : 'bg-accent')} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-text-3">
                    {coupon.redeemed} of {coupon.limit} redeemed · valid till {formatDay(coupon.validTill)}
                  </p>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {tab === 'Leads' && (
        <section className="mt-5">
          <SectionHeader title="Lead inbox" description="Students and groups who asked about your services" />
          <Card className="divide-y divide-border overflow-hidden">
            {businessLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{lead.name}</p>
                  <p className="truncate text-sm text-text-2">{lead.interest}</p>
                  <p className="text-xs text-text-3">
                    {formatDay(lead.at)} · {formatTime(lead.at)}
                  </p>
                </div>
                <Badge tone={lead.status === 'Won' ? 'success' : lead.status === 'New' ? 'accent' : 'neutral'}>{lead.status}</Badge>
              </div>
            ))}
          </Card>
        </section>
      )}

      {tab === 'Ads' && (
        <section className="mt-5 space-y-4">
          <Card className="space-y-4 p-5">
            <p className="font-semibold">New sponsored campus post</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Objective" htmlFor="ad-goal">
                <Select id="ad-goal">
                  <option>Visits to the shop</option>
                  <option>Coupon redemptions</option>
                  <option>Event attendance</option>
                </Select>
              </Field>
              <Field label="Daily budget (₹)" htmlFor="ad-budget">
                <Input id="ad-budget" inputMode="numeric" defaultValue="300" />
              </Field>
              <Field label="Audience: college" htmlFor="ad-college">
                <Select id="ad-college">
                  <option>CSMSS (verified students)</option>
                  <option>Students in Pune</option>
                </Select>
              </Field>
              <Field label="Audience: year" htmlFor="ad-year">
                <Select id="ad-year">
                  <option>All years</option>
                  <option>First year</option>
                  <option>Final year</option>
                </Select>
              </Field>
            </div>
            <Button onClick={() => toast('Campaign submitted for review (demo)')}>
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              Submit campaign
            </Button>
            <p className="text-xs text-text-3">Ads are labelled “Sponsored”. Targeting uses college, department and year only, never individual profiles.</p>
          </Card>
        </section>
      )}

      {tab === 'Plans' && (
        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {adPlans.map((plan) => (
            <Card key={plan.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{plan.name}</p>
                <p className="text-sm font-bold">{plan.price}</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-3">For {plan.forWho}</p>
              <p className="text-sm text-text-2">{plan.tagline}</p>
              <ul className="space-y-1.5 text-sm text-text-2">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <Button variant="secondary" className="mt-auto" onClick={() => toast(`${plan.name} selected (demo, no payment taken)`)}>
                Choose plan
              </Button>
            </Card>
          ))}
        </section>
      )}

      <Sheet
        open={couponOpen}
        onClose={() => setCouponOpen(false)}
        title="New coupon"
        footer={<Button full onClick={() => { setCouponOpen(false); toast('Coupon created (demo)'); }}>Create coupon</Button>}
      >
        <div className="space-y-4">
          <Field label="Code" htmlFor="cp-code" hint="Uppercase letters and numbers">
            <Input id="cp-code" placeholder="BREW25" />
          </Field>
          <Field label="Offer" htmlFor="cp-offer">
            <Input id="cp-offer" placeholder="25% off any drink" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Redemption limit" htmlFor="cp-limit">
              <Input id="cp-limit" inputMode="numeric" defaultValue="200" />
            </Field>
            <Field label="Valid till" htmlFor="cp-valid">
              <Input id="cp-valid" type="date" />
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
