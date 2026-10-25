'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Briefcase, ExternalLink, GraduationCap, Hourglass, MailCheck, Presentation } from 'lucide-react';
import { AuthLayout, Checkbox, FormField } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/fields';
import { PasswordHints, PasswordInput } from '@/components/ui/password-input';
import { FormAlert, Spinner } from '@/components/ui/states';
import { motion } from '@/components/motion';
import { get, isApiError, post } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import { usePublicConfig } from '@/components/shell/public-shell';
import { cn } from '@/lib/utils';

// Sign up like any app: name, email, mobile, date of birth and a password. The age is worked out
// from the date of birth (18 or over). Students and faculty choose their college at the end;
// industry experts don't. Faculty and experts can sign in once an admin approves them.

type Role = 'student' | 'faculty' | 'expert';

interface College {
  id: string;
  name: string;
  shortName: string;
  city: string | null;
}

const ROLES: Array<{ value: Role; label: string; hint: string; icon: typeof GraduationCap }> = [
  { value: 'student', label: 'Student', hint: 'Studying at a college', icon: GraduationCap },
  { value: 'faculty', label: 'Faculty', hint: 'Teaching or staff', icon: Presentation },
  { value: 'expert', label: 'Industry expert', hint: 'Alumni or mentor', icon: Briefcase },
];

const MINIMUM_AGE = 18;

