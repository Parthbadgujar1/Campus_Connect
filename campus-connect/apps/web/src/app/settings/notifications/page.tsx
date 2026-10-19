'use client';

import { useState } from 'react';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { Select, Switch } from '@/components/ui/fields';
import { useToast } from '@/components/ui/toast';

// Smart notifications (module 30). Stored locally in the prototype; the backend
// phase saves these per user and per device.
const GROUPS: { title: string; items: { key: string; label: string; description: string; on: boolean }[] }[] = [
  {
    title: 'People & messages',
    items: [
      { key: 'messages', label: 'Messages', description: 'Direct, group and class chats', on: true },
      { key: 'community', label: 'Community activity', description: 'Posts and replies in communities you joined', on: true },
      { key: 'roommate', label: 'Roommate responses', description: 'When someone replies to your roommate request', on: true },
      { key: 'marketplace', label: 'Marketplace responses', description: 'Replies and offers on your listings', on: true },
    ],
  },
  {
    title: 'Deadlines & events',
    items: [
      { key: 'events', label: 'Event reminders', description: 'The day before and one hour before', on: true },
      { key: 'jobs', label: 'Job and internship deadlines', description: '3 days and 1 day before closing', on: true },
      { key: 'hackathons', label: 'Hackathon deadlines', description: 'Registration and submission reminders', on: true },
      { key: 'assignments', label: 'Assignments and exams', description: 'Due dates from academic management', on: true },
    ],
  },
  {
    title: 'Opportunities & campus',
    items: [
      { key: 'opportunities', label: 'New opportunities', description: 'Matches for your branch and year', on: true },
      { key: 'announcements', label: 'College announcements', description: 'Notices marked important by admins', on: true },
      { key: 'travel', label: 'Travel updates', description: 'Trip seats, departures and expense splits', on: false },
    ],
  },
];

export default function NotificationSettingsPage() {
  const toast = useToast();
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.on]))),
  );
  const [quiet, setQuiet] = useState(true);
  const [digest, setDigest] = useState('daily');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Notifications" back backHref="/settings" subtitle="Choose what reaches you" />

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-6">
          <SectionHeader title={group.title} />
          <Card className="divide-y divide-border overflow-hidden">
            {group.items.map((item) => (
              <Switch
                key={item.key}
                label={item.label}
                description={item.description}
                checked={state[item.key] ?? false}
                onChange={(checked) => setState((s) => ({ ...s, [item.key]: checked }))}
              />
            ))}
          </Card>
        </section>
      ))}

      <section className="mt-6">
        <SectionHeader title="Delivery" />
        <Card className="divide-y divide-border overflow-hidden">
          <Switch
            label="Quiet hours"
            description="No pushes from 11 PM to 7 AM. Urgent safety alerts still come through."
            checked={quiet}
            onChange={(checked) => {
              setQuiet(checked);
              toast(checked ? 'Quiet hours on' : 'Quiet hours off');
            }}
          />
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <label htmlFor="digest" className="text-[15px] font-medium">
              Summary digest
            </label>
            <Select id="digest" value={digest} onChange={(e) => setDigest(e.target.value)} className="h-9 w-40 text-sm">
              <option value="off">Off</option>
              <option value="daily">Daily at 8 AM</option>
              <option value="weekly">Weekly on Monday</option>
            </Select>
          </div>
        </Card>
      </section>
    </div>
  );
}
