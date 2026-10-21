'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { FormField } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage, get, isApiError, patch, upload } from '@/lib/api/client';
import { invalidate, useQuery } from '@/lib/api/hooks';
import type { FileView, Me } from '@/lib/api/types';
import { useSession } from '@/lib/session';

const LINKS = [
  ['github', 'GitHub', 'https://github.com/you'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/in/you'],
  ['portfolio', 'Portfolio', 'https://your-site.com'],
  ['leetcode', 'LeetCode', 'https://leetcode.com/you'],
] as const;

const splitList = (v: string) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 30);

function EditForm({ me }: { me: Me }) {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useSession();
  const p = me.profile;
  const departments = useQuery<{ items: Array<{ id: string; name: string }> }>(`meta:departments:${me.college.slug}`, (s) => get(`/meta/colleges/${me.college.slug}/departments`, undefined, s));
  const [form, setForm] = useState({
    displayName: p.displayName,
    username: p.username,
    headline: p.headline ?? '',
    bio: p.bio ?? '',
    departmentId: p.departmentId ?? '',
    year: p.year ? String(p.year) : '',
    semester: p.semester ? String(p.semester) : '',
    division: p.division ?? '',
    skills: p.skills.join(', '),
    interests: p.interests.join(', '),
    ...Object.fromEntries(LINKS.map(([k]) => [k, p.links[k] ?? ''])),
  } as Record<string, string>);
  const [avatar, setAvatar] = useState<{ id: string | null; url: string | null }>({ id: null, url: p.avatarUrl });
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const f = await upload<FileView>('avatar', file);
      setAvatar({ id: f.id, url: f.thumbnailUrl ?? f.url });
      setAvatarChanged(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (form.displayName!.trim().length < 2) local.displayName = 'Enter your name.';
    if (!/^[A-Za-z0-9._]{3,24}$/.test(form.username!)) local.username = 'Use 3–24 letters, numbers, dots or underscores.';
    for (const [k, label] of LINKS) if (form[k] && !/^https:\/\/\S+$/.test(form[k]!)) local[k] = `${label} must be a full link starting with https://`;
    setErrors(local);
    if (Object.keys(local).length) return;
    setPending(true);
    setFormError(null);
    try {
      await patch('/me/profile', {
        displayName: form.displayName!.trim(),
        username: form.username!.trim(),
        headline: form.headline!.trim() || null,
        bio: form.bio!.trim() || null,
        departmentId: form.departmentId || null,
        year: form.year ? Number(form.year) : null,
        semester: form.semester ? Number(form.semester) : null,
        division: form.division!.trim() || null,
        skills: splitList(form.skills!),
        interests: splitList(form.interests!),
        links: Object.fromEntries(LINKS.map(([k]) => [k, form[k]?.trim() || undefined]).filter(([, v]) => v)),
        ...(avatarChanged ? { avatarFileId: avatar.id } : {}),
      });
      await refresh();
      invalidate('profile:', 'feed:', 'home:');
      toast('Profile saved');
      router.push('/you');
    } catch (err) {
      if (isApiError(err) && Object.keys(err.fields).length) setErrors(err.fields);
      else setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {formError && <FormAlert>{formError}</FormAlert>}
      <section aria-label="Photo">
        <SectionHeader title="Photo" description="A clear photo helps classmates recognise you. JPG, PNG or WebP, up to 5 MB." />
        <Card className="flex items-center gap-4 p-4">
          <PersonAvatar person={{ id: me.id, displayName: form.displayName || p.displayName, username: p.username, avatarUrl: avatar.url }} size="lg" />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading}>
              {uploading ? <Spinner /> : <Camera className="h-4 w-4" aria-hidden="true" />} {avatar.url ? 'Change photo' : 'Add photo'}
            </Button>
            {avatar.url && (
              <Button variant="ghost" size="sm" onClick={() => { setAvatar({ id: null, url: null }); setAvatarChanged(true); }}>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
              </Button>
            )}
          </div>
        </Card>
      </section>

      <section aria-label="Basics" className="space-y-4">
        <SectionHeader title="Basics" />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="displayName" label="Name" error={errors.displayName}>
            <Input id="displayName" value={form.displayName} onChange={set('displayName')} maxLength={80} autoComplete="name" />
          </FormField>
          <FormField id="username" label="Username" error={errors.username} hint="Your profile address: /profile/username">
            <Input id="username" value={form.username} onChange={set('username')} maxLength={24} autoCapitalize="none" spellCheck={false} />
          </FormField>
        </div>
        <FormField id="headline" label="Headline" hint="One line, e.g. “TE Comp · loves backend and badminton”">
          <Input id="headline" value={form.headline} onChange={set('headline')} maxLength={120} />
        </FormField>
        <FormField id="bio" label="Bio" hint={`${form.bio!.length}/300`}>
          <Textarea id="bio" value={form.bio} onChange={set('bio')} maxLength={300} />
        </FormField>
      </section>

      <section aria-label="Class" className="space-y-4">
        <SectionHeader title="Class" description="Used for class and department posts. Choose who sees it in Privacy controls." />
        <FormField id="departmentId" label="Department">
          <Select id="departmentId" value={form.departmentId} onChange={set('departmentId')}>
            <option value="">Not set</option>
            {departments.data?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField id="year" label="Year">
            <Select id="year" value={form.year} onChange={set('year')}>
              <option value="">–</option>
              {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </FormField>
          <FormField id="semester" label="Semester">
            <Select id="semester" value={form.semester} onChange={set('semester')}>
              <option value="">–</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField id="division" label="Division">
            <Input id="division" value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value.toUpperCase() }))} maxLength={8} />
          </FormField>
        </div>
      </section>

      <section aria-label="Skills and interests" className="space-y-4">
        <SectionHeader title="Skills & interests" description="Separate with commas." />
        <FormField id="skills" label="Skills"><Input id="skills" value={form.skills} onChange={set('skills')} /></FormField>
        <FormField id="interests" label="Interests"><Input id="interests" value={form.interests} onChange={set('interests')} /></FormField>
      </section>

      <section aria-label="Links" className="space-y-4">
        <SectionHeader title="Links" />
        <div className="grid gap-4 sm:grid-cols-2">
          {LINKS.map(([k, label, placeholder]) => (
            <FormField key={k} id={k} label={label} error={errors[k] ?? errors[`links.${k}`]}>
              <Input id={k} type="url" inputMode="url" value={form[k]} onChange={set(k)} placeholder={placeholder} />
            </FormField>
          ))}
        </div>
      </section>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 flex justify-end gap-2 rounded-2xl border border-border bg-[var(--surface-solid)] p-3 shadow-float md:bottom-4">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending || uploading} aria-busy={pending}>{pending && <Spinner />} Save profile</Button>
      </div>
    </form>
  );
}

export default function EditProfilePage() {
  const { user } = useSession();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-40 md:px-8 md:pb-16">
      <PageHeader title="Edit profile" back backHref="/you" />
      {user ? <EditForm me={user} /> : <SkeletonList count={2} />}
    </div>
  );
}
