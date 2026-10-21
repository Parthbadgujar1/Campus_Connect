import Link from 'next/link';
import type { PersonSummary } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { Avatar, VerifiedMark } from './avatar';

const PX = { xs: 24, sm: 36, md: 44, lg: 64, xl: 96 } as const;

/** A person's photo when they have one, otherwise the initials orb. */
export function PersonAvatar({ person, size = 'md', className, link = false }: { person: Pick<PersonSummary, 'id' | 'displayName' | 'avatarUrl' | 'username'> | null; size?: keyof typeof PX; className?: string; link?: boolean }) {
  const name = person?.displayName ?? 'Deleted user';
  const face = person?.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.avatarUrl} alt={name} width={PX[size]} height={PX[size]} loading="lazy" className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: PX[size], height: PX[size] }} />
  ) : (
    <Avatar name={name} seed={person?.id} size={size} className={className} />
  );
  if (!link || !person || person.username === 'deleted') return face;
  return (
    <Link href={`/profile/${person.username}`} aria-label={`View ${name}`} className="press shrink-0 rounded-full">
      {face}
    </Link>
  );
}

export function PersonName({ person, className }: { person: Pick<PersonSummary, 'displayName' | 'username' | 'isVerified'> | null; className?: string }) {
  if (!person || person.username === 'deleted') return <span className={cn('font-semibold text-text-3', className)}>Deleted user</span>;
  return (
    <Link href={`/profile/${person.username}`} className={cn('inline-flex min-w-0 items-center gap-1 font-semibold hover:underline', className)}>
      <span className="truncate">{person.displayName}</span>
      {person.isVerified && <VerifiedMark />}
    </Link>
  );
}
