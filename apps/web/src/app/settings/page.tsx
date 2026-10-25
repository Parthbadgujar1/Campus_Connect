'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BadgeCheck, Bell, BookOpen, ClipboardList, Cookie, Database, FileText, HelpCircle, Info, KeyRound, Lock, LogOut, Mail, MapPinned, MessageSquareHeart, Pencil, RotateCcw, ShieldAlert, ShieldHalf, UserRound } from 'lucide-react';
import { AmbiencePanel } from '@/components/shell/ambience';
import { openCookieSettings } from '@/components/shell/cookie-banner';
import { startTour } from '@/components/shell/tour';
import { Card, ListRow, PageHeader, SectionHeader } from '@/components/ui/layout';
import { ConfirmDialog } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { ROLE_LABEL } from '@/lib/roles';

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, signOut, updateSettings } = useSession();
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const out = async (everywhere: boolean) => {
    setBusy(true);
    try {
      await signOut(everywhere);
      router.replace('/login');
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Settings" subtitle={user ? `Signed in as ${user.email}` : 'Account, privacy, notifications and appearance'} back backHref="/you" />

      <section className="mt-4" aria-label="Appearance">
        <SectionHeader title="Appearance" description="Theme, font, text size and motion. Saved to your account, so every device matches." />
        <Card className="p-4 md:p-5">
          <AmbiencePanel />
        </Card>
      </section>

      <section className="mt-8" aria-label="Account">
        <SectionHeader title="Account" />
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={Pencil} title="Edit profile" subtitle="Name, photo, bio, class, skills and links" href="/profile/edit" />
          <ListRow icon={KeyRound} title="Password & devices" subtitle="Change password, see where you are signed in, sign-in activity" href="/settings/security" />
          <ListRow icon={UserRound} title="Profile and details" subtitle="Name, photo, department, skills" href="/profile/edit" />
          <ListRow icon={BadgeCheck} title="Role & verification" subtitle={user ? (user.pendingRole ? `${ROLE_LABEL[user.role]} · ${user.pendingRole} access under review` : `${ROLE_LABEL[user.role]}${user.profile.isVerified ? ' · verified' : ' · get a verified badge'}`) : undefined} href="/verify" />
        </Card>
      </section>

      <section className="mt-8" aria-label="Privacy and safety">
        <SectionHeader title="Privacy & safety" />
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={Lock} title="Privacy controls" subtitle="Who can see your profile and message you" href="/settings/privacy" />
          <ListRow icon={ShieldHalf} title="Blocked people & my reports" subtitle="Unblock people and see what happened to your reports" href="/settings/privacy#blocked" />
          <ListRow icon={Database} title="Your data & account" subtitle="Delete your account" href="/settings/data" />
          <ListRow icon={Cookie} title="Cookie settings" subtitle="Only necessary cookies are on unless you choose otherwise" onClick={openCookieSettings} />
          <ListRow icon={ShieldAlert} title="Safety & emergency" subtitle="Emergency contacts and helplines" href="/safety" />
        </Card>
      </section>

      <section className="mt-8" aria-label="Notifications">
        <SectionHeader title="Notifications" />
        <Card className="overflow-hidden">
          <ListRow icon={Bell} title="Notification settings" subtitle="In-app alerts, email summaries and quiet hours" href="/settings/notifications" />
        </Card>
      </section>

      <section className="mt-8" aria-label="Feedback and surveys">
        <SectionHeader title="Feedback & surveys" description="Tell the team what works and what does not. Every message is read." />
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={MessageSquareHeart} title="Send feedback about the app" subtitle="Ideas, problems, praise or questions" href="/feedback?tab=send" />
          <ListRow icon={ClipboardList} title="Surveys" subtitle="Questions from CampusConnect" href="/feedback" />
          <ListRow icon={FileText} title="My feedback" subtitle="What you sent and what happened to it" href="/feedback?tab=mine" />
        </Card>
      </section>

      <section className="mt-8" aria-label="Help and about">
        <SectionHeader title="Help & about" />
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={MapPinned} title="Take the tour again" subtitle="A 30-second walk through where everything lives" onClick={() => { router.push('/'); setTimeout(startTour, 300); }} />
          <ListRow
            icon={RotateCcw}
            title="Run the welcome setup again"
            subtitle="Class, interests, theme and notifications"
            onClick={async () => {
              await updateSettings({ onboarding: 'reset' }).catch(() => undefined);
              router.push('/welcome');
            }}
          />
          <ListRow icon={HelpCircle} title="Frequently asked questions" href="/faq" />
          <ListRow icon={BookOpen} title="Ask a question anonymously" subtitle="Hush: answers from people who have been there" href="/hush" />
          <ListRow icon={Mail} title="Contact us" subtitle="Support, privacy, safety and partnerships" href="/contact" />
          <ListRow icon={FileText} title="Privacy, terms & cookies" subtitle="How we handle your data and the rules of the app" href="/privacy" />
          <ListRow icon={Info} title="About CampusConnect" subtitle="Version 1.0 · made for students" onClick={() => toast('CampusConnect 1.0 · no ads, no fees, no selling of your data')} />
        </Card>
      </section>

      <div className="mt-8">
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={LogOut} title={busy ? 'Signing out…' : 'Sign out'} danger onClick={() => void out(false)} />
          <ListRow icon={LogOut} title="Sign out on every device" subtitle="Phones, tablets and browsers" danger onClick={() => setConfirmAll(true)} />
        </Card>
      </div>

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={() => void out(true)}
        title="Sign out everywhere?"
        description="You will be signed out on every phone, tablet and browser, including this one."
        confirmLabel="Sign out everywhere"
        danger
        pending={busy}
      />
    </div>
  );
}
