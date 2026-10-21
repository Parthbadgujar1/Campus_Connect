'use client';

// Loading, error and confirmation building blocks used by every screen:
//   Skeleton*     placeholders shaped like the content, shown while it loads
//   ErrorState    a clear explanation plus "Try again", chosen from the API error code
//   FormAlert     an error or success message at the top of a form (announced to screen readers)
//   LoadMore      the "Load more" button for paged lists
//   ConfirmDialog asks before anything that cannot be undone

import { useEffect, useId, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Lock, RefreshCw, SearchX, ServerCrash, WifiOff } from 'lucide-react';
import { isApiError } from '@/lib/api/client';
import { Button } from './button';
import { Input } from './fields';
import { Sheet } from './sheet';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-xl bg-surface-2', className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('block space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </span>
  );
}

type SkeletonVariant = 'post' | 'row' | 'card' | 'message' | 'tile';

function SkeletonItem({ variant }: { variant: SkeletonVariant }) {
  if (variant === 'row') {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    );
  }
  if (variant === 'message') {
    return (
      <div className="flex gap-2 py-1.5 even:justify-end">
        <Skeleton className="h-10 w-2/3 max-w-xs rounded-2xl" />
      </div>
    );
  }
  if (variant === 'tile') {
    return <Skeleton className="h-28 rounded-2xl" />;
  }
  if (variant === 'card') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={3} className="mt-4" />
    </div>
  );
}

/** A loading list shaped like the real one. Announced once as "Loading" to screen readers. */
export function SkeletonList({ count = 4, variant = 'post', className, label = 'Loading' }: { count?: number; variant?: SkeletonVariant; className?: string; label?: string }) {
  const grid = variant === 'card' || variant === 'tile';
  return (
    <div role="status" aria-live="polite" className={cn(grid ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : variant === 'row' ? 'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface' : 'space-y-3', className)}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonItem key={i} variant={variant} />
      ))}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />
      {label && <span className="text-sm text-text-3">{label}</span>}
    </span>
  );
}

function describe(error: unknown): { icon: typeof AlertTriangle; title: string; message: string; retry: boolean } {
  if (isApiError(error)) {
    if (error.code === 'OFFLINE') return { icon: WifiOff, title: 'You are offline', message: error.message, retry: true };
    if (error.code === 'NETWORK' || error.code === 'SERVICE_UNAVAILABLE' || error.code === 'OVERLOADED')
      return { icon: ServerCrash, title: 'We could not load this', message: error.message, retry: true };
    if (error.code === 'MODULE_UNAVAILABLE' || error.code === 'FEATURE_DISABLED')
      return { icon: ServerCrash, title: 'Taking a short break', message: error.message, retry: true };
    if (error.status === 404) return { icon: SearchX, title: 'Not found', message: error.message, retry: false };
    if (error.status === 403) return { icon: Lock, title: 'No access', message: error.message, retry: false };
    if (error.status === 429) return { icon: AlertTriangle, title: 'Slow down a little', message: error.message, retry: true };
    return { icon: AlertTriangle, title: 'Something went wrong', message: error.message, retry: true };
  }
  return { icon: AlertTriangle, title: 'Something went wrong', message: 'Please try again in a moment.', retry: true };
}

/** Explains what went wrong in plain words and offers a retry when it may help. */
export function ErrorState({ error, onRetry, className, compact = false }: { error: unknown; onRetry?: () => void; className?: string; compact?: boolean }) {
  const d = describe(error);
  const Icon = d.icon;
  const requestId = isApiError(error) ? error.requestId : null;
  return (
    <div role="alert" className={cn('rounded-2xl border border-border bg-surface text-center', compact ? 'p-4' : 'px-6 py-10', className)}>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-3 text-[17px] font-semibold">{d.title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[14px] text-text-2">{d.message}</p>
      {d.retry && onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
      )}
      {requestId && <p className="font-mono mt-3 text-[11px] text-text-3">Reference: {requestId}</p>}
    </div>
  );
}

/** Error or success message for a form. Field errors are shown next to their fields instead. */
export function FormAlert({ tone = 'error', children, className }: { tone?: 'error' | 'success' | 'info'; children: ReactNode; className?: string }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'font-sans flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-medium',
        tone === 'error' && 'bg-danger-soft text-danger',
        tone === 'success' && 'bg-success-soft text-success',
        tone === 'info' && 'bg-info-soft text-info',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Text under a field when it has an error; link it with aria-describedby. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="font-sans text-[13px] font-medium text-danger">
      {message}
    </p>
  );
}

export function LoadMore({ hasMore, loading, onClick, label = 'Load more' }: { hasMore: boolean; loading: boolean; onClick: () => void; label?: string }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center py-4">
      <Button variant="secondary" onClick={onClick} disabled={loading} aria-busy={loading}>
        {loading ? <Spinner /> : null}
        {loading ? 'Loading…' : label}
      </Button>
    </div>
  );
}

/**
 * Asks before an action. For permanent actions pass `requireText` (the person types it) and/or
 * `requirePassword`; the confirm button stays disabled until they have.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  requireText,
  requirePassword = false,
  pending = false,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: { password: string; text: string }) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireText?: string;
  requirePassword?: boolean;
  pending?: boolean;
  error?: string | null;
  children?: ReactNode;
}) {
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const textId = useId();
  const passwordId = useId();
  useEffect(() => {
    if (!open) {
      setText('');
      setPassword('');
    }
  }, [open]);
  const ready = (!requireText || text === requireText) && (!requirePassword || password.length > 0) && !pending;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!ready} aria-busy={pending} onClick={() => onConfirm({ password, text })}>
            {pending && <Spinner />}
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onConfirm({ password, text });
        }}
      >
        {children}
        {error && <FormAlert>{error}</FormAlert>}
        {requirePassword && (
          <div className="space-y-1.5">
            <label htmlFor={passwordId} className="text-sm font-semibold">
              Your password
            </label>
            <Input id={passwordId} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {requireText && (
          <div className="space-y-1.5">
            <label htmlFor={textId} className="text-sm font-semibold">
              Type <span className="font-mono rounded bg-surface-2 px-1.5 py-0.5">{requireText}</span> to confirm
            </label>
            <Input id={textId} autoComplete="off" autoCapitalize="characters" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
