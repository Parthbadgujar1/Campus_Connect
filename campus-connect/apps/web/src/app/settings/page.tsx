'use client';

import { useRouter } from 'next/navigation';
import { Award, Bell, Briefcase, CircleHelp, Heart, IdCard, Info, Lock, LogOut, Pencil, ShieldAlert, ShieldCheck, ShieldHalf } from 'lucide-react';
import { Card, ListRow, PageHeader, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { AmbiencePanel } from '@/components/shell/ambience';
import { appActions } from '@/lib/store';

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Settings" subtitle="Account, privacy, notifications and ambience" back backHref="/you" />

      <section className="mt-4" aria-labelledby="set-ambience">
        <SectionHeader title="Ambience" description="How the app looks and moves" />
        <Card className="p-4 md:p-5">
          <AmbiencePanel />
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="set-account">
        <SectionHeader title="Account" />
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={Pencil} title="Edit profile" subtitle="Name, bio, branch, skills and links" href="/profile/edit" />
          <ListRow icon={ShieldCheck} title="College verification" subtitle="Email, student ID and trust level" href="/verify" />
          <ListRow icon={IdCard} title="Digital student ID" subtitle="QR pass for library, events and campus" href="/id" />
          <ListRow icon={Briefcase} title="Career profile" subtitle="Projects, certificates and portfolio" href="/profile/me" />
          <ListRow icon={Award} title="Achievements" subtitle="XP, badges and rank" href="/achievements" />
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="set-privacy">
        <SectionHeader title="Privacy & safety" />
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={Lock} title="Privacy controls" subtitle="Who can see and message you" href="/settings/privacy" />
          <ListRow icon={Heart} title="Connect privacy" subtitle="Opt-in dating, incognito and campus-only" href="/connect" />
          <ListRow icon={ShieldHalf} title="Blocked & reports" subtitle="People you blocked and reports you filed" href="/settings/privacy#blocked" />
          <ListRow icon={ShieldAlert} title="Safety & emergency" subtitle="Emergency contacts and SOS" href="/safety" />
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="set-notif">
        <SectionHeader title="Notifications" />
        <Card className="overflow-hidden">
          <ListRow icon={Bell} title="Notification settings" subtitle="Messages, deadlines, events, travel and more" href="/settings/notifications" />
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="set-help">
        <SectionHeader title="Help & about" />
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={CircleHelp} title="Student help board" subtitle="Notes, project help and recommendations" href="/help" />
          <ListRow icon={Info} title="About CampusConnect" subtitle="Front-end preview · mock data" onClick={() => toast('CampusConnect front-end preview · mock data')} />
        </Card>
      </section>

      <div className="mt-8">
        <Card className="overflow-hidden">
          <ListRow
            icon={LogOut}
            title="Sign out"
            danger
            onClick={() => {
              appActions.signOut();
              router.replace('/login');
            }}
          />
        </Card>
      </div>
    </div>
  );
}
