'use client';

import { useState } from 'react';
import { FormField } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/fields';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';

/** For people who cannot sign in: ask for a copy or deletion of their data, confirmed by email. */
export function DataRequestForm() {
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<'export' | 'deletion'>('export');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await post<{ message: string }>('/privacy/requests', { email: email.trim(), kind, details: details.trim() || undefined });
      setDone(r.message);
    } catch (err) {
      setError(isApiError(err) ? (err.fields.email ?? err.message) : 'Could not send the request. Please try again.');
    } finally {
      setPending(false);
    }
  };

  if (done) return <FormAlert tone="success">{done} Open the link in that email to confirm; it works for 24 hours.</FormAlert>;
  return (
    <form onSubmit={submit} noValidate className="font-sans space-y-4 rounded-2xl border border-border bg-surface p-5">
      {error && <FormAlert>{error}</FormAlert>}
      <FormField id="dr-email" label="Email address of the account">
        <Input id="dr-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <FormField id="dr-kind" label="What would you like?">
        <Select id="dr-kind" value={kind} onChange={(e) => setKind(e.target.value as 'export' | 'deletion')}>
          <option value="export">A copy of my data</option>
          <option value="deletion">Delete my account and data</option>
        </Select>
      </FormField>
      <FormField id="dr-details" label="Anything we should know? (optional)">
        <Textarea id="dr-details" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      </FormField>
      <Button type="submit" disabled={pending || !email} aria-busy={pending}>
        {pending && <Spinner />} Send request
      </Button>
      <p className="text-[13px] text-text-3">To protect you, we only act after you confirm from that inbox. Deletion follows the same 30-day grace period as deleting in Settings.</p>
    </form>
  );
}
