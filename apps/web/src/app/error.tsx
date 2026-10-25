'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

/**
 * When a screen crashes, only that screen shows this message; the tab bar, other tabs and the
 * rest of the app keep working. "Try again" re-renders and re-fetches just this screen.
 */
export default function ScreenError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('Screen error', error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center" role="alert">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="font-display mt-4 text-[28px]">This screen hit a snag</h1>
      <p className="mt-2 text-[15px] text-text-2">Something unexpected happened while showing this page. Everything else still works. Try again, or head home.</p>
      <div className="font-sans mt-6 flex flex-wrap justify-center gap-2.5">
        <button type="button" onClick={() => retry()} className="press inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
        <Link href="/" className="press inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-5 text-[15px] font-semibold">
          <Home className="h-4 w-4" aria-hidden="true" /> Go home
        </Link>
      </div>
      {error.digest && <p className="font-mono mt-4 text-[11px] text-text-3">Reference: {error.digest}</p>}
    </main>
  );
}
