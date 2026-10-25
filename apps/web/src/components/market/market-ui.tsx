'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { ImagePlus, MapPin, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { get, post, upload, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, type Page } from '@/lib/api/hooks';
import type { ListingView } from '@/lib/api/modules';
import type { FileView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable, Reveal } from '@/components/motion';
import { gradientFor } from '@/lib/visuals';
import { ago, rupees } from '@/lib/live-time';

export const MODE_LABEL: Record<ListingView['mode'], string> = { sell: 'For sale', rent: 'For rent', borrow: 'To borrow', exchange: 'To swap', free: 'Free' };
export const CATEGORY_LABEL: Record<string, string> = { books: 'Books', electronics: 'Electronics', laptops_phones: 'Laptops & phones', furniture: 'Furniture', cycles: 'Cycles', equipment: 'Lab & drawing kit', clothing: 'Clothing', sports: 'Sports', housing: 'Rooms & PGs', services: 'Services', other: 'Other' };
export const CONDITION_LABEL: Record<ListingView['condition'], string> = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };

export function priceLabel(l: Pick<ListingView, 'mode' | 'pricePaise'>): string {
  if (l.mode === 'rent') return `${rupees(l.pricePaise)} / month`;
  if (l.mode === 'sell') return rupees(l.pricePaise);
  return MODE_LABEL[l.mode];
}

