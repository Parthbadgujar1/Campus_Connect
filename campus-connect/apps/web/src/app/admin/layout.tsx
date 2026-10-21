'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, ClipboardList, Inbox, LayoutGrid, MessageSquareHeart, Server, ShieldAlert, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/layout';
import { useSession } from '@/lib/session';
import { can, ROLE_LABEL, type Capability } from '@/lib/roles';
import { cn } from '@/lib/utils';

// The admin console. Which sections show depends on the role: faculty review Shelf uploads and
// lectures; moderators also handle people and reports; admins see everything. The API checks
// every action again, so a hidden section is a convenience, not the protection.

const SECTIONS: Array<{ href: string; label: string; icon: LucideIcon; needs: Capability }> = [
  { href: '/admin', label: 'Overview', icon: BarChart3, needs: 'admin' },
  { href: '/admin/content', label: 'Approvals', icon: LayoutGrid, needs: 'admin.queue' },
  { href: '/admin/people', label: 'People', icon: Users, needs: 'admin.people' },
  { href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert, needs: 'admin.moderation' },
  { href: '/admin/surveys', label: 'Surveys', icon: ClipboardList, needs: 'admin.surveys' },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquareHeart, needs: 'admin.feedback' },
  { href: '/admin/inbox', label: 'Inbox', icon: Inbox, needs: 'admin.system' },
  { href: '/admin/system', label: 'System', icon: Server, needs: 'admin.system' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const sections = SECTIONS.filter((s) => can(user, s.needs));
  const title = user?.role === 'faculty' ? 'Review' : 'Admin console';

  return (
    <div className="mx-auto w-full max-w-6xl pb-28 md:pb-12">
      <div className="px-4 md:px-8">
        <PageHeader title={title} subtitle={user ? `${ROLE_LABEL[user.role]} tools for your college` : undefined} back backHref="/campus" />
      </div>
      {sections.length > 1 && (
        <nav aria-label="Admin sections" className="font-sans no-scrollbar mt-1 flex gap-2 overflow-x-auto px-4 pb-1 md:px-8">
          {sections.map((section) => {
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
      )}
      <div className="mt-5 px-4 md:px-8">{children}</div>
    </div>
  );
}
