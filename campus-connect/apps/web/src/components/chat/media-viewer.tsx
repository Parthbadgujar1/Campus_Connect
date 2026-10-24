'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, Forward, X } from 'lucide-react';
import type { FileView } from '@/lib/api/types';
import { time, day } from '@/lib/live-time';

export interface ViewerItem {
  messageId: string;
  file: FileView;
  sender: string;
  caption: string | null;
  createdAt: string;
}

/** Full-screen photo and video viewer for a chat: swipe or use ←/→, Esc closes. */
export function MediaViewer({ items, start, onClose, onForward }: { items: ViewerItem[]; start: number; onClose: () => void; onForward?: (messageId: string) => void }) {
  const [index, setIndex] = useState(start);
  const touch = useRef<number | null>(null);
  const item = items[index];
  const go = (by: number) => setIndex((i) => Math.min(items.length - 1, Math.max(0, i + by)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!item || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Photo and video viewer">
      <header className="flex items-center gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.sender}</p>
          <p className="text-[12px] text-white/70">{day(item.createdAt)}, {time(item.createdAt)} · {index + 1} of {items.length}</p>
        </div>
        {onForward && <button type="button" onClick={() => onForward(item.messageId)} aria-label="Forward" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><Forward className="h-5 w-5" aria-hidden="true" /></button>}
        {item.file.url && (
          <a href={item.file.url} download={item.file.name} aria-label="Download" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><Download className="h-5 w-5" aria-hidden="true" /></a>
        )}
      </header>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2"
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? touch.current) - touch.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        {item.file.kind === 'video' ? (
          <video key={item.messageId} src={item.file.url ?? undefined} controls autoPlay playsInline className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.messageId} src={item.file.url ?? undefined} alt={item.caption ?? item.file.name} className="max-h-full max-w-full select-none object-contain" />
        )}
        {index > 0 && <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 md:grid"><ChevronLeft className="h-6 w-6" aria-hidden="true" /></button>}
        {index < items.length - 1 && <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 md:grid"><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>}
      </div>
      {item.caption && <p className="mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-[15px]">{item.caption}</p>}
      {items.length > 1 && (
        <div className="no-scrollbar flex justify-center gap-1.5 overflow-x-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {items.map((it, i) => (
            <button key={it.messageId} type="button" onClick={() => setIndex(i)} aria-label={`Show item ${i + 1}`} className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-white' : 'border-transparent opacity-60'}`}>
              {it.file.kind === 'video' ? <video src={it.file.url ?? undefined} preload="metadata" muted className="h-full w-full object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.file.thumbnailUrl ?? it.file.url ?? undefined} alt="" className="h-full w-full object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
