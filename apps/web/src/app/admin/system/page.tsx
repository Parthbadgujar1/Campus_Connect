'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { History, Mail, Play, RotateCcw, Server, ToggleLeft } from 'lucide-react';
import { get, patch, post } from '@/lib/api/client';
import { useAction, useInfinite, useQuery, type Page } from '@/lib/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Switch } from '@/components/ui/fields';
import { EmptyState, SectionHeader } from '@/components/ui/layout';
import { InfiniteList } from '@/components/ui/infinite';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Figure } from '@/components/admin/admin-ui';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

interface SystemInfo {
  jobs: Array<{ name: string; lastStartedAt: string | null; lastFinishedAt: string | null; lastStatus: string | null; lastError: string | null; lastDurationMs: number | null; runs: number }>;
  modules: Array<{ name: string; status: string; registrationError?: string | null }>;
  email: { mode: string; last7Days: Record<string, number> };
  realtime: Record<string, number>;
  cache: Record<string, unknown>;
  database: Record<string, unknown>;
}
interface Flag {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  allowedRoles: string[];
  updatedAt: string;
}
interface EmailRow {
  id: string;
  to: string;
  template: string;
  status: string;
  attempts: number;
  lastError: string | null;
  subject: string | null;
  createdAt: string;
  sentAt: string | null;
}
interface AuditRow {
  id: string;
  at: string;
  action: string;
  actor: { id: string; name: string; role: string } | null;
  entity: { type: string; id: string | null } | null;
  meta: Record<string, unknown> | null;
}

type Tab = 'health' | 'switches' | 'email' | 'audit';

