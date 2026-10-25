'use client';

import { Ban, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Switch } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, SectionHeader } from '@/components/ui/layout';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, get, patch } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import type { Me, PersonSummary } from '@/lib/api/types';
import { ago } from '@/lib/live-time';
import { useSession } from '@/lib/session';

type MessagePrivacy = Me['profile']['messagePrivacy'];
type ProfileVisibility = 'campus' | 'connections';

export default function PrivacyControlsPage() {
  const toast = useToast();
  const { user, refresh } = useSession();
  const blocked = useQuery<{ items: PersonSummary[] }>('me:blocks', (s) => get('/me/blocks', undefined, s));
  const reports = useQuery<{ items: Array<{ id: string; targetType: string; reason: string; status: string; outcome: string; createdAt: string }> }>('me:reports', (s) => get('/reports/mine', undefined, s));

  if (!user) return <SkeletonList className="mx-auto mt-8 max-w-2xl px-4" count={2} />;
  const vis = { profile: 'campus' as ProfileVisibility, showBranch: true, showEmail: false, showActivity: false, showOnline: true, ...user.profile.visibility };

  const save = async (change: Record<string, unknown>) => {
    try {
      await patch('/me/profile', change);
      await refresh();
      toast('Saved');
    } catch (err) {
      toast(errorMessage(err));
    }
  };
  const setVis = (key: keyof typeof vis, value: unknown) => void save({ visibility: { ...vis, [key]: value } });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Privacy controls" back backHref="/settings" subtitle="Choose what others can see and do" />

      <section className="mt-5" aria-label="Your profile">
        <SectionHeader title="Your profile" description="Choose who can see your profile and what it shows." />
        <Card className="space-y-4 p-4">
          <div className="space-y-2">
            <p className="font-sans text-sm font-semibold">Who can see your full profile</p>
            <Segmented<ProfileVisibility>
              label="Profile visibility"
              value={vis.profile}
              onChange={(v) => setVis('profile', v)}
              options={[{ value: 'campus', label: 'Everyone at college' }, { value: 'connections', label: 'Mutual follows' }]}
            />
          </div>
        </Card>
        <Card className="mt-3 divide-y divide-border overflow-hidden">
          <Switch label="Show department and year" description="On your profile and next to your name" checked={vis.showBranch} onChange={(v) => setVis('showBranch', v)} />
          <Switch label="Show my email" description="Lets classmates email you directly" checked={vis.showEmail} onChange={(v) => setVis('showEmail', v)} />
          <Switch label="Show my activity" description="Events you are going to and spaces you joined" checked={vis.showActivity} onChange={(v) => setVis('showActivity', v)} />
          <Switch label="Last seen & online" description="Let people you chat with see when you are online and when you were last here" checked={vis.showOnline !== false} onChange={(v) => setVis('showOnline', v)} />
        </Card>
      </section>

      <section className="mt-8" aria-label="Messages">
        <SectionHeader title="Who can message you" />
        <Card className="p-4">
          <Segmented<MessagePrivacy>
            label="Who can message you"
            value={user.profile.messagePrivacy}
            onChange={(v) => void save({ messagePrivacy: v })}
            options={[{ value: 'everyone', label: 'Everyone' }, { value: 'connections', label: 'Mutual follows' }, { value: 'nobody', label: 'Nobody new' }]}
          />
          <p className="font-sans mt-3 text-[13px] text-text-3">Existing chats stay open. Blocked people can never message you.</p>
        </Card>
      </section>

      <section id="blocked" className="mt-8 scroll-mt-20" aria-label="Blocked people">
        <SectionHeader title="Blocked people" description="You do not see each other anywhere. They are not told." />
        {blocked.loading ? (
          <SkeletonList variant="row" count={2} />
        ) : blocked.error ? (
          <ErrorState error={blocked.error} onRetry={blocked.reload} />
        ) : blocked.data!.items.length ? (
          <Card className="divide-y divide-border overflow-hidden">
            {blocked.data!.items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <PersonAvatar person={p} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.displayName}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await del(`/users/${p.id}/block`);
                      blocked.setData((cur) => ({ items: (cur?.items ?? []).filter((x) => x.id !== p.id) }));
                      toast(`Unblocked ${p.displayName}`);
                    } catch (err) {
                      toast(errorMessage(err));
                    }
                  }}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState icon={Ban} title="You have not blocked anyone" />
        )}
      </section>

      <section className="mt-8" aria-label="Your reports">
        <SectionHeader title="Your reports" description="What happened to things you reported" />
        {reports.loading ? (
          <SkeletonList variant="row" count={2} />
        ) : reports.error ? (
          <ErrorState error={reports.error} onRetry={reports.reload} />
        ) : reports.data!.items.length ? (
          <Card className="divide-y divide-border overflow-hidden">
            {reports.data!.items.map((r) => (
              <div key={r.id} className="font-sans flex items-center gap-3 px-4 py-3">
                <Flag className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold capitalize">{r.targetType.replace('_', ' ')} · {r.reason.replace('_', ' ')}</span>
                  <span className="block text-[12px] text-text-3">{r.outcome} · {ago(r.createdAt)}</span>
                </span>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState icon={Flag} title="No reports" description="If something breaks the rules, use Report on it." />
        )}
      </section>
    </div>
  );
}
