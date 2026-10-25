'use client';

import { useEffect, type ReactNode } from 'react';
import { MotionProvider } from '@/components/motion';
import { ToastProvider } from '@/components/ui/toast';
import { SessionProvider } from '@/lib/session';
import { useAppState } from '@/lib/store';

/** Keeps <html data-theme / data-mode / data-text / data-font / data-motion> in sync with the Ambience choice. */
function AmbienceSync() {
  const theme = useAppState((s) => s.theme);
  const textSize = useAppState((s) => s.textSize);
  const font = useAppState((s) => s.font);
  const reduceMotion = useAppState((s) => s.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (query.matches ? 'night' : 'pro') : theme;
      root.dataset.theme = resolved;
      root.dataset.mode = resolved === 'night' ? 'dark' : 'light';
    };
    apply();
    root.dataset.text = textSize;
    root.dataset.font = font;
    root.dataset.motion = reduceMotion ? 'reduce' : 'full';

    if (theme !== 'system') return;
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme, textSize, font, reduceMotion]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider>
        <AmbienceSync />
        <MotionProvider>{children}</MotionProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
