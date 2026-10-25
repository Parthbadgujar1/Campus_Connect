'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CheckCircle2, Clock, Mail, ShieldAlert } from 'lucide-react';
import { Checkbox, FormField } from '@/components/auth/auth-layout';
import { useConsent } from '@/components/shell/cookie-banner';
import { usePublicConfig } from '@/components/shell/public-shell';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/fields';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';
import { useOptionalSession } from '@/lib/session';

const TOPICS = [
  ['support', 'Help with my account or the app'],
  ['privacy', 'Privacy or my data'],
  ['safety', 'Safety concern'],
  ['partnership', 'Bring CampusConnect to my college'],
  ['press', 'Press'],
  ['general', 'Something else'],
] as const;
type Topic = (typeof TOPICS)[number][0];

function ContactForm() {
  const params = useSearchParams();
  const session = useOptionalSession();
  const consent = useConsent();
  const initialTopic = (TOPICS.find(([t]) => t === params.get('topic'))?.[0] ?? 'support') as Topic;
  const [name, setName] = useState(session?.user?.profile.displayName ?? '');
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [agree, setAgree] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (name.trim().length < 2) local.name = 'Tell us your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) local.email = 'Enter an email address we can reply to.';
    if (subject.trim().length < 3) local.subject = 'Add a short subject.';
    if (message.trim().length < 10) local.message = 'Write at least a sentence so we can help.';
    if (!agree) local.consent = 'Please agree so we can use your details to reply.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setPending(true);
    setFormError(null);
    // Campaign (UTM) parameters are sent only if the visitor allowed analytics.
    const utm = consent?.analytics
      ? { source: params.get('utm_source') ?? undefined, medium: params.get('utm_medium') ?? undefined, campaign: params.get('utm_campaign') ?? undefined, term: params.get('utm_term') ?? undefined, content: params.get('utm_content') ?? undefined }
      : undefined;
    try {
      const r = await post<{ message: string }>('/contact', {
        name: name.trim(), email: email.trim(), topic, subject: subject.trim(), message: message.trim(), consent: true,
        analyticsConsent: Boolean(consent?.analytics), utm, anonymousId: consent?.anonymousId, website,
      });
      setSent(r.message);
    } catch (err) {
      if (isApiError(err) && Object.keys(err.fields).length) setErrors(err.fields);
      else setFormError(isApiError(err) ? err.message : 'Could not send your message. Please try again.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
        <h2 className="font-display mt-3 text-[26px]">Message sent</h2>
        <p className="mt-2 text-[15px] text-text-2">{sent}</p>
        <Link href="/" className="font-sans mt-5 inline-block font-semibold text-accent hover:underline">Back to CampusConnect</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="font-sans space-y-4 rounded-2xl border border-border bg-surface p-5 md:p-6">
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="c-name" label="Your name" error={errors.name}>
          <Input id="c-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name) || undefined} />
        </FormField>
        <FormField id="c-email" label="Email to reply to" error={errors.email}>
          <Input id="c-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email) || undefined} />
        </FormField>
      </div>
      <FormField id="c-topic" label="What is it about?">
        <Select id="c-topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </FormField>
      {topic === 'safety' && <FormAlert tone="info">In an emergency call 112. For mental health support, Tele-MANAS is free and open 24×7: 14416.</FormAlert>}
      <FormField id="c-subject" label="Subject" error={errors.subject}>
        <Input id="c-subject" maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} aria-invalid={Boolean(errors.subject) || undefined} />
      </FormField>
      <FormField id="c-message" label="Message" error={errors.message} hint={`${message.length}/4000`}>
        <Textarea id="c-message" maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={Boolean(errors.message) || undefined} className="min-h-36" />
      </FormField>
      {/* Hidden from people; bots that fill every field are quietly dropped. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <Checkbox id="c-consent" checked={agree} onChange={setAgree} error={errors.consent}>
        I agree that CampusConnect uses my name and email to reply to this message, as described in the <Link href="/privacy" className="font-semibold text-accent hover:underline">privacy policy</Link>.
      </Checkbox>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />} Send message
      </Button>
    </form>
  );
}

export default function ContactPage() {
  const { data } = usePublicConfig();
  return (
    <div>
      <h1 className="marker-heading hl-green text-[34px] font-bold">Contact us</h1>
      <p className="mt-2 text-[16px] text-text-2">Real people read every message. Check the <Link href="/faq" className="text-accent hover:underline">FAQ</Link> for quick answers.</p>
      <div className="font-sans mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <Mail className="h-5 w-5 text-accent" aria-hidden="true" />
          <p className="mt-2 text-[14px] font-semibold">Email</p>
          <p className="text-[13px] text-text-2">{data ? <a className="text-accent hover:underline" href={`mailto:${data.operator.supportEmail}`}>{data.operator.supportEmail}</a> : '…'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <Clock className="h-5 w-5 text-accent" aria-hidden="true" />
          <p className="mt-2 text-[14px] font-semibold">Reply time</p>
          <p className="text-[13px] text-text-2">Within 2 working days</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <ShieldAlert className="h-5 w-5 text-accent" aria-hidden="true" />
          <p className="mt-2 text-[14px] font-semibold">Grievance Officer</p>
          <p className="text-[13px] text-text-2">{data ? <a className="text-accent hover:underline" href={`mailto:${data.operator.privacyEmail}`}>{data.operator.privacyEmail}</a> : '…'}</p>
        </div>
      </div>
      <div className="mt-6">
        <Suspense fallback={<Spinner label="Loading" />}>
          <ContactForm />
        </Suspense>
      </div>
    </div>
  );
}
