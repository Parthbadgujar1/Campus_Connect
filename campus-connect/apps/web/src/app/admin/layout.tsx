'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BarChart3, Film, Megaphone, ShieldAlert, Users, LayoutGrid, Settings } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
  { href: '/admin/lectures', label: 'Lectures', icon: Film },
  { href: '/admin/content', label: 'Content', icon: LayoutGrid },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role = useAppState((s) => s.role);

  if (role !== 'admin') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
        <PageHeader title="Admin portal" back backHref="/settings" />
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description="In this preview you can switch to the Admin role in Settings. In the live app, admin access is granted by the college."
          action={
            <Link href="/settings" className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Go to settings
            </Link>
          }
          className="mt-6"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="px-4 md:px-8">
        <PageHeader title="Admin portal" subtitle="CSMSS · verification, moderation, content and analytics" back backHref="/campus" />
      </div>

      <nav aria-label="Admin sections" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-8">
        {SECTIONS.map((section) => {
          const active = section.href === '/admin' ? pathname === '/admin' : pathname.startsWith(section.href);
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                active ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-border bg-surface text-text-2 hover:text-text',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {section.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">{children}</div>
    </div>
  );
}
