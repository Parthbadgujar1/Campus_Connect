'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, Check, GraduationCap, Palette, PartyPopper, Sparkles } from 'lucide-react';
import { FontPicker, THEME_OPTIONS } from '@/components/shell/ambience';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Input, Select } from '@/components/ui/fields';
import { FormAlert, Spinner } from '@/components/ui/states';
import { get, isApiError, patch, put } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import { useSession } from '@/lib/session';
import { useAppState, type TextSize } from '@/lib/store';
import { cn } from '@/lib/utils';

const INTERESTS = [
  'Coding', 'AI & ML', 'Web dev', 'App dev', 'Cyber security', 'Robotics', 'Electronics', 'Design', 'Photography', 'Music', 'Dance',
  'Drama', 'Sports', 'Cricket', 'Football', 'Badminton', 'Chess', 'Gaming', 'Reading', 'Writing', 'Startups', 'Finance', 'Volunteering',
  'Travel', 'Fitness', 'Anime', 'Movies', 'Hackathons', 'Open source', 'Research', 'GATE prep', 'Placements',
];

const STEPS = [
  { key: 'welcome', title: 'Welcome', icon: Sparkles },
  { key: 'class', title: 'Your class', icon: GraduationCap },
  { key: 'interests', title: 'Interests', icon: Sparkles },
  { key: 'look', title: 'Look & feel', icon: Palette },
  { key: 'notify', title: 'Notifications', icon: Bell },
  { key: 'done', title: 'All set', icon: PartyPopper },
] as const;

