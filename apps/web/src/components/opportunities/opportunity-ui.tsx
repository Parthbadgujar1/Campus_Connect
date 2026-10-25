'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookmarkCheck, Bookmark, Building2, CalendarClock, CheckCircle2, MapPin, Plus } from 'lucide-react';
import { del, get, post, put } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { OpportunityView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Pressable } from '@/components/motion';
import { deadline, daysLeft } from '@/lib/live-time';
import { cn } from '@/lib/utils';

export const KIND_LABEL: Record<string, string> = {
  internship: 'Internship',
  job: 'Job',
  part_time: 'Part-time',
  freelance: 'Freelance',
  hackathon: 'Hackathon',
  competition: 'Competition',
  scholarship: 'Scholarship',
  research: 'Research',
  workshop: 'Mentorship / workshop',
  certification: 'Certification',
  open_source: 'Open source',
  startup: 'Startup',
  ambassador: 'Ambassador',
  volunteering: 'Volunteering',
};

export const STAGE_LABEL: Record<string, { label: string; tone: 'neutral' | 'info' | 'accent' | 'success' | 'danger' | 'warning' }> = {
  applied: { label: 'Applied', tone: 'info' },
  shortlisted: { label: 'Shortlisted', tone: 'accent' },
  interview: { label: 'Interview', tone: 'warning' },
  offer: { label: 'Offer', tone: 'success' },
  rejected: { label: 'Not selected', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export function OpportunityCard({ o, onChange }: { o: OpportunityView; onChange: (o: OpportunityView) => void }) {
  const days = daysLeft(o.deadline);
  const save = useAction(async () => {
    onChange({ ...o, saved: !o.saved });
    await (o.saved ? del(`/saved/opportunity/${o.id}`) : put(`/saved/opportunity/${o.id}`));
  });
  return (
    <Pressable>
      <article className="relative rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/40">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <Link href={`/opportunities/${o.id}`} className="block font-semibold leading-snug after:absolute after:inset-0">
              {o.title}
            </Link>
            <p className="mt-0.5 text-[13px] text-text-3">{o.orgName} · {KIND_LABEL[o.kind] ?? o.kind}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-2">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{o.mode === 'remote' ? 'Remote' : o.location}</span>
              {o.payText && <span>{o.payText}</span>}
              <span className={cn('inline-flex items-center gap-1 font-semibold', days <= 3 && days >= 0 ? 'text-warning' : '')}>
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{deadline(o.deadline)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {o.myApplication && <Badge tone={STAGE_LABEL[o.myApplication.stage]?.tone ?? 'info'}>{STAGE_LABEL[o.myApplication.stage]?.label ?? o.myApplication.stage}</Badge>}
              {!o.eligibility.eligible && <Badge tone="warning">{o.eligibility.reasons[0]}</Badge>}
              {o.status === 'pending' && <Badge tone="warning">Waiting for review</Badge>}
              {o.skills.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-text-2">{s}</span>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => void save.run()} aria-pressed={o.saved} aria-label={o.saved ? 'Remove from saved' : 'Save'} className="relative z-10 -mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-2 hover:bg-surface-2">
            {o.saved ? <BookmarkCheck className="h-5 w-5 text-accent" aria-hidden="true" /> : <Bookmark className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </article>
    </Pressable>
  );
}

const MODES = [
  { value: 'onsite', label: 'On campus / onsite' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
];

/** Post an opportunity (students' posts are reviewed first; staff and experts publish at once). */
export function PostOpportunitySheet({ open, onClose, defaultKind = 'internship' }: { open: boolean; onClose: () => void; defaultKind?: string }) {
  const toast = useToast();
  const { user } = useSession();
  const slug = user?.college.slug;
  const departments = useQuery<{ items: Array<{ id: string; name: string }> }>(open && slug ? `meta:departments:${slug}` : null, (signal) => get(`/meta/colleges/${slug}/departments`, undefined, signal));
  const [form, setForm] = useState({ orgName: '', title: '', kind: defaultKind, mode: 'onsite', location: '', payText: '', deadline: '', minYear: '1', skills: '', description: '', applyUrl: '' });
  const [depts, setDepts] = useState<string[]>([]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const send = useAction(async () => {
    const res = await post<{ status: string; message: string }>('/opportunities', {
      orgName: form.orgName.trim(),
      title: form.title.trim(),
      kind: form.kind,
      mode: form.mode,
      location: form.location.trim() || (form.mode === 'remote' ? 'Remote' : ''),
      payText: form.payText.trim() || undefined,
      deadline: new Date(`${form.deadline}T23:59:00`).toISOString(),
      minYear: Number(form.minYear),
      eligibleDepartmentIds: depts,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
      description: form.description.trim() || undefined,
      applyUrl: form.applyUrl.trim() || undefined,
    });
    toast(res.message);
    invalidate('opps:');
    onClose();
  });
  const fields = send.error && 'fields' in send.error ? (send.error as { fields: Record<string, string> }).fields : {};
  const ready = form.orgName.trim().length >= 2 && form.title.trim().length >= 3 && form.deadline && (form.mode === 'remote' || form.location.trim().length >= 2);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Post an opportunity"
      description="Internships, jobs, hackathons, scholarships… Student posts are checked by a moderator first."
      footer={
        <Button full onClick={() => void send.run()} disabled={!ready || send.pending} aria-busy={send.pending}>
          {send.pending ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden="true" />} Post
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Organisation" htmlFor="o-org" hint={fields.orgName}>
            <Input id="o-org" value={form.orgName} onChange={(e) => set('orgName', e.target.value)} maxLength={120} />
          </Field>
          <Field label="Type" htmlFor="o-kind">
            <Select id="o-kind" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Title" htmlFor="o-title" hint={fields.title}>
          <Input id="o-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} placeholder="Frontend intern, Smart India Hackathon…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Where" htmlFor="o-mode">
            <Select id="o-mode" value={form.mode} onChange={(e) => set('mode', e.target.value)}>
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="City / place" htmlFor="o-loc" hint={fields.location}>
            <Input id="o-loc" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={120} placeholder={form.mode === 'remote' ? 'Remote' : 'Pune'} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Last date to apply" htmlFor="o-deadline" hint={fields.deadline}>
            <Input id="o-deadline" type="date" value={form.deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set('deadline', e.target.value)} />
          </Field>
          <Field label="Pay or prize (optional)" htmlFor="o-pay">
            <Input id="o-pay" value={form.payText} onChange={(e) => set('payText', e.target.value)} maxLength={80} placeholder="₹20,000 / month" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Open from year" htmlFor="o-year">
            <Select id="o-year" value={form.minYear} onChange={(e) => set('minYear', e.target.value)}>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y === 1 ? 'Any year' : `Year ${y} and above`}</option>)}
            </Select>
          </Field>
          <Field label="Skills (comma separated)" htmlFor="o-skills">
            <Input id="o-skills" value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="React, SQL" />
          </Field>
        </div>
        {departments.data && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Departments <span className="font-normal text-text-3">(none = everyone)</span></legend>
            <div className="flex flex-wrap gap-2">
              {departments.data.items.map((d) => {
                const on = depts.includes(d.id);
                return (
                  <button key={d.id} type="button" aria-pressed={on} onClick={() => setDepts((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))} className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold', on ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border bg-surface text-text-2')}>
                    {on && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                    {d.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        <Field label="Details" htmlFor="o-desc">
          <Textarea id="o-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={6000} rows={4} placeholder="What it involves, eligibility, how selection works" />
        </Field>
        <Field label="Apply link (optional)" htmlFor="o-url" hint={fields.applyUrl ?? 'If people apply on another site. Leave empty to collect applications here.'}>
          <Input id="o-url" value={form.applyUrl} onChange={(e) => set('applyUrl', e.target.value)} inputMode="url" placeholder="https://" />
        </Field>
        {send.error && <FormAlert>{send.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

