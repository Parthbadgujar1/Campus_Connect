'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChatList } from '@/components/chat/chat-list';
import { cn } from '@/lib/utils';

// Phones: the list and a conversation are separate screens. Desktop: side by side.
export default function ChatsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const threadOpen = pathname !== '/chats';

  return (
    <div className="flex h-dvh min-h-0 min-w-0 overflow-hidden md:gap-4 md:py-4 md:pr-4">
      <section
        className={cn(
          'min-h-0 w-full flex-col md:flex md:w-[380px] md:shrink-0 md:rounded-3xl md:border md:border-border md:bg-surface md:shadow-card',
          threadOpen ? 'hidden' : 'flex',
        )}
      >
        <ChatList />
      </section>
      <section
        className={cn(
          'min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-3xl md:border md:border-border md:bg-surface md:shadow-card',
          threadOpen ? 'flex' : 'hidden md:flex',
        )}
      >
        {children}
      </section>
    </div>
  );
}
