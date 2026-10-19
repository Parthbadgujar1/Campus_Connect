'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CalendarRange, Users, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DetailHero, EmptyState, MetaLine, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { teamPosts } from '@/data/careers';
import { getPerson, me } from '@/data/people';

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const team = teamPosts.find((t) => t.id === id);
  const toast = useToast();
  const [requested, setRequested] = useState(false);

  if (!team) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Team" back backHref="/teams" />
        <EmptyState icon={Users} title="This team post is closed" className="mt-6" />
      </div>
    );
  }

  const owner = getPerson(team.ownerId);
  const open = team.spots - team.filled;
  const mySkills = me.skills.map((s) => s.toLowerCase());
  const fit = team.lookingFor.filter((s) => mySkills.some((mine) => s.toLowerCase().includes(mine) || mine.includes(s.toLowerCase())));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={team.title} back backHref="/teams" />

      <div className="mt-2 space-y-5 md:mt-4">
        <DetailHero seed={team.seed} icon={Users} eyebrow={team.type} title={team.title}>
          <MetaLine icon={CalendarRange}>{team.timeline}</MetaLine>
          <MetaLine icon={Users}>
            {team.filled} of {team.spots} spots filled · {open > 0 ? `${open} open` : 'Team full'}
          </MetaLine>
          <div className="pt-1">
            <ProgressBar value={team.filled} max={team.spots} tone={open > 0 ? 'accent' : 'success'} label="Team fill" />
          </div>
        </DetailHero>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="flex-1"
            disabled={open === 0 || requested}
            onClick={() => {
              setRequested(true);
              toast(`Request sent to ${owner.name.split(' ')[0]}`);
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {open === 0 ? 'Team is full' : requested ? 'Request sent' : 'Request to join'}
          </Button>
          <Link href={`/profile/${owner.username}`} className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-border bg-surface px-6 text-[15px] font-semibold hover:bg-surface-2">
            <Avatar name={owner.name} seed={owner.id} size="xs" />
            Owner: {owner.name.split(' ')[0]}
          </Link>
        </div>

        <Card className="space-y-3 p-5">
          <SectionHeader title="About the project" />
          <p className="text-[15px] leading-relaxed text-text-2">{team.description}</p>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="space-y-3 p-5">
            <p className="font-semibold">Roles needed</p>
            <div className="flex flex-wrap gap-2">
              {team.lookingFor.map((skill) => (
                <Badge key={skill} tone={fit.includes(skill) ? 'success' : 'neutral'}>
                  {skill}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-text-3">
              {fit.length > 0 ? `You match ${fit.length} of ${team.lookingFor.length} roles.` : 'Add skills to your profile to see how well you fit.'}
            </p>
          </Card>

          <Card className="space-y-3 p-5">
            <p className="font-semibold">Members</p>
            <ul className="space-y-3">
              {team.members.map((memberId) => {
                const member = getPerson(memberId);
                return (
                  <li key={memberId} className="flex items-center gap-3">
                    <Avatar name={member.name} seed={member.id} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
                    {memberId === team.ownerId && <Badge tone="accent">Lead</Badge>}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-text-3">{team.requests} people have requested to join.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
