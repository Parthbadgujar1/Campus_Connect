'use client';

import { useMemo, useState } from 'react';
import { Heart, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { creatorProjects } from '@/data/fun';
import { getPerson } from '@/data/people';
import { compactNumber } from '@/lib/visuals';
import { cn } from '@/lib/utils';

// Makers: student projects that want attention, feedback or teammates.
const KINDS = ['All', 'Coding', 'Design', 'Videos', 'Music', 'Startups'] as const;

export default function MakersPage() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All');
  const [interested, setInterested] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);

  const projects = useMemo(() => creatorProjects.filter((p) => kind === 'All' || p.kind === kind), [kind]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Makers" subtitle="Student projects, looking for feedback and teammates" back backHref="/discover" />

      <ChipRow className="mt-4">
        {KINDS.map((item) => (
          <Chip key={item} active={kind === item} onClick={() => setKind(item)}>
            {item}
          </Chip>
        ))}
      </ChipRow>

      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {projects.map((project) => {
          const maker = getPerson(project.authorId);
          const isLiked = liked.includes(project.id);
          const wantsHelp = interested.includes(project.id);
          return (
            <li key={project.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <Avatar name={maker.name} seed={maker.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{maker.name}</p>
                  <p className="text-[13px] text-text-3">
                    {project.kind} · {maker.branch ?? 'Campus'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[17px] font-semibold leading-snug">{project.title}</p>
                <p className="mt-1 text-[14px] text-text-2">{project.blurb}</p>
              </div>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <button
                  type="button"
                  aria-pressed={isLiked}
                  onClick={() => setLiked((l) => (l.includes(project.id) ? l.filter((x) => x !== project.id) : [...l, project.id]))}
                  className={cn('flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold', isLiked ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
                >
                  <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} aria-hidden="true" />
                  {compactNumber(project.likes + (isLiked ? 1 : 0))}
                </button>
                <Button
                  size="sm"
                  variant={wantsHelp ? 'secondary' : 'primary'}
                  className="ml-auto"
                  aria-pressed={wantsHelp}
                  onClick={() => setInterested((l) => (l.includes(project.id) ? l.filter((x) => x !== project.id) : [...l, project.id]))}
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {wantsHelp ? 'Collaborating' : 'Collaborate'}
                </Button>
              </div>
            </li>
          );
        })}
        {projects.length === 0 && <li className="col-span-full py-12 text-center text-[15px] text-text-3">No projects in this area yet.</li>}
      </ul>
    </div>
  );
}
