'use client';

import { use, useState } from 'react';
import { Building2, CalendarClock, CheckCircle2, ExternalLink, MapPin, Send, Users, XCircle } from 'lucide-react';
import { get, patch, post, del } from '@/lib/api/client';
import { invalidate, useAction, useQuery, type Page } from '@/lib/api/hooks';
import type { OpportunityView } from '@/lib/api/types';
import type { ApplicantView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/fields';
import { Card, MetaLine, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { KIND_LABEL, STAGE_LABEL } from '@/components/opportunities/opportunity-ui';
import { ago, deadline, longDate } from '@/lib/live-time';

function Applicants({ id }: { id: string }) {
  const toast = useToast();
  const list = useQuery<Page<ApplicantView>>(`opps:applicants:${id}`, (signal) => get(`/opportunities/${id}/applicants`, { limit: 50 }, signal));
  const move = useAction(async (applicationId: string, stage: string) => {
    await patch(`/applications/${applicationId}`, { stage });
    list.setData((d) => (d ? { ...d, items: d.items.map((a) => (a.id === applicationId ? { ...a, stage } : a)) } : d));
    toast('Updated. They have been notified.');
  });
  if (list.loading) return <SkeletonList variant="row" count={3} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const items = list.data?.items ?? [];
  if (!items.length) return <p className="text-[14px] text-text-3">No applications yet.</p>;
  return (
    <Stagger className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((a) => (
        <StaggerItem key={a.id}>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <PersonAvatar person={a.person} size="sm" link />
            <div className="min-w-0 flex-1">
              <PersonName person={a.person} />
              <p className="truncate text-[13px] text-text-3">{[a.person.department, a.person.year ? `Year ${a.person.year}` : null, `applied ${ago(a.appliedAt)}`].filter(Boolean).join(' · ')}</p>
              {a.note && <p className="mt-1 text-[13px] text-text-2">“{a.note}”</p>}
            </div>
            <Select aria-label={`Stage for ${a.person.displayName}`} value={a.stage} onChange={(e) => void move.run(a.id, e.target.value)} className="h-10 w-40 text-[14px]" disabled={a.stage === 'withdrawn'}>
              {Object.entries(STAGE_LABEL).filter(([k]) => k !== 'withdrawn' || a.stage === 'withdrawn').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
        </StaggerItem>
      ))}
      {move.error && <FormAlert className="m-3">{move.error.message}</FormAlert>}
    </Stagger>
  );
}

export default function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const q = useQuery<OpportunityView>(`opps:one:${id}`, (signal) => get(`/opportunities/${id}`, undefined, signal));
  const [note, setNote] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const apply = useAction(async () => {
    const res = await post<{ id: string; stage: string; applyUrl: string | null }>(`/opportunities/${id}/apply`, { note: note.trim() || undefined });
    q.setData((o) => (o ? { ...o, myApplication: { id: res.id, stage: res.stage, updatedAt: new Date().toISOString() } } : o));
    invalidate('opps:');
    toast(res.applyUrl ? 'Recorded. Finish your application on the organiser’s site.' : 'Application sent.');
    if (res.applyUrl) window.open(res.applyUrl, '_blank', 'noopener,noreferrer');
  });
  const withdraw = useAction(async () => {
    const app = q.data?.myApplication;
    if (!app) return;
    await patch(`/applications/${app.id}`, { stage: 'withdrawn' });
    q.setData((o) => (o && o.myApplication ? { ...o, myApplication: { ...o.myApplication, stage: 'withdrawn' } } : o));
    invalidate('opps:');
  });
  const close = useAction(async () => {
    await del(`/opportunities/${id}`);
    setConfirmClose(false);
    q.reload();
    invalidate('opps:');
  });

  const o = q.data;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Opportunity" back backHref="/opportunities" />
      {q.loading && <SkeletonList variant="card" count={2} />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {o && (
        <Reveal className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[22px] font-bold leading-tight">{o.title}</h2>
                <p className="mt-0.5 text-[15px] text-text-2">{o.orgName}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{KIND_LABEL[o.kind] ?? o.kind}</Badge>
                  {!o.open && <Badge tone="danger">Closed</Badge>}
                  {o.status === 'pending' && <Badge tone="warning">Waiting for review</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <MetaLine icon={MapPin}>{o.mode === 'remote' ? 'Remote' : `${o.location}${o.mode === 'hybrid' ? ' (hybrid)' : ''}`}</MetaLine>
              <MetaLine icon={CalendarClock}>Apply by {longDate(o.deadline)} · {deadline(o.deadline)}</MetaLine>
              {o.payText && <MetaLine icon={CheckCircle2}>{o.payText}</MetaLine>}
              {o.canManage && typeof o.applicantsCount === 'number' && <MetaLine icon={Users}>{o.applicantsCount} applied</MetaLine>}
            </div>
            {o.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {o.skills.map((s) => (
                  <span key={s} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] text-text-2">{s}</span>
                ))}
              </div>
            )}
            {o.description && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{o.description}</p>}
            {o.postedBy && (
              <p className="mt-4 flex items-center gap-2 text-[13px] text-text-3">
                <PersonAvatar person={o.postedBy} size="xs" /> Posted by <PersonName person={o.postedBy} className="text-text-2" />
              </p>
            )}
          </Card>

          {!o.canManage && (
            <section aria-label="Apply">
              {o.myApplication && o.myApplication.stage !== 'withdrawn' ? (
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">You applied</p>
                    <p className="text-[13px] text-text-3">Current stage: {STAGE_LABEL[o.myApplication.stage]?.label ?? o.myApplication.stage}. You will be notified when it changes.</p>
                  </div>
                  {o.applyUrl && (
                    <a href={o.applyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[14px] font-semibold">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" /> Organiser’s site
                    </a>
                  )}
                  {!['offer', 'rejected'].includes(o.myApplication.stage) && (
                    <Button size="sm" variant="ghost" onClick={() => void withdraw.run()} disabled={withdraw.pending}>
                      <XCircle className="h-4 w-4" aria-hidden="true" /> Withdraw
                    </Button>
                  )}
                </Card>
              ) : !o.open ? (
                <FormAlert tone="info">Applications for this one are closed.</FormAlert>
              ) : !o.eligibility.eligible ? (
                <FormAlert tone="info">You cannot apply: {o.eligibility.reasons.join(' ')}</FormAlert>
              ) : (
                <Card className="space-y-3 p-4">
                  <Field label="A short note (optional)" htmlFor="apply-note" hint="Why you are interested, or a link to your work">
                    <Textarea id="apply-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
                  </Field>
                  {apply.error && <FormAlert>{apply.error.message}</FormAlert>}
                  <Button full onClick={() => void apply.run()} disabled={apply.pending} aria-busy={apply.pending}>
                    {apply.pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    {o.applyUrl ? 'Apply on the organiser’s site' : o.myApplication ? 'Apply again' : 'Apply'}
                  </Button>
                </Card>
              )}
              {withdraw.error && <FormAlert className="mt-3">{withdraw.error.message}</FormAlert>}
            </section>
          )}

          {o.canManage && (
            <section aria-label="Applicants">
              <SectionHeader title="Applicants" description="Moving someone to a new stage notifies them." />
              <Applicants id={o.id} />
              {o.status !== 'closed' && (
                <Button variant="danger" className="mt-4" onClick={() => setConfirmClose(true)}>
                  Close this opportunity
                </Button>
              )}
            </section>
          )}
        </Reveal>
      )}
      <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} onConfirm={() => void close.run()} title="Close this opportunity?" description="It stops taking applications and moves to Closed. Applicants keep their status." confirmLabel="Close it" danger pending={close.pending} error={close.error?.message} />
    </div>
  );
}
