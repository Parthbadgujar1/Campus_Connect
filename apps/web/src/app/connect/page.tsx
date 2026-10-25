'use client';

import { useState } from 'react';
import { Search, UsersRound } from 'lucide-react';
import { Segmented } from '@/components/ui/chip';
import { Input } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/layout';
import { Reveal } from '@/components/motion';
import { PeopleList } from '@/components/people/people-list';
import { useSession } from '@/lib/session';

// Crossed paths: people you are likely to know (same department, same year), and the whole
// college directory with search.

type Tab = 'class' | 'department' | 'everyone';

export default function ConnectPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>(user?.profile.year ? 'class' : user?.profile.departmentId ? 'department' : 'everyone');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const dept = user?.profile.departmentId ?? undefined;
  const year = user?.profile.year ?? undefined;
  const query = tab === 'class' ? { departmentId: dept, year } : tab === 'department' ? { departmentId: dept } : { q: search || undefined };
  const missing = (tab === 'class' && (!dept || !year)) || (tab === 'department' && !dept);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Crossed paths" subtitle="People you share a class or department with" back backHref="/discover" />
      <Reveal className="space-y-3">
        <Segmented<Tab>
          label="Who to show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'class', label: 'My year' },
            { value: 'department', label: 'My department' },
            { value: 'everyone', label: 'Everyone' },
          ]}
        />
        {tab === 'everyone' && (
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-3" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, username or skill" className="pl-10" aria-label="Search people" enterKeyHint="search" />
          </form>
        )}
      </Reveal>
      <div className="mt-4">
        {missing ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-[14px] text-text-3">Add your department and year in Edit profile to see your classmates here.</p>
        ) : (
          <PeopleList cacheKey={`connect:${tab}:${search}`} query={query} empty={{ icon: UsersRound, title: 'No one found', description: tab === 'everyone' ? 'Try a different name or skill.' : 'Nobody else from your class has joined yet. Invite them!' }} />
        )}
      </div>
    </div>
  );
}
