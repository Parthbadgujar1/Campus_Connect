'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { Sheet } from '@/components/ui/sheet';
import { FormAlert, Spinner } from '@/components/ui/states';
import { isApiError, post } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export type ReportTarget = 'post' | 'comment' | 'discussion' | 'discussion_reply' | 'message' | 'user' | 'listing' | 'hush_question' | 'hush_answer' | 'lost_found' | 'resource' | 'event' | 'space' | 'lecture';

const REASONS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'harassment', label: 'Bullying or harassment', hint: 'Targeting or threatening someone' },
  { value: 'hate', label: 'Hate speech', hint: 'Attacks on caste, religion, gender, region...' },
  { value: 'sexual', label: 'Sexual content', hint: 'Nudity or sexual material' },
  { value: 'violence', label: 'Violence or threats', hint: 'Threats or encouraging harm' },
  { value: 'self_harm', label: 'Self-harm or suicide', hint: 'Someone may be at risk' },
  { value: 'scam', label: 'Scam or fraud', hint: 'Fake offers, asking for money or OTPs' },
  { value: 'spam', label: 'Spam', hint: 'Repeated or unwanted promotion' },
  { value: 'privacy', label: 'Private information', hint: 'Phone numbers, addresses, photos shared without consent' },
  { value: 'misinformation', label: 'False information', hint: 'Fake notices or dates' },
  { value: 'copyright', label: 'Copyright', hint: 'Someone else’s book, paper or work' },
  { value: 'other', label: 'Something else', hint: 'Tell us more below' },
];

/** Report anything. Reporters are never revealed to the person reported. */
export function ReportSheet({ open, onClose, targetType, targetId, label = 'this' }: { open: boolean; onClose: () => void; targetType: ReportTarget; targetId: string; label?: string }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setReason('');
      setDetails('');
      setDone(null);
      setError(null);
    }, 300);
  };

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await post<{ message: string }>('/reports', { targetType, targetId, reason, details: details.trim() || undefined });
      setDone(r.message);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not send the report. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={done ? 'Thanks for telling us' : `Report ${label}`}
      description={done ? undefined : 'Only moderators see reports. The person is not told who reported them.'}
      footer={
        done ? (
          <Button full onClick={close}>Done</Button>
        ) : (
          <Button full disabled={!reason || pending} onClick={submit} aria-busy={pending}>
            {pending && <Spinner />} Send report
          </Button>
        )
      }
    >
      {done ? (
        <FormAlert tone="success">{done}</FormAlert>
      ) : (
        <div className="space-y-4">
          {error && <FormAlert>{error}</FormAlert>}
          <div role="radiogroup" aria-label="Reason" className="font-sans grid gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                onClick={() => setReason(r.value)}
                className={cn('press rounded-2xl border px-4 py-3 text-left', reason === r.value ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2')}
              >
                <span className="block text-[15px] font-semibold">{r.label}</span>
                <span className="block text-[13px] text-text-3">{r.hint}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="report-details" className="font-sans text-sm font-semibold">Anything else? (optional)</label>
            <Textarea id="report-details" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          {reason === 'self_harm' && (
            <FormAlert tone="info">If someone is in immediate danger, call 112. Tele-MANAS (free, 24×7): 14416.</FormAlert>
          )}
        </div>
      )}
    </Sheet>
  );
}
