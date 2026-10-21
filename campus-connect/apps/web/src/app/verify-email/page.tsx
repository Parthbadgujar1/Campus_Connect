'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AuthLayout, FormField } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/fields';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';
import type { SessionPayload } from '@/lib/api/types';
import { useSession } from '@/lib/session';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const { adopt } = useSession();
  const [state, setState] = useState<'working' | 'failed'>(token ? 'working' : 'failed');
  const [message, setMessage] = useState(token ? '' : 'This page needs the link from your email.');
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Links are single-use, so the request must run exactly once (React may mount twice in dev).
    if (!token || started.current) return;
    started.current = true;
    post<SessionPayload>('/auth/verify-email', { token })
      .then(async (payload) => {
        await adopt(payload);
        router.replace('/welcome');
      })
      .catch((err) => {
        setState('failed');
        setMessage(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
      });
  }, [token, adopt, router]);

  if (state === 'working') return <Spinner label="Confirming your email…" />;
  return (
    <div className="space-y-4">
      <FormAlert>{message}</FormAlert>
      {resent ? (
        <FormAlert tone="success">If that address has an account waiting, a new link is on its way.</FormAlert>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await post('/auth/resend-verification', { email: email.trim() }).catch(() => undefined);
            setResent(true);
          }}
        >
          <FormField id="email" label="Send a new link to">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
          </FormField>
          <Button type="submit" full disabled={!email}>Send a new link</Button>
        </form>
      )}
      <Link href="/login" className="font-sans block text-center text-[14px] font-semibold text-accent hover:underline">Back to sign in</Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Confirm your email" subtitle="One moment while we check your link.">
      <Suspense fallback={<Spinner label="Loading" />}>
        <Verify />
      </Suspense>
    </AuthLayout>
  );
}
