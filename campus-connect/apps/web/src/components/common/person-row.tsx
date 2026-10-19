import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar, VerifiedMark } from '@/components/ui/avatar';
import type { Person } from '@/lib/types';
import { cn } from '@/lib/utils';

export function personMeta(person: Person): string {
  if (person.role === 'faculty' || person.role === 'admin' || person.role === 'business') {
    return person.designation ?? person.department ?? '';
  }
  const parts = [person.branch, person.year ? `Year ${person.year}` : undefined].filter(Boolean);
  return parts.join(' · ');
}

export function PersonRow({
  person,
  subtitle,
  action,
  className,
}: {
  person: Person;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 py-2.5', className)}>
      <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.name} seed={person.id} size="md" />
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[15px] font-semibold">
            <span className="truncate">{person.name}</span>
            {person.verified && <VerifiedMark />}
          </span>
          <span className="block truncate text-[13px] text-text-3">{subtitle ?? personMeta(person)}</span>
        </span>
      </Link>
      {action}
    </div>
  );
}
