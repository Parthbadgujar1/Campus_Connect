import { MessagesSquare } from 'lucide-react';

// Desktop placeholder. On phones the list fills the screen, so this is hidden there.
export default function ChatsIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="orb grid h-16 w-16 place-items-center rounded-full text-accent-ink">
        <MessagesSquare className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="font-display text-2xl font-semibold">Pick a conversation</p>
      <p className="max-w-xs text-sm text-text-3">
        Friends, study groups, class chats, spaces and anonymous rooms, all in calm lanes instead of bubbles.
      </p>
    </div>
  );
}
