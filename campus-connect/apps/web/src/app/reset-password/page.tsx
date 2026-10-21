'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthLayout, FormField } from '@/components/auth/auth-layout';
import { Button, buttonClass } from '@/components/ui/button';
import { PasswordHints, PasswordInput } from '@/components/ui/password-input';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; expired?: boolean } | null>(null);

  if (!token) {
    return <FormAlert>This page needs the link from your email. <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>.</FormAlert>;
  }
  if (done) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">Your password was changed and every device was signed out. Sign in with the new password.</FormAlert>
        <Link href="/login" className={buttonClass({ full: true, size: 'lg' })}>Sign in</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (password !== confirm) return setError({ message: 'The two passwords do not match.' });
    setPending(true);
    setError(null);
    try {
      await post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      if (isApiError(err)) setError({ message: err.code === 'WEAK_PASSWORD' ? err.reasons.join(' ') || err.message : err.message, expired: err.code === 'GONE' });
      else setError({ message: 'Something went wrong. Please try again.' });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && (
        <FormAlert>
          {error.message}
          {error.expired && (
            <>
              {' '}
              <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>.
            </>
          )}
        </FormAlert>
      )}
      <FormField id="password" label="New password">
        <PasswordInput id="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
      <PasswordHints password={password} />
      <FormField id="confirm" label="Confirm new password">
        <PasswordInput id="confirm" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <Button type="submit" full size="lg" disabled={pending || !password || !confirm} aria-busy={pending}>
        {pending && <Spinner />}
        Change password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="For your security, this also signs you out on every other device.">
      <Suspense fallback={<Spinner label="Loading" />}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
