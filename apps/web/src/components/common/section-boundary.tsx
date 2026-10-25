'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Keeps one broken part of a screen from taking the rest down. If something inside throws while it is
 * drawn, only this part is replaced by a short note with a Try again button; everything around it keeps
 * working. Give it a `resetKey` (for example the page path) to start fresh when the person navigates.
 */
export class SectionBoundary extends Component<
  { children: ReactNode; label?: string; className?: string; compact?: boolean; resetKey?: string },
  { failed: boolean; key: string | undefined }
> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: { resetKey?: string }, state: { failed: boolean; key: string | undefined }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? 'section'}] could not be shown`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { label = 'This part', className, compact } = this.props;
    return (
      <div role="alert" className={cn('flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 text-[14px] text-text-2', compact ? 'py-2' : 'py-4', className)}>
        <span>{label} could not be shown right now.</span>
        <button type="button" onClick={() => this.setState({ failed: false })} className="shrink-0 rounded-full bg-accent px-3 py-1 text-[13px] font-semibold text-accent-ink">
          Try again
        </button>
      </div>
    );
  }
}
