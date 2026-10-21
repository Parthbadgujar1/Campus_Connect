'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { BadgeCheck, Ban, Check, ExternalLink, FileText, Search, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import { get, patch, post, withQuery } from '@/lib/api/client';
import { invalidate, useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import type { ApiRole, PersonSummary } from '@/lib/api/types';
import type { AdminUserRow, VerificationRow } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { RoleInfoList } from '@/components/admin/admin-ui';
import { useSession } from '@/lib/session';
import { ROLE_LABEL } from '@/lib/roles';
import { ago, day } from '@/lib/live-time';
import { cn } from '@/lib/utils';

const ROLES: ApiRole[] = ['student', 'faculty', 'expert', 'moderator', 'admin'];
const KIND_LABEL: Record<VerificationRow['kind'], string> = { student_id: 'Student ID check', faculty_role: 'Faculty access', expert_role: 'Expert access' };

interface UserDetail {
  person: PersonSummary;
  email: string;
  role: ApiRole;
  pendingRole: 'faculty' | 'expert' | null;
  roleInfo: Record<string, string | number | null>;
  status: string;
  emailVerifiedAt: string | null;
  joinedAt: string;
  lastSignInAt: string | null;
  deletionScheduledFor: string | null;
  counts: { posts: number; reportsAgainst: number; activeSessions: number };
  moderationHistory: Array<{ action: string; reason: string | null; at: string }>;
}

function PersonSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const { user: me } = useSession();
  const d = useQuery<UserDetail>(`admin:user:${id}`, (signal) => get(`/admin/users/${id}`, undefined, signal));
  const [role, setRole] = useState<ApiRole | ''>('');
  const [reason, setReason] = useState('');
  const save = useAction(async (change: { role?: ApiRole; verified?: boolean; suspended?: boolean }, message: string) => {
    await patch(`/admin/users/${id}`, { ...change, reason: reason.trim() || undefined });
    toast(message);
    setReason('');
    d.reload();
    invalidate('admin:users', 'admin:overview');
  });
  const u = d.data;
  const isAdmin = me?.role === 'admin';
  const self = me?.id === id;
  return (
    <Sheet open onClose={onClose} title={u?.person.displayName ?? 'Person'} description={u ? `${u.email} · ${ROLE_LABEL[u.role]}` : undefined}>
      {d.loading && <SkeletonList variant="row" count={3} />}
      {d.error && <ErrorState error={d.error} onRetry={d.reload} compact />}
      {u && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <PersonAvatar person={u.person} size="lg" link />
            <div className="min-w-0 text-[13px] text-text-3">
              <p>Joined {day(u.joinedAt)} · last sign-in {u.lastSignInAt ? ago(u.lastSignInAt) : 'never'}</p>
              <p>{u.counts.posts} posts · {u.counts.reportsAgainst} reports about them · {u.counts.activeSessions} signed-in devices</p>
              <p>{u.emailVerifiedAt ? 'Email confirmed' : 'Email not confirmed yet'}</p>
              {u.deletionScheduledFor && <p className="font-semibold text-warning">Account deletion scheduled for {day(u.deletionScheduledFor)}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'danger' : 'neutral'}>{u.status}</Badge>
            {u.person.isVerified && <Badge tone="info" icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}>Verified</Badge>}
            {u.pendingRole && <Badge tone="warning">Asked for {u.pendingRole} access</Badge>}
          </div>
          <Card className="p-4">
            <p className="mb-2 text-[13px] font-semibold">Sign-up details</p>
            <RoleInfoList info={u.roleInfo} />
          </Card>

          {self ? (
            <FormAlert tone="info">This is your own account. Another admin can change it.</FormAlert>
          ) : (
            <div className="space-y-4">
              <Field label="Note (shown to them for suspensions and warnings)" htmlFor="adm-reason">
                <Textarea id="adm-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Reason" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={save.pending} onClick={() => void save.run({ verified: !u.person.isVerified }, u.person.isVerified ? 'Verified badge removed' : 'Marked as verified')}>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {u.person.isVerified ? 'Remove verified badge' : 'Mark verified'}
                </Button>
                {u.status === 'suspended' ? (
                  <Button size="sm" variant="secondary" disabled={save.pending} onClick={() => void save.run({ suspended: false }, 'Account restored')}>Restore account</Button>
                ) : (
                  <Button size="sm" variant="danger" disabled={save.pending || !reason.trim()} onClick={() => void save.run({ suspended: true }, 'Account suspended and signed out everywhere')}>
                    <Ban className="h-4 w-4" aria-hidden="true" /> Suspend
                  </Button>
                )}
              </div>
              {u.status !== 'suspended' && !reason.trim() && <p className="text-[12px] text-text-3">Write a reason to suspend.</p>}
              {isAdmin && (
                <div className="flex items-end gap-2">
                  <Field label="Change role" htmlFor="adm-role" className="flex-1">
                    <Select id="adm-role" value={role || u.role} onChange={(e) => setRole(e.target.value as ApiRole)}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </Select>
                  </Field>
                  <Button disabled={save.pending || !role || role === u.role} onClick={() => void save.run({ role: role as ApiRole }, `Role changed to ${ROLE_LABEL[role as ApiRole]}`)}>Save role</Button>
                </div>
              )}
              {save.error && <FormAlert>{save.error.message}</FormAlert>}
            </div>
          )}

          {u.moderationHistory.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold">Moderation history</p>
              <ul className="space-y-1.5 text-[13px]">
                {u.moderationHistory.map((h, i) => (
                  <li key={i} className="rounded-xl bg-surface-2 px-3 py-2"><span className="font-semibold">{h.action.replace(/_/g, ' ')}</span> · {day(h.at)}{h.reason ? ` — ${h.reason}` : ''}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Everyone() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const role = (params.get('role') as ApiRole | null) ?? null;
  const status = params.get('status');
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [open, setOpen] = useState<string | null>(null);
  const set = (next: Record<string, string | null>) => router.replace(withQuery(pathname, { tab: null, role, status, q: q || null, ...next }), { scroll: false });
  const list = useInfinite<AdminUserRow>(`admin:users:${role}:${status}:${q}`, (cursor, signal) => get<Page<AdminUserRow>>('/admin/users', { role: role ?? undefined, status: status ?? undefined, q: q || undefined, cursor: cursor ?? undefined, limit: 25 }, signal));
  return (
    <>
      <form className="relative" onSubmit={(e) => { e.preventDefault(); set({ q: text.trim() || null }); }}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
        <Input value={text} onChange={(e) => { setText(e.target.value); if (!e.target.value) set({ q: null }); }} placeholder="Name, email, username or enrollment number" className="h-11 pl-10" aria-label="Search people" enterKeyHint="search" />
      </form>
      <ChipRow className="mt-3">
        <Chip active={!role} onClick={() => set({ role: null })}>All roles</Chip>
        {ROLES.map((r) => <Chip key={r} active={role === r} onClick={() => set({ role: r })}>{ROLE_LABEL[r]}</Chip>)}
      </ChipRow>
      <ChipRow className="mt-2">
        {[['', 'Any status'], ['active', 'Active'], ['pending', 'Email not confirmed'], ['suspended', 'Suspended']].map(([v, label]) => (
          <Chip key={v} active={(status ?? '') === v} onClick={() => set({ status: v || null })}>{label}</Chip>
        ))}
      </ChipRow>
      <InfiniteList
        state={list}
        skeleton="row"
        className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface"
        itemClassName="border-b border-border last:border-0"
        empty={{ icon: Users, title: 'Nobody matches', description: 'Try another name or clear the filters.' }}
        endMessage="That’s everyone"
        render={(u) => (
          <button type="button" onClick={() => setOpen(u.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
            <PersonAvatar person={{ id: u.id, displayName: u.name, avatarUrl: null, username: u.username }} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-semibold">{u.name}</span>
                {u.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-info" aria-label="Verified" />}
              </span>
              <span className="block truncate text-[12px] text-text-3">{u.email}{u.department ? ` · ${u.department}` : ''}{u.year ? ` · Year ${u.year}` : ''}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={u.role === 'admin' || u.role === 'moderator' ? 'accent' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge>
              {u.status !== 'active' && <span className={cn('text-[11px] font-semibold', u.status === 'suspended' ? 'text-danger' : 'text-text-3')}>{u.status}</span>}
              {u.pendingRole && <span className="text-[11px] font-semibold text-warning">wants {u.pendingRole}</span>}
            </span>
          </button>
        )}
      />
      {open && <PersonSheet id={open} onClose={() => { setOpen(null); list.reload(); }} />}
    </>
  );
}

function RequestCard({ r, onDone }: { r: VerificationRow; onDone: () => void }) {
  const toast = useToast();
  const { user } = useSession();
  const [note, setNote] = useState('');
  const decide = useAction(async (decision: 'approve' | 'reject') => {
    await post(`/admin/verifications/${r.id}/decision`, { decision, note: note.trim() || undefined });
    toast(decision === 'approve' ? 'Approved. They have been told.' : 'Rejected. They have been told.');
    invalidate('admin:overview');
    onDone();
  });
  const roleRequest = r.kind !== 'student_id';
  const blocked = roleRequest && user?.role !== 'admin';
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <PersonAvatar person={r.person} size="md" link />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.person.displayName}</p>
          <p className="truncate text-[13px] text-text-3">{r.email}</p>
          <p className="mt-1 text-[12px] text-text-3">Asked {ago(r.createdAt)}</p>
        </div>
        <Badge tone={roleRequest ? 'warning' : 'info'}>{KIND_LABEL[r.kind]}</Badge>
      </div>
      <RoleInfoList info={r.roleInfo} />
      {r.note && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[14px]">“{r.note}”</p>}
      {r.documentUrl && (
        <a href={r.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent">
          <FileText className="h-4 w-4" aria-hidden="true" /> Open the uploaded document <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      {r.status === 'pending' ? (
        blocked ? (
          <p className="text-[13px] text-text-3">Only admins can grant faculty or expert access.</p>
        ) : (
          <>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note to them (optional, sent by email)" aria-label="Note" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void decide.run('approve')} disabled={decide.pending}>{decide.pending ? <Spinner /> : <Check className="h-4 w-4" aria-hidden="true" />} Approve</Button>
              <Button size="sm" variant="secondary" onClick={() => void decide.run('reject')} disabled={decide.pending}><X className="h-4 w-4" aria-hidden="true" /> Reject</Button>
            </div>
            {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
          </>
        )
      ) : (
        <p className="text-[13px] text-text-3">{r.status === 'approved' ? 'Approved' : 'Rejected'}{r.reviewerNote ? ` — ${r.reviewerNote}` : ''}</p>
      )}
    </Card>
  );
}

function Requests() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const list = useInfinite<VerificationRow>(`admin:verifications:${status}`, (cursor, signal) => get<Page<VerificationRow>>('/admin/verifications', { status, cursor: cursor ?? undefined, limit: 20 }, signal));
  return (
    <>
      <ChipRow>
        {(['pending', 'approved', 'rejected'] as const).map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s === 'pending' ? 'Waiting' : s === 'approved' ? 'Approved' : 'Rejected'}</Chip>)}
      </ChipRow>
      <InfiniteList
        state={list}
        skeleton="card"
        className="mt-4 grid gap-3 md:grid-cols-2"
        empty={{ icon: UserCheck, title: status === 'pending' ? 'No requests waiting' : 'Nothing here', description: status === 'pending' ? 'Faculty and expert sign-ups, and student ID checks, show up here.' : undefined }}
        endMessage="No more requests"
        render={(r) => <RequestCard r={r} onDone={() => list.setItems((items) => items.filter((x) => x.id !== r.id))} />}
      />
    </>
  );
}

function PeopleInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'requests' ? 'requests' : 'everyone';
  return (
    <div>
      <Segmented<'everyone' | 'requests'>
        label="People views"
        value={tab}
        onChange={(v) => router.replace(v === 'requests' ? '/admin/people?tab=requests' : '/admin/people', { scroll: false })}
        className="mb-4 max-w-md"
        options={[
          { value: 'everyone', label: 'Everyone' },
          { value: 'requests', label: 'Requests' },
        ]}
      />
      {tab === 'everyone' ? <Everyone /> : <Requests />}
    </div>
  );
}

export default function AdminPeoplePage() {
  return (
    <Suspense fallback={<SkeletonList variant="row" count={6} />}>
      <PeopleInner />
    </Suspense>
  );
}