function ageFrom(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function RegisterPage() {
  const config = usePublicConfig();
  const colleges = useQuery<{ items: College[] }>('meta:colleges', (signal) => get('/meta/colleges', undefined, signal));
  const [role, setRole] = useState<Role>('student');
  const [collegeId, setCollegeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const age = useMemo(() => ageFrom(dob), [dob]);
  const needsCollege = role !== 'expert';
  const today = new Date().toISOString().slice(0, 10);

  // With a single college on this server, it is chosen for you.
  useEffect(() => {
    const items = colleges.data?.items ?? [];
    if (items.length === 1 && !collegeId) setCollegeId(items[0]!.id);
  }, [colleges.data, collegeId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.displayName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!/^\+?[0-9]{10,15}$/.test(phone.replace(/[\s()-]/g, ''))) e.phone = 'Enter a valid mobile number, for example +91 98765 43210.';
    if (age === null || age > 100 || age < 0) e.dateOfBirth = 'Enter your date of birth.';
    else if (age < MINIMUM_AGE) e.dateOfBirth = `CampusConnect is for people aged ${MINIMUM_AGE} or over.`;
    if (password.length < 10) e.password = 'Use at least 10 characters.';
    if (confirm !== password) e.confirm = 'The two passwords do not match.';
    if (needsCollege && !collegeId) e.collegeId = 'Choose your college.';
    if (!terms) e.acceptTerms = 'Please accept the terms and privacy policy to continue.';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (pending) return;
    const local = validate();
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) {
      const first = Object.keys(local)[0]!;
      document.getElementById(first === 'displayName' ? 'name' : first)?.focus();
      return;
    }
    setPending(true);
    try {
      const r = await post<{ devLink?: string }>('/auth/register', {
        email: email.trim(),
        password,
        displayName: name.trim(),
        role,
        phone: phone.trim(),
        dateOfBirth: dob,
        collegeId: needsCollege ? collegeId : undefined,
        acceptTerms: terms,
        marketingOptIn: marketing,
      });
      setDevLink(r?.devLink ?? null);
      setDone(true);
    } catch (err) {
      if (isApiError(err)) {
        setErrors(err.fields);
        if (err.code === 'WEAK_PASSWORD') setErrors({ password: err.reasons.join(' ') || err.message });
        else if (!Object.keys(err.fields).length) setFormError(err.message);
      } else setFormError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Check your email" subtitle={<>We sent a link to <strong className="text-text">{email.trim()}</strong>. Open it to confirm your email.</>}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <MailCheck className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <p className="font-sans text-[14px] text-text-2">The link works for 24 hours. Can&apos;t find it? Check spam or promotions, or send it again.</p>
          </div>
          {devLink && (
            <div className="space-y-2 rounded-2xl border border-dashed border-warning bg-warning-soft p-4 text-warning">
              <p className="font-sans text-[13px] font-semibold">Local development: emails are not sent yet, so here is the link.</p>
              <a href={devLink} className="font-sans inline-flex items-center gap-1.5 text-[14px] font-semibold underline"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Confirm my email</a>
            </div>
          )}
          {role !== 'student' && (
            <div className="flex items-start gap-3 rounded-2xl bg-info-soft p-4 text-info">
              <Hourglass className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="font-sans text-[14px]">{role === 'faculty' ? 'Faculty accounts are approved by your college admin.' : 'Industry expert accounts are approved by an admin.'} You can sign in as soon as it is approved, and we will email you.</p>
            </div>
          )}
          {resent && <FormAlert tone="success">Sent again. It can take a minute to arrive.</FormAlert>}
          <Button
            variant="secondary"
            full
            onClick={async () => {
              await post('/auth/resend-verification', { email: email.trim() }).catch(() => undefined);
              setResent(true);
            }}
          >
            Send the email again
          </Button>
          <Link href="/login" className="font-sans block text-center text-[14px] font-semibold text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (config.data && !config.data.registrationOpen) {
    return (
      <AuthLayout title="Sign-ups are paused" subtitle="New accounts are switched off for a short while. Please try again later.">
        <Link href="/login" className="font-sans font-semibold text-accent hover:underline">Back to sign in</Link>
      </AuthLayout>
    );
  }

  const collegeList = colleges.data?.items ?? [];
  const err = (k: string) => errors[k];

  return (
    <AuthLayout
      title="Join your campus"
      subtitle="Create an account with your email and a password. It takes a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        <fieldset>
          <legend className="font-sans mb-2 text-sm font-semibold">I am joining as</legend>
          <div role="radiogroup" aria-label="I am joining as" className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <motion.button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={role === r.value}
                whileTap={{ scale: 0.96 }}
                onClick={() => setRole(r.value)}
                className={cn('font-sans flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors', role === r.value ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border bg-surface text-text-2 hover:bg-surface-2')}
              >
                <r.icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[13px] font-semibold leading-tight">{r.label}</span>
                <span className="hidden text-[11px] leading-tight text-text-3 sm:block">{r.hint}</span>
              </motion.button>
            ))}
          </div>
          {role !== 'student' && <p className="font-sans mt-2 text-[12px] text-text-3">{role === 'faculty' ? 'Faculty' : 'Industry expert'} accounts are approved by an admin before you can sign in.</p>}
        </fieldset>

        <FormField id="name" label="Full name" error={err('displayName')}>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(err('displayName')) || undefined} />
        </FormField>
        <FormField id="email" label="Email" error={err('email')} hint="Any email you use: Gmail, Outlook, your college address…">
          <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(err('email')) || undefined} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="phone" label="Mobile number" error={err('phone')}>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} aria-invalid={Boolean(err('phone')) || undefined} />
          </FormField>
          <FormField id="dateOfBirth" label="Date of birth" error={err('dateOfBirth')} hint={age !== null && age >= 0 && age <= 100 ? `Age: ${age}` : undefined}>
            <Input id="dateOfBirth" type="date" autoComplete="bday" required max={today} value={dob} onChange={(e) => setDob(e.target.value)} aria-invalid={Boolean(err('dateOfBirth')) || undefined} />
          </FormField>
        </div>
        <p className="font-sans -mt-1 text-[12px] text-text-3">Your mobile number and date of birth stay private. They are never shown on your profile.</p>

        <FormField id="password" label="Password" error={err('password')}>
          <PasswordInput id="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(err('password'))} aria-describedby="password-hints" />
        </FormField>
        <div id="password-hints">
          <PasswordHints password={password} email={email} name={name} />
        </div>
        <FormField id="confirm" label="Confirm password" error={err('confirm')}>
          <PasswordInput id="confirm" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(err('confirm'))} />
        </FormField>

        {needsCollege && (
          <FormField id="collegeId" label="Your college" error={err('collegeId')}>
            <Select id="collegeId" value={collegeId} onChange={(e) => setCollegeId(e.target.value)} disabled={colleges.loading} aria-invalid={Boolean(err('collegeId')) || undefined}>
              <option value="">{colleges.loading ? 'Loading colleges…' : 'Choose your college'}</option>
              {collegeList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? `, ${c.city}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <fieldset className="space-y-3 pt-1">
          <legend className="sr-only">Agreements</legend>
          <Checkbox id="acceptTerms" checked={terms} onChange={setTerms} error={err('acceptTerms')}>
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="font-semibold text-accent hover:underline">Terms of service</Link> and have read the{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:underline">Privacy policy</Link>.
          </Checkbox>
          <Checkbox id="marketing" checked={marketing} onChange={setMarketing}>
            Send me occasional emails about new features. <span className="text-text-3">Optional; unsubscribe any time.</span>
          </Checkbox>
        </fieldset>

        <Button type="submit" full size="lg" disabled={pending} aria-busy={pending}>
          {pending && <Spinner />}
          {pending ? 'Creating your account…' : 'Create account'}
        </Button>
        <p className="font-sans text-center text-[12px] text-text-3">Free for students. No ads, no fees, and we never sell your data.</p>
      </form>
    </AuthLayout>
  );
}