function Health() {
  const toast = useToast();
  const sys = useQuery<SystemInfo>('admin:system', (signal) => get('/admin/system', undefined, signal));
  const run = useAction(async (name: string) => {
    const r = await post<{ ran: boolean; lastStatus: string | null; lastError: string | null; durationMs: number | null }>(`/admin/jobs/${name}/run`);
    toast(r.ran ? `${name}: ${r.lastStatus ?? 'done'}${r.durationMs !== null ? ` in ${r.durationMs} ms` : ''}` : `${name} is already running`);
    sys.reload();
  });
  if (sys.loading) return <SkeletonList variant="row" count={5} />;
  if (sys.error) return <ErrorState error={sys.error} onRetry={sys.reload} />;
  const s = sys.data!;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Figure label="Live connections" value={Number(s.realtime.connections ?? 0)} />
        <Figure label="Database" value={s.database.replicaSet ? 'Replica set' : 'Standalone'} tone={s.database.replicaSet ? 'success' : 'warning'} />
        <Figure label="Email mode" value={s.email.mode} />
        <Figure label="Emails sent (7 days)" value={s.email.last7Days.sent ?? 0} tone="success" />
        <Figure label="Emails failed (7 days)" value={(s.email.last7Days.failed ?? 0) + (s.email.last7Days.dead ?? 0)} tone={(s.email.last7Days.dead ?? 0) ? 'danger' : 'neutral'} />
      </div>
      <section>
        <SectionHeader title="Modules" description="A module that keeps failing is paused for a few minutes so the rest of the app keeps working." />
        <div className="flex flex-wrap gap-2">
          {s.modules.map((m) => (
            <span key={m.name} title={m.registrationError ?? undefined} className={cn('font-sans rounded-full px-3 py-1 text-[12px] font-semibold', m.status === 'ok' ? 'bg-success-soft text-success' : m.status === 'paused' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger')}>{m.name} · {m.status}</span>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader title="Background jobs" />
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {s.jobs.map((j) => (
            <div key={j.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-sans font-semibold">{j.name}</p>
                <p className="text-[12px] text-text-3">{j.lastFinishedAt ? `Last run ${ago(j.lastFinishedAt)}${j.lastDurationMs !== null ? ` · ${j.lastDurationMs} ms` : ''}` : 'Not run yet'} · {j.runs} runs</p>
                {j.lastError && <p className="text-[12px] text-danger">{j.lastError}</p>}
              </div>
              {j.lastStatus && <Badge tone={j.lastStatus === 'ok' ? 'success' : j.lastStatus === 'skipped' ? 'neutral' : 'danger'}>{j.lastStatus}</Badge>}
              <Button size="sm" variant="secondary" onClick={() => void run.run(j.name)} disabled={run.pending}><Play className="h-4 w-4" aria-hidden="true" /> Run now</Button>
            </div>
          ))}
          {!s.jobs.length && <p className="px-4 py-6 text-center text-[14px] text-text-3">No job has run yet. Jobs start a minute after the API starts.</p>}
        </div>
        {run.pending && <p className="mt-2 flex items-center gap-2 text-[13px] text-text-3"><Spinner /> Running…</p>}
        {run.error && <FormAlert className="mt-2">{run.error.message}</FormAlert>}
      </section>
    </div>
  );
}

function Switches() {
  const toast = useToast();
  const flags = useQuery<{ items: Flag[] }>('admin:flags', (signal) => get('/admin/flags', undefined, signal));
  const save = useAction(async (key: string, change: Partial<Pick<Flag, 'enabled' | 'rolloutPercent'>>) => {
    await patch(`/admin/flags/${key}`, change);
    flags.setData((d) => (d ? { items: d.items.map((f) => (f.key === key ? { ...f, ...change } : f)) } : d));
    toast('Saved. It takes effect within seconds.');
  });
  if (flags.loading) return <SkeletonList variant="row" count={6} />;
  if (flags.error) return <ErrorState error={flags.error} onRetry={flags.reload} />;
  const items = flags.data?.items ?? [];
  if (!items.length) return <EmptyState icon={ToggleLeft} title="No feature switches" />;
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-text-3">Turn features on or off for everyone at once, without a restart. The apps update by themselves.</p>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((f) => (
          <div key={f.key}>
            <Switch checked={f.enabled} onChange={(v) => void save.run(f.key, { enabled: v })} disabled={save.pending} label={f.description || f.key} description={`${f.key}${f.enabled && f.rolloutPercent < 100 ? ` · ${f.rolloutPercent}% of people` : ''}`} />
            {f.enabled && (
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                <span className="font-sans text-[12px] font-semibold text-text-3">Roll out to</span>
                {[10, 25, 50, 100].map((p) => (
                  <Chip key={p} active={f.rolloutPercent === p} onClick={() => void save.run(f.key, { rolloutPercent: p })}>{p}%</Chip>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {save.error && <FormAlert>{save.error.message}</FormAlert>}
    </div>
  );
}

function Email() {
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = useInfinite<EmailRow>(`admin:emails:${status}`, (cursor, signal) => get<Page<EmailRow>>('/admin/emails', { status: status ?? undefined, cursor: cursor ?? undefined, limit: 25 }, signal));
  const retry = useAction(async (id: string) => {
    await post(`/admin/emails/${id}/retry`);
    list.setItems((items) => items.map((x) => (x.id === id ? { ...x, status: 'queued', lastError: null } : x)));
  });
  const one = useQuery<{ subject: string | null; html: string | null; text: string | null; to: string }>(open ? `admin:email:${open}` : null, (signal) => get(`/admin/emails/${open}`, undefined, signal));
  return (
    <>
      <ChipRow>
        {[null, 'queued', 'sent', 'failed', 'dead', 'suppressed'].map((s) => <Chip key={s ?? 'all'} active={status === s} onClick={() => setStatus(s)}>{s ?? 'All'}</Chip>)}
      </ChipRow>
      <InfiniteList
        state={list}
        skeleton="row"
        className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface"
        itemClassName="border-b border-border last:border-0"
        empty={{ icon: Mail, title: 'No emails here' }}
        endMessage="No older emails"
        render={(e) => (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => setOpen(e.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate font-semibold">{e.subject ?? e.template}</span>
              <span className="block truncate text-[12px] text-text-3">{e.to} · {ago(e.createdAt)} · {e.attempts} attempt{e.attempts === 1 ? '' : 's'}</span>
              {e.lastError && <span className="block truncate text-[12px] text-danger">{e.lastError}</span>}
            </button>
            <Badge tone={e.status === 'sent' ? 'success' : e.status === 'dead' || e.status === 'failed' ? 'danger' : 'neutral'}>{e.status}</Badge>
            {(e.status === 'failed' || e.status === 'dead') && <Button size="sm" variant="ghost" onClick={() => void retry.run(e.id)} disabled={retry.pending}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Retry</Button>}
          </div>
        )}
      />
      {retry.error && <FormAlert className="mt-2">{retry.error.message}</FormAlert>}
      {open && (
        <Sheet open onClose={() => setOpen(null)} title={one.data?.subject ?? 'Email'} description={one.data?.to}>
          {one.loading && <SkeletonList variant="row" count={2} />}
          {one.data && (one.data.text ? <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3 text-[13px]">{one.data.text}</pre> : <p className="text-[14px] text-text-3">Email bodies are shown only in local development, because real emails can contain sign-in links.</p>)}
        </Sheet>
      )}
    </>
  );
}

function Audit() {
  const list = useInfinite<AuditRow>('admin:audit', (cursor, signal) => get<Page<AuditRow>>('/admin/audit', { cursor: cursor ?? undefined, limit: 30 }, signal));
  return (
    <InfiniteList
      state={list}
      skeleton="row"
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      itemClassName="border-b border-border last:border-0"
      empty={{ icon: History, title: 'Nothing logged yet' }}
      endMessage="That’s the last 180 days"
      render={(a) => (
        <div className="px-4 py-2.5">
          <p className="font-sans text-[14px] font-semibold">{a.action}</p>
          <p className="text-[12px] text-text-3">{a.actor ? `${a.actor.name} (${a.actor.role})` : 'System'} · {ago(a.at)}{a.entity ? ` · ${a.entity.type}` : ''}</p>
        </div>
      )}
    />
  );
}

function SystemInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (['health', 'switches', 'email', 'audit'].includes(params.get('tab') ?? '') ? params.get('tab') : 'health') as Tab;
  const TABS: Array<{ value: Tab; label: string; icon: typeof Server }> = [
    { value: 'health', label: 'Health', icon: Server },
    { value: 'switches', label: 'Feature switches', icon: ToggleLeft },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'audit', label: 'Audit log', icon: History },
  ];
  return (
    <div>
      <ChipRow className="mb-4">
        {TABS.map((t) => (
          <Chip key={t.value} active={tab === t.value} onClick={() => router.replace(t.value === 'health' ? '/admin/system' : `/admin/system?tab=${t.value}`, { scroll: false })}>
            <t.icon className="h-3.5 w-3.5" aria-hidden="true" /> {t.label}
          </Chip>
        ))}
      </ChipRow>
      {tab === 'health' && <Health />}
      {tab === 'switches' && <Switches />}
      {tab === 'email' && <Email />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}

export default function AdminSystemPage() {
  return (
    <Suspense fallback={<SkeletonList variant="row" count={5} />}>
      <SystemInner />
    </Suspense>
  );
}
