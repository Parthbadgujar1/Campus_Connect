'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';

function Confirm() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(token ? null : { ok: false, message: 'This page needs the link from your email.' });
  const started = useRef(false);
  useEffect(() => {
    // Single-use link: run once even if React mounts twice in development.
    if (!token || started.current) return;
    started.current = true;
    post<{ message: string }>('/privacy/requests/confirm', { token })
      .then((r) => setState({ ok: true, message: r.message }))
      .catch((err) => setState({ ok: false, message: isApiError(err) ? err.message : 'Something went wrong. Please try again.' }));
  }, [token]);
  if (!state) return <Spinner label="Confirming your request…" />;
  return (
    <div className="space-y-4">
      <FormAlert tone={state.ok ? 'success' : 'error'}>{state.message}</FormAlert>
      {!state.ok && <Link href="/privacy#your-rights" className="font-sans font-semibold text-accent hover:underline">Make a new request</Link>}
    </div>
  );
}

export default function ConfirmDataRequestPage() {
  return (
    <div className="max-w-lg">
      <h1 className="marker-heading hl-blue text-[32px] font-bold">Confirm your request</h1>
      <div className="mt-6">
        <Suspense fallback={<Spinner label="Loading" />}>
          <Confirm />
        </Suspense>
      </div>
    </div>
  );
}
