'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GraduationCap, Handshake, Shield, UserRound, type LucideIcon } from 'lucide-react';
import { college, getPerson, me } from '@/data/people';
import { mentors } from '@/data/careers';
import { appActions, useAppState, type Session } from '@/lib/store';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Option {
  role: Role;
  title: string;
  description: string;
  icon: LucideIcon;
  name: string;
  email: string;
}

const expert = getPerson(mentors[0]?.personId ?? 'p-harsh');
const faculty = getPerson('f-anita');

const OPTIONS: Option[] = [
  {
    role: 'student',
    title: 'Student',
    description: 'Campus, spaces, chats, study circles and your profile.',
    icon: UserRound,
    name: me.name,
    email: `${me.username}@${college.domain}`,
  },
  {
    role: 'faculty',
    title: 'Teacher',
    description: 'Upload lectures, answer questions and review shared notes.',
    icon: GraduationCap,
    name: faculty.name,
    email: `${faculty.username}@${college.domain}`,
  },
  {
    role: 'expert',
    title: 'Industry expert',
    description: 'Mentor students, post opportunities and answer questions.',
    icon: Handshake,
    name: expert.name,
    email: `${expert.username}@partners.${college.domain}`,
  },
  {
    role: 'admin',
    title: 'Admin',
    description: 'Approve content, handle reports and send notices.',
    icon: Shield,
    name: 'Campus office',
    email: `office@${college.domain}`,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const signedIn = useAppState((s) => s.session);
  const [choice, setChoice] = useState<Role>('student');
  const selected = OPTIONS.find((o) => o.role === choice) ?? OPTIONS[0]!;

  const enter = (option: Option) => {
    const session: Session = { role: option.role, name: option.name, email: option.email };
    appActions.signIn(session);
    router.replace('/');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-[14px] font-semibold text-accent">CampusConnect</p>
      <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-tight">Sign in to {college.shortName}</h1>
      <p className="mt-2 text-[15px] text-text-2">Use your college email. Choose how you're joining today.</p>

      <div role="radiogroup" aria-label="Who are you?" className="mt-7 grid gap-2.5">
        {OPTIONS.map((option) => {
          const active = option.role === choice;
          const Icon = option.icon;
          return (
            <button
              key={option.role}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(option.role)}
              className={cn(
                'flex items-start gap-3.5 rounded-2xl border bg-surface p-4 text-left transition-colors',
                active ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-text-3',
              )}
            >
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2')}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-semibold">{option.title}</span>
                <span className="block text-[14px] text-text-3">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-[13px] font-semibold text-text-3">Signing in as</p>
        <p className="mt-1 text-[15px] font-semibold">{selected.name}</p>
        <p className="text-[14px] text-text-2">{selected.email}</p>
      </div>

      <button
        type="button"
        onClick={() => enter(selected)}
        className="mt-5 h-12 rounded-full bg-accent text-[15px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Continue as {selected.title.toLowerCase()}
      </button>
      <p className="mt-4 text-center text-[13px] text-text-3">
        Demo sign-in. Real accounts with college email verification arrive with the backend.
      </p>
      {signedIn && (
        <button type="button" onClick={() => router.replace('/')} className="mt-2 text-center text-[14px] font-semibold text-accent">
          Back to the app
        </button>
      )}
    </main>
  );
}
