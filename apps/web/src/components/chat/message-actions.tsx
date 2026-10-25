'use client';

import type { LucideIcon } from 'lucide-react';
import { CheckSquare, Copy, CornerUpLeft, EyeOff, Flag, Forward, Pencil, Undo2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import type { MessageView } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Action {
  label: string;
  hint?: string;
  icon: LucideIcon;
  danger?: boolean;
  run: () => void;
}

/**
 * What you can do with one message, in one place: opened by tapping the "⋯" beside it, by pressing
 * and holding it on a phone, or by right-clicking it. Mirrors the long-press menu of WhatsApp.
 */
export function MessageActionSheet({
  m,
  canEdit,
  canUnsend,
  onClose,
  onReact,
  onReply,
  onCopy,
  onForward,
  onEdit,
  onSelect,
  onDeleteForMe,
  onUnsend,
  onReport,
}: {
  m: MessageView;
  canEdit: boolean;
  canUnsend: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onEdit: () => void;
  onSelect: () => void;
  onDeleteForMe: () => void;
  onUnsend: () => void;
  onReport: () => void;
}) {
  const done = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const copyable = Boolean(m.body) && m.kind !== 'poll' && m.kind !== 'plan';
  const forwardable = ['text', 'image', 'file', 'voice', 'video'].includes(m.kind);
  const actions: Action[] = [
    { label: 'Reply', icon: CornerUpLeft, run: done(onReply) },
    ...(copyable ? [{ label: 'Copy', icon: Copy, run: done(onCopy) }] : []),
    ...(forwardable ? [{ label: 'Forward', icon: Forward, run: done(onForward) }] : []),
    ...(canEdit ? [{ label: 'Edit', hint: 'Within 15 minutes of sending', icon: Pencil, run: done(onEdit) }] : []),
    { label: 'Select', hint: 'Pick several messages', icon: CheckSquare, run: done(onSelect) },
    { label: 'Delete for me', hint: 'Others still see it', icon: EyeOff, run: done(onDeleteForMe) },
    ...(canUnsend ? [{ label: 'Unsend', hint: 'Delete for everyone', icon: Undo2, danger: true, run: done(onUnsend) }] : []),
    ...(!m.isMine ? [{ label: 'Report', icon: Flag, danger: true, run: done(onReport) }] : []),
  ];
  return (
    <Sheet open onClose={onClose} title="Message">
      <div className="space-y-3">
        <div className="flex justify-between gap-1 rounded-2xl bg-surface-2 p-1.5" role="group" aria-label="React">
          {REACTIONS.map((e) => (
            <button key={e} type="button" onClick={done(() => onReact(e))} aria-label={`React ${e}`} className="press grid h-11 flex-1 place-items-center rounded-xl text-[22px] hover:bg-surface">
              {e}
            </button>
          ))}
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {actions.map((a) => (
            <li key={a.label}>
              <button type="button" onClick={a.run} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2', a.danger && 'text-danger')}>
                <a.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.label}</span>
                  {a.hint && <span className="block text-[12px] text-text-3">{a.hint}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
