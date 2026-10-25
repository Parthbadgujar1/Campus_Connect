'use client';

import { useRef, useState } from 'react';
import { BadgeCheck, CheckCircle2, Clock, FileUp, GraduationCap, Mail, ShieldCheck, XCircle } from 'lucide-react';
import { get, post, upload } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { FileView } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { useSession } from '@/lib/session';
import { ROLE_LABEL } from '@/lib/roles';
import { ago } from '@/lib/live-time';

interface RequestRow {
  id: string;
  kind: 'student_id' | 'faculty_role' | 'expert_role';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  note: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<RequestRow['kind'], string> = { student_id: 'Verified badge (ID card)', faculty_role: 'Faculty access', expert_role: 'Expert access' };

export default function VerifyPage() {
  const { user, refresh } = useSession();
  const toast = useToast();
  const requests = useQuery<{ items: RequestRow[] }>('verify:mine', (signal) => get('/me/verification-requests', undefined, signal));
  const [file, setFile] = useState<FileView | null>(null);
  const [note, setNote] = useState('');
  const input = useRef<HTMLInputElement | null>(null);

  const pick = useAction(async (f: File) => setFile(await upload<FileView>('verification', f)));
  const send = useAction(async () => {
    await post('/me/verification-requests', { kind: 'student_id', fileId: file?.id, note: note.trim() || undefined });
    toast('Sent for review. You will get a notification when it is decided.');
    setFile(null);
    setNote('');
    invalidate('verify:');
    void refresh();
  });

  const items = requests.data?.items ?? [];
  const pendingBadge = items.some((r) => r.kind === 'student_id' && r.status === 'pending');
  const verified = Boolean(user?.profile.isVerified);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Role & verification" back backHref="/settings" subtitle="Who you are on CampusConnect" />

      <Reveal>
        <Card className="mt-4 flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${verified ? 'bg-success-soft text-success' : 'bg-surface-2 text-text-2'}`}>
            {verified ? <ShieldCheck className="h-7 w-7" aria-hidden="true" /> : <GraduationCap className="h-7 w-7" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {user?.profile.displayName}
              {user && <Badge tone="accent">{ROLE_LABEL[user.role]}</Badge>}
              {verified && <Badge tone="success" icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}>Verified</Badge>}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-3">
              <Mail className="h-4 w-4" aria-hidden="true" /> {user?.email} (email confirmed)
            </p>
            {user?.pendingRole && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-info">
                <Clock className="h-4 w-4" aria-hidden="true" /> Your {user.pendingRole} access is waiting for an admin.
              </p>
            )}
          </div>
        </Card>
      </Reveal>

      {!verified && (
        <section className="mt-8" aria-label="Get verified">
          <SectionHeader title="Get the verified badge" description="Upload a photo of an ID card. Only the admin office sees it, and it is deleted with your account." />
          {pendingBadge ? (
            <FormAlert tone="info">Your ID card is being reviewed, usually within a day.</FormAlert>
          ) : (
            <Card className="space-y-4 p-4">
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick.run(f); e.target.value = ''; }} />
              <Button variant="secondary" onClick={() => input.current?.click()} disabled={pick.pending}>
                {pick.pending ? <Spinner /> : <FileUp className="h-4 w-4" aria-hidden="true" />}
                {file ? `Chosen: ${file.name}` : pick.pending ? 'Uploading…' : 'Choose a photo or PDF'}
              </Button>
              {pick.error && <FormAlert>{pick.error.message}</FormAlert>}
              <Field label="Note for the reviewer (optional)" htmlFor="verify-note">
                <Textarea id="verify-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="For example: second year, Civil, division A" />
              </Field>
              {send.error && <FormAlert>{send.error.message}</FormAlert>}
              <Button onClick={() => void send.run()} disabled={!file || send.pending} aria-busy={send.pending}>
                {send.pending && <Spinner />} Send for review
              </Button>
            </Card>
          )}
        </section>
      )}

      <section className="mt-8" aria-label="My requests">
        <SectionHeader title="My requests" />
        {requests.loading && <SkeletonList variant="row" count={2} />}
        {requests.error && <ErrorState error={requests.error} onRetry={requests.reload} />}
        {!requests.loading && !requests.error && !items.length && <p className="text-[14px] text-text-3">No requests yet.</p>}
        <Stagger className="space-y-3">
          {items.map((r) => (
            <StaggerItem key={r.id}>
              <Card className="flex items-start gap-3 p-4">
                {r.status === 'approved' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" /> : r.status === 'rejected' ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" /> : <Clock className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{KIND_LABEL[r.kind]}</p>
                  <p className="text-[13px] text-text-3">
                    {r.status === 'pending' ? 'Waiting for review' : r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Not approved' : 'Cancelled'} · asked {ago(r.createdAt)}
                  </p>
                  {r.reviewerNote && <p className="mt-1.5 text-[14px] text-text-2">“{r.reviewerNote}”</p>}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
