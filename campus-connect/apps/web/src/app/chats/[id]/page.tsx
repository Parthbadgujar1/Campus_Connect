'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChatAvatar } from '@/components/chat/chat-list';
import { ConversationView, type ConversationMode } from '@/components/chat/conversation';
import { closeCircle, getChat, getMessages } from '@/data/chats';

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  const chat = getChat(id);

  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-display text-xl font-semibold">This conversation is not available</p>
        <Link href="/chats" className="text-sm font-semibold text-accent">
          Back to chats
        </Link>
      </div>
    );
  }

  const other = chat.kind === 'direct' ? chat.memberIds.find((m) => m !== 'me') : undefined;
  const activity = other ? closeCircle.find((c) => c.personId === other)?.activity : undefined;
  const mode: ConversationMode = chat.kind === 'direct' ? 'direct' : chat.kind === 'anonymous' ? 'anonymous' : 'group';

  return (
    <ConversationView
      key={chat.id}
      id={chat.id}
      title={chat.title}
      subtitle={chat.online ? `Active now${activity ? ` · ${activity}` : ''}` : chat.subtitle}
      avatar={<ChatAvatar chat={chat} size="sm" />}
      initialMessages={getMessages(chat.id)}
      mode={mode}
      memberIds={chat.memberIds}
      backHref="/chats"
      replyFrom={mode === 'direct' ? other : undefined}
      unread={chat.unread}
    />
  );
}