export default function WelcomePage() {
  const router = useRouter();
  const { user, refresh, updateSettings } = useSession();
  const theme = useAppState((s) => s.theme);
  const textSize = useAppState((s) => s.textSize);
  const [step, setStep] = useState(0);
  const [departmentId, setDepartmentId] = useState(user?.profile.departmentId ?? '');
  const [year, setYear] = useState<string>(user?.profile.year ? String(user.profile.year) : '');
  const [semester, setSemester] = useState<string>(user?.profile.semester ? String(user.profile.semester) : '');
  const [division, setDivision] = useState(user?.profile.division ?? '');
  const [interests, setInterests] = useState<string[]>(user?.profile.interests ?? []);
  const [skills, setSkills] = useState<string>((user?.profile.skills ?? []).join(', '));
  const [digest, setDigest] = useState<'off' | 'daily' | 'weekly'>('weekly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const departments = useQuery<{ items: Array<{ id: string; name: string }> }>(
    user ? `meta:departments:${user.college.slug}` : null,
    (signal) => get(`/meta/colleges/${user!.college.slug}/departments`, undefined, signal),
  );

  // Move focus to each new step's heading so screen readers announce it.
  useEffect(() => headingRef.current?.focus(), [step]);

  const first = useMemo(() => user?.profile.displayName.split(' ')[0] ?? 'there', [user]);
  // Industry experts are not in a class or department, so they skip that step.
  const steps = useMemo(() => STEPS.filter((s) => s.key !== 'class' || user?.role !== 'expert'), [user?.role]);
  const current = steps[step]!;
  const isStudent = !user || user.role === 'student';

  const skipAll = async () => {
    await updateSettings({ onboarding: 'skipped', tour: 'skipped' }).catch(() => undefined);
    router.replace('/');
  };

  const finish = async (takeTour: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const skillList = skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);
      await patch('/me/profile', {
        departmentId: departmentId || null,
        year: year ? Number(year) : null,
        semester: semester ? Number(semester) : null,
        division: division.trim() || null,
        interests: interests.slice(0, 30),
        skills: skillList,
      });
      await put('/me/notification-preferences', { emailDigest: digest });
      await updateSettings({ onboarding: 'completed', ...(takeTour ? { tour: 'reset' as const } : { tour: 'skipped' as const }) });
      await refresh();
      router.replace('/');
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-10 pt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-sans text-[13px] font-semibold text-text-3">
          Step {step + 1} of {steps.length}
        </p>
        {step < steps.length - 1 && (
          <button type="button" onClick={skipAll} className="font-sans text-[14px] font-semibold text-text-2 hover:text-text">
            Skip setup
          </button>
        )}
      </div>
      <div className="mt-3 flex gap-1.5" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
        {steps.map((s, i) => (
          <span key={s.key} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-surface-3')} />
        ))}
      </div>

      <section className="animate-rise mt-8 flex-1" key={current.key} aria-labelledby="step-title">
        {current.key === 'welcome' && (
          <>
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="marker-heading hl-blue text-[32px] font-bold leading-tight outline-none">
              Hi {first}, welcome to {user && user.role !== 'expert' ? user.college.shortName : 'CampusConnect'}
            </h1>
            <p className="mt-3 text-[16px] text-text-2">Let&apos;s set things up so your feed, events and spaces fit you. It takes about a minute, and you can change everything later in Settings.</p>
            <ul className="font-sans mt-6 space-y-3 text-[15px]">
              {['See posts from your class and department', 'Get events and notices that matter to you', 'Find people and spaces with your interests'].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-success-soft text-success"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}

        {current.key === 'class' && (
          <>
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-[28px] outline-none">{isStudent ? 'Your class' : 'Your department'}</h1>
            <p className="mt-2 text-[15px] text-text-2">{isStudent ? 'Used to show you class and department posts. You choose who can see it on your profile.' : 'Used to show you your department’s posts and notices.'}</p>
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="dept" className="font-sans text-sm font-semibold">Department</label>
                {departments.loading ? <Spinner label="Loading departments" /> : (
                  <Select id="dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">Choose your department</option>
                    {departments.data?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                )}
              </div>
              {isStudent && <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="year" className="font-sans text-sm font-semibold">Year</label>
                  <Select id="year" value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="">–</option>
                    {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="sem" className="font-sans text-sm font-semibold">Semester</label>
                  <Select id="sem" value={semester} onChange={(e) => setSemester(e.target.value)}>
                    <option value="">–</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="div" className="font-sans text-sm font-semibold">Division</label>
                  <Input id="div" maxLength={8} value={division} onChange={(e) => setDivision(e.target.value.toUpperCase())} placeholder="A" />
                </div>
              </div>}
            </div>
          </>
        )}

        {current.key === 'interests' && (
          <>
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-[28px] outline-none">What are you into?</h1>
            <p className="mt-2 text-[15px] text-text-2">Pick a few. We use them to suggest spaces, events and people.</p>
            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Interests">
              {INTERESTS.map((i) => {
                const on = interests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setInterests((list) => (on ? list.filter((x) => x !== i) : [...list, i].slice(0, 30)))}
                    className={cn('press font-sans rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors', on ? 'border-accent bg-accent text-accent-ink' : 'border-border bg-surface hover:bg-surface-2')}
                  >
                    {on && <Check className="-ml-0.5 mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                    {i}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 space-y-1.5">
              <label htmlFor="skills" className="font-sans text-sm font-semibold">Skills (optional)</label>
              <Input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Python, Public speaking" />
              <p className="font-sans text-[13px] text-text-3">Separate with commas. Shown on your profile and used for opportunity matches.</p>
            </div>
          </>
        )}

        {current.key === 'look' && (
          <>
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-[28px] outline-none">Make it yours</h1>
            <p className="mt-2 text-[15px] text-text-2">Choose a theme and a font. You see the change right away.</p>
            <p className="font-sans mt-5 text-sm font-semibold">Theme</p>
            <div role="radiogroup" aria-label="Theme" className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {THEME_OPTIONS.map((o) => {
                const selected = o.value === theme;
                const Icon = o.icon;
                return (
                  <button key={o.value} type="button" role="radio" aria-checked={selected} onClick={() => void updateSettings({ theme: o.value }).catch(() => undefined)}
                    className={cn('press rounded-2xl border p-3 text-left transition-colors', selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2')}>
                    <span className="mb-2 flex h-12 items-end gap-1.5 rounded-xl p-2" style={{ background: o.swatch[0] }} aria-hidden="true">
                      <span className="h-5 flex-1 rounded-md" style={{ background: o.swatch[1] }} />
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: o.swatch[2] }} />
                    </span>
                    <span className="font-sans flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4" aria-hidden="true" />{o.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="font-sans mt-6 text-sm font-semibold">Font</p>
            <div className="mt-2"><FontPicker /></div>
            <p className="font-sans mt-6 text-sm font-semibold">Text size</p>
            <Segmented<TextSize>
              className="mt-2"
              label="Text size"
              value={textSize}
              onChange={(v) => void updateSettings({ textSize: v }).catch(() => undefined)}
              options={[{ value: 'sm', label: 'Smaller' }, { value: 'md', label: 'Default' }, { value: 'lg', label: 'Larger' }]}
            />
          </>
        )}

        {current.key === 'notify' && (
          <>
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="font-display text-[28px] outline-none">Stay in the loop</h1>
            <p className="mt-2 text-[15px] text-text-2">In-app notifications are on for messages, replies and events. Would you also like an email summary?</p>
            <div role="radiogroup" aria-label="Email summary" className="font-sans mt-5 grid gap-2.5">
              {([
                ['weekly', 'Weekly summary', 'One email on Sunday with what you missed'],
                ['daily', 'Daily summary', 'One short email each evening'],
                ['off', 'No summary emails', 'Only essential emails (security, password)'],
              ] as const).map(([value, label, hint]) => (
                <button key={value} type="button" role="radio" aria-checked={digest === value} onClick={() => setDigest(value)}
                  className={cn('press flex items-start gap-3 rounded-2xl border p-4 text-left', digest === value ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2')}>
                  <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', digest === value ? 'border-accent bg-accent' : 'border-text-3')} aria-hidden="true">
                    {digest === value && <span className="h-2 w-2 rounded-full bg-accent-ink" />}
                  </span>
                  <span><span className="block text-[15px] font-semibold">{label}</span><span className="block text-[13px] text-text-3">{hint}</span></span>
                </button>
              ))}
            </div>
            <p className="font-sans mt-4 text-[13px] text-text-3">Fine-tune each kind of notification later in Settings &gt; Notifications.</p>
          </>
        )}

        {current.key === 'done' && (
          <>
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="marker-heading hl-green text-[32px] font-bold leading-tight outline-none">You&apos;re all set, {first}!</h1>
            <p className="mt-3 text-[16px] text-text-2">Want a 30-second tour of where everything lives? You can skip it and replay it any time from Settings &gt; Help.</p>
            {error && <FormAlert className="mt-4">{error}</FormAlert>}
            <div className="mt-6 grid gap-2.5">
              <Button size="lg" onClick={() => finish(true)} disabled={saving} aria-busy={saving}>
                {saving && <Spinner />} Take the tour
              </Button>
              <Button size="lg" variant="secondary" onClick={() => finish(false)} disabled={saving}>
                Explore on my own
              </Button>
            </div>
          </>
        )}
      </section>

      {current.key !== 'done' && (
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}>
            {step === 0 ? "Let's go" : 'Continue'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </main>
  );
}
