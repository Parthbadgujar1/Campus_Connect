'use client';

import { useState } from 'react';
import { CheckCircle2, Laptop, Smartphone, XCircle } from 'lucide-react';
import { FormField } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PasswordHints, PasswordInput } from '@/components/ui/password-input';
import { ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, get, isApiError, post } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import { ago, dateTime } from '@/lib/live-time';
import { useSession } from '@/lib/session';

interface Device {
  id: string;
  kind: 'web' | 'mobile';
  device: string;
  current: boolean;
  signedInAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

const REASONS: Record<string, string> = {
  ok: 'Signed in',
  bad_password: 'Wrong password',
  locked: 'Blocked: too many attempts',
  not_verified: 'Email not verified yet',
  suspended: 'Account suspended',
};

function ChangePassword() {
  const { user } = useSession();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setError({ message: 'The new passwords do not match.', fields: { confirm: 'The new passwords do not match.' } });
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const r = await post<{ otherSessionsSignedOut: number }>('/auth/change-password', { currentPassword: current, newPassword: next });
      setDone(r.otherSessionsSignedOut ? `Password changed. ${r.otherSessionsSignedOut} other device${r.otherSessionsSignedOut === 1 ? '' : 's'} signed out.` : 'Password changed.');
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password changed');
    } catch (err) {
      if (isApiError(err)) setError({ message: err.code === 'WEAK_PASSWORD' ? err.reasons.join(' ') || err.message : err.message, fields: err.fields });
      else setError({ message: 'Could not change the password.', fields: {} });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormAlert>{error.message}</FormAlert>}
      {done && <FormAlert tone="success">{done}</FormAlert>}
      <FormField id="current" label="Current password" error={error?.fields.currentPassword}>
        <PasswordInput id="current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={Boolean(error?.fields.currentPassword)} />
      </FormField>
      <FormField id="new" label="New password" error={error?.fields.newPassword}>
        <PasswordInput id="new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </FormField>
      <PasswordHints password={next} email={user?.email} name={user?.profile.displayName} />
      <FormField id="confirm" label="Confirm new password" error={error?.fields.confirm}>
        <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <Button type="submit" disabled={pending || !current || !next || !confirm} aria-busy={pending}>
        {pending && <Spinner />} Change password
      </Button>
      <p className="font-sans text-[13px] text-text-3">Changing it signs out every other device. We email you so you know it happened.</p>
    </form>
  );
}

export default function SecurityPage() {
  const toast = useToast();
  const devices = useQuery<{ items: Device[] }>('me:sessions', (s) => get('/auth/sessions', undefined, s));
  const activity = useQuery<{ passwordChangedAt: string | null; lastSignInAt: string | null; recentAttempts: Array<{ success: boolean; reason: string | null; at: string }> }>('me:security', (s) => get('/me/security', undefined, s));
  const [removing, setRemoving] = useState<string | null>(null);

  const signOutDevice = async (d: Device) => {
    setRemoving(d.id);
    try {
      await del(`/auth/sessions/${d.id}`);
      devices.setData((cur) => ({ items: (cur?.items ?? []).filter((x) => x.id !== d.id) }));
      toast(`Signed out of ${d.device}`);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Password & devices" subtitle="Keep your account safe" back backHref="/settings" />

      <section className="mt-4" aria-label="Change password">
        <SectionHeader title="Change password" description={activity.data?.passwordChangedAt ? `Last changed ${ago(activity.data.passwordChangedAt)} ago` : undefined} />
        <Card className="p-4 md:p-5">
          <ChangePassword />
        </Card>
      </section>

      <section className="mt-8" aria-label="Where you are signed in">
        <SectionHeader title="Where you are signed in" description="Sign out of anything you do not recognise, then change your password." />
        {devices.loading ? (
          <SkeletonList variant="row" count={2} />
        ) : devices.error ? (
          <ErrorState error={devices.error} onRetry={devices.reload} />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {devices.data!.items.map((d) => {
              const Icon = d.kind === 'mobile' ? Smartphone : Laptop;
              return (
                <div key={d.id} className="font-sans flex items-center gap-3 px-4 py-3.5">
                  <Icon className="h-5 w-5 shrink-0 text-text-2" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">
                      {d.device} {d.current && <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">This device</span>}
                    </span>
                    <span className="block text-[13px] text-text-3">Active {ago(d.lastActiveAt)} · signed in {dateTime(d.signedInAt)}</span>
                  </span>
                  {!d.current && (
                    <Button variant="secondary" size="sm" onClick={() => signOutDevice(d)} disabled={removing === d.id} aria-busy={removing === d.id}>
                      {removing === d.id ? <Spinner /> : 'Sign out'}
                    </Button>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <section className="mt-8" aria-label="Recent sign-in activity">
        <SectionHeader title="Recent sign-in activity" />
        {activity.loading ? (
          <SkeletonList variant="row" count={3} />
        ) : activity.error ? (
          <ErrorState error={activity.error} onRetry={activity.reload} />
        ) : activity.data!.recentAttempts.length ? (
          <Card className="divide-y divide-border overflow-hidden">
            {activity.data!.recentAttempts.slice(0, 15).map((a, i) => (
              <div key={i} className="font-sans flex items-center gap-3 px-4 py-3">
                {a.success ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />}
                <span className="flex-1 text-[14px]">{REASONS[a.reason ?? ''] ?? (a.success ? 'Signed in' : 'Failed attempt')}</span>
                <span className="text-[13px] text-text-3">{dateTime(a.at)}</span>
              </div>
            ))}
          </Card>
        ) : (
          <p className="text-[14px] text-text-3">No recent activity.</p>
        )}
      </section>
    </div>
  );
}
