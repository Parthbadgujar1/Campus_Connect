'use client';

import { useState } from 'react';
import { AlertTriangle, Bot, Check, EyeOff, Ghost, Lock, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Card, EmptyState, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { InfoBanner } from '@/components/common/cards';
import { useToast } from '@/components/ui/toast';
import { aiFlags, anonymousRevealRequests, reportQueue } from '@/data/admin';
import { relativeTime } from '@/lib/time';

type Tab = 'Reports' | 'AI flags' | 'Anonymous';

export default function AdminModerationPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Reports');
  const [handled, setHandled] = useState<string[]>([]);
  const open = (ids: string[]) => ids.filter((id) => !handled.includes(id));

  const resolve = (id: string, message: string) => {
    setHandled((h) => [...h, id]);
    toast(message);
  };

  return (
    <div className="space-y-6 px-4 pb-28 md:px-8 md:pb-12">
      <Segmented<Tab>
        label="Moderation queues"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'Reports', label: 'Reports', count: open(reportQueue.map((r) => r.id)).length },
          { value: 'AI flags', label: 'AI flags', count: open(aiFlags.map((f) => f.id)).length },
          { value: 'Anonymous', label: 'Anonymous', count: anonymousRevealRequests.length },
        ]}
      />

      {tab === 'Reports' && (
        <section className="space-y-3">
          <SectionHeader title="User reports" description="Reviewed by moderators. Reporters stay anonymous to the author." />
          {open(reportQueue.map((r) => r.id)).length === 0 && <EmptyState icon={Check} title="No open reports" />}
          {reportQueue
            .filter((r) => !handled.includes(r.id))
            .map((r) => (
              <Card key={r.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{r.target}</Badge>
                  <Badge tone={r.count >= 4 ? 'danger' : 'warning'}>{r.count} reports</Badge>
                  <Badge tone="neutral">{r.reason}</Badge>
                  <span className="ml-auto text-xs text-text-3">{relativeTime(r.at)} ago</span>
                </div>
                <p className="text-[15px] font-medium">“{r.preview}”</p>
                <p className="text-xs text-text-3">First reported by {r.reporter}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => resolve(r.id, 'Report dismissed')}>
                    Dismiss
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => resolve(r.id, 'Warning sent to the author')}>
                    Warn author
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => resolve(r.id, 'Content removed and logged')}>
                    Remove content
                  </Button>
                </div>
              </Card>
            ))}
        </section>
      )}

      {tab === 'AI flags' && (
        <section className="space-y-3">
          <InfoBanner icon={Bot} title="AI flags are suggestions">
            High-confidence spam is hidden automatically. Everything else waits for a human decision.
          </InfoBanner>
          {aiFlags
            .filter((f) => !handled.includes(f.id))
            .map((f) => (
              <Card key={f.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{f.type}</Badge>
                  <Badge tone={f.action === 'Auto-hidden' ? 'danger' : 'neutral'}>{f.action}</Badge>
                  <span className="ml-auto text-xs text-text-3">{relativeTime(f.at)} ago</span>
                </div>
                <p className="text-[15px]">{f.preview}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-text-3">
                    <span>Model confidence</span>
                    <span className="font-semibold text-text">{f.confidence}%</span>
                  </div>
                  <ProgressBar value={f.confidence} tone={f.confidence >= 85 ? 'danger' : 'warning'} label="Model confidence" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" onClick={() => resolve(f.id, 'Confirmed: content removed')}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    Confirm and remove
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => resolve(f.id, 'Flag dismissed; model feedback saved')}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Not a violation
                  </Button>
                </div>
              </Card>
            ))}
        </section>
      )}

      {tab === 'Anonymous' && (
        <section className="space-y-3">
          <InfoBanner icon={Lock} title="Identity reveal needs two admins" tone="warning">
            Anonymous authors are revealed only for threats or documented academic cases. Each request is logged and needs a second approver.
          </InfoBanner>
          {anonymousRevealRequests.map((req) => (
            <Card key={req.id} className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Ghost className="h-4 w-4 text-text-3" aria-hidden="true" />
                <p className="font-semibold">{req.reason}</p>
              </div>
              <p className="text-xs text-text-3">Requested by {req.requestedBy} · {req.status}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => toast('Second approver notified (demo)')}>
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Request second approval
                </Button>
                <span className="flex items-center gap-1.5 text-xs text-text-3">
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  Identity hidden until approved
                </span>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
