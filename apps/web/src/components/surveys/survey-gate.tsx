'use client';

// Compulsory surveys. As soon as an admin publishes one for this person's role, it appears here
// on top of the app and cannot be closed until it is answered (signing out is still possible).
// Optional surveys never block; they show as a card on Home and in Campus → Feedback.

import { useEffect } from 'react';
import { ClipboardCheck, LogOut } from 'lucide-react';
import { get } from '@/lib/api/client';
import { invalidate, useQuery } from '@/lib/api/hooks';
import type { SurveyView } from '@/lib/api/modules';
import { lockScroll } from '@/lib/scroll-lock';
import { useSession } from '@/lib/session';
import { AnimatePresence, motion } from '@/components/motion';
import { useToast } from '@/components/ui/toast';
import { SurveyForm } from './survey-form';

export interface PendingSurveys {
  compulsory: SurveyView[];
  optional: SurveyView[];
}

export function usePendingSurveys() {
  const { status } = useSession();
  return useQuery<PendingSurveys>(status === 'signed-in' ? 'surveys:pending' : null, (signal) => get('/surveys/pending', undefined, signal), { refreshMs: 120_000 });
}

export function SurveyGate() {
  const { signOut } = useSession();
  const toast = useToast();
  const pending = usePendingSurveys();
  const due = pending.data?.compulsory[0];

  useEffect(() => {
    if (!due) return;
    return lockScroll();
  }, [due]);

  return (
    <AnimatePresence>
      {due && (
        <motion.div key={due.id} role="dialog" aria-modal="true" aria-labelledby="survey-gate-title" className="fixed inset-0 z-[95] overflow-y-auto bg-bg/95 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="mx-auto w-full max-w-xl px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
                <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-accent">Required</p>
                <h2 id="survey-gate-title" className="mt-0.5 text-[24px] font-bold leading-tight">{due.title}</h2>
                {due.description && <p className="mt-1.5 text-[15px] text-text-2">{due.description}</p>}
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-text-2">
              Please answer this survey to continue using CampusConnect{pending.data && pending.data.compulsory.length > 1 ? ` (${pending.data.compulsory.length} to go)` : ''}.
            </p>
            <div className="mt-6">
              <SurveyForm
                survey={due}
                onDone={() => {
                  toast('Thank you, your answers were saved.');
                  invalidate('surveys:');
                }}
              />
            </div>
            <button type="button" onClick={() => void signOut()} className="mx-auto mt-8 flex items-center gap-1.5 text-[13px] font-semibold text-text-3 hover:text-text">
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out instead
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
