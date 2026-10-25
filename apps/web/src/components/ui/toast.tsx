'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastFn = (message: string) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((text: string) => {
    setCurrent({ id: Date.now(), text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCurrent(null), 2600);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <div
          key={current.id}
          role="status"
          aria-live="polite"
          className="animate-pop pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex justify-center px-4 md:bottom-8"
        >
          <div className="glass max-w-sm rounded-full px-5 py-3 text-center text-sm font-semibold text-text shadow-float">
            {current.text}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
