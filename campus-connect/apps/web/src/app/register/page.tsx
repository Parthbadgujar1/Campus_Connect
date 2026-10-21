'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Briefcase, GraduationCap, Hourglass, MailCheck, Presentation } from 'lucide-react';
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

// Sign up with any email address and a password, like any app. People choose their college and
// say who they are; students are in straight away (after confirming the email), while faculty
// and industry experts use the app as students until an admin approves their role.

type Role = 'student' | 'faculty' | 'expert';

interface College {
  id: string;
  name: string;
  shortName: string;
  city: string | null;
}

const ROLES: Array<{ value: Role; label: string; hint: string; icon: typeof GraduationCap }> = [
  { value: 'student', label: 'Student', hint: 'Studying at the college', icon: GraduationCap },
  { value: 'faculty', label: 'Faculty', hint: 'Teaching or staff', icon: Presentation },
  { value: 'expert', label: 'Industry expert', hint: 'Alumni or mentor', icon: Briefcase },
];

const THIS_YEAR = new Date().getFullYear();

export default function RegisterPage() {
  const config = usePublicConfig();
  const colleges = useQuery<{ items: College[] }>('meta:colleges', (signal) => get('/meta/colleges', undefined, signal));
  const [role, setRole] = useState<Role>('student');
  const [collegeId, setCollegeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [info, setInfo] = useState({ enrollmentNumber: '', admissionYear: '', employeeId: '', designation: '', organization: '', linkedinUrl: '' });
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);

  // With a single college on this server, it is chosen for you.
  useEffect(() => {
    const items = colleges.data?.items ?? [];
    if (items.length === 1 && !collegeId) setCollegeId(items[0]!.id);
  }, [colleges.data, collegeId]);

  const setField = (k: keyof typeof info, v: string) => setInfo((s) => ({ ...s, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!collegeId) e.collegeId = 'Choose your college.';
    if (name.trim().length < 2) e.displayName = 'Enter your name as people know it.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 10) e.password = 'Use at least 10 characters.';
    if (confirm !== password) e.confirm = 'The two passwords do not match.';
    if (role === 'student' && !info.enrollmentNumber.trim()) e['roleInfo.enrollmentNumber'] = 'Enter your enrolment (PRN) number.';
    if (role === 'faculty' && !info.employeeId.trim()) e['roleInfo.employeeId'] = 'Enter your employee ID.';
    if (role !== 'student' && !info.designation.trim()) e['roleInfo.designation'] = role === 'faculty' ? 'Enter your designation, for example Assistant Professor.' : 'Enter your role, for example Senior Engineer.';
    if (role === 'expert' && !info.organization.trim()) e['roleInfo.organization'] = 'Enter your company or organisation.';
    if (role === 'expert' && info.linkedinUrl && !/^https:\/\/\S+$/.test(info.linkedinUrl.trim())) e['roleInfo.linkedinUrl'] = 'Use a full link that starts with https://';
    if (!terms) e.acceptTerms = 'Please accept the terms and privacy policy to continue.';
    if (!adult) e.confirmAdult = 'CampusConnect is for people aged 18 or over.';
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
      document.getElementById(first === 'displayName' ? 'name' : first.replace('roleInfo.', 'info-'))?.focus();
      return;
    }
    const roleInfo =
      role === 'student'
        ? { enrollmentNumber: info.enrollmentNumber.trim(), admissionYear: info.admissionYear ? Number(info.admissionYear) : undefined }
        : role === 'faculty'
          ? { employeeId: info.employeeId.trim(), designation: info.designation.trim() }
          : { organization: info.organization.trim(), designation: info.designation.trim(), linkedinUrl: info.linkedinUrl.trim() || undefined };
    setPending(true);
    try {
      await post('/auth/register', { email: email.trim(), password, displayName: name.trim(), role, roleInfo, collegeId, acceptTerms: terms, confirmAdult: adult, marketingOptIn: marketing });
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
      <AuthLayout title="Check your email" subtitle={<>We sent a link to <strong className="text-text">{email.trim()}</strong>. Open it to finish creating your account.</>}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <MailCheck className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <p className="font-sans text-[14px] text-text-2">The link works for 24 hours. Can&apos;t find it? Check spam or promotions, or send it again.</p>
          </div>
          {role !== 'student' && (
            <div className="flex items-start gap-3 rounded-2xl bg-info-soft p-4 text-info">
              <Hourglass className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="font-sans text-[14px]">Your {role === 'faculty' ? 'faculty' : 'expert'} access will be reviewed by your college. You can use CampusConnect as a student until it is approved, and we will tell you when it is.</p>
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
        </fieldset>

        <FormField id="collegeId" label="College" error={err('collegeId')}>
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

        <FormField id="name" label="Your name" error={err('displayName')}>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(err('displayName')) || undefined} />
        </FormField>
        <FormField id="email" label="Email" error={err('email')} hint="Any email you use: Gmail, Outlook, your college address…">
          <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(err('email')) || undefined} />
        </FormField>

          <motion.div key={role} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <p className="font-sans text-[13px] text-text-3">
              {role === 'student' ? 'Used only to confirm you study here. Never shown on your profile.' : 'Your college checks these details before giving you this role. Never shown publicly.'}
            </p>
            {role === 'student' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField id="info-enrollmentNumber" label="Enrolment (PRN) number" error={err('roleInfo.enrollmentNumber')}>
                  <Input id="info-enrollmentNumber" value={info.enrollmentNumber} onChange={(e) => setField('enrollmentNumber', e.target.value)} maxLength={40} autoCapitalize="characters" />
                </FormField>
                <FormField id="info-admissionYear" label="Year of admission">
                  <Select id="info-admissionYear" value={info.admissionYear} onChange={(e) => setField('admissionYear', e.target.value)}>
                    <option value="">Choose</option>
                    {Array.from({ length: 8 }, (_, i) => THIS_YEAR - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
            )}
            {role === 'faculty' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField id="info-employeeId" label="Employee ID" error={err('roleInfo.employeeId')}>
                  <Input id="info-employeeId" value={info.employeeId} onChange={(e) => setField('employeeId', e.target.value)} maxLength={40} />
                </FormField>
                <FormField id="info-designation" label="Designation" error={err('roleInfo.designation')}>
                  <Input id="info-designation" value={info.designation} onChange={(e) => setField('designation', e.target.value)} maxLength={120} placeholder="Assistant Professor" />
                </FormField>
              </div>
            )}
            {role === 'expert' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="info-organization" label="Company or organisation" error={err('roleInfo.organization')}>
                    <Input id="info-organization" value={info.organization} onChange={(e) => setField('organization', e.target.value)} maxLength={160} />
                  </FormField>
                  <FormField id="info-designation" label="Your role" error={err('roleInfo.designation')}>
                    <Input id="info-designation" value={info.designation} onChange={(e) => setField('designation', e.target.value)} maxLength={120} placeholder="Senior Engineer" />
                  </FormField>
                </div>
                <FormField id="info-linkedinUrl" label="LinkedIn (optional)" error={err('roleInfo.linkedinUrl')}>
                  <Input id="info-linkedinUrl" value={info.linkedinUrl} onChange={(e) => setField('linkedinUrl', e.target.value)} inputMode="url" placeholder="https://www.linkedin.com/in/…" />
                </FormField>
              </>
            )}
          </motion.div>

        <FormField id="password" label="Password" error={err('password')}>
          <PasswordInput id="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(err('password'))} aria-describedby="password-hints" />
        </FormField>
        <div id="password-hints">
          <PasswordHints password={password} email={email} name={name} />
        </div>
        <FormField id="confirm" label="Confirm password" error={err('confirm')}>
          <PasswordInput id="confirm" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(err('confirm'))} />
        </FormField>

        <fieldset className="space-y-3 pt-1">
          <legend className="sr-only">Agreements</legend>
          <Checkbox id="acceptTerms" checked={terms} onChange={setTerms} error={err('acceptTerms')}>
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="font-semibold text-accent hover:underline">Terms of service</Link> and have read the{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:underline">Privacy policy</Link>.
          </Checkbox>
          <Checkbox id="confirmAdult" checked={adult} onChange={setAdult} error={err('confirmAdult')}>
            I am 18 or older.
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
