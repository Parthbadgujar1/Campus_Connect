'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Plain text with working links: web addresses, @mentions (to the profile) and, when a
// tagHref is given, #hashtags. Links to this site open in the app; others open in a new tab.

const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|(^|[^A-Za-z0-9._])@([A-Za-z0-9._]{3,24})|(^|[^A-Za-z0-9_&])#([A-Za-z0-9][A-Za-z0-9-]{0,29})/g;

/** Hashtags in a caption, lowercased and unique (at most 10, like the API allows). */
export function hashtagsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|[^A-Za-z0-9_&])#([A-Za-z0-9][A-Za-z0-9-]{0,29})/g)) {
    out.add(m[1]!.toLowerCase());
    if (out.size >= 10) break;
  }
  return [...out];
}

function internalPath(url: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const u = new URL(url);
    return u.origin === window.location.origin ? `${u.pathname}${u.search}${u.hash}` : null;
  } catch {
    return null;
  }
}

export function RichText({ text, tagHref, className, linkClassName = 'font-semibold underline-offset-2 hover:underline' }: { text: string; tagHref?: (tag: string) => string; className?: string; linkClassName?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (m[1]) {
      parts.push(text.slice(last, start));
      const path = internalPath(m[1]);
      parts.push(
        path ? (
          <Link key={start} href={path} className={linkClassName} onClick={(e) => e.stopPropagation()}>{m[1]}</Link>
        ) : (
          <a key={start} href={m[1]} target="_blank" rel="noopener noreferrer nofollow" className={cn(linkClassName, 'break-all')} onClick={(e) => e.stopPropagation()}>{m[1]}</a>
        ),
      );
      last = start + m[0].length;
    } else if (m[3]) {
      parts.push(text.slice(last, start) + (m[2] ?? ''));
      parts.push(<Link key={start} href={`/profile/${m[3].toLowerCase()}`} className={linkClassName} onClick={(e) => e.stopPropagation()}>@{m[3]}</Link>);
      last = start + m[0].length;
    } else if (m[5] && tagHref) {
      parts.push(text.slice(last, start) + (m[4] ?? ''));
      parts.push(<Link key={start} href={tagHref(m[5].toLowerCase())} className={linkClassName} onClick={(e) => e.stopPropagation()}>#{m[5]}</Link>);
      last = start + m[0].length;
    }
  }
  parts.push(text.slice(last));
  return <span className={className}>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</span>;
}