export function ListingTile({ l }: { l: ListingView }) {
  const img = l.images[0];
  return (
    <Pressable>
      <Link href={`/marketplace/${l.id}`} className="block overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-colors hover:border-accent/40">
        <div className="relative aspect-[4/3]" style={img ? undefined : { background: gradientFor(l.id) }}>
          {img?.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          {l.status !== 'available' && <span className="absolute left-2 top-2"><Badge tone="warning">{l.status === 'reserved' ? 'Reserved' : l.status === 'sold' ? 'Sold' : l.status}</Badge></span>}
        </div>
        <div className="p-3">
          <p className="text-[16px] font-bold">{priceLabel(l)}</p>
          <p className="line-clamp-2 text-[14px] leading-snug">{l.title}</p>
          <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-text-3"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{l.location} · {ago(l.createdAt)}</p>
        </div>
      </Link>
    </Pressable>
  );
}

export function CreateListingSheet({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { mode?: ListingView['mode']; category?: string } }) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({ title: '', mode: preset?.mode ?? 'sell', category: preset?.category ?? 'books', price: '', condition: 'good', location: '', description: '', returnBy: '' });
  const [images, setImages] = useState<FileView[]>([]);
  const input = useRef<HTMLInputElement | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const add = useAction(async (files: File[]) => {
    for (const f of files.slice(0, 8 - images.length)) {
      const up = await upload<FileView>('listing', f);
      setImages((list) => [...list, up]);
    }
  });
  const send = useAction(async () => {
    const priced = form.mode === 'sell' || form.mode === 'rent';
    const r = await post<{ id: string }>('/listings', {
      title: form.title.trim(),
      mode: form.mode,
      category: form.category,
      pricePaise: priced ? Math.round(Number(form.price) * 100) : undefined,
      condition: form.condition,
      location: form.location.trim(),
      description: form.description.trim() || undefined,
      returnBy: form.mode === 'borrow' ? form.returnBy : undefined,
      imageFileIds: images.map((i) => i.id),
    });
    toast('Your listing is live');
    invalidate('market:');
    onClose();
    router.push(`/marketplace/${r.id}`);
  });
  const priced = form.mode === 'sell' || form.mode === 'rent';
  const ready = form.title.trim().length >= 3 && form.location.trim().length >= 2 && (!priced || Number(form.price) > 0) && (form.mode !== 'borrow' || Boolean(form.returnBy));
  return (
    <Sheet open={open} onClose={onClose} title="New listing" description="No fees, no payments in the app: buyers message you and you meet on campus." footer={<Button full onClick={() => void send.run()} disabled={!ready || send.pending}>{send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Post listing</Button>}>
      <div className="space-y-4">
        <div>
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) void add.run(fs); e.target.value = ''; }} />
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <span key={img.id} className="relative h-20 w-20 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbnailUrl ?? img.url ?? ''} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setImages((l) => l.filter((x) => x.id !== img.id))} aria-label="Remove photo" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </span>
            ))}
            {images.length < 8 && (
              <button type="button" onClick={() => input.current?.click()} disabled={add.pending} className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-border bg-surface-2 text-text-2" aria-label="Add photos">
                {add.pending ? <Spinner /> : <ImagePlus className="h-6 w-6" aria-hidden="true" />}
              </button>
            )}
          </div>
          <p className="mt-1 text-[12px] text-text-3">Up to 8 photos. Location data in photos is removed automatically.</p>
          {add.error && <FormAlert className="mt-2">{add.error.message}</FormAlert>}
        </div>
        <Field label="Title" htmlFor="m-title"><Input id="m-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Listing type" htmlFor="m-mode"><Select id="m-mode" value={form.mode} onChange={(e) => set('mode', e.target.value)}>{Object.entries(MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Category" htmlFor="m-cat"><Select id="m-cat" value={form.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {priced ? (
            <Field label={form.mode === 'rent' ? 'Rent per month (₹)' : 'Price (₹)'} htmlFor="m-price"><Input id="m-price" type="number" inputMode="decimal" min={1} value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
          ) : form.mode === 'borrow' ? (
            <Field label="Return by" htmlFor="m-return"><Input id="m-return" type="date" min={new Date().toISOString().slice(0, 10)} value={form.returnBy} onChange={(e) => set('returnBy', e.target.value)} /></Field>
          ) : (
            <div />
          )}
          <Field label="Condition" htmlFor="m-cond"><Select id="m-cond" value={form.condition} onChange={(e) => set('condition', e.target.value)}>{Object.entries(CONDITION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        </div>
        <Field label="Pickup place" htmlFor="m-loc"><Input id="m-loc" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={120} placeholder="Hostel B, library entrance…" /></Field>
        <Field label="Details" htmlFor="m-desc"><Textarea id="m-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} rows={3} /></Field>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

/** The market, optionally fixed to one category (Rooms & PGs, Services). */
export function MarketBoard({ title, subtitle, category: fixedCategory, preset, backHref = '/campus' }: { title: string; subtitle: string; category?: string; preset?: { mode?: ListingView['mode']; category?: string }; backHref?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mode = params.get('mode');
  const category = fixedCategory ?? params.get('category');
  const sort = (params.get('sort') as 'new' | 'price_low' | 'price_high') || 'new';
  const mine = params.get('mine') === 'true';
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(params.get('sell') === '1');
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { mode, category: fixedCategory ? null : category, sort: sort === 'new' ? null : sort, mine: mine ? 'true' : null, q: q || null, ...next }), { scroll: false });
  const list = useInfinite<ListingView>(`market:list:${mode}:${category}:${sort}:${mine}:${q}`, (cursor, signal) => get<Page<ListingView>>('/listings', { mode: mode ?? undefined, category: category ?? undefined, sort, mine: mine ? 'true' : undefined, q: q || undefined, cursor: cursor ?? undefined, limit: 16 }, signal));
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={title} subtitle={subtitle} back backHref={backHref} actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> {fixedCategory === 'housing' ? 'List a room' : fixedCategory === 'services' ? 'Offer a service' : 'Sell'}</Button>} />
      <Reveal className="space-y-3">
        <Segmented label="Listings" value={mine ? 'mine' : 'all'} onChange={(v) => go({ mine: v === 'mine' ? 'true' : null })} options={[{ value: 'all', label: 'Browse' }, { value: 'mine', label: 'My listings' }]} />
        <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: search.trim() || null }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="pl-10" aria-label="Search listings" enterKeyHint="search" />
        </form>
        <ChipRow>
          <Chip active={!mode} onClick={() => go({ mode: null })}>Any type</Chip>
          {Object.entries(MODE_LABEL).map(([v, l]) => <Chip key={v} active={mode === v} onClick={() => go({ mode: v })}>{l}</Chip>)}
        </ChipRow>
        {!fixedCategory && (
          <ChipRow>
            <Chip active={!category} onClick={() => go({ category: null })}>All categories</Chip>
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => <Chip key={v} active={category === v} onClick={() => go({ category: v })}>{l}</Chip>)}
          </ChipRow>
        )}
        <Segmented label="Sort" value={sort} onChange={(v) => go({ sort: v === 'new' ? null : v })} options={[{ value: 'new', label: 'Newest' }, { value: 'price_low', label: 'Price: low' }, { value: 'price_high', label: 'Price: high' }]} />
      </Reveal>
      <div className="mt-4">
        <InfiniteList state={list} skeleton="card" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" empty={{ icon: ShoppingBag, title: mine ? 'You have no listings' : 'Nothing listed yet', description: 'List something you no longer need. It is free.' }} endMessage="That’s everything listed" render={(l) => <ListingTile l={l} />} />
      </div>
      <CreateListingSheet open={creating} onClose={() => setCreating(false)} preset={preset ?? (fixedCategory ? { category: fixedCategory, mode: fixedCategory === 'housing' ? 'rent' : 'sell' } : undefined)} />
    </div>
  );
}
