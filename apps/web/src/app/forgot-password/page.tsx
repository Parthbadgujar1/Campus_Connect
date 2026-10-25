'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthLayout, FormField } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/fields';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';

function ForgotForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(isApiError(err) ? (err.fields.email ?? err.message) : 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">If an account uses {email.trim()}, a reset link is on its way. It works for one hour.</FormAlert>
        <Link href="/login" className="font-sans block text-center text-[14px] font-semibold text-accent hover:underline">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      <FormField id="email" label="Email">
        <Input id="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <Button type="submit" full size="lg" disabled={pending || !email} aria-busy={pending}>
        {pending && <Spinner />}
        Email me a reset link
      </Button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Reset your password" subtitle="Enter the email you signed up with and we will send you a link to choose a new password." footer={<Link href="/login" className="font-semibold text-accent hover:underline">Back to sign in</Link>}>
      <Suspense fallback={<Spinner label="Loading" />}>
        <ForgotForm />
      </Suspense>
    </AuthLayout>
  );
}
