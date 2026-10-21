'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, KeyRound, MapPin, MessageCircle, Plus, Search, ShieldQuestion, XCircle } from 'lucide-react';
import { get, patch, post, upload, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { ClaimView, LostFoundView } from '@/lib/api/modules';
import type { FileView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable, Reveal } from '@/components/motion';
import { useSession } from '@/lib/session';
import { ago, dateTime, toLocalInput } from '@/lib/live-time';
import { gradientFor } from '@/lib/visuals';

const CATEGORIES: Record<string, string> = { electronics: 'Electronics', books: 'Books', id_card: 'ID card', keys: 'Keys', clothing: 'Clothing', bag: 'Bag', other: 'Other' };
const STATUS: Record<LostFoundView['status'], { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = { open: { label: 'Open', tone: 'info' }, claim_pending: { label: 'Claimed, checking', tone: 'warning' }, returned: { label: 'Returned', tone: 'success' }, closed: { label: 'Closed', tone: 'neutral' } };

function ItemCard({ it, onOpen }: { it: LostFoundView; onOpen: () => void }) {
  return (
    <Pressable>
      <button type="button" onClick={onOpen} className="flex w-full gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition-colors hover:border-accent/40">
        <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl" style={it.image ? undefined : { background: gradientFor(it.id) }}>
          {it.image?.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.image.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={it.kind === 'lost' ? 'danger' : 'success'}>{it.kind === 'lost' ? 'Lost' : 'Found'}</Badge>
            <Badge tone={STATUS[it.status].tone}>{STATUS[it.status].label}</Badge>
            {it.isMine && it.pendingClaims ? <Badge tone="warning">{it.pendingClaims} claim{it.pendingClaims === 1 ? '' : 's'} to check</Badge> : null}
          </span>
          <span className="mt-1 block truncate font-semibold">{it.title}</span>
          <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-text-3"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{it.location}</span>
          <span className="block text-[12px] text-text-3">{CATEGORIES[it.category]} · {ago(it.occurredAt)}</span>
        </span>
      </button>
    </Pressable>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const item = useQuery<LostFoundView>(`lostfound:one:${id}`, (signal) => get(`/lost-found/${id}`, undefined, signal));
  const claims = useQuery<{ items: ClaimView[] }>(item.data?.isMine && item.data.kind === 'found' ? `lostfound:claims:${id}` : null, (signal) => get(`/lost-found/${id}/claims`, undefined, signal));
  const [answer, setAnswer] = useState('');
  const claim = useAction(async () => {
    await post(`/lost-found/${id}/claims`, { answer: answer.trim() });
    toast('Claim sent to the finder');
    item.reload();
    invalidate('lostfound:list');
  });
  const decide = useAction(async (claimId: string, decision: 'approve' | 'reject') => {
    await post(`/lost-found/claims/${claimId}/decision`, { decision });
    claims.reload();
    item.reload();
    invalidate('lostfound:list');
  });
  const close = useAction(async (status: 'returned' | 'closed' | 'open') => {
    await patch(`/lost-found/${id}`, { status });
    item.reload();
    invalidate('lostfound:list');
  });
  const message = useAction(async () => {
    const r = await post<{ chatId: string }>('/chats/direct', { userId: item.data!.reporter.id });
    router.push(`/chats/${r.chatId}`);
  });
  const it = item.data;
  return (
    <Sheet open onClose={onClose} title={it?.title ?? 'Item'} description={it ? `${it.kind === 'lost' ? 'Lost' : 'Found'} · ${it.location}` : undefined}>
      {item.loading && <SkeletonList variant="card" count={1} />}
      {item.error && <ErrorState error={item.error} onRetry={item.reload} />}
      {it && (
        <div className="space-y-4">
          {it.image?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.image.url} alt={it.title} className="max-h-72 w-full rounded-2xl object-cover" />
          )}
          <div className="flex flex-wrap gap-1.5"><Badge tone={STATUS[it.status].tone}>{STATUS[it.status].label}</Badge><Badge>{CATEGORIES[it.category]}</Badge></div>
          <p className="text-[14px] text-text-2">{it.kind === 'lost' ? 'Lost' : 'Found'} {dateTime(it.occurredAt)} at {it.location}</p>
          {it.description && <p className="whitespace-pre-wrap text-[15px]">{it.description}</p>}
          <div className="flex items-center gap-2 text-[14px]"><PersonAvatar person={it.reporter} size="xs" /> Reported by <PersonName person={it.reporter} /></div>

          {!it.isMine && it.kind === 'found' && ['open', 'claim_pending'].includes(it.status) && (
            it.myClaim === 'pending' ? (
              <FormAlert tone="info">You claimed this. The finder will check your answer and get back to you.</FormAlert>
            ) : it.myClaim === 'approved' ? (
              <FormAlert tone="success">Your claim was approved. Message the finder to collect it.</FormAlert>
            ) : (
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <p className="flex items-center gap-2 font-semibold"><ShieldQuestion className="h-5 w-5 text-accent" aria-hidden="true" />Is this yours?</p>
                {it.verificationQuestion && <p className="text-[14px] text-text-2">The finder asks: <strong>{it.verificationQuestion}</strong></p>}
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} maxLength={500} placeholder="Only the finder sees your answer" aria-label="Your answer" />
                {claim.error && <FormAlert>{claim.error.message}</FormAlert>}
                <Button full onClick={() => void claim.run()} disabled={answer.trim().length < 3 || claim.pending}>{claim.pending ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden="true" />} Claim it</Button>
              </div>
            )
          )}
          {!it.isMine && (
            <Button variant="secondary" full onClick={() => void message.run()} disabled={message.pending}><MessageCircle className="h-4 w-4" aria-hidden="true" /> Message {it.reporter.displayName.split(' ')[0]}</Button>
          )}

          {it.isMine && it.kind === 'found' && (
            <div className="space-y-2">
              <p className="font-semibold">Claims</p>
              {claims.loading && <SkeletonList variant="row" count={1} />}
              {claims.data && !claims.data.items.length && <p className="text-[14px] text-text-3">No claims yet.</p>}
              {claims.data?.items.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border p-3">
                  <div className="flex items-center gap-2"><PersonAvatar person={c.claimant} size="xs" /><PersonName person={c.claimant} /><span className="ml-auto text-[12px] text-text-3">{ago(c.createdAt)}</span></div>
                  <p className="mt-2 text-[15px]">“{c.answer}”</p>
                  {c.status === 'pending' ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => void decide.run(c.id, 'approve')} disabled={decide.pending}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> It’s theirs</Button>
                      <Button size="sm" variant="ghost" onClick={() => void decide.run(c.id, 'reject')} disabled={decide.pending}><XCircle className="h-4 w-4" aria-hidden="true" /> Not a match</Button>
                    </div>
                  ) : (
                    <Badge tone={c.status === 'approved' ? 'success' : 'neutral'} className="mt-2">{c.status === 'approved' ? 'Approved' : c.status === 'rejected' ? 'Declined' : 'Withdrawn'}</Badge>
                  )}
                </div>
              ))}
              {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
            </div>
          )}
          {it.isMine && (
            <div className="flex flex-wrap gap-2">
              {it.status !== 'returned' && <Button variant="secondary" onClick={() => void close.run('returned')} disabled={close.pending}>{it.kind === 'lost' ? 'I got it back' : 'Returned to owner'}</Button>}
              {it.status !== 'closed' && <Button variant="ghost" onClick={() => void close.run('closed')} disabled={close.pending}>Close report</Button>}
              {(it.status === 'closed' || it.status === 'returned') && <Button variant="ghost" onClick={() => void close.run('open')} disabled={close.pending}>Reopen</Button>}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ReportItem({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ kind: 'lost', title: '', category: 'electronics', location: '', occurredAt: toLocalInput(new Date()), description: '', verificationQuestion: '' });
  const [image, setImage] = useState<FileView | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const pick = useAction(async (f: File) => setImage(await upload<FileView>('lost_found', f)));
  const send = useAction(async () => {
    await post('/lost-found', { ...form, title: form.title.trim(), location: form.location.trim(), occurredAt: new Date(form.occurredAt).toISOString(), description: form.description.trim() || undefined, verificationQuestion: form.kind === 'found' ? form.verificationQuestion.trim() || undefined : undefined, imageFileId: image?.id });
    toast('Posted to the board');
    invalidate('lostfound:');
    onClose();
  });
  const ready = form.title.trim().length >= 3 && form.location.trim().length >= 2;
  return (
    <Sheet open={open} onClose={onClose} title="Report an item" footer={<Button full onClick={() => void send.run()} disabled={!ready || send.pending}>{send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Post</Button>}>
      <div className="space-y-4">
        <Segmented label="Lost or found" value={form.kind} onChange={(v) => set('kind', v)} options={[{ value: 'lost', label: 'I lost something' }, { value: 'found', label: 'I found something' }]} />
        <Field label="What is it?" htmlFor="lf-title"><Input id="lf-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} placeholder="Black earbuds case" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="lf-cat"><Select id="lf-cat" value={form.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="When" htmlFor="lf-when"><Input id="lf-when" type="datetime-local" value={form.occurredAt} max={toLocalInput(new Date())} onChange={(e) => set('occurredAt', e.target.value)} /></Field>
        </div>
        <Field label="Where" htmlFor="lf-where"><Input id="lf-where" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={160} placeholder="Canteen, near the window seats" /></Field>
        <Field label="Details (optional)" htmlFor="lf-desc"><Textarea id="lf-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} rows={3} /></Field>
        {form.kind === 'found' && (
          <Field label="A question only the owner can answer" htmlFor="lf-q" hint="For example: what sticker is on it? Claims must answer it; only you see the answers.">
            <Input id="lf-q" value={form.verificationQuestion} onChange={(e) => set('verificationQuestion', e.target.value)} maxLength={200} />
          </Field>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick.run(f); e.target.value = ''; }} />
        <Button variant="secondary" full onClick={() => input.current?.click()} disabled={pick.pending}>{pick.pending ? <Spinner /> : image ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}{image ? 'Photo added' : 'Add a photo (optional)'}</Button>
        {(pick.error || send.error) && <FormAlert>{(pick.error ?? send.error)!.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

function LostFoundInner() {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const include = (params.get('include') as 'open' | 'resolved' | 'mine') || 'open';
  const kind = params.get('kind');
  const category = params.get('category');
  const q = params.get('q') ?? '';
  const open = params.get('id');
  const [search, setSearch] = useState(q);
  const [reporting, setReporting] = useState(false);
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { include: include === 'open' ? null : include, kind, category, q: q || null, id: open, ...next }), { scroll: false });
  const list = useInfinite<LostFoundView>(`lostfound:list:${include}:${kind}:${category}:${q}`, (cursor, signal) => get<Page<LostFoundView>>('/lost-found', { include, kind: kind ?? undefined, category: category ?? undefined, q: q || undefined, cursor: cursor ?? undefined, limit: 15 }, signal));
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Lost & found" subtitle={`On ${user?.college.shortName ?? 'campus'}`} back backHref="/campus" actions={<Button size="sm" onClick={() => setReporting(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Report</Button>} />
      <Reveal className="space-y-3">
        <Segmented label="Which items" value={include} onChange={(v) => go({ include: v === 'open' ? null : v })} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'mine', label: 'My reports' }]} />
        <form className="relative" onSubmit={(e) => { e.preventDefault(); go({ q: search.trim() || null }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items or places" className="pl-10" aria-label="Search lost and found" enterKeyHint="search" />
        </form>
        <ChipRow>
          <Chip active={!kind} onClick={() => go({ kind: null })}>Lost and found</Chip>
          <Chip active={kind === 'lost'} onClick={() => go({ kind: 'lost' })}>Lost</Chip>
          <Chip active={kind === 'found'} onClick={() => go({ kind: 'found' })}>Found</Chip>
          {Object.entries(CATEGORIES).map(([v, l]) => <Chip key={v} active={category === v} onClick={() => go({ category: category === v ? null : v })}>{l}</Chip>)}
        </ChipRow>
      </Reveal>
      <div className="mt-4">
        <InfiniteList state={list} skeleton="row" className="space-y-3" empty={{ icon: Search, title: 'Nothing on the board', description: 'Lost something, or found it? Post it so it finds its way home.' }} endMessage="That’s every item on the board" render={(it) => <ItemCard it={it} onOpen={() => go({ id: it.id })} />} />
      </div>
      {open && <Detail id={open} onClose={() => go({ id: null })} />}
      <ReportItem open={reporting} onClose={() => setReporting(false)} />
    </div>
  );
}

export default function LostFoundPage() {
  return (
    <Suspense fallback={<SkeletonList variant="row" count={4} className="mx-auto mt-24 max-w-3xl px-4" />}>
      <LostFoundInner />
    </Suspense>
  );
}
