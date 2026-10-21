'use client';

import Link from 'next/link';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QA {
  q: string;
  a: ReactNode;
  topic: 'Getting started' | 'Account & security' | 'Privacy' | 'Using CampusConnect' | 'Safety';
}

const FAQ: QA[] = [
  { topic: 'Getting started', q: 'Who can join CampusConnect?', a: <p>Students, faculty and industry experts of colleges that are on CampusConnect, aged 18 or over. You sign up with any email address and a password, and choose your college. Faculty and expert roles are confirmed by the college before they are switched on.</p> },
  { topic: 'Getting started', q: 'My college is not in the list. What now?', a: <p>Your college may not be on CampusConnect yet. Ask your college office, or <Link href="/contact?topic=partnership" className="text-accent hover:underline">tell us</Link> and we will reach out.</p> },
  { topic: 'Getting started', q: 'I did not get the verification email.', a: <p>Check spam and promotions. The link works for 24 hours. On the sign-in page, enter your email and password and choose “Send the verification email again”.</p> },
  { topic: 'Getting started', q: 'Does it cost anything?', a: <p>No. CampusConnect is free, with no ads, no hidden fees and no in-app purchases.</p> },
  { topic: 'Account & security', q: 'I forgot my password.', a: <p>Use <Link href="/forgot-password" className="text-accent hover:underline">Forgot password</Link>. Resetting it signs you out on every other device.</p> },
  { topic: 'Account & security', q: 'How do I sign out of a device I lost?', a: <p>Settings &gt; Password &amp; devices shows every signed-in device. Sign it out, then change your password.</p> },
  { topic: 'Account & security', q: 'How do I delete my account?', a: <p>Settings &gt; Your data &amp; account &gt; Delete my account. Your profile is hidden immediately and everything is permanently deleted after 30 days. Sign in within those 30 days if you change your mind.</p> },
  { topic: 'Privacy', q: 'Can anyone see who posted anonymously?', a: <p>No. Not other students, not space owners and not moderators. Only in serious safety or legal cases can it be revealed, and that needs two different admins and is permanently logged.</p> },
  { topic: 'Privacy', q: 'Can people from other colleges see my profile?', a: <p>No. Your profile and posts are visible only inside your college, and you control the details in Settings &gt; Privacy controls.</p> },
  { topic: 'Privacy', q: 'Can I get a copy of my data?', a: <p>Yes: Settings &gt; Your data &amp; account &gt; Request a copy. We email you when it is ready (usually minutes).</p> },
  { topic: 'Privacy', q: 'What cookies do you use?', a: <p>Only the ones needed to keep you signed in safely. See the <Link href="/cookies" className="text-accent hover:underline">cookie policy</Link>.</p> },
  { topic: 'Using CampusConnect', q: 'How do I change the theme or font?', a: <p>Tap the Appearance button (sun/moon icon) or go to Settings &gt; Appearance. Choose Handwritten, Classic, your device’s System font, or Easy to read. Your choice follows you to every device.</p> },
  { topic: 'Using CampusConnect', q: 'What are the small dots on some sections?', a: <p>A dot marks a section you have not opened yet, so you can explore everything. It disappears once you open it.</p> },
  { topic: 'Using CampusConnect', q: 'Can I see the welcome tour again?', a: <p>Yes: Settings &gt; Help &amp; about &gt; Take the tour again.</p> },
  { topic: 'Using CampusConnect', q: 'Why is my Shelf upload not visible yet?', a: <p>Student uploads are reviewed by faculty first, to keep wrong or copyrighted material off the Shelf. You are notified when it is approved.</p> },
  { topic: 'Safety', q: 'Someone is bothering me. What can I do?', a: <p>Block them from their profile (you will no longer see each other) and report the messages or posts. Reports are private. In an emergency call 112.</p> },
  { topic: 'Safety', q: 'Is the marketplace safe?', a: <p>Meet in public places on campus, check items before paying, and never share OTPs or bank details. CampusConnect never asks for payments.</p> },
];

function Item({ qa, open, onToggle }: { qa: QA; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className="border-b border-border last:border-0">
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="font-sans flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold hover:bg-surface-2">
          {qa.q}
          <ChevronDown className={cn('h-5 w-5 shrink-0 text-text-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </h3>
      <div id={id} role="region" hidden={!open} className="px-5 pb-5 text-[15px] leading-relaxed text-text-2">
        {qa.a}
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.topic.toLowerCase().includes(q)) : FAQ;
  }, [query]);
  const topics = [...new Set(results.map((r) => r.topic))];

  return (
    <div>
      <h1 className="marker-heading hl-violet text-[34px] font-bold">Frequently asked questions</h1>
      <p className="mt-2 text-[16px] text-text-2">Quick answers. Still stuck? <Link href="/contact" className="text-accent hover:underline">Contact us</Link>.</p>
      <div className="relative mt-6">
        <label htmlFor="faq-search" className="sr-only">Search questions</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-3" aria-hidden="true" />
        <input id="faq-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" className="font-sans h-12 w-full rounded-full border border-border bg-surface pl-12 pr-4 text-[15px] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft" />
      </div>
      <p className="font-sans mt-2 text-[13px] text-text-3" aria-live="polite">{results.length} {results.length === 1 ? 'answer' : 'answers'}</p>
      <div className="mt-4 space-y-8">
        {topics.map((t) => (
          <section key={t} aria-label={t}>
            <h2 className="text-[20px] font-semibold">{t}</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
              {results.filter((r) => r.topic === t).map((qa) => (
                <Item key={qa.q} qa={qa} open={open === qa.q || Boolean(query.trim())} onToggle={() => setOpen((o) => (o === qa.q ? null : qa.q))} />
              ))}
            </div>
          </section>
        ))}
        {!results.length && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-text-3">No answers match. Try other words, or contact us.</p>}
      </div>
    </div>
  );
}
