'use client';

// A short guided tour for new people. It spotlights the five tabs and the Appearance button, can
// be skipped at any step (button or Esc), works with the keyboard (arrow keys, Tab stays inside),
// and is remembered on the account so it never shows twice. Settings > Help can replay it.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const START_TOUR_EVENT = 'cc:start-tour';
export const startTour = () => window.dispatchEvent(new Event(START_TOUR_EVENT));

interface Step {
  target: string | null;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { target: null, title: 'Welcome to CampusConnect', body: 'A quick look at where everything lives. It takes about 30 seconds, and you can skip it any time.' },
  { target: 'tab-home', title: 'Home', body: 'Your feed: posts from your college, your class and people you follow, with notices pinned on top.' },
  { target: 'tab-campus', title: 'Campus', body: 'Notices, events, the Shelf for notes and papers, lectures, opportunities, lost & found and the marketplace.' },
  { target: 'tab-discover', title: 'Discover', body: 'Spaces and their discussion boards, Hush for anonymous questions, games and videos.' },
  { target: 'tab-chats', title: 'Chats', body: 'Direct messages and groups, with plans, polls and view-once snaps.' },
  { target: 'tab-you', title: 'You', body: 'Your profile, saved items, settings and privacy controls, including deleting your account.' },
  { target: 'appearance', title: 'Make it yours', body: 'Change the theme, font and text size whenever you like. Your choice follows you to every device.' },
  { target: null, title: 'You are all set', body: 'A small dot marks sections you have not opened yet. You can replay this tour from Settings > Help.' },
];

function visibleTarget(name: string | null): HTMLElement | null {
  if (!name) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function Tour({ open, onFinish }: { open: boolean; onFinish: (how: 'completed' | 'skipped') => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  const measure = useCallback(() => {
    const el = visibleTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (open) cardRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish('skipped');
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if (e.key === 'Tab' && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
        const first = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastItem?.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onFinish]);

  if (!open || typeof document === 'undefined') return null;

  // Place the card next to the highlighted element: above it near the bottom of the screen
  // (the phone tab bar), to its right on the desktop rail, centred when there is no target.
  const pad = 8;
  let style: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  if (rect) {
    const width = Math.min(340, window.innerWidth - 24);
    if (rect.left < 120 && rect.width < 120) {
      style = { left: rect.right + 16, top: Math.max(12, Math.min(rect.top - 20, window.innerHeight - 260)), width };
    } else if (rect.top > window.innerHeight / 2) {
      style = { left: Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12)), bottom: window.innerHeight - rect.top + 16, width };
    } else {
      style = { left: Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12)), top: rect.bottom + 16, width };
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl ring-4 ring-accent transition-all duration-300"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
      )}
      <div ref={cardRef} className="font-sans animate-pop absolute w-[min(340px,calc(100vw-24px))] rounded-3xl border border-border bg-[var(--surface-solid)] p-5 shadow-float" style={style}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-3">
            {index + 1} of {STEPS.length}
          </p>
          <button type="button" onClick={() => onFinish('skipped')} className="press -mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-text" aria-label="Skip the tour">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <h2 id="tour-title" className="font-display mt-1 text-[22px] leading-tight">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-2 text-[14px] text-text-2">
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-accent' : 'w-1.5 bg-surface-3')} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {index > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onFinish('skipped')}>
              Skip tour
            </Button>
          )}
          <Button size="sm" data-autofocus onClick={() => (last ? onFinish('completed') : setIndex((i) => i + 1))}>
            {last ? 'Start exploring' : 'Next'}
            {!last && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
