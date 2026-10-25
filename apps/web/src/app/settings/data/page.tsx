'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { ConfirmDialog, FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, post } from '@/lib/api/client';
import { longDate } from '@/lib/live-time';
import { useSession } from '@/lib/session';

const DELETED = [
  'Your profile, photo and account',
  'Posts (including anonymous ones), Hush questions and answers',
  'Listings, lost & found reports, Shelf uploads and every file you uploaded',
  'Likes, votes, follows, RSVPs, applications, saved items and notifications',
  'Your settings, consents, devices and sign-in history',
];

export default function DataPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, refresh, signOut } = useSession();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const scheduleDeletion = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await post('/me/deletion', { reason: reason.trim() || undefined });
      // The server signed every device out; clear this one too, then explain how to come back.
      await signOut().catch(() => undefined);
      router.replace('/login?reason=deleted');
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  };

  const cancelDeletion = async () => {
    setCancelling(true);
    try {
      await del('/me/deletion');
      await refresh();
      toast('Your account will stay. Welcome back!');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Your data & account" subtitle="Your data belongs to you" back backHref="/settings" />

      <section className="mt-4" aria-label="Delete your account">
        <SectionHeader title="Delete your account" />
        {user?.deletionScheduledFor ? (
          <Card className="space-y-4 border-danger/40 p-4 md:p-5">
            <FormAlert>Your account is scheduled for permanent deletion on {longDate(user.deletionScheduledFor)}. Until then your profile is hidden from others.</FormAlert>
            <Button onClick={cancelDeletion} disabled={cancelling} aria-busy={cancelling}>
              {cancelling ? <Spinner /> : <Undo2 className="h-4 w-4" aria-hidden="true" />} Keep my account
            </Button>
          </Card>
        ) : (
          <Card className="space-y-4 p-4 md:p-5">
            <p className="text-[15px] text-text-2">
              Your profile is hidden straight away and everything is <strong className="text-text">permanently deleted after 30 days</strong>. Changed your mind? Sign in any time in those 30 days and choose “Keep my account”.
            </p>
            <div>
              <p className="font-sans text-[13px] font-semibold text-text">What is deleted</p>
              <ul className="font-sans mt-2 space-y-1.5">
                {DELETED.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-[14px] text-text-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                    {d}
                  </li>
                ))}
              </ul>
              <p className="font-sans mt-3 text-[13px] text-text-3">
                Your comments and chat messages in other people’s conversations become “[deleted]”, so their threads still make sense. A security log that holds only an anonymous id is kept as the law requires.
              </p>
            </div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete my account
            </Button>
          </Card>
        )}
        <p className="font-sans mt-3 text-[13px] text-text-3">
          Can’t sign in? You can also <Link href="/privacy#your-rights" className="font-semibold text-accent hover:underline">request deletion by email</Link>.
        </p>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void scheduleDeletion()}
        title="Delete your account?"
        description="You will be signed out everywhere. Everything is permanently deleted in 30 days unless you sign in and keep your account."
        confirmLabel="Delete my account"
        danger
        pending={deleting}
        error={deleteError}
      >
        <div className="space-y-1.5">
          <label htmlFor="leave-reason" className="font-sans text-sm font-semibold">Why are you leaving? (optional)</label>
          <Textarea id="leave-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" placeholder="It helps us improve." />
        </div>
      </ConfirmDialog>
    </div>
  );
}
