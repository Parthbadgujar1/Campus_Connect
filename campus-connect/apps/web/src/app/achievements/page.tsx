'use client';

import { Award, BookOpen, Code2, Flame, HandHeart, Medal, MessageCircle, Star, Trophy, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { badges, leaderboard, xpSummary } from '@/data/fun';
import { getPerson, me } from '@/data/people';
import { cn } from '@/lib/utils';

const ICONS: Record<(typeof badges)[number]['icon'], LucideIcon> = {
  hack: Flame,
  help: HandHeart,
  book: BookOpen,
  volunteer: Users,
  chat: MessageCircle,
  trophy: Trophy,
  code: Code2,
  star: Star,
};

const XP_RULES = [
  { label: 'Answer a help request (marked helpful)', xp: '+25' },
  { label: 'Share an approved resource', xp: '+40' },
  { label: 'Attend an event with check-in', xp: '+30' },
  { label: 'Complete a volunteer hour', xp: '+20' },
  { label: 'Win a campus quiz', xp: '+50' },
];

export default function AchievementsPage() {
  const sorted = [...leaderboard].sort((a, b) => b.xp - a.xp);
  const earned = badges.filter((b) => b.earned).length;
  const levelPct = (xpSummary.xp / xpSummary.nextLevelXp) * 100;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Achievements" subtitle="XP, badges and campus rankings" back backHref="/campus" />

      <Card className="mt-4 space-y-4 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-accent text-2xl font-extrabold text-accent-ink">
            {xpSummary.level}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Level {xpSummary.level} · Contributor</p>
            <p className="text-sm text-text-3">
              {xpSummary.xp.toLocaleString('en-IN')} XP · {(xpSummary.nextLevelXp - xpSummary.xp).toLocaleString('en-IN')} to level {xpSummary.level + 1}
            </p>
          </div>
          <Badge tone="accent">#{xpSummary.rankInCollege} in college</Badge>
        </div>
        <ProgressBar value={levelPct} label="Progress to next level" />
      </Card>

      <section className="mt-7">
        <SectionHeader title="Badges" description={`${earned} of ${badges.length} earned`} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {badges.map((badge) => {
            const Icon = ICONS[badge.icon];
            return (
              <Card key={badge.id} className={cn('flex flex-col items-start gap-3 p-4', !badge.earned && 'opacity-70')}>
                <span className={cn('grid h-11 w-11 place-items-center rounded-xl', badge.earned ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-text-3')}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{badge.name}</p>
                  <p className="text-xs text-text-3">{badge.description}</p>
                </div>
                <div className="mt-auto w-full space-y-1">
                  {badge.earned ? (
                    <Badge tone="success">Earned</Badge>
                  ) : (
                    <>
                      <ProgressBar value={badge.progress} max={badge.target} label={`${badge.name} progress`} className="h-1.5" />
                      <p className="text-[11px] text-text-3">
                        {badge.progress} / {badge.target}
                      </p>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="College leaderboard" description="Resets at the start of each month" />
        <Card className="divide-y divide-border overflow-hidden">
          {sorted.map((row, i) => {
            const isMe = row.personId === me.id;
            const person = getPerson(row.personId);
            return (
              <div key={row.personId} className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-accent-soft/60')}>
                <span className="w-7 text-center text-sm font-bold text-text-3">
                  {i === 0 ? <Medal className="mx-auto h-5 w-5 text-warning" aria-label="First" /> : i + 1}
                </span>
                <Avatar name={isMe ? me.name : person.name} seed={person.id} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{isMe ? 'You' : person.name}</span>
                <span className="text-sm font-bold tabular-nums">{row.xp.toLocaleString('en-IN')}</span>
              </div>
            );
          })}
        </Card>
      </section>

      <section className="mt-8">
        <SectionHeader title="How to earn XP" />
        <Card className="divide-y divide-border">
          {XP_RULES.map((rule) => (
            <div key={rule.label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-text-2">{rule.label}</span>
              <span className="font-bold text-success">{rule.xp} XP</span>
            </div>
          ))}
        </Card>
        <p className="mt-3 flex items-center gap-2 text-xs text-text-3">
          <Award className="h-3.5 w-3.5" aria-hidden="true" />
          Points are awarded when a moderator or an organiser confirms the action.
        </p>
      </section>
    </div>
  );
}
