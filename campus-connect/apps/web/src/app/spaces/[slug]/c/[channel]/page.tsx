'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Hash, Headphones, Megaphone } from 'lucide-react';
import { ConversationView } from '@/components/chat/conversation';
import { EmptyState } from '@/components/ui/layout';
import { getSpace, roomMessages } from '@/data/spaces';
import { students } from '@/data/people';
import { gradientFor, initials } from '@/lib/visuals';
import { cn } from '@/lib/utils';

// A space's text room. Desktop keeps the room list beside the conversation.
export default function SpaceRoomPage() {
  const { slug, channel: channelId } = useParams<{ slug: string; channel: string }>();
  const space = getSpace(slug);
  const channel = space?.channels.find((c) => c.id === channelId);

  if (!space || !channel) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState icon={Hash} title="This room doesn’t exist" action={<Link href="/spaces" className="text-sm font-semibold text-accent">Back to spaces</Link>} />
      </div>
    );
  }

  const Icon = channel.kind === 'announcements' ? Megaphone : Hash;

  return (
    <div className="flex h-dvh min-h-0 min-w-0 overflow-hidden md:gap-4 md:py-4 md:pr-4">
      <aside className="hidden min-h-0 w-[300px] shrink-0 flex-col overflow-y-auto rounded-3xl border border-border bg-surface p-4 shadow-card md:flex">
        <Link href={`/spaces/${space.slug}`} className="press flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl font-display font-semibold text-white" style={{ background: gradientFor(`${space.seed}-icon`) }}>
            {initials(space.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[17px] font-semibold">{space.name}</span>
            <span className="block text-xs text-success">{space.online} online</span>
          </span>
        </Link>
        <p className="mt-5 px-2 text-[11px] font-bold uppercase tracking-wider text-text-3">Text rooms</p>
        <nav className="font-sans mt-1.5 space-y-0.5" aria-label="Rooms">
          {space.channels.map((c) => {
            const ChannelIcon = c.kind === 'announcements' ? Megaphone : Hash;
            const active = c.id === channel.id;
            return (
              <Link
                key={c.id}
                href={`/spaces/${space.slug}/c/${c.id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  active ? 'bg-accent-soft text-accent-soft-ink' : 'text-text-2 hover:bg-surface-2 hover:text-text',
                )}
              >
                <ChannelIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{c.name}</span>
                {c.unread > 0 && !active && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
              </Link>
            );
          })}
        </nav>
        <p className="mt-5 px-2 text-[11px] font-bold uppercase tracking-wider text-text-3">Voice lounges</p>
        <div className="mt-1.5 space-y-0.5">
          {space.voice.map((room) => (
            <Link key={room.id} href={`/spaces/${space.slug}?tab=rooms`} className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold text-text-2 hover:bg-surface-2 hover:text-text">
              <Headphones className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{room.name}</span>
              {room.memberIds.length > 0 && <span className="text-xs text-success">{room.memberIds.length}</span>}
            </Link>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-3xl md:border md:border-border md:bg-surface md:shadow-card">
        <ConversationView
          key={`${space.slug}-${channel.id}`}
          id={`${space.slug}-${channel.id}`}
          title={`# ${channel.name}`}
          subtitle={channel.topic}
          avatar={
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          }
          initialMessages={roomMessages(space, channel.id)}
          mode="channel"
          memberIds={['me', ...students.slice(0, 6).map((p) => p.id)]}
          backHref={`/spaces/${space.slug}?tab=rooms`}
          placeholder={`Message #${channel.name}`}
        />
      </section>
    </div>
  );
}
