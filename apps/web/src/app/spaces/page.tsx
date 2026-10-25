'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LayoutGrid, Lock, Plus, Search, Users } from 'lucide-react';
import { errorMessage, get, post, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
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
import { cn } from '@/lib/utils';

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

const KIND_HELP: Record<string, string> = {
  club: 'A college club or team: GDSC, robotics, drama…',
  interest: 'People who share a hobby or topic: photography, startups…',
  exam: 'Prepare together for GATE, placements, CAT, semester exams…',
  hostel: 'Your hostel or block: notices, lost items, events…',
  city: 'People from the same city: travel home, meetups…',
  department: 'A department’s official space (faculty and admins).',
  class: 'One class or division (faculty and admins).',
};

/** Start a space in two short steps: what kind it is, then the details. */
function CreateSpace({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const { user } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: '', kind: 'club', privacy: 'public', description: '' });
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const addTopic = () => {
    const t = topic.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    if (t && !topics.includes(t) && topics.length < 10) setTopics((l) => [...l, t]);
    setTopic('');
  };
  const send = useAction(async () => {
    const r = await post<{ id: string; slug: string; status: string; message: string }>('/spaces', { name: form.name.trim(), kind: form.kind, privacy: form.privacy, description: form.description.trim() || undefined, tags: topics });
    toast(r.message);
    invalidate('spaces:');
    onClose();
    setStep(1);
    router.push(`/spaces/${r.slug}`);
  });
  const kinds = Object.entries(SPACE_KINDS).filter(([k]) => !['department', 'class'].includes(k) || isStaffRole(user?.role));
  const close = () => {
    onClose();
    setStep(1);
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={step === 1 ? 'Start a space' : `New ${(SPACE_KINDS[form.kind] ?? 'space').toLowerCase()} space`}
      description={step === 1 ? 'Step 1 of 2 · What kind of space is it?' : 'Step 2 of 2 · Every space gets discussions and its own group chat. New spaces are checked before they are listed.'}
      footer={
        step === 1 ? (
          <Button full onClick={() => setStep(2)}>Next</Button>
        ) : (
          <div className="flex w-full gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button full onClick={() => void send.run()} disabled={form.name.trim().length < 2 || send.pending}>{send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Create space</Button>
          </div>
        )
      }
    >
      {step === 1 ? (
        <div className="grid gap-2" role="radiogroup" aria-label="Kind of space">
          {kinds.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={form.kind === v} onClick={() => set('kind', v)} className={cn('flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors', form.kind === v ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-2')}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold text-white" style={{ background: gradientFor(v) }}>{l.slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{l}</span>
                <span className="block text-[13px] text-text-3">{KIND_HELP[v]}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Name" htmlFor="sp-name" hint="Short and clear, like “GATE 2027 Prep” or “Photography Club”."><Input id="sp-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} autoFocus /></Field>
          <Field label="What is it about?" htmlFor="sp-desc" hint="Who it is for and what members do here."><Textarea id="sp-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={600} rows={3} /></Field>
          <Field label="Topics" htmlFor="sp-topic" hint="Help the right people find it. Up to 10.">
            <div className="flex gap-2">
              <Input id="sp-topic" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTopic(); } }} maxLength={30} placeholder="e.g. machine-learning" />
              <Button variant="secondary" onClick={addTopic} disabled={!topic.trim()}>Add</Button>
            </div>
            {topics.length > 0 && (
              <ChipRow className="mt-2">
                {topics.map((t) => <Chip key={t} active onClick={() => setTopics((l) => l.filter((x) => x !== t))}>#{t} ✕</Chip>)}
              </ChipRow>
            )}
          </Field>
          <Field label="Who can join" htmlFor="sp-priv">
            <Select id="sp-priv" value={form.privacy} onChange={(e) => set('privacy', e.target.value)}>
              <option value="public">Anyone at college can join and read</option>
              <option value="private">By approval: only members can read</option>
            </Select>
          </Field>
          {send.error && <FormAlert>{send.error.message}</FormAlert>}
        </div>
      )}
    </Sheet>
  );
}

type Suggested = SpaceView & { reason: string };

/** "Suggested for you": spaces matching your interests, where people you follow are, or active. */
function SuggestedSpaces() {
  const toast = useToast();
  const list = useQuery<{ items: Suggested[] }>('spaces:suggested', (signal) => get('/spaces/suggested', { limit: 8 }, signal));
  const [joined, setJoined] = useState<Record<string, string>>({});
  const join = async (s: Suggested) => {
    try {
      const r = await post<{ status: string }>(`/spaces/${s.id}/join`);
      setJoined((m) => ({ ...m, [s.id]: r.status }));
      toast(r.status === 'pending' ? 'Request sent to the owners' : `You joined ${s.name}`);
      invalidate('spaces:list');
    } catch (err) {
      toast(errorMessage(err));
    }
  };
  if (!list.data?.items.length) return null;
  return (
    <section className="mt-5" aria-label="Suggested spaces">
      <h2 className="mb-2 text-[17px] font-semibold">Suggested for you</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {list.data.items.map((s) => (
          <div key={s.id} className="flex w-56 shrink-0 flex-col rounded-2xl border border-border bg-surface p-3 shadow-card">
            <Link href={`/spaces/${s.slug}`} className="flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[16px] font-bold text-white" style={{ background: gradientFor(s.slug) }}>{s.name.slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block text-[12px] text-text-3">{s.membersCount} members · {SPACE_KINDS[s.kind] ?? s.kind}</span>
              </span>
            </Link>
            <p className="mt-2 line-clamp-2 text-[13px] text-text-2">{s.description || 'No description yet.'}</p>
            <p className="mt-1 text-[12px] font-semibold text-accent">{s.reason}</p>
            <Button size="sm" className="mt-3" variant={joined[s.id] ? 'secondary' : 'primary'} disabled={Boolean(joined[s.id])} onClick={() => void join(s)}>
              {joined[s.id] === 'active' ? 'Joined' : joined[s.id] === 'pending' ? 'Requested' : s.privacy === 'private' ? 'Ask to join' : 'Join'}
            </Button>
          </div>
        ))}
      </div>
    </section>
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
      {!mine && !kind && !q && <SuggestedSpaces />}
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
