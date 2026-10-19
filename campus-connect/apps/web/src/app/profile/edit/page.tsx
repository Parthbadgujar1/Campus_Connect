'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { college, me } from '@/data/people';

const BIO_LIMIT = 160;

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function EditProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: me.name,
    username: me.username,
    bio: me.bio ?? '',
    branch: me.branch ?? college.departments[0] ?? '',
    year: String(me.year ?? 1),
    semester: String(me.semester ?? 1),
    division: me.division ?? 'A',
    skills: me.skills.join(', '),
    interests: me.interests.join(', '),
    github: me.github ?? '',
    linkedin: me.linkedin ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'username', string>>>({});

  const update = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^[a-z0-9._]{3,24}$/i.test(form.username)) next.username = '3–24 letters, numbers, dots or underscores.';
    setErrors(next);
    if (Object.keys(next).length) return;
    toast('Profile saved');
    router.push('/profile/me');
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Edit profile"
        back
        backHref="/profile/me"
        actions={
          <Button size="sm" type="submit" form="edit-profile-form">
            Save
          </Button>
        }
      />

      <form id="edit-profile-form" onSubmit={submit} className="mt-4 space-y-6" noValidate>
        <Card className="flex items-center gap-4 p-4">
          <Avatar name={form.name || me.name} seed={me.id} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Profile photo</p>
            <p className="text-xs text-text-3">Photos are uploaded from the mobile app in this preview.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => toast('Photo upload opens on device (demo)')} type="button">
            Change
          </Button>
        </Card>

        <section className="space-y-4">
          <SectionHeader title="Basics" />
          <Field label="Full name" htmlFor="pf-name" hint={errors.name ? undefined : 'Shown on your posts and chats'}>
            <Input id="pf-name" value={form.name} onChange={(e) => update('name')(e.target.value)} aria-invalid={!!errors.name} />
            {errors.name && <p role="alert" className="text-xs text-danger">{errors.name}</p>}
          </Field>
          <Field label="Username" htmlFor="pf-username">
            <div className="flex items-center rounded-xl border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <span className="pl-3.5 text-text-3">@</span>
              <Input
                id="pf-username"
                value={form.username}
                onChange={(e) => update('username')(e.target.value)}
                aria-invalid={!!errors.username}
                className="h-11 border-0 bg-transparent px-1.5 focus:ring-0"
              />
            </div>
            {errors.username && <p role="alert" className="text-xs text-danger">{errors.username}</p>}
          </Field>
          <Field label="Bio" htmlFor="pf-bio" hint={`${form.bio.length}/${BIO_LIMIT}`}>
            <Textarea id="pf-bio" value={form.bio} maxLength={BIO_LIMIT} onChange={(e) => update('bio')(e.target.value)} />
          </Field>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Academics" description="Used for matching, feeds and eligibility" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Department" htmlFor="pf-branch">
              <Select id="pf-branch" value={form.branch} onChange={(e) => update('branch')(e.target.value)}>
                {college.departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label="Year" htmlFor="pf-year">
              <Select id="pf-year" value={form.year} onChange={(e) => update('year')(e.target.value)}>
                {college.years.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Semester" htmlFor="pf-sem">
              <Select id="pf-sem" value={form.semester} onChange={(e) => update('semester')(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Division" htmlFor="pf-div">
              <Select id="pf-div" value={form.division} onChange={(e) => update('division')(e.target.value)}>
                {college.divisions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Skills & links" />
          <Field label="Skills" htmlFor="pf-skills" hint="Separate with commas">
            <Input id="pf-skills" value={form.skills} onChange={(e) => update('skills')(e.target.value)} />
          </Field>
          <Field label="Interests" htmlFor="pf-interests" hint="Used for recommendations">
            <Input id="pf-interests" value={form.interests} onChange={(e) => update('interests')(e.target.value)} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="GitHub" htmlFor="pf-gh">
              <Input id="pf-gh" placeholder="github.com/you" value={form.github} onChange={(e) => update('github')(e.target.value)} />
            </Field>
            <Field label="LinkedIn" htmlFor="pf-li">
              <Input id="pf-li" placeholder="linkedin.com/in/you" value={form.linkedin} onChange={(e) => update('linkedin')(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-text-3">
            {splitList(form.skills).length} skills · {splitList(form.interests).length} interests. Who sees these is controlled in{' '}
            <Link href="/settings/privacy" className="font-semibold text-accent">
              privacy controls
            </Link>
            .
          </p>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => router.back()} type="button">
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </div>
  );
}
