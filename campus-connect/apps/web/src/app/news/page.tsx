'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Archive, Megaphone, Pin, Plus, Search } from 'lucide-react';
import { del, get, patch, post, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { AnnouncementView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Reveal } from '@/components/motion';
import { useSession } from '@/lib/session';
import { can } from '@/lib/roles';
import { ago, longDate } from '@/lib/live-time';
import { cn } from '@/lib/utils';

const CATEGORY: Record<AnnouncementView['category'], { label: string; tone: 'danger' | 'info' | 'accent' | 'success' | 'warning' | 'neutral' }> = {
  important: { label: 'Important', tone: 'danger' },
  notice: { label: 'Notice', tone: 'info' },
  results: { label: 'Results', tone: 'success' },
  event: { label: 'Event', tone: 'accent' },
  news: { label: 'News', tone: 'neutral' },
  club: { label: 'Club', tone: 'warning' },
};

function NoticeCard({ a, onChange, manage }: { a: AnnouncementView; onChange: (next: AnnouncementView | null) => void; manage: boolean }) {
  const [open, setOpen] = useState(false);
  const archive = useAction(async () => {
    await del(`/announcements/${a.id}`);
    onChange(null);
  });
  const publish = useAction(async () => {
    await patch(`/announcements/${a.id}`, { status: 'published' });
    onChange({ ...a, status: 'published' });
  });
  const long = a.body.length > 280;
  return (
    <article className={cn('rounded-2xl border bg-surface p-4 shadow-card', a.pinned ? 'border-accent/40' : 'border-border')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CATEGORY[a.category].tone}>{CATEGORY[a.category].label}</Badge>
        {a.pinned && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent"><Pin className="h-3.5 w-3.5" aria-hidden="true" />Pinned</span>}
        {a.status !== 'published' && <Badge tone="warning">{a.status === 'draft' ? 'Draft' : 'Archived'}</Badge>}
        <span className="ml-auto text-[12px] text-text-3">{ago(a.publishedAt)}</span>
      </div>
      <h3 className="mt-2 text-[17px] font-semibold leading-snug">{a.title}</h3>
      <p className={cn('mt-1.5 whitespace-pre-wrap text-[15px] text-text-2', !open && long && 'line-clamp-4')}>{a.body}</p>
      {long && <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[13px] font-semibold text-accent">{open ? 'Show less' : 'Read more'}</button>}
      <p className="mt-2 text-[12px] text-text-3">{a.authorLabel} · {longDate(a.publishedAt)}{a.audience.scope === 'department' ? ' · your department' : a.audience.scope === 'year' ? ` · year ${a.audience.year}` : ''}</p>
      {manage && (a.isMine || a.status !== 'archived') && (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.status === 'draft' && <Button size="sm" onClick={() => void publish.run()} disabled={publish.pending}>Publish and notify</Button>}
          {a.status !== 'archived' && (
            <Button size="sm" variant="ghost" onClick={() => void archive.run()} disabled={archive.pending}>
              <Archive className="h-4 w-4" aria-hidden="true" /> Archive
            </Button>
          )}
        </div>
      )}
      {(archive.error || publish.error) && <FormAlert className="mt-2">{(archive.error ?? publish.error)!.message}</FormAlert>}
    </article>
  );
}

function ComposeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { user } = useSession();
  const slug = user?.college.slug;
  const departments = useQuery<{ items: Array<{ id: string; name: string }> }>(open && slug ? `meta:departments:${slug}` : null, (signal) => get(`/meta/colleges/${slug}/departments`, undefined, signal));
  const [form, setForm] = useState({ title: '', body: '', category: 'notice', scope: 'college', departmentId: user?.profile.departmentId ?? '', year: '1', authorLabel: '' });
  const [pinned, setPinned] = useState(false);
  const [notify, setNotify] = useState(true);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const send = useAction(async (status: 'published' | 'draft') => {
    const audience = form.scope === 'department' ? { scope: 'department', departmentId: form.departmentId } : form.scope === 'year' ? { scope: 'year', year: Number(form.year) } : { scope: 'college' };
    const res = await post<{ id: string; notified: number }>('/announcements', { title: form.title.trim(), body: form.body.trim(), category: form.category, audience, pinned, notify, status, authorLabel: form.authorLabel.trim() || undefined });
    toast(status === 'draft' ? 'Saved as a draft' : `Published${res.notified ? ` · ${res.notified} people notified` : ''}`);
    invalidate('news:');
    onClose();
  });
  const ready = form.title.trim().length >= 3 && form.body.trim().length >= 1 && (form.scope !== 'department' || form.departmentId);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Publish a notice"
      description="It appears on the notice board, and the people it is for are notified."
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void send.run('draft')} disabled={!ready || send.pending}>Save draft</Button>
          <Button full onClick={() => void send.run('published')} disabled={!ready || send.pending} aria-busy={send.pending}>
            {send.pending ? <Spinner /> : <Megaphone className="h-4 w-4" aria-hidden="true" />} Publish
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Title" htmlFor="n-title">
          <Input id="n-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} />
        </Field>
        <Field label="Message" htmlFor="n-body">
          <Textarea id="n-body" value={form.body} onChange={(e) => set('body', e.target.value)} maxLength={5000} rows={6} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="n-cat">
            <Select id="n-cat" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {Object.entries(CATEGORY).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="For" htmlFor="n-scope">
            <Select id="n-scope" value={form.scope} onChange={(e) => set('scope', e.target.value)}>
              <option value="college">Everyone</option>
              <option value="department">One department</option>
              <option value="year">One year</option>
            </Select>
          </Field>
        </div>
        {form.scope === 'department' && (
          <Field label="Department" htmlFor="n-dept">
            <Select id="n-dept" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">Choose</option>
              {departments.data?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        {form.scope === 'year' && (
          <Field label="Year" htmlFor="n-year">
            <Select id="n-year" value={form.year} onChange={(e) => set('year', e.target.value)}>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Signed as (optional)" htmlFor="n-label" hint="For example: Department of Computer Engineering">
          <Input id="n-label" value={form.authorLabel} onChange={(e) => set('authorLabel', e.target.value)} maxLength={120} placeholder={user?.profile.displayName} />
        </Field>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <Switch checked={pinned} onChange={setPinned} label="Pin to the top" />
          <Switch checked={notify} onChange={setNotify} label="Notify people" description="Sends an in-app notification to everyone it is for" />
        </div>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

function NewsInner() {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get('category');
  const q = params.get('q') ?? '';
  const view = (params.get('view') as 'board' | 'mine') ?? 'board';
  const [search, setSearch] = useState(q);
  const [composing, setComposing] = useState(params.get('compose') === '1');
  const go = (next: Record<string, string | null>) => router.push(withQuery(pathname, { category, q: q || null, view: view === 'board' ? null : view, ...next }), { scroll: false });
  const manage = can(user, 'news.publish');
  const list = useInfinite<AnnouncementView>(`news:list:${category}:${q}:${view}`, (cursor, signal) => get<Page<AnnouncementView>>('/announcements', { category: category ?? undefined, q: q || undefined, mine: view === 'mine' ? 'true' : undefined, cursor: cursor ?? undefined, limit: 15 }, signal));
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Notices & news"
        subtitle="From your college, department and teachers"
        back
        backHref="/campus"
        actions={
          manage && (
            <Button size="sm" onClick={() => setComposing(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Notice
            </Button>
          )
        }
      />
      <Reveal className="space-y-3">
        {manage && <Segmented label="Notice views" value={view} onChange={(v) => go({ view: v === 'board' ? null : v })} options={[{ value: 'board', label: 'Notice board' }, { value: 'mine', label: 'Published by me' }]} />}
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notices" className="pl-10" aria-label="Search notices" enterKeyHint="search" />
        </form>
        <ChipRow>
          <Chip active={!category} onClick={() => go({ category: null })}>All</Chip>
          {Object.entries(CATEGORY).map(([v, c]) => (
            <Chip key={v} active={category === v} onClick={() => go({ category: v })}>{c.label}</Chip>
          ))}
        </ChipRow>
      </Reveal>
      <div className="mt-4">
        <InfiniteList
          state={list}
          className="space-y-3"
          empty={{ icon: Megaphone, title: 'No notices here', description: 'Official notices from your college show up here.' }}
          endMessage="You’re all caught up"
          render={(a) => <NoticeCard a={a} manage={manage} onChange={(next) => list.setItems((items) => (next ? items.map((x) => (x.id === a.id ? next : x)) : items.filter((x) => x.id !== a.id)))} />}
        />
      </div>
      <ComposeSheet open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={<SkeletonList count={3} className="mx-auto mt-24 max-w-3xl px-4" />}>
      <NewsInner />
    </Suspense>
  );
}
