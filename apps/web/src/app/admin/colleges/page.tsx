'use client';

import { useState } from 'react';
import { Building2, Pause, Pencil, Play, Plus } from 'lucide-react';
import { errorMessage, get, patch, post } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/fields';
import { Card, EmptyState } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/lib/session';
import { day } from '@/lib/live-time';

// Admin → Colleges: the colleges students and faculty can choose when they sign up. Adding one
// makes it appear on the sign-up form straight away; pausing one hides it from new sign-ups
// (people already there keep their accounts).

interface CollegeRow {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  city: string | null;
  state: string | null;
  status: 'active' | 'suspended';
  people: number;
  departments: number;
  createdAt: string;
}

function CollegeSheet({ college, onClose }: { college: CollegeRow | null; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: college?.name ?? '', shortName: college?.shortName ?? '', city: college?.city ?? '', state: college?.state ?? '' });
  const [departments, setDepartments] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useAction(async () => {
    const body = { name: form.name.trim(), shortName: form.shortName.trim(), city: form.city.trim() || null, state: form.state.trim() || null };
    if (college) await patch(`/admin/colleges/${college.id}`, body);
    else await post('/admin/colleges', { ...body, departments: departments.split('\n').map((d) => d.trim()).filter(Boolean) });
    invalidate('admin:colleges', 'meta:colleges');
    toast(college ? 'College updated' : 'College added. It now appears on the sign-up form.');
    onClose();
  });
  const valid = form.name.trim().length >= 3 && form.shortName.trim().length >= 2;
  return (
    <Sheet open onClose={onClose} title={college ? 'Edit college' : 'Add a college'} footer={<Button full disabled={!valid || save.pending} onClick={() => void save.run()}>{save.pending && <Spinner />} {college ? 'Save' : 'Add college'}</Button>}>
      <div className="space-y-4">
        <Field label="Full name" htmlFor="col-name"><Input id="col-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={160} placeholder="Government College of Engineering, Aurangabad" /></Field>
        <Field label="Short name" htmlFor="col-short" hint="Shown in tight spaces, like “GECA”."><Input id="col-short" value={form.shortName} onChange={(e) => set('shortName', e.target.value)} maxLength={40} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" htmlFor="col-city"><Input id="col-city" value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} /></Field>
          <Field label="State" htmlFor="col-state"><Input id="col-state" value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={80} /></Field>
        </div>
        {!college && (
          <Field label="Departments (optional)" htmlFor="col-depts" hint="One per line. Students pick one when they set up their profile.">
            <Textarea id="col-depts" rows={5} value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder={'Computer Engineering\nInformation Technology\nMechanical Engineering'} />
          </Field>
        )}
        {save.error && <FormAlert>{save.error.message}</FormAlert>}
      </div>
    </Sheet>
  );
}

export default function AdminCollegesPage() {
  const toast = useToast();
  const { user } = useSession();
  const list = useQuery<{ items: CollegeRow[] }>('admin:colleges', (signal) => get('/admin/colleges', undefined, signal));
  const [editing, setEditing] = useState<CollegeRow | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (c: CollegeRow) => {
    setBusy(c.id);
    try {
      await patch(`/admin/colleges/${c.id}`, { status: c.status === 'active' ? 'suspended' : 'active' });
      invalidate('admin:colleges', 'meta:colleges');
      toast(c.status === 'active' ? `${c.shortName} is hidden from new sign-ups` : `${c.shortName} is open for sign-ups`);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-text-3">Students and faculty choose one of these when they sign up.</p>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden="true" /> Add college</Button>
      </div>
      {list.loading && <SkeletonList variant="row" count={3} />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && !list.data.items.length && <EmptyState icon={Building2} title="No colleges yet" description="Add the first college so people can sign up." />}
      <div className="grid gap-3 md:grid-cols-2">
        {list.data?.items.map((c) => (
          <Card key={c.id} className="space-y-2 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{c.name}</p>
                <p className="text-[13px] text-text-3">{[c.shortName, c.city, c.state].filter(Boolean).join(' · ')}</p>
              </div>
              <Badge tone={c.status === 'active' ? 'success' : 'warning'}>{c.status === 'active' ? 'Open' : 'Paused'}</Badge>
            </div>
            <p className="text-[13px] text-text-3">{c.people} people · {c.departments} departments · added {day(c.createdAt)}{c.id === user?.college.id ? ' · your college' : ''}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Button>
              {c.id !== user?.college.id && (
                <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => void toggle(c)}>
                  {busy === c.id ? <Spinner /> : c.status === 'active' ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  {c.status === 'active' ? 'Pause sign-ups' : 'Open sign-ups'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      {editing && <CollegeSheet college={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
