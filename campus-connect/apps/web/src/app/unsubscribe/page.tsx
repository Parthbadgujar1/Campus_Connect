'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';

const SCOPES: Record<string, string> = { marketing: 'product news and tips', notification: 'notification summaries', all: 'all non-essential emails' };

function Unsubscribe() {
  const params = useSearchParams();
  const e = params.get('e') ?? '';
  const s = params.get('s') ?? '';
  const t = params.get('t') ?? '';
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  let email = '';
  try {
    email = e ? atob(e.replace(/-/g, '+').replace(/_/g, '/')) : '';
  } catch {
    email = '';
  }
  if (!e || !SCOPES[s] || !t) return <FormAlert>This unsubscribe link is incomplete. You can manage emails in Settings &gt; Notifications.</FormAlert>;

  const confirm = async () => {
    setState('working');
    try {
      await post('/privacy/unsubscribe', { e, s, t });
      setState('done');
    } catch (err) {
      setState('error');
      setMessage(isApiError(err) ? err.message : 'Could not unsubscribe. Please try again.');
    }
  };

  if (state === 'done') {
    return <FormAlert tone="success">Done. {email || 'This address'} will no longer get {SCOPES[s]}. Security emails (like password resets) still arrive, because you need them.</FormAlert>;
  }
  return (
    <div className="space-y-4">
      {state === 'error' && <FormAlert>{message}</FormAlert>}
      <p className="text-[16px] text-text-2">Stop sending <strong className="text-text">{SCOPES[s]}</strong> to <strong className="text-text">{email || 'this address'}</strong>?</p>
      <Button onClick={confirm} disabled={state === 'working'} aria-busy={state === 'working'}>
        {state === 'working' && <Spinner />} Unsubscribe
      </Button>
      <p className="font-sans text-[13px] text-text-3">Changed your mind later? Turn emails back on in <Link href="/settings/notifications" className="text-accent hover:underline">Settings &gt; Notifications</Link>.</p>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="max-w-lg">
      <h1 className="marker-heading hl-yellow text-[32px] font-bold">Unsubscribe</h1>
      <div className="mt-6">
        <Suspense fallback={<Spinner label="Loading" />}>
          <Unsubscribe />
        </Suspense>
      </div>
    </div>
  );
}
