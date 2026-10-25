import Link from 'next/link';
import { Compass, Home, Search } from 'lucide-react';

export const metadata = { title: 'Page not found' };

/** Custom 404 for any address that does not exist. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-display text-[84px] leading-none text-accent" aria-hidden="true">
        404
      </p>
      <h1 className="marker-heading hl-yellow mt-4 text-[28px] font-bold">This page wandered off</h1>
      <p className="mt-3 text-[15px] text-text-2">The link may be old, mistyped, or the page was removed. Let’s get you somewhere useful.</p>
      <nav aria-label="Helpful links" className="font-sans mt-8 grid w-full gap-2.5">
        <Link href="/" className="press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink">
          <Home className="h-4 w-4" aria-hidden="true" /> Go home
        </Link>
        <Link href="/search" className="press inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-[15px] font-semibold">
          <Search className="h-4 w-4" aria-hidden="true" /> Search CampusConnect
        </Link>
        <Link href="/discover" className="press inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold text-text-2 hover:bg-surface-2">
          <Compass className="h-4 w-4" aria-hidden="true" /> Explore Discover
        </Link>
      </nav>
    </main>
  );
}
