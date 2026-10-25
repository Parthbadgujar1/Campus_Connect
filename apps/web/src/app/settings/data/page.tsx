'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Download, FileArchive, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, get, isApiError, post } from '@/lib/api/client';
import { useQuery } from '@/lib/api/hooks';
import { longDate } from '@/lib/live-time';
import { useSession } from '@/lib/session';

interface ExportItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt: string | null;
  download: { url: string | null; size: number; expiresAt: string | null } | null;
}

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
  const exports = useQuery<{ items: ExportItem[] }>('me:exports', (s) => get('/me/exports', undefined, s), { refreshMs: 10_000 });
  const [requesting, setRequesting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const requestExport = async () => {
    setRequesting(true);
    setExportError(null);
    try {
      await post('/me/exports');
      toast('We are preparing your data');
      exports.reload();
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setRequesting(false);
    }
  };

  const scheduleDeletion = async ({ password, text }: { password: string; text: string }) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await post('/me/deletion', { password, confirm: text, reason: reason.trim() || undefined });
      // The server signed every device out; clear this one too, then explain how to come back.
      await signOut().catch(() => undefined);
      router.replace('/login?reason=deleted');
    } catch (err) {
      setDeleteError(isApiError(err) ? (err.fields.password ?? err.message) : 'Could not schedule the deletion. Please try again.');
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

  const busyExport = exports.data?.items.some((e) => e.status === 'pending' || e.status === 'processing');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-36 md:px-8 md:pb-16">
      <PageHeader title="Your data & account" subtitle="Your data belongs to you" back backHref="/settings" />

      <section id="exports" className="mt-4" aria-label="Download your data">
        <SectionHeader title="Download your data" description="A copy of everything CampusConnect holds about you, as a JSON file you can open in any text editor." />
        <Card className="space-y-4 p-4 md:p-5">
          {exportError && <FormAlert>{exportError}</FormAlert>}
          <Button onClick={requestExport} disabled={requesting || busyExport} aria-busy={requesting}>
            {requesting ? <Spinner /> : <FileArchive className="h-4 w-4" aria-hidden="true" />}
            {busyExport ? 'Preparing your copy…' : 'Request a copy'}
          </Button>
          <p className="font-sans text-[13px] text-text-3">Usually ready within a few minutes. We also email you when it is ready. Download links work for 7 days.</p>
          {exports.loading ? (
            <SkeletonList variant="row" count={1} />
          ) : exports.error ? (
            <ErrorState compact error={exports.error} onRetry={exports.reload} />
          ) : exports.data!.items.length ? (
            <ul className="font-sans divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {exports.data!.items.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">Requested {longDate(e.requestedAt)}</span>
                    <span className="block text-[12px] text-text-3">
                      {e.status === 'completed' ? (e.download ? `Ready · ${Math.max(1, Math.round(e.download.size / 1024))} KB` : 'Expired') : e.status === 'failed' ? 'Failed. Request a new copy.' : 'Preparing…'}
                    </span>
                  </span>
                  {e.download?.url ? (
                    <a href={e.download.url} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-ink" download>
                      <Download className="h-4 w-4" aria-hidden="true" /> Download
                    </a>
                  ) : e.status !== 'completed' && e.status !== 'failed' ? (
                    <Spinner />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </section>

      <section className="mt-8" aria-label="Delete your account">
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
                Your comments and chat messages in other people’s conversations become “[deleted]”, so their threads still make sense. A security log that holds only an anonymous id is kept as the law requires. Want a copy first? Use “Request a copy” above.
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
        onConfirm={scheduleDeletion}
        title="Delete your account?"
        description="You will be signed out everywhere. Everything is permanently deleted in 30 days unless you sign in and keep your account."
        confirmLabel="Delete my account"
        danger
        requireText="DELETE"
        requirePassword
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
