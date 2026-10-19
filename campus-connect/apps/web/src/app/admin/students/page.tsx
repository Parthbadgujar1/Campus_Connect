'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Search, XCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Input } from '@/components/ui/fields';
import { Card, EmptyState, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { verificationQueue } from '@/data/admin';
import { allPeople, getPerson, students } from '@/data/people';
import { relativeTime } from '@/lib/time';

const BRANCH_FILTERS = ['All', 'Computer Engineering', 'Information Technology', 'Electrical Engineering', 'Electronics & Telecom', 'Mechanical Engineering', 'Civil Engineering'] as const;

export default function AdminStudentsPage() {
  const toast = useToast();
  const [queue, setQueue] = useState(verificationQueue.map((q) => ({ ...q })));
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState<(typeof BRANCH_FILTERS)[number]>('All');

  const directory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => branch === 'All' || s.branch === branch)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  }, [query, branch]);

  const decide = (id: string, status: 'approved' | 'rejected', name: string) => {
    setQueue((list) => list.filter((q) => q.id !== id));
    toast(status === 'approved' ? `${name} verified` : `${name}: ID rejected, student notified`);
  };

  return (
    <div className="space-y-8 px-4 pb-28 md:px-8 md:pb-12">
      <section>
        <SectionHeader title="Verification queue" description={`${queue.length} waiting · reviewed within 24 hours`} />
        {queue.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Queue is clear" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {queue.map((item) => {
              const person = getPerson(item.personId);
              return (
                <Card key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={person.name} seed={person.id} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{person.name}</p>
                      <p className="text-xs text-text-3">
                        {person.branch ?? person.department} · Year {person.year ?? '—'}
                      </p>
                      <p className="mt-1 text-xs text-text-2">
                        {item.method} · {relativeTime(item.submittedAt)} ago
                      </p>
                    </div>
                  </div>
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-surface-2 text-xs text-text-3">
                    ID photo preview (blurred in admin view)
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => decide(item.id, 'approved', person.name)}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" className="flex-1" onClick={() => decide(item.id, 'rejected', person.name)}>
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Reject
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Student directory" description={`${allPeople.filter((p) => p.role === 'student').length} student profiles in this preview`} />
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or username" aria-label="Search students" className="pl-10" />
          </div>
          <ChipRow>
            {BRANCH_FILTERS.map((item) => (
              <Chip key={item} active={branch === item} onClick={() => setBranch(item)}>
                {item}
              </Chip>
            ))}
          </ChipRow>
          <Card className="divide-y divide-border overflow-hidden">
            <div className="hidden grid-cols-[1fr_1fr_80px_100px] gap-4 bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-2 md:grid">
              <span>Student</span>
              <span>Branch</span>
              <span>Year</span>
              <span>Status</span>
            </div>
            {directory.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 md:grid md:grid-cols-[1fr_1fr_80px_100px] md:gap-4">
                <Avatar name={s.name} seed={s.id} size="sm" />
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-text-3">@{s.username}</p>
                </div>
                <span className="hidden truncate text-sm text-text-2 md:block">{s.branch}</span>
                <span className="hidden text-sm md:block">{s.year}</span>
                <span className="shrink-0">
                  <Badge tone={s.verified ? 'success' : 'warning'}>{s.verified ? 'Verified' : 'Pending'}</Badge>
                </span>
              </div>
            ))}
            {directory.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-3">No students match.</p>}
          </Card>
        </div>
      </section>
    </div>
  );
}
