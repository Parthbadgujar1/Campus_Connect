'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthLayout, Checkbox, FormField } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/fields';
import { PasswordInput } from '@/components/ui/password-input';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';
import { useSession } from '@/lib/session';

/** Only same-site paths are followed after sign-in (no open redirects). */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string; fields?: Record<string, string> } | null>(null);
  const [resent, setResent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setResent(false);
    try {
      await signIn(email.trim(), password, remember);
      router.replace(safeNext(params.get('next')));
    } catch (err) {
      if (isApiError(err)) setError({ message: err.message, code: err.code, fields: err.fields });
      else setError({ message: 'Something went wrong. Please try again.' });
      setPending(false);
    }
  };

  const resend = async () => {
    try {
      await post('/auth/resend-verification', { email: email.trim() });
      setResent(true);
    } catch (err) {
      setError({ message: isApiError(err) ? err.message : 'Could not send the email. Try again shortly.' });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-describedby={error ? 'login-error' : undefined}>
      {params.get('reason') === 'expired' && !error && <FormAlert tone="info">Your session ended. Please sign in again.</FormAlert>}
      {params.get('reason') === 'deleted' && !error && (
        <FormAlert tone="info">Your account is scheduled for deletion in 30 days and you have been signed out everywhere. Changed your mind? Sign in and choose “Keep my account”.</FormAlert>
      )}
      {error && (
        <div id="login-error">
          <FormAlert>
            <p>{error.message}</p>
            {error.code === 'EMAIL_NOT_VERIFIED' && !resent && (
              <button type="button" onClick={resend} className="mt-1 font-semibold underline">
                Send the verification email again
              </button>
            )}
            {error.code === 'ACCOUNT_SUSPENDED' && (
              <Link href="/contact?topic=support" className="mt-1 inline-block font-semibold underline">
                Contact support
              </Link>
            )}
          </FormAlert>
        </div>
      )}
      {resent && <FormAlert tone="success">Sent. Check your inbox (and spam) for the verification link.</FormAlert>}

      <FormField id="email" label="Email" error={error?.fields?.email}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error?.fields?.email) || undefined}
          aria-describedby={error?.fields?.email ? 'email-error' : undefined}
        />
      </FormField>
      <FormField
        id="password"
        label="Password"
        error={error?.fields?.password}
        trailing={
          <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="font-sans text-[13px] font-semibold text-accent hover:underline">
            Forgot password?
          </Link>
        }
      >
        <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(error?.fields?.password)} />
      </FormField>
      <Checkbox id="remember" checked={remember} onChange={setRemember}>
        Keep me signed in on this device <span className="text-text-3">(not on shared computers)</span>
      </Checkbox>
      <Button type="submit" full size="lg" disabled={pending || !email || !password} aria-busy={pending}>
        {pending && <Spinner />}
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      {process.env.NODE_ENV !== 'production' && (
        <p className="font-sans text-center text-[12px] text-text-3">Local testing: demo accounts for every role are listed at the top of apps/api/scripts/seed.ts.</p>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your email and password."
      footer={
        <>
          New to CampusConnect?{' '}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<Spinner label="Loading" />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
