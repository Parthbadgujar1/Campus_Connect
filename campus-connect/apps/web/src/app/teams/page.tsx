'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Lightbulb, Plus, Rocket, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Chip, ChipRow, Segmented } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { teamPosts } from '@/data/careers';
import { creatorProjects } from '@/data/fun';
import { getPerson } from '@/data/people';
import { cn } from '@/lib/utils';

type View = 'Find' | 'Mine' | 'Showcase';
const TYPES = ['All', 'Hackathon', 'Project', 'Research', 'Startup', 'Coding'] as const;

export default function TeamsPage() {
  const toast = useToast();
  const [view, setView] = useState<View>('Find');
  const [type, setType] = useState<(typeof TYPES)[number]>('All');
  const [postOpen, setPostOpen] = useState(false);

  const visible = teamPosts.filter((t) => type === 'All' || t.type === type);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Teams & projects"
        subtitle="Find teammates, co-founders and research partners"
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setPostOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Post
          </Button>
        }
      />

      <div className="mt-4">
        <Segmented<View>
          label="Team sections"
          value={view}
          onChange={setView}
          options={[
            { value: 'Find', label: 'Find teammates' },
            { value: 'Mine', label: 'My teams' },
            { value: 'Showcase', label: 'Showcase' },
          ]}
        />
      </div>

      {view === 'Find' && (
        <section className="mt-5 space-y-4">
          <ChipRow>
            {TYPES.map((item) => (
              <Chip key={item} active={type === item} onClick={() => setType(item)}>
                {item}
              </Chip>
            ))}
          </ChipRow>
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((team) => {
              const owner = getPerson(team.ownerId);
              const open = team.spots - team.filled;
              return (
                <Card key={team.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{team.type}</Badge>
                    <span className="text-xs text-text-3">{team.timeline}</span>
                  </div>
                  <Link href={`/teams/${team.id}`} className="font-semibold leading-snug hover:underline">
                    {team.title}
                  </Link>
                  <p className="line-clamp-2 text-sm text-text-2">{team.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {team.lookingFor.map((skill) => (
                      <Badge key={skill}>Need: {skill}</Badge>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-text-3">
                      <Avatar name={owner.name} seed={owner.id} size="xs" />
                      <span className="truncate">{owner.name.split(' ')[0]} · {team.requests} requests</span>
                    </span>
                    <span className={cn('text-xs font-semibold', open > 0 ? 'text-success' : 'text-text-3')}>
                      {open > 0 ? `${open} spot${open === 1 ? '' : 's'} open` : 'Full'}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {view === 'Mine' && (
        <section className="mt-5">
          <EmptyState
            icon={Users}
            title="You’re not in a team yet"
            description="Join a team from Find teammates, or post a requirement to recruit people for your idea."
            action={
              <Button variant="soft" onClick={() => setView('Find')}>
                Find a team
              </Button>
            }
          />
          <Card className="mt-5 space-y-3 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Lightbulb className="h-4 w-4 text-accent" aria-hidden="true" />
              Skill-based matching
            </p>
            <p className="text-sm text-text-2">Teams that need React or Python skills will appear first in your list because they match your profile.</p>
            <ProgressBar value={72} label="Profile readiness for teams" />
            <Link href="/profile/edit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Update skills
            </Link>
          </Card>
        </section>
      )}

      {view === 'Showcase' && (
        <section className="mt-5">
          <SectionHeader title="Project showcase" description="Finished work from students across departments" action={{ label: 'All creators', href: '/creators' }} />
          <div className="grid gap-3 md:grid-cols-2">
            {creatorProjects.slice(0, 4).map((project) => {
              const author = getPerson(project.authorId);
              return (
                <Card key={project.id} className="flex items-start gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
                    <Rocket className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{project.title}</p>
                    <p className="mt-0.5 text-xs text-text-3">
                      {project.kind} · {author.name}
                    </p>
                    <p className="mt-2 text-sm text-text-2">{project.blurb}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <Sheet
        open={postOpen}
        onClose={() => setPostOpen(false)}
        title="Post a team requirement"
        description="Tell people what you are building and who you need"
        footer={
          <Button full onClick={() => { setPostOpen(false); toast('Team post published (demo)'); }}>
            Publish
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="tp-title">
            <Input id="tp-title" placeholder="e.g. Hackathon team — 2 spots" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type" htmlFor="tp-type">
              <Select id="tp-type">
                {TYPES.slice(1).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Open spots" htmlFor="tp-spots">
              <Input id="tp-spots" type="number" min={1} max={10} defaultValue={2} />
            </Field>
          </div>
          <Field label="Skills you need" htmlFor="tp-skills" hint="Comma separated">
            <Input id="tp-skills" placeholder="Solidity, UI design" />
          </Field>
          <Field label="What is the project?" htmlFor="tp-desc">
            <Textarea id="tp-desc" placeholder="Goal, timeline and what each member will do" />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
