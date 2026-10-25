'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Ambulance, Flame, HeartHandshake, MapPin, MessageSquareWarning, Phone, ShieldAlert, Siren, Trash2, UserPlus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { InfoBanner } from '@/components/common/info-banner';
import { cn } from '@/lib/utils';

// Campus → Safety. National helplines (India) that work from any phone, one-tap location sharing
// with people you trust (kept on this device, sent by your own SMS or share sheet), and a way
// to report a safety concern to the college admins.

const HELPLINES: Array<{ number: string; label: string; detail: string; icon: LucideIcon; tone: string }> = [
  { number: '112', label: 'Emergency', detail: 'Police, fire and ambulance, anywhere in India', icon: Siren, tone: 'bg-danger text-white' },
  { number: '108', label: 'Ambulance', detail: 'Medical emergency (most states)', icon: Ambulance, tone: 'bg-danger-soft text-danger' },
  { number: '101', label: 'Fire', detail: 'Fire brigade', icon: Flame, tone: 'bg-warning-soft text-warning' },
  { number: '1091', label: 'Women in distress', detail: 'Police women’s helpline', icon: ShieldAlert, tone: 'bg-accent-soft text-accent-soft-ink' },
  { number: '181', label: 'Women helpline', detail: 'Support and counselling, all day', icon: HeartHandshake, tone: 'bg-accent-soft text-accent-soft-ink' },
  { number: '14416', label: 'Tele-MANAS', detail: 'Free mental health support, many languages', icon: HeartHandshake, tone: 'bg-success-soft text-success' },
  { number: '1930', label: 'Cyber crime', detail: 'Online fraud and harassment', icon: MessageSquareWarning, tone: 'bg-surface-2 text-text-2' },
];

interface Trusted {
  name: string;
  phone: string;
}
const KEY = 'cc.safety.trusted';

function loadTrusted(): Trusted[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.name === 'string' && typeof x.phone === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}
function storeTrusted(list: Trusted[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the list lasts until the page closes.
  }
}

function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('This device cannot share its location.'));
    else navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.code === 1 ? 'Location permission was denied. Allow it in your browser settings and try again.' : 'Your location could not be found. Try again outdoors or with Wi-Fi on.')), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 });
  });
}

export default function SafetyPage() {
  const toast = useToast();
  const [trusted, setTrusted] = useState<Trusted[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Trusted>({ name: '', phone: '' });
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setTrusted(loadTrusted()), []);

  const save = (list: Trusted[]) => {
    setTrusted(list);
    storeTrusted(list);
  };

  const shareLocation = async () => {
    setError(null);
    setSharing(true);
    try {
      const pos = await locate();
      const { latitude, longitude } = pos.coords;
      const text = `I need help. My location: https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)} (sent from CampusConnect at ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })})`;
      setMessage(text);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const sendVia = async () => {
    if (!message) return;
    try {
      if (navigator.share) await navigator.share({ text: message });
      else {
        await navigator.clipboard.writeText(message);
        toast('Message copied. Paste it into any chat.');
      }
    } catch {
      // Share sheet closed.
    }
  };
  const phones = trusted.map((t) => t.phone.replace(/[^\d+]/g, '')).join(',');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Safety" subtitle="Helplines, location sharing and reporting a concern" back backHref="/campus" />

      <div className="mt-4 space-y-7">
        <Card className="space-y-4 border-danger/30 bg-danger-soft p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white">
              <Siren className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-danger">In immediate danger?</p>
              <p className="text-sm text-text-2">Call 112. It works from any phone, even without balance. Then send your location to someone you trust.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href="tel:112" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-danger text-[15px] font-semibold text-white">
              <Phone className="h-4 w-4" aria-hidden="true" /> Call 112
            </a>
            <Button size="lg" variant="secondary" onClick={() => void shareLocation()} disabled={sharing}>
              {sharing ? <Spinner /> : <MapPin className="h-4 w-4" aria-hidden="true" />} Share my location
            </Button>
          </div>
          {error && <FormAlert>{error}</FormAlert>}
        </Card>

        <section>
          <SectionHeader title="Helplines" description="Free national numbers. Tap to call." />
          <Card className="divide-y divide-border overflow-hidden">
            {HELPLINES.map((h) => (
              <a key={h.number} href={`tel:${h.number}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', h.tone)}>
                  <h.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{h.label}</span>
                  <span className="block text-[13px] text-text-3">{h.detail}</span>
                </span>
                <span className="font-sans text-[17px] font-bold tabular-nums text-accent">{h.number}</span>
              </a>
            ))}
          </Card>
        </section>

        <section>
          <SectionHeader title="Trusted contacts" description="Saved on this device only. Used when you share your location." />
          <Card className="divide-y divide-border overflow-hidden">
            {trusted.map((t, i) => (
              <div key={`${t.phone}-${i}`} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2"><Users className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <a href={`tel:${t.phone}`} className="block text-[13px] text-text-3">{t.phone}</a>
                </span>
                <button type="button" onClick={() => save(trusted.filter((_, j) => j !== i))} aria-label={`Remove ${t.name}`} className="grid h-9 w-9 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-danger">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {trusted.length < 5 && (
              <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-accent hover:bg-surface-2">
                <UserPlus className="h-5 w-5" aria-hidden="true" /> Add a trusted contact
              </button>
            )}
          </Card>
        </section>

        <section>
          <SectionHeader title="Report a concern" />
          <InfoBanner icon={MessageSquareWarning} title="Harassment, an unsafe spot or a suspicious person?" action={<Link href="/contact?topic=safety" className={buttonClass({ size: 'sm' })}>Report to the college team</Link>}>
            Your report goes to the college admins. For anything urgent, call 112 first. To report a post, message or profile, use Report on it directly.
          </InfoBanner>
        </section>
      </div>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a trusted contact"
        description="Only kept on this device."
        footer={
          <Button full disabled={!draft.name.trim() || draft.phone.replace(/\D/g, '').length < 10} onClick={() => { save([...trusted, { name: draft.name.trim(), phone: draft.phone.trim() }]); setDraft({ name: '', phone: '' }); setAdding(false); toast('Trusted contact added'); }}>
            Save contact
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="t-name"><Input id="t-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={60} placeholder="Aai" autoComplete="off" /></Field>
          <Field label="Phone number" htmlFor="t-phone"><Input id="t-phone" type="tel" inputMode="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} maxLength={20} placeholder="+91 98xxxxxxxx" autoComplete="off" /></Field>
        </div>
      </Sheet>

      <Sheet open={Boolean(message)} onClose={() => setMessage(null)} title="Send your location" description="Nothing is sent until you choose how.">
        <div className="space-y-4">
          <p className="rounded-2xl bg-surface-2 p-3 text-[14px]">{message}</p>
          <div className="grid gap-2">
            {trusted.length > 0 && (
              <a href={`sms:${phones}?body=${encodeURIComponent(message ?? '')}`} className={buttonClass({ full: true })}>
                <Phone className="h-4 w-4" aria-hidden="true" /> Text {trusted.length === 1 ? trusted[0]!.name : `${trusted.length} trusted contacts`}
              </a>
            )}
            <Button variant="secondary" full onClick={() => void sendVia()}>Share another way</Button>
            {!trusted.length && <p className="text-center text-[13px] text-text-3">Add trusted contacts to text them in one tap.</p>}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
