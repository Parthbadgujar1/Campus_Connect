'use client';

import { useState } from 'react';
import { Phone, ShieldAlert, Siren, UserPlus, HeartPulse, Trash2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { InfoBanner } from '@/components/common/cards';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { emergencyContacts } from '@/data/campus';
import { cn } from '@/lib/utils';

const KIND_ORDER = ['Security', 'Medical', 'Safety', 'Counselling'] as const;

export default function SafetyPage() {
  const toast = useToast();
  const [sosOpen, setSosOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [trusted, setTrusted] = useState<string[]>(['Sister · +91 00000 11122']);
  const [trustedDraft, setTrustedDraft] = useState('');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Safety & emergency" subtitle="Contacts, SOS and trusted people" back backHref="/campus" />

      <div className="mt-4 space-y-6">
        <Card className="space-y-4 border-danger/30 bg-danger-soft p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white">
              <Siren className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-danger">In immediate danger?</p>
              <p className="text-sm text-text-2">Call campus security first. SOS also alerts your trusted contacts with your location.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href="tel:+910000000101" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-danger text-[15px] font-semibold text-white">
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call campus security
            </a>
            <Button size="lg" variant="secondary" onClick={() => setSosOpen(true)}>
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Send SOS
            </Button>
          </div>
        </Card>

        {KIND_ORDER.map((kind) => {
          const contacts = emergencyContacts.filter((c) => c.kind === kind || (kind === 'Medical' && c.kind === 'Medical'));
          if (contacts.length === 0) return null;
          return (
            <section key={kind}>
              <SectionHeader title={kind === 'Medical' ? 'Medical' : kind === 'Security' ? 'Campus security' : kind === 'Safety' ? 'Safety desks' : 'Counselling'} />
              <Card className="divide-y divide-border overflow-hidden">
                {contacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', kind === 'Medical' ? 'bg-success-soft text-success' : 'bg-surface-2 text-text-2')}>
                      {kind === 'Medical' ? <HeartPulse className="h-4 w-4" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-text-3">{c.role}</p>
                    </div>
                    <Badge tone={c.availability === '24x7' ? 'success' : 'neutral'}>{c.availability}</Badge>
                    <a href={`tel:${c.phone.replace(/\s/g, '')}`} aria-label={`Call ${c.name}`} className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                ))}
              </Card>
            </section>
          );
        })}

        <section>
          <SectionHeader title="Trusted contacts" description="Get alerted when you use SOS" />
          <Card className="space-y-3 p-4">
            {trusted.map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t}</span>
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setTrusted((list) => list.filter((x) => x !== t))} className="grid h-8 w-8 place-items-center rounded-full text-text-3 hover:text-danger">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!trustedDraft.trim()) return;
                setTrusted((list) => [...list, trustedDraft.trim()]);
                setTrustedDraft('');
                toast('Trusted contact added');
              }}
            >
              <Input aria-label="Trusted contact name and phone" placeholder="Name · phone" value={trustedDraft} onChange={(e) => setTrustedDraft(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={!trustedDraft.trim()}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add
              </Button>
            </form>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Report something" />
          <Card className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-text-2">Harassment, unsafe spot, suspicious person or a theft. You can report anonymously.</p>
            <Button variant="secondary" onClick={() => setReportOpen(true)}>
              Report
            </Button>
          </Card>
        </section>

        <InfoBanner icon={Info} title="This is a preview">
          Alerts are not sent from this demo. The live app connects SOS to the campus security control room and your trusted contacts.
        </InfoBanner>
      </div>

      <Sheet
        open={sosOpen}
        onClose={() => setSosOpen(false)}
        title="Send SOS?"
        description="Your name, location and time go to security and trusted contacts"
        footer={
          <Button
            full
            variant="danger"
            onClick={() => {
              setSosOpen(false);
              toast('SOS would be sent now. Demo only, nothing was sent.');
            }}
          >
            Send SOS now
          </Button>
        }
      >
        <p className="text-sm text-text-2">Only use this in a real emergency. Misuse can lead to action under the code of conduct.</p>
      </Sheet>

      <Sheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report a safety concern"
        footer={
          <Button full onClick={() => { setReportOpen(false); toast('Report received by the safety desk (demo)'); }}>
            Submit report
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="What happened?" htmlFor="sf-type">
            <Select id="sf-type">
              <option>Harassment</option>
              <option>Unsafe place or lighting</option>
              <option>Suspicious person</option>
              <option>Theft or damage</option>
              <option>Other</option>
            </Select>
          </Field>
          <Field label="Where?" htmlFor="sf-where">
            <Input id="sf-where" placeholder="Building, gate or hostel" />
          </Field>
          <Field label="Details" htmlFor="sf-details">
            <Textarea id="sf-details" placeholder="Only what you saw. You do not need to give your name." />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
