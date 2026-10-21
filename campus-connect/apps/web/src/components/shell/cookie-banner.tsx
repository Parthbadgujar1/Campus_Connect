'use client';

// Cookie consent, done honestly:
//   * CampusConnect sets only strictly necessary cookies (your sign-in session and its security
//     token). Those need no consent and are always on.
//   * Optional categories (preferences, analytics, marketing) are OFF until you turn them on.
//     Today the app uses none of them; the switches exist so any future use waits for consent.
//   * "Accept all" and "Necessary only" are equally easy (no dark patterns); you can change your
//     mind any time from "Cookie settings" in the footer or in Settings > Privacy.
//   * Each choice is recorded (with the policy version) so it can be shown on request.

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Cookie } from 'lucide-react';
import { post } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/fields';

export const COOKIE_POLICY_VERSION = '2026-10-20';
const KEY = 'cc:consent';
const OPEN_EVENT = 'cc:cookie-settings';

export interface ConsentChoice {
  version: string;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  at: string;
  anonymousId: string;
}

function read(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as ConsentChoice;
    return c.version === COOKIE_POLICY_VERSION ? c : null;
  } catch {
    return null;
  }
}

let listeners: Array<() => void> = [];
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}
let snapshot: ConsentChoice | null | undefined;
function getSnapshot() {
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

/** The visitor's current choice (null until they decide). Analytics code must check this first. */
export function useConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function anonymousId(): string {
  const existing = getSnapshot()?.anonymousId;
  if (existing) return existing;
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `anon_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function save(choice: Omit<ConsentChoice, 'version' | 'at' | 'anonymousId'>) {
  const full: ConsentChoice = { ...choice, version: COOKIE_POLICY_VERSION, at: new Date().toISOString(), anonymousId: anonymousId() };
  try {
    localStorage.setItem(KEY, JSON.stringify(full));
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
  snapshot = full;
  emit();
  void post('/consents', { anonymousId: full.anonymousId, policyVersion: COOKIE_POLICY_VERSION, choices: choice }).catch(() => undefined);
}

export function CookieBanner() {
  const consent = useConsent();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [customising, setCustomising] = useState(false);
  const [forced, setForced] = useState(false);
  const [prefs, setPrefs] = useState({ preferences: false, analytics: false, marketing: false });

  useEffect(() => {
    const open = () => {
      const c = getSnapshot();
      setPrefs({ preferences: c?.preferences ?? false, analytics: c?.analytics ?? false, marketing: c?.marketing ?? false });
      setCustomising(true);
      setForced(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (!mounted || (consent && !forced)) return null;

  const done = (choice: typeof prefs) => {
    save(choice);
    setForced(false);
    setCustomising(false);
  };

  return (
    <section
      role="region"
      aria-label="Cookie choices"
      className="font-sans animate-sheet fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[85] mx-auto max-w-xl rounded-3xl border border-border bg-[var(--surface-solid)] p-5 shadow-float md:bottom-6 print:hidden"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
          <Cookie className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">Your cookie choices</h2>
          <p className="mt-1 text-[14px] text-text-2">
            We use only necessary cookies to keep you signed in securely. Optional cookies stay off unless you turn them on. Read the{' '}
            <Link href="/cookies" className="font-semibold text-accent hover:underline">cookie policy</Link>.
          </p>
        </div>
      </div>

      {customising && (
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
          <Switch label="Necessary" description="Sign-in session and security. Always on." checked onChange={() => undefined} disabled />
          <Switch label="Preferences" description="Remember choices such as language on this device." checked={prefs.preferences} onChange={(v) => setPrefs((p) => ({ ...p, preferences: v }))} />
          <Switch label="Analytics" description="Anonymous usage counts to improve the app." checked={prefs.analytics} onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))} />
          <Switch label="Marketing" description="Measuring campaigns. We do not show ads." checked={prefs.marketing} onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="secondary" onClick={() => done({ preferences: false, analytics: false, marketing: false })}>
          Necessary only
        </Button>
        {customising ? (
          <Button variant="secondary" onClick={() => done(prefs)}>
            Save choices
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setCustomising(true)}>
            Choose
          </Button>
        )}
        <Button variant="secondary" onClick={() => done({ preferences: true, analytics: true, marketing: true })}>
          Accept all
        </Button>
      </div>
    </section>
  );
}
