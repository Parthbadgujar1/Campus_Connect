'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LayoutGrid, Lock, Plus, Search, Users } from 'lucide-react';
import { get, post, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, type Page } from '@/lib/api/hooks';
import type { SpaceView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable, Reveal } from '@/components/motion';
import { useSession } from '@/lib/session';
import { gradientFor } from '@/lib/visuals';
import { SPACE_KINDS, isStaffRole } from '@/components/spaces/space-kinds';

function SpaceCard({ s }: { s: SpaceView }) {
  return (
    <Pressable>
      <Link href={`/spaces/${s.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/40">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[18px] font-bold text-white" style={{ background: gradientFor(s.slug) }}>{s.name.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{s.name}</span>
            {s.privacy === 'private' && <Lock className="h-3.5 w-3.5 shrink-0 text-text-3" aria-label="Private" />}
          </span>
          <span className="line-clamp-1 block text-[13px] text-text-3">{s.description || SPACE_KINDS[s.kind]}</span>
          <span className="mt-1 flex items-center gap-2 text-[12px] text-text-3">
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{s.membersCount}</span>
            <span>{SPACE_KINDS[s.kind] ?? s.kind}</span>
            {s.membership?.status === 'active' && <Badge tone="success">Joined</Badge>}
            {s.membership?.status === 'pending' && <Badge tone="warning">Requested</Badge>}
          </span>
        </span>
      </Link>
    </Pressable>
  );
}

function CreateSpace({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const { user } = useSession();
  const [form, setForm] = useState({ name: '', kind: 'club', privacy: 'public', description: '' });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const send = useAction(async () => {
    const r = await post<{ id: string; slug: string; status: string; message: string }>('/spaces', { name: form.name.trim(), kind: form.kind, privacy: form.privacy, description: form.description.trim() || undefined, tags: [] });
    toast(r.message);
    invalidate('spaces:');
    onClose();
    router.push(`/spaces/${r.slug}`);
  });
  const kinds = Object.entries(SPACE_KINDS).filter(([k]) => !['department', 'class'].includes(k) || isStaffRole(user?.role));
  return (
    <Sheet open={open} onClose={onClose} title="Start a space" description="A club, an interest or a study group. New spaces are checked before they are listed." footer={<Button full onClick={() => void send.run()} disabled={form.name.trim().length < 2 || send.pending}>{send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Create space</Button>}>
      <div className="space-y-4">
        <Field label="Name" htmlFor="sp-name"><Input id="sp-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="sp-kind"><Select id="sp-kind" value={form.kind} onChange={(e) => set('kind', e.target.value)}>{kinds.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Who can join" htmlFor="sp-priv"><Select id="sp-priv" value={form.privacy} onChange={(e) => set('privacy', e.target.value)}><option value="public">Anyone at college</option><option value="private">By approval</option></Select></Field>
        </div>
        <Field label="What is it about?" htmlFor="sp-desc"><Textarea id="sp-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={600} rows={3} /></Field>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

function SpacesInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = params.get('kind');
  const mine = params.get('mine') === 'true';
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(false);
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { kind, mine: mine ? 'true' : null, q: q || null, ...next }), { scroll: false });
  const list = useInfinite<SpaceView>(`spaces:list:${kind}:${mine}:${q}`, (cursor, signal) => get<Page<SpaceView>>('/spaces', { kind: kind ?? undefined, mine: mine ? 'true' : undefined, q: q || undefined, cursor: cursor ?? undefined, limit: 20 }, signal));
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Boards" subtitle="Spaces for clubs, interests and study groups" back backHref="/discover" actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New space</Button>} />
      <Reveal className="space-y-3">
        <Segmented label="Spaces" value={mine ? 'mine' : 'all'} onChange={(v) => go({ mine: v === 'mine' ? 'true' : null })} options={[{ value: 'all', label: 'All spaces' }, { value: 'mine', label: 'My spaces' }]} />
        <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: search.trim() || null }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search spaces" className="pl-10" aria-label="Search spaces" enterKeyHint="search" />
        </form>
        <ChipRow>
          <Chip active={!kind} onClick={() => go({ kind: null })}>All</Chip>
          {Object.entries(SPACE_KINDS).map(([v, l]) => <Chip key={v} active={kind === v} onClick={() => go({ kind: v })}>{l}</Chip>)}
        </ChipRow>
      </Reveal>
      <div className="mt-4">
        <InfiniteList state={list} skeleton="row" className="space-y-3" empty={{ icon: LayoutGrid, title: mine ? 'You have not joined a space yet' : 'No spaces here', description: 'Start one for your club, interest or study group.' }} endMessage="That’s every space" render={(s) => <SpaceCard s={s} />} />
      </div>
      <CreateSpace open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

export default function SpacesPage() {
  return (
    <Suspense fallback={<SkeletonList variant="row" count={4} className="mx-auto mt-24 max-w-3xl px-4" />}>
      <SpacesInner />
    </Suspense>
  );
}
