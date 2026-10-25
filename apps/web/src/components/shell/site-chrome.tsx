'use client';

// Small site-wide helpers: skip link, reading progress, back to top, offline notice.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowUp, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** First focusable element: lets keyboard and screen-reader users jump past the navigation. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="font-sans fixed left-3 top-3 z-[100] -translate-y-20 rounded-full bg-text px-4 py-2.5 text-sm font-semibold text-bg shadow-float transition-transform focus:translate-y-0"
    >
      Skip to content
    </a>
  );
}

function useScroll() {
  const [state, setState] = useState({ progress: 0, y: 0 });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setState({ progress: max > 0 ? Math.min(1, window.scrollY / max) : 0, y: window.scrollY });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return state;
}

/** A thin bar at the very top showing how far down the page you are. */
export function ScrollProgress() {
  const { progress } = useScroll();
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden">
      <div className="h-full origin-left bg-accent transition-transform duration-150 ease-out" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

/** Appears after scrolling down a screen or two. */
export function BackToTop({ withTabBar = true }: { withTabBar?: boolean }) {
  const { y } = useScroll();
  const visible = y > 900;
  return (
    <button
      type="button"
      onClick={() => {
        const reduce = document.documentElement.dataset.motion === 'reduce';
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        document.getElementById('main-content')?.focus({ preventScroll: true });
      }}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        'press fixed right-4 z-50 grid h-11 w-11 place-items-center rounded-full border border-border bg-[var(--surface-solid)] text-text shadow-float transition-[opacity,transform] duration-300 print:hidden md:bottom-6 md:right-6',
        withTabBar ? 'bottom-[calc(76px+env(safe-area-inset-bottom))]' : 'bottom-6',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** A calm notice while the device is offline; things you already loaded stay readable. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="font-sans sticky top-0 z-[55] flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-center text-[13px] font-semibold text-warning">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      You are offline. What is already loaded still works; new changes will need a connection.
    </div>
  );
}
