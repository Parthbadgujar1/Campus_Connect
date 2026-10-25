'use client';

import { useParams } from 'next/navigation';
import { LiveConversation } from '@/components/chat/live-conversation';

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  return <LiveConversation key={id} chatId={id} />;
}
