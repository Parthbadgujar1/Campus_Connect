'use client';

import { useEffect, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { useAppState } from '@/lib/store';

/** Keeps <html data-theme / data-mode / data-text / data-motion> in sync with the Ambience choice. */
function AmbienceSync() {
  const theme = useAppState((s) => s.theme);
  const textSize = useAppState((s) => s.textSize);
  const reduceMotion = useAppState((s) => s.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (query.matches ? 'night' : 'day') : theme;
      root.dataset.theme = resolved;
      root.dataset.mode = resolved === 'night' || resolved === 'dusk' ? 'dark' : 'light';
    };
    apply();
    root.dataset.text = textSize;
    root.dataset.motion = reduceMotion ? 'reduce' : 'full';

    if (theme !== 'system') return;
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme, textSize, reduceMotion]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AmbienceSync />
      {children}
    </ToastProvider>
  );
}
