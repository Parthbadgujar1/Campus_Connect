'use client';

import { Segmented } from '@/components/ui/chip';
import { Input, Switch } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage, get, put } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';

interface Prefs {
  inApp: Record<string, boolean>;
  email: Record<string, boolean>;
  emailDigest: 'off' | 'daily' | 'weekly';
  marketingEmails: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}

const KINDS: Array<[string, string, string]> = [
  ['message', 'Messages', 'New messages in direct chats'],
  ['mention', 'Mentions', 'When someone @mentions you'],
  ['comment', 'Comments', 'On your posts and discussions'],
  ['reply', 'Replies', 'To your comments and Hush questions'],
  ['like', 'Likes', 'On your posts'],
  ['follow', 'New followers', 'When someone follows you'],
  ['event', 'Events', 'Updates and reminders for events you RSVPed'],
  ['application', 'Applications', 'When an application moves stage'],
  ['announcement', 'Notices', 'College announcements'],
  ['space', 'Spaces', 'Join requests and approvals'],
  ['verification', 'Reviews', 'Approvals for your uploads and requests'],
];

export default function NotificationSettingsPage() {
  const toast = useToast();
  const q = useQuery<Prefs>('me:notification-prefs', (s) => get('/me/notification-preferences', undefined, s));

  const save = async (change: Partial<Prefs>) => {
    const previous = q.data;
    if (previous) q.setData({ ...previous, ...change, inApp: { ...previous.inApp, ...change.inApp }, email: { ...previous.email, ...change.email } });
    try {
      await put('/me/notification-preferences', change);
    } catch (err) {
      if (previous) q.setData(previous);
      toast(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Notifications" back backHref="/settings" subtitle="Choose what reaches you, and when" />
      {q.loading ? (
        <SkeletonList variant="row" count={6} className="mt-5" />
      ) : q.error ? (
        <ErrorState className="mt-5" error={q.error} onRetry={q.reload} />
      ) : (
        <>
          <section className="mt-5" aria-label="In the app">
            <SectionHeader title="In the app" description="Security alerts are always on." />
            <Card className="divide-y divide-border overflow-hidden">
              {KINDS.map(([k, label, hint]) => (
                <Switch key={k} label={label} description={hint} checked={q.data!.inApp[k] ?? true} onChange={(v) => void save({ inApp: { [k]: v } })} />
              ))}
            </Card>
          </section>

          <section className="mt-8" aria-label="Email">
            <SectionHeader title="Email summaries" description="Essential emails (verification, password, security) are always sent." />
            <Card className="space-y-4 p-4">
              <Segmented<Prefs['emailDigest']>
                label="Email summary"
                value={q.data!.emailDigest}
                onChange={(v) => void save({ emailDigest: v })}
                options={[{ value: 'off', label: 'Off' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]}
              />
            </Card>
            <Card className="mt-3 overflow-hidden">
              <Switch label="Product news" description="Occasional emails about new features. Off unless you turn it on." checked={q.data!.marketingEmails} onChange={(v) => void save({ marketingEmails: v })} />
            </Card>
          </section>

          <section className="mt-8" aria-label="Quiet hours">
            <SectionHeader title="Quiet hours" description="No push alerts in this window. Notifications still wait for you in the app." />
            <Card className="font-sans grid grid-cols-2 gap-3 p-4">
              <div className="space-y-1.5">
                <label htmlFor="quiet-start" className="text-sm font-semibold">From</label>
                <Input id="quiet-start" type="time" value={q.data!.quietStart?.slice(0, 5) ?? ''} onChange={(e) => void save({ quietStart: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="quiet-end" className="text-sm font-semibold">Until</label>
                <Input id="quiet-end" type="time" value={q.data!.quietEnd?.slice(0, 5) ?? ''} onChange={(e) => void save({ quietEnd: e.target.value || null })} />
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
